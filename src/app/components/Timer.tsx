'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { prepareAudioOnce } from '@/lib/client/audio';
import { browserAudioPreferenceStorage, DEFAULT_AMBIENT_MUTED, DEFAULT_AMBIENT_VOLUME, readAudioPreferences, writeAudioPreferences } from '@/lib/client/audio-preferences';
import { clientId, hostTokenKey } from '@/lib/client/identity';
import { fetchPublicRoom, sendCommand, sendHeartbeat } from '@/lib/client/rooms';
import { isCredentialContextCurrent, mergeAuthenticatedSnapshot, shouldApplyRequestFailure, shouldRevokeHostToken, shouldStoreIssuedHostToken, snapshotAcceptance, type SnapshotWatermark } from '@/lib/client/snapshot-order';
import type { PublicRoomSnapshot, RoomSnapshot, TimerCommand, TimerPhase } from '@/lib/timer/types';
import ShareActions from './ShareActions';
import DiscordWebhookSettings from './DiscordWebhookSettings';
import DiscordActivityPanel from './DiscordActivityPanel';
import { HostTransferBadge, HostTransferOffer } from './HostTransfer';
import VolumeControl from './VolumeControl';

const phaseLabels: Record<TimerPhase, string> = { focus: '集中', shortBreak: '小休憩', longBreak: '長休憩' };

export default function Timer({ roomId }: { roomId: string }) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'reconnecting' | 'missing'>('connecting');
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(DEFAULT_AMBIENT_MUTED);
  const [volume, setVolume] = useState(DEFAULT_AMBIENT_VOLUME);
  const [audioPreferencesLoaded, setAudioPreferencesLoaded] = useState(false);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [currentClientId, setCurrentClientId] = useState('');
  const [membershipReady, setMembershipReady] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const tokenRef = useRef<string | null>(null);
  const clientRef = useRef('');
  const serverOffsetRef = useRef(0);
  const latestTimerSnapshotRef = useRef<SnapshotWatermark | null>(null);
  const latestAuthenticatedSnapshotRef = useRef<SnapshotWatermark | null>(null);
  const acceptedResponseRef = useRef(0);
  const heartbeatSuccessRef = useRef(0);
  const previousPhaseRef = useRef<TimerPhase | null>(null);
  const focusAudioRef = useRef<HTMLAudioElement>(null);
  const breakAudioRef = useRef<HTMLAudioElement>(null);
  const interactedRef = useRef(false);

  useEffect(() => {
    const preferences = readAudioPreferences(browserAudioPreferenceStorage());
    const restore = window.setTimeout(() => {
      setVolume(preferences.volume);
      setIsMuted(preferences.muted);
      setAudioPreferencesLoaded(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (!audioPreferencesLoaded) return;
    writeAudioPreferences(browserAudioPreferenceStorage(), { volume, muted: isMuted });
  }, [audioPreferencesLoaded, isMuted, volume]);

  const acceptSnapshot = useCallback((next: RoomSnapshot | PublicRoomSnapshot, requestToken?: string | null, issuedHostToken?: string | null) => {
    const previousGeneration = latestTimerSnapshotRef.current?.generation ?? null;
    const generationChanged = previousGeneration !== null && next.generation > previousGeneration;
    if (generationChanged) {
      latestAuthenticatedSnapshotRef.current = null;
      previousPhaseRef.current = null;
    }
    const watermark = {
      generation: next.generation,
      revision: next.revision,
      version: next.state.version,
      serverNow: next.state.serverNow,
    };
    const authenticated = 'role' in next;
    const orderedAcceptance = snapshotAcceptance(
      latestTimerSnapshotRef.current,
      latestAuthenticatedSnapshotRef.current,
      watermark,
      authenticated,
    );
    const credentialContextCurrent = isCredentialContextCurrent(tokenRef.current, requestToken);
    // Preserve a newly issued credential even if this snapshot lost a revision race to a later heartbeat.
    const issuedTokenStored = authenticated
      && Boolean(issuedHostToken)
      && shouldStoreIssuedHostToken(tokenRef.current, requestToken, previousGeneration, next.generation);
    const acceptance = {
      ...orderedAcceptance,
      metadata: orderedAcceptance.metadata && credentialContextCurrent,
    };
    if (acceptance.timer) latestTimerSnapshotRef.current = watermark;
    if (acceptance.metadata) latestAuthenticatedSnapshotRef.current = watermark;
    if (acceptance.timer || acceptance.metadata) acceptedResponseRef.current += 1;
    const receivedAt = Date.now();
    if (issuedTokenStored && issuedHostToken) {
      sessionStorage.setItem(hostTokenKey(roomId), issuedHostToken);
      tokenRef.current = issuedHostToken;
      setHostToken(issuedHostToken);
    }
    if (authenticated && acceptance.metadata && shouldRevokeHostToken(tokenRef.current, requestToken, next.role)) {
      sessionStorage.removeItem(hostTokenKey(roomId));
      tokenRef.current = null;
      setHostToken(null);
    }
    if (authenticated && (acceptance.timer || acceptance.metadata)) {
      setSnapshot((current) => mergeAuthenticatedSnapshot(current, next, acceptance));
    } else if (!authenticated && acceptance.timer) {
      setSnapshot((current) => current && current.generation === next.generation
        ? {
            ...next,
            role: current.role,
            participants: current.participants,
            hostTransfer: current.hostTransfer,
          }
        : { ...next, role: 'participant' });
    }
    setConnection('connected');
    setError('');
    if (!acceptance.timer) return issuedTokenStored;
    serverOffsetRef.current = next.state.serverNow - receivedAt;
    setRemaining(next.state.remainingSeconds);
    if (previousPhaseRef.current && previousPhaseRef.current !== next.state.phase) {
      const title = next.state.phase === 'focus' ? '集中を始めよう' : '休憩の時間です';
      if (Notification.permission === 'granted') new Notification(title, { body: `ルーム「${roomId}」のタイマーが切り替わりました。` });
    }
    previousPhaseRef.current = next.state.phase;
    return issuedTokenStored;
  }, [roomId]);

  useEffect(() => {
    latestTimerSnapshotRef.current = null;
    latestAuthenticatedSnapshotRef.current = null;
    acceptedResponseRef.current = 0;
    heartbeatSuccessRef.current = 0;
    const notificationTimer = window.setTimeout(() => {
      setNotificationPermission('Notification' in window ? Notification.permission : 'unsupported');
      setMembershipReady(false);
    }, 0);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const transferredToken = fragment.get('hostToken');
    if (transferredToken) {
      sessionStorage.setItem(hostTokenKey(roomId), transferredToken);
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    tokenRef.current = transferredToken ?? sessionStorage.getItem(hostTokenKey(roomId));
    setHostToken(tokenRef.current);
    clientRef.current = clientId();
    setCurrentClientId(clientRef.current);
    const controller = new AbortController();
    let failures = 0;

    const sync = async () => {
      if (document.hidden) return;
      const acceptedAtStart = acceptedResponseRef.current;
      try {
        acceptSnapshot(await fetchPublicRoom(roomId, controller.signal)); failures = 0;
      } catch (caught) {
        if (controller.signal.aborted) return;
        if (!shouldApplyRequestFailure(acceptedAtStart, acceptedResponseRef.current)) return;
        failures += 1;
        const message = caught instanceof Error ? caught.message : '同期できませんでした。';
        if (message.includes('見つかりません')) {
          latestTimerSnapshotRef.current = null;
          latestAuthenticatedSnapshotRef.current = null;
          previousPhaseRef.current = null;
          setSnapshot(null);
          setConnection('missing');
        } else setConnection('reconnecting');
        setError(message);
      }
    };
    const beat = async () => {
      const acceptedAtStart = acceptedResponseRef.current;
      const heartbeatSuccessAtStart = heartbeatSuccessRef.current;
      const requestToken = tokenRef.current;
      try {
        const result = await sendHeartbeat(roomId, clientRef.current, requestToken);
        const issuedTokenStored = acceptSnapshot(result.snapshot, requestToken, result.hostToken);
        if (issuedTokenStored && result.hostToken) {
          const confirmation = await sendHeartbeat(roomId, clientRef.current, result.hostToken);
          acceptSnapshot(confirmation.snapshot, result.hostToken, confirmation.hostToken);
        }
        heartbeatSuccessRef.current += 1;
        setMembershipReady(true);
        failures = 0;
      }
      catch {
        if (heartbeatSuccessRef.current === heartbeatSuccessAtStart) setMembershipReady(false);
        if (!shouldApplyRequestFailure(acceptedAtStart, acceptedResponseRef.current)) return;
        failures += 1;
        if (failures > 1) setConnection('reconnecting');
      }
    };
    void beat();
    const syncTimer = window.setInterval(sync, 2_000);
    const beatTimer = window.setInterval(beat, 10_000);
    const refresh = () => { setConnection('connecting'); void sync(); void beat(); };
    const onVisibilityChange = () => { if (!document.hidden) refresh(); };
    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', refresh);
    return () => { controller.abort(); window.clearTimeout(notificationTimer); window.clearInterval(syncTimer); window.clearInterval(beatTimer); window.removeEventListener('visibilitychange', onVisibilityChange); window.removeEventListener('online', refresh); };
  }, [acceptSnapshot, roomId]);

  useEffect(() => {
    if (!snapshot) return;
    const update = () => {
      const state = snapshot.state;
      if (!state.isRunning || state.phaseEndsAt === null) setRemaining(state.pausedRemainingSeconds);
      else setRemaining(Math.max(0, Math.ceil((state.phaseEndsAt - (Date.now() + serverOffsetRef.current)) / 1000)));
    };
    update(); const timer = window.setInterval(update, 250); return () => window.clearInterval(timer);
  }, [snapshot]);

  useEffect(() => {
    const focus = focusAudioRef.current; const rest = breakAudioRef.current;
    if (!focus || !rest) return;
    focus.muted = isMuted; rest.muted = isMuted; focus.volume = volume; rest.volume = volume;
    if (!interactedRef.current || !snapshot?.state.isRunning) { focus.pause(); rest.pause(); return; }
    const active = snapshot.state.phase === 'focus' ? focus : rest;
    const inactive = snapshot.state.phase === 'focus' ? rest : focus;
    inactive.pause(); void active.play().catch(() => undefined);
  }, [isMuted, snapshot?.state.isRunning, snapshot?.state.phase, volume]);

  async function command(value: TimerCommand) {
    if (!snapshot || !membershipReady || connection !== 'connected') return;
    setError('');
    const requestToken = tokenRef.current;
    try { acceptSnapshot(await sendCommand(roomId, value, clientRef.current, requestToken), requestToken); }
    catch (caught) { setError(caught instanceof Error ? caught.message : '操作に失敗しました。'); }
  }

  async function enableNotifications() {
    if ('Notification' in window) setNotificationPermission(await Notification.requestPermission());
  }

  function receiveHostToken(token: string) {
    sessionStorage.setItem(hostTokenKey(roomId), token);
    tokenRef.current = token;
    setHostToken(token);
  }

  const interact = () => {
    interactedRef.current = prepareAudioOnce(interactedRef.current, [focusAudioRef.current, breakAudioRef.current]);
  };
  const role = snapshot?.role;
  const running = snapshot?.state.isRunning ?? false;
  const phase = snapshot?.state.phase ?? 'focus';
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');

  if (connection === 'missing') {
    return <main className="room-shell"><section className="panel empty"><p className="eyebrow">ルームが見つかりません</p><h1>{roomId}</h1><p className="lead">期限切れか、まだ作成されていないルームだよ。</p><Link className="button button-primary" href="/">新しいルームを作る</Link></section></main>;
  }

  return (
    <main className={`room-shell phase-${phase}`}>
      <nav className="room-nav"><Link href="/" className="brand">Pomodoro Together</Link><div className="flex items-center gap-2"><span className={`status ${connection}`}>{connection === 'connected' ? '同期中' : connection === 'connecting' ? '接続中' : '再接続中'}</span>{snapshot?.role === 'host' && currentClientId ? <HostTransferBadge roomId={roomId} clientId={currentClientId} snapshot={snapshot} token={hostToken} onUpdate={acceptSnapshot} /> : <span className="badge">参加者</span>}</div></nav>
      <section className="timer-card" aria-live="polite">
        {snapshot && <DiscordActivityPanel roomId={roomId} state={snapshot.state} />}
        {snapshot && currentClientId && <HostTransferOffer roomId={roomId} clientId={currentClientId} snapshot={snapshot} onUpdate={acceptSnapshot} onToken={receiveHostToken} />}
        <div className="timer-head"><div><p className="eyebrow">{phaseLabels[phase]}</p><h1>{roomId}</h1></div><VolumeControl volume={volume} setVolume={setVolume} isMuted={isMuted} setIsMuted={setIsMuted} onInteraction={interact} /></div>
        <div className="time" role="timer" aria-label={`残り${Math.floor(remaining / 60)}分${remaining % 60}秒`}>{minutes}<span>:</span>{seconds}</div>
        <p className="cycle">🍅 {snapshot?.state.completedPomodoros ?? 0} 完了 ・ 次の長休憩まで {snapshot ? snapshot.state.longBreakEvery - snapshot.state.cyclePosition : '–'} セット</p>
        <div className="controls">
          <button className="icon-button" onClick={() => void command('reset')} disabled={!snapshot || !membershipReady || connection !== 'connected'} aria-label="タイマーをリセット">↺</button>
          <button className="play-button" onClick={() => { interact(); void command(running ? 'pause' : 'start'); }} disabled={!snapshot || !membershipReady || connection !== 'connected'} aria-label={running ? 'タイマーを一時停止' : 'タイマーを開始'}>{running ? 'Ⅱ' : '▶'}</button>
          <button className="icon-button" onClick={() => void command('skip')} disabled={!snapshot || !membershipReady || connection !== 'connected'} aria-label="次のフェーズへ進む">↠</button>
        </div>
        {snapshot && !membershipReady && <p className="hint">参加状態を確認しています。接続が完了すると操作できます。</p>}
        {role === 'participant' && membershipReady && <p className="hint">タイマーは全員で操作できます。連携設定とホスト移譲はホスト専用です。</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {snapshot && <ShareActions roomId={roomId} state={snapshot.state} />}
        {snapshot?.role === 'host' && snapshot.integrations.discordWebhookAvailable && <DiscordWebhookSettings roomId={roomId} token={hostToken} connected={snapshot.integrations.discordWebhookConnected} onUpdate={acceptSnapshot} />}
        <div className="room-actions">
          <span>👥 {snapshot?.participantCount ?? 0}人</span>
          {notificationPermission === 'default' && <button type="button" onClick={() => void enableNotifications()}>通知を有効化</button>}
        </div>
      </section>
      <audio ref={focusAudioRef} src="/music/work.mp3" loop preload="none" />
      <audio ref={breakAudioRef} src="/music/break.mp3" loop preload="none" />
    </main>
  );
}

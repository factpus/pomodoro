'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clientId, hostTokenKey } from '@/lib/client/identity';
import { fetchPublicRoom, sendCommand, sendHeartbeat } from '@/lib/client/rooms';
import type { PublicRoomSnapshot, RoomSnapshot, TimerCommand, TimerPhase } from '@/lib/timer/types';
import ShareActions from './ShareActions';
import DiscordWebhookSettings from './DiscordWebhookSettings';
import DiscordActivityPanel from './DiscordActivityPanel';
import VolumeControl from './VolumeControl';

const phaseLabels: Record<TimerPhase, string> = { focus: '集中', shortBreak: '小休憩', longBreak: '長休憩' };

export default function Timer({ roomId }: { roomId: string }) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'reconnecting' | 'missing'>('connecting');
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0.35);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const tokenRef = useRef<string | null>(null);
  const clientRef = useRef('');
  const serverOffsetRef = useRef(0);
  const previousPhaseRef = useRef<TimerPhase | null>(null);
  const focusAudioRef = useRef<HTMLAudioElement>(null);
  const breakAudioRef = useRef<HTMLAudioElement>(null);
  const interactedRef = useRef(false);

  const acceptSnapshot = useCallback((next: RoomSnapshot | PublicRoomSnapshot) => {
    const receivedAt = Date.now();
    serverOffsetRef.current = next.state.serverNow - receivedAt;
    setSnapshot((current) => ({
      ...next,
      role: 'role' in next ? next.role : (current?.role ?? 'participant'),
    }));
    setRemaining(next.state.remainingSeconds);
    setConnection('connected');
    setError('');
    if (previousPhaseRef.current && previousPhaseRef.current !== next.state.phase) {
      const title = next.state.phase === 'focus' ? '集中を始めよう' : '休憩の時間です';
      if (Notification.permission === 'granted') new Notification(title, { body: `ルーム「${roomId}」のタイマーが切り替わりました。` });
    }
    previousPhaseRef.current = next.state.phase;
  }, [roomId]);

  useEffect(() => {
    const notificationTimer = window.setTimeout(() => {
      setNotificationPermission('Notification' in window ? Notification.permission : 'unsupported');
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
    const controller = new AbortController();
    let failures = 0;

    const sync = async () => {
      if (document.hidden) return;
      try {
        acceptSnapshot(await fetchPublicRoom(roomId, controller.signal)); failures = 0;
      } catch (caught) {
        if (controller.signal.aborted) return;
        failures += 1;
        const message = caught instanceof Error ? caught.message : '同期できませんでした。';
        if (message.includes('見つかりません')) setConnection('missing'); else setConnection('reconnecting');
        setError(message);
      }
    };
    const beat = async () => {
      try { acceptSnapshot(await sendHeartbeat(roomId, clientRef.current, tokenRef.current)); failures = 0; }
      catch { failures += 1; if (failures > 1) setConnection('reconnecting'); }
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
    if (!snapshot || snapshot.role !== 'host' || connection !== 'connected') return;
    setError('');
    try { acceptSnapshot(await sendCommand(roomId, value, clientRef.current, tokenRef.current)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : '操作に失敗しました。'); }
  }

  async function enableNotifications() {
    if ('Notification' in window) setNotificationPermission(await Notification.requestPermission());
  }

  const interact = () => { interactedRef.current = true; focusAudioRef.current?.load(); breakAudioRef.current?.load(); };
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
      <nav className="room-nav"><Link href="/" className="brand">Pomodoro Together</Link><div className="flex items-center gap-2"><span className={`status ${connection}`}>{connection === 'connected' ? '同期中' : connection === 'connecting' ? '接続中' : '再接続中'}</span><span className="badge">{role === 'host' ? 'ホスト' : '参加者'}</span></div></nav>
      <section className="timer-card" aria-live="polite">
        <DiscordActivityPanel />
        <div className="timer-head"><div><p className="eyebrow">{phaseLabels[phase]}</p><h1>{roomId}</h1></div><VolumeControl volume={volume} setVolume={setVolume} isMuted={isMuted} setIsMuted={setIsMuted} onInteraction={interact} /></div>
        <div className="time" role="timer" aria-label={`残り${Math.floor(remaining / 60)}分${remaining % 60}秒`}>{minutes}<span>:</span>{seconds}</div>
        <p className="cycle">🍅 {snapshot?.state.completedPomodoros ?? 0} 完了 ・ 次の長休憩まで {snapshot ? snapshot.state.longBreakEvery - snapshot.state.cyclePosition : '–'} セット</p>
        <div className="controls">
          <button className="icon-button" onClick={() => void command('reset')} disabled={role !== 'host' || connection !== 'connected'} aria-label="タイマーをリセット">↺</button>
          <button className="play-button" onClick={() => { interact(); void command(running ? 'pause' : 'start'); }} disabled={role !== 'host' || connection !== 'connected'} aria-label={running ? 'タイマーを一時停止' : 'タイマーを開始'}>{running ? 'Ⅱ' : '▶'}</button>
          <button className="icon-button" onClick={() => void command('skip')} disabled={role !== 'host' || connection !== 'connected'} aria-label="次のフェーズへ進む">↠</button>
        </div>
        {role === 'participant' && <p className="hint">タイマー操作はホストだけが行えます。</p>}
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

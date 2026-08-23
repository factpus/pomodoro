'use client';

import { useEffect, useState } from 'react';
import type { PublicTimerState } from '@/lib/timer/types';
import { useDiscordActivity } from './DiscordActivityProvider';

const phaseLabels = { focus: '集中', shortBreak: '小休憩', longBreak: '長休憩' } as const;

const inviteMessages = {
  checking: 'Discordの招待可否を確認しています。',
  ready: '',
  'voice-channel-required': 'サーバーのボイスチャンネルから開くとDiscord招待を利用できます。',
  'permission-required': 'このチャンネルでは招待を作成する権限がありません。',
  unknown: '招待可否を確認できません。失敗する場合はリンク共有を利用してください。',
} as const;

export default function DiscordActivityPanel({ roomId, state }: { roomId: string; state: PublicTimerState }) {
  const { embedded, authenticated, participants, error, inviteAvailability, invite, setTimerPresence } = useDiscordActivity();
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!authenticated) return;
    const phase = phaseLabels[state.phase];
    void setTimerPresence({
      details: state.isRunning ? `${phase}中` : `${phase}・一時停止`,
      state: '仲間とタイマーを同期中',
      endsAt: state.isRunning && state.phaseEndsAt ? state.phaseEndsAt : undefined,
    }).catch(() => undefined);
  }, [authenticated, setTimerPresence, state.isRunning, state.phase, state.phaseEndsAt, state.version]);

  if (!embedded) return null;

  async function openInvite() {
    setMessage('');
    try {
      await invite();
    } catch (caught) {
      setMessage(caught instanceof Error ? `${caught.message} 招待リンクをコピーできます。` : '招待画面を開けませんでした。招待リンクをコピーできます。');
    }
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
      setMessage('招待リンクをコピーしました。Discordへ貼り付けてください。');
    } catch {
      setMessage('リンクをコピーできませんでした。下のリンク共有を利用してください。');
    }
  }

  const canInvite = authenticated && (inviteAvailability === 'ready' || inviteAvailability === 'unknown');
  const availabilityMessage = authenticated ? inviteMessages[inviteAvailability] : 'Discord認証の完了後に招待できます。';

  return (
    <div className="activity-panel">
      <span>Discord Activity ・ {participants}人接続</span><button type="button" disabled={!canInvite} onClick={() => void openInvite()}>ボイスチャンネルへ招待</button>
      {(!canInvite || message) && <button type="button" className="activity-fallback" onClick={() => void copyInviteLink()}>招待リンクをコピー</button>}
      {(message || error || availabilityMessage) && <p role="status">{message || error || availabilityMessage}</p>}
    </div>
  );
}

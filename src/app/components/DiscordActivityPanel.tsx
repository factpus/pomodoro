'use client';

import { useEffect, useState } from 'react';
import type { PublicTimerState } from '@/lib/timer/types';
import { useDiscordActivity } from './DiscordActivityProvider';

const phaseLabels = { focus: '集中', shortBreak: '小休憩', longBreak: '長休憩' } as const;

export default function DiscordActivityPanel({ state }: { state: PublicTimerState }) {
  const { embedded, participants, error, invite, setTimerPresence } = useDiscordActivity();
  const [message, setMessage] = useState('');

  useEffect(() => {
    const phase = phaseLabels[state.phase];
    void setTimerPresence({
      details: state.isRunning ? `${phase}中` : `${phase}・一時停止`,
      state: '仲間とタイマーを同期中',
      endsAt: state.isRunning && state.phaseEndsAt ? state.phaseEndsAt : undefined,
    }).catch(() => undefined);
  }, [setTimerPresence, state.isRunning, state.phase, state.phaseEndsAt, state.version]);

  if (!embedded) return null;

  async function openInvite() {
    setMessage('');
    try {
      await invite();
    } catch {
      setMessage('招待画面を開けませんでした。上のリンク共有を利用してください。');
    }
  }

  return (
    <div className="activity-panel">
      <span>Discord Activity ・ {participants}人接続</span><button type="button" onClick={() => void openInvite()}>ボイスチャンネルへ招待</button>
      {(message || error) && <p role="status">{message || error}</p>}
    </div>
  );
}

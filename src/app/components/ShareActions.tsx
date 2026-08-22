'use client';

import { useState } from 'react';
import type { PublicTimerState } from '@/lib/timer/types';

type Feedback = 'discord' | 'line' | 'link' | 'share' | 'error' | null;

function minutes(seconds: number) {
  return Math.max(1, Math.round(seconds / 60));
}

export default function ShareActions({ roomId, state }: { roomId: string; state: PublicTimerState }) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const roomUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/room/${roomId}`;
  const text = `🍅 Pomodoro Together\nルーム「${roomId}」で一緒に集中しよう。\n集中${minutes(state.focusSeconds)}分・休憩${minutes(state.shortBreakSeconds)}分`;

  function announce(value: Feedback) {
    setFeedback(value);
    window.setTimeout(() => setFeedback(null), 2_500);
  }

  async function copy(value: string, success: Feedback) {
    try {
      await navigator.clipboard.writeText(value);
      announce(success);
      return true;
    } catch {
      announce('error');
      return false;
    }
  }

  async function shareToDiscord() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Pomodoro Together', text, url: roomUrl });
        announce('share');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await copy(`${text}\n${roomUrl}`, 'discord');
  }

  function shareToLine() {
    const target = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(roomUrl)}`;
    window.open(target, '_blank', 'noopener,noreferrer');
    announce('line');
  }

  const message = feedback === 'discord'
    ? 'Discord用の招待文をコピーしました。'
    : feedback === 'line'
      ? 'LINEの共有画面を開きました。'
      : feedback === 'link'
        ? '招待リンクをコピーしました。'
        : feedback === 'share'
          ? '共有画面を開きました。'
          : feedback === 'error'
            ? 'コピーできませんでした。ブラウザの権限を確認してください。'
            : '';

  return (
    <div className="share-block">
      <p className="share-title">仲間を招待</p>
      <div className="share-actions" aria-label="ルームを共有">
        <button type="button" onClick={() => void shareToDiscord()}>Discord</button>
        <button type="button" onClick={shareToLine}>LINE</button>
        <button type="button" onClick={() => void copy(roomUrl, 'link')}>リンクをコピー</button>
      </div>
      <p className="share-feedback" role="status" aria-live="polite">{message}</p>
    </div>
  );
}

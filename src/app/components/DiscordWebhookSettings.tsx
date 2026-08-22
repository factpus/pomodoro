'use client';

import { FormEvent, useState } from 'react';
import { connectDiscordWebhook, disconnectDiscordWebhook } from '@/lib/client/rooms';
import type { RoomSnapshot } from '@/lib/timer/types';

interface Props {
  roomId: string;
  token: string | null;
  connected: boolean;
  onUpdate: (snapshot: RoomSnapshot) => void;
}

export default function DiscordWebhookSettings({ roomId, token, connected, onUpdate }: Props) {
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const snapshot = await connectDiscordWebhook(roomId, url, token);
      onUpdate(snapshot);
      setUrl('');
      setMessage('テスト通知を送信し、接続しました。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '接続できませんでした。');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setMessage('');
    try {
      onUpdate(await disconnectDiscordWebhook(roomId, token));
      setMessage('Discord通知を解除しました。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '解除できませんでした。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="integration-settings">
      <summary>Discord通知 {connected ? '・接続済み' : ''}</summary>
      <div className="integration-body">
        <p className="hint">DiscordチャンネルのWebhook URLを接続すると、開始・切替・スキップ・リセットを通知するよ。URLは暗号化して保存します。</p>
        {connected ? (
          <button className="button button-secondary" type="button" disabled={busy} onClick={() => void disconnect()}>通知を解除</button>
        ) : (
          <form className="integration-form" onSubmit={(event) => void submit(event)}>
            <label className="label" htmlFor="discord-webhook">Webhook URL</label>
            <input id="discord-webhook" className="input" type="password" inputMode="url" autoComplete="off" required maxLength={500} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://discord.com/api/webhooks/..." />
            <button className="button button-primary" type="submit" disabled={busy}>{busy ? '確認中…' : 'テストして接続'}</button>
          </form>
        )}
        {message && <p className="integration-message" role="status">{message}</p>}
      </div>
    </details>
  );
}

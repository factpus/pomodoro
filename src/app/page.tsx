'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import TimeSettings, { type TimeSettingsValue } from '@/app/components/TimeSettings';
import { clientId, hostTokenKey } from '@/lib/client/identity';
import { createSharedRoom } from '@/lib/client/rooms';

const initialSettings: TimeSettingsValue = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 };

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [settings, setSettings] = useState(initialSettings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const normalizedRoomId = roomId.trim().toLowerCase();
  const roomPath = (id: string) => `/room/${id}${window.location.search}`;

  async function createRoom(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await createSharedRoom({ roomId: normalizedRoomId || undefined, settings }, clientId());
      sessionStorage.setItem(hostTokenKey(result.snapshot.roomId), result.hostToken);
      router.push(roomPath(result.snapshot.roomId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ルームを作成できませんでした。'); setBusy(false);
    }
  }

  function joinRoom() {
    if (!normalizedRoomId) { setError('参加するルーム名を入力してください。'); return; }
    router.push(roomPath(normalizedRoomId));
  }

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">一緒なら、集中は続けやすい。</p>
          <h1 id="page-title">Pomodoro Together</h1>
          <p className="lead">同じタイマーを仲間と共有して、集中と休憩のリズムを揃えよう。</p>
        </div>
        <form onSubmit={createRoom} className="panel space-y-6">
          <div>
            <label htmlFor="room-id" className="label">ルーム名</label>
            <div className="mt-2 flex gap-2">
              <input id="room-id" className="input" value={roomId} onChange={(event) => setRoomId(event.target.value)} placeholder="空欄なら自動生成" maxLength={50} pattern="[A-Za-z0-9-]+" />
              <button type="button" className="icon-button" onClick={() => setRoomId(crypto.randomUUID().slice(0, 8))} aria-label="ランダムなルーム名を生成">🎲</button>
            </div>
          </div>
          <TimeSettings value={settings} onChange={setSettings} />
          {error && <p className="error" role="alert">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <button className="button button-primary" type="submit" disabled={busy}>{busy ? '作成中…' : 'ルームを作る'}</button>
            <button className="button button-secondary" type="button" onClick={joinRoom} disabled={busy}>既存ルームに参加</button>
          </div>
          <p className="hint">設定はルーム作成者が決めます。参加時には既存ルームの設定が使われます。</p>
        </form>
      </section>
      <section className="home-features" aria-label="特徴">
        <article><span>01</span><h2>登録なしで共有</h2><p>ルームを作り、DiscordやLINEへURLを送るだけ。</p></article>
        <article><span>02</span><h2>通話はいつもの場所で</h2><p>音声機能を増やさず、集中と休憩だけを揃えます。</p></article>
        <article><span>03</span><h2>切断しても復元</h2><p>サーバー時刻を基準に、正しい残り時間へ戻ります。</p></article>
      </section>
      <footer><nav><Link href="/guide">使い方</Link><Link href="/faq">FAQ</Link><Link href="/about">About</Link><Link href="/privacy">プライバシー</Link><Link href="/terms">利用規約</Link><Link href="/contact">問い合わせ</Link></nav><span>Made by factpus</span></footer>
    </main>
  );
}

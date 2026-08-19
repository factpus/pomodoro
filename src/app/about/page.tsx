import Link from 'next/link';

export const metadata = { title: 'このアプリについて' };

export default function AboutPage() {
  return <main className="room-shell"><article className="panel empty"><p className="eyebrow">About</p><h1>集中を、ひとりにしない。</h1><p className="lead">Pomodoro Togetherは、離れた仲間と同じタイマーを共有できるポモドーロアプリです。ホストが操作した集中・休憩の状態は参加者全員に同期され、再接続しても正しい残り時間へ戻ります。</p><p className="lead">Next.js、Vercel、Redisを使い、サーバーレス環境でも複数人利用できるよう設計しています。</p><Link className="button button-primary" href="/">タイマーを使う</Link></article></main>;
}

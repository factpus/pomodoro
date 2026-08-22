import InfoPage from '@/app/components/InfoPage';

export const metadata = { title: 'このアプリについて' };

export default function AboutPage() {
  return <InfoPage eyebrow="About" title="集中を、ひとりにしない。"><p className="lead">Pomodoro Togetherは、DiscordやLINEで話しながら作業する人たちが、集中と休憩のリズムだけを共有するためのWebアプリです。</p><section><h2>足さないことも、設計。</h2><p>独自チャット、音声通話、重いタスク管理は作りません。既に使い慣れた通話サービスを置き換えず、URLを開くだけの共同タイマーとして単純さを守ります。</p></section><section><h2>サーバーレスでも正しく同期。</h2><p>Next.js、Vercel Functions、Upstash Redisで構成し、終了時刻を基準に状態を復元します。ホスト権限、入力検証、レート制限、分散ロック、期限切れを組み込み、複数インスタンスでも同じ状態を参照します。</p></section><section><h2>作者について</h2><p>factpusが、実際に使えるサービスであることと、判断の理由まで説明できるポートフォリオであることの両立を目指して開発しています。</p></section></InfoPage>;
}

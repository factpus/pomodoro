import InfoPage from '@/app/components/InfoPage';

export const metadata = { title: '使い方', description: 'Pomodoro Togetherで仲間と集中時間を共有する方法。' };

export default function GuidePage() {
  return <InfoPage eyebrow="Guide" title="3ステップで、一緒に集中。"><section><h2>1. ルームを作る</h2><p>集中・小休憩・長休憩の時間を選び、ルームを作成します。作成したブラウザがホストになり、タイマーを操作できます。</p></section><section><h2>2. 仲間を招待する</h2><p>ルーム画面のDiscord、LINE、リンクコピーから参加URLを共有します。参加者はアカウント登録なしで同じタイマーを見られます。</p></section><section><h2>3. 通話しながら開始する</h2><p>DiscordやLINEの音声通話はそのまま使い、ホストがタイマーを開始します。タブが休止してもサーバー時刻から正しい残り時間へ復元します。</p></section><section><h2>ホストを交代する</h2><p>右上の「ホスト」を押して接続中の参加者を選びます。相手が60秒以内に承認すると操作権限が移り、元のホストは参加者になります。</p></section><section><h2>Discord通知（任意）</h2><p>ホストはルーム内の「Discord通知」からチャンネルWebhookを接続できます。開始や休憩への切替だけを通知し、秒ごとの投稿は行いません。</p></section></InfoPage>;
}

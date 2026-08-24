import InfoPage from '@/app/components/InfoPage';

export const metadata = { title: 'よくある質問' };

export default function FaqPage() {
  return <InfoPage eyebrow="FAQ" title="よくある質問"><section><h2>アカウントは必要？</h2><p>必要ありません。参加URLを開くだけで利用できます。</p></section><section><h2>誰が操作できる？</h2><p>接続中の参加者全員がタイマーを操作できます。Discord通知などの連携設定とホスト移譲はホスト専用です。ホストが切断した場合は、切断を最初に検知した参加者へ自動移譲されます。</p></section><section><h2>ルームはいつまで残る？</h2><p>現在は最終更新から24時間です。永続保存や履歴機能はありません。</p></section><section><h2>参加人数がすぐ減るのはなぜ？</h2><p>開いている参加者だけを数えるためです。切断後は約15秒で人数から除外され、再接続すると戻ります。</p></section><section><h2>DiscordやLINEの音声は記録される？</h2><p>されません。このサービスは音声通話を提供せず、各サービスとはタイマーの共有・通知だけを連携します。</p></section></InfoPage>;
}

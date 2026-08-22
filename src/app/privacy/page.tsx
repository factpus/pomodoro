import InfoPage from '@/app/components/InfoPage';

export const metadata = { title: 'プライバシーポリシー' };

export default function PrivacyPage() {
  return <InfoPage eyebrow="Privacy" title="プライバシーポリシー"><p className="document-date">制定・最終更新: 2026年8月22日</p><section><h2>取得・保存する情報</h2><p>ルーム名、タイマー設定・状態、匿名のクライアント識別子、最終接続時刻、ホスト権限を確認するためのハッシュ値を、サービス提供に必要な範囲で扱います。ルーム情報は最終更新から24時間で失効します。</p></section><section><h2>ブラウザ内の情報</h2><p>ホスト権限、通知・音量などの利用情報をブラウザのSession StorageまたはLocal Storageへ保存します。アカウント情報や音声・通話内容は取得しません。</p></section><section><h2>外部サービス</h2><p>ホスティングと配信にVercel、共有状態にUpstash Redisを利用します。任意のDiscord Webhookを接続した場合、URLを暗号化して保存し、タイマーイベントの通知にのみ使用します。LINE共有を選ぶと、LINEの共有画面へ参加URLが送られます。</p></section><section><h2>アクセス情報</h2><p>不正利用防止のレート制限に、リクエスト元IPアドレスから生成した一時的な識別情報を利用する場合があります。現時点で広告配信や行動追跡を目的とするCookieは使用しません。</p></section><section><h2>問い合わせ</h2><p>削除や取り扱いに関する連絡は問い合わせページからお願いします。ルーム名と状況を添えてください。</p></section></InfoPage>;
}

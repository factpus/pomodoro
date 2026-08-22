import InfoPage from '@/app/components/InfoPage';

export const metadata = { title: '問い合わせ' };

export default function ContactPage() {
  return <InfoPage eyebrow="Contact" title="問い合わせ"><p>不具合報告、機能提案、開発・導入の相談はGitHubから受け付けています。公開してよい内容だけを記載し、Webhook URLやホスト用トークンなどの秘密情報は送らないでください。</p><p><a className="button button-primary" href="https://github.com/factpus/pomodoro/issues" target="_blank" rel="noreferrer">GitHub Issuesを開く</a></p><section><h2>不具合報告にあると助かる情報</h2><p>発生日時、端末・ブラウザ、行った操作、表示されたメッセージ、再現手順を添えてください。ルームの秘密情報や個人情報は伏せてください。</p></section></InfoPage>;
}

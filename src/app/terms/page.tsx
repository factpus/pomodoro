import InfoPage from '@/app/components/InfoPage';

export const metadata = { title: '利用規約' };

export default function TermsPage() {
  return <InfoPage eyebrow="Terms" title="利用規約"><p className="document-date">制定・最終更新: 2026年8月22日</p><section><h2>サービスの利用</h2><p>本サービスは、複数人で集中・休憩時間を共有するために提供します。法令に反する利用、第三者への妨害、過度な自動アクセス、脆弱性の悪用を禁止します。</p></section><section><h2>ルームと連携先</h2><p>推測されやすいルーム名へ秘密情報を含めないでください。Discord Webhookなど外部サービスの認証情報は、正当な権限を持つ利用者だけが接続してください。外部サービス側の規約も適用されます。</p></section><section><h2>提供の変更・停止</h2><p>保守、障害、費用または安全上の理由により、予告なく機能の変更・一時停止・終了を行う場合があります。重要な作業記録の保存先としては利用しないでください。</p></section><section><h2>免責</h2><p>正確な動作と継続提供に努めますが、完全性や特定目的への適合を保証するものではありません。利用により生じた損害について、法令上認められる範囲で責任を負いません。</p></section></InfoPage>;
}

# Pomodoro Together

離れた仲間と同じ集中・休憩タイマーを共有できる、ポートフォリオ向けWebアプリです。

公開URL: [Pomodoro Together](https://pomodoro-app-five-khaki.vercel.app/)

## 主な機能

- CDNキャッシュを利用したルームURLによる複数人同期（通常2秒以内）
- ホスト・参加者の権限分離
- 右上のホストバッジから行う、承認制のホスト移譲
- 終了時刻を基準にした、タブ休止に強いタイマー
- 切断後の自動再接続と状態復元
- 参加人数、Discord・LINE共有、ルーム別OGP、プリセット、長休憩、ブラウザ通知
- 任意のDiscord Webhook通知、`/pomodoro`コマンド、Discord Activity
- レスポンシブUI、キーボード操作、PWA、OG画像

## 技術構成

- Next.js 16 / React 19 / TypeScript
- Vercel Functions
- Upstash Redis（ルーム状態、TTL、分散ロック、レート制限）
- Zod（API入力検証）
- Vitest / Playwright / GitHub Actions

VercelのFunctionで常駐Socket.IOサーバーを動かす構成は廃止しました。Redisを正とするHTTP同期方式により、Functionの再起動・複数インスタンス・再デプロイに耐える構成です。詳細は [アーキテクチャ](docs/ARCHITECTURE.md) と [改善記録](docs/IMPROVEMENT_PLAN.md) を参照してください。

## ローカル起動

```bash
npm install
copy .env.example .env.local
npm run dev
```

Redis環境変数が未設定の開発環境ではメモリストアを使用します。本番環境では安全のためRedisが必須です。

## Vercel環境変数

Vercel MarketplaceでUpstash Redisをプロジェクトへ接続すると、通常は次の値が自動設定されます。

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

`KV_REST_API_URL` / `KV_REST_API_TOKEN` も後方互換として利用できます。

Discord連携は任意です。暗号鍵、Interaction、Activityの設定は [Discord連携セットアップ](docs/DISCORD_SETUP.md) を参照してください。

## 検証

```bash
npm run check
npm run test:e2e
npm audit --omit=dev --audit-level=high
```

CIではlint、型検査、単体テスト、カバレッジ、本番ビルド、依存関係監査、2ブラウザ同期E2Eを実行します。

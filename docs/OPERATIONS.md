# 運用・監視

最終更新: 2026-08-22

## 死活監視

`GET /api/health` を監視対象とする。本番でRedisへ接続できれば `200 {"status":"ok","storage":"redis"}`、Redis未設定または接続不能なら503を返す。レスポンスは常に `Cache-Control: no-store` とする。

5分間隔の外形監視を設定し、2回連続失敗で通知する。監視サービスへ認証情報やルームURLを渡さず、ヘルスチェックURLだけを登録する。

## 構造化ログ

サーバーの重要イベントは1行JSONでVercel Logsへ出力する。Webhook URL、OAuthコード、アクセストークン、ホストトークン、IPアドレスは記録しない。ルームを識別する必要がある場合は短い不可逆ハッシュだけを使う。

主なイベント:

- `api.unhandled_error`
- `health.redis_failed`
- `discord.webhook_failed`
- `discord.public_invite_failed`
- `discord.command_failed`

## アラートの目安

- `/api/health` が2回連続で503
- `api.unhandled_error` が5分で5件以上
- `discord.webhook_failed` の401・404が発生
- Upstashの日次コマンド数または保存容量が契約上限の70%を超過
- Vercel Functionsのエラー率が5分で5%を超過

## 障害時の確認順

1. Vercelの最新DeploymentとFunction Logsを確認
2. `/api/health` でRedis接続を確認
3. Upstashの稼働状況と使用量を確認
4. Discord連携だけの障害か、通常Web同期も失敗しているかを切り分け
5. 必要ならDiscord連携の環境変数を外し、通常Web版を維持して再デプロイ

Discord Webhookは429だけを最大1回再試行する。401・404は失効と判断してルームから自動解除する。その他の障害ではタイマー本体を止めない。

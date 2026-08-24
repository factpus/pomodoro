# 運用・監視

最終更新: 2026-08-24

## 死活監視

`GET /api/health` を監視対象とする。本番でRedisへ接続できれば `200 {"status":"ok","storage":"redis"}`、Redis未設定または接続不能なら503を返す。レスポンスは常に `Cache-Control: no-store` とする。

5分間隔の外形監視を設定し、2回連続失敗で通知する。監視サービスへ認証情報やルームURLを渡さず、ヘルスチェックURLだけを登録する。

### 設定状況

手順の文書化と、外部サービス上での設定完了は分けて管理する。次の一覧は2026-08-24時点の実設定状況であり、チェック済みは動作確認済み、未チェックは未確認または現行プランでは利用できない項目を表す。

- [x] UptimeRobotから `/api/health` を5分間隔で監視（初回の正常応答を確認済み）
- [ ] 2回連続失敗時の通知先と通知テスト
- [ ] Upstashの日次コマンド数・保存容量70%のアラート
- [x] VercelのWeb通知・メール通知とDeployment Failures通知を有効化
- [ ] VercelのError Anomaly・Usage Anomaly AlertsはHobbyプランでは利用できないため、Proへ移行する場合に再検討

HobbyプランではVercelの異常検知Alertsに依存せず、外部HTTP監視から `/api/health` の200/503を確認する。Vercel標準通知はデプロイ失敗の検知に使用し、実行中サービスとRedisの死活監視とは役割を分ける。

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

Discord Webhookは429だけを最大1回再試行する。`Retry-After` または `retry_after` の待機時間は短縮せず、処理期限を超える場合は早期再試行しない。401・404は失効と判断してルームから自動解除する。その他の障害ではタイマー本体を止めない。

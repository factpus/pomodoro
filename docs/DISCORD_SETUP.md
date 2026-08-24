# Discord連携セットアップ

最終更新: 2026-08-24

Discord連携は任意機能です。未設定でも通常のWeb版、URL共有、LINE共有は動作します。秘密情報はGitへコミットせず、VercelのEnvironment Variablesへ設定してください。

## 1. Webhook通知

32バイトの暗号鍵を生成します。

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

出力を `INTEGRATION_ENCRYPTION_KEY` として設定します。ホストがルーム画面からDiscordチャンネルのWebhook URLを入力すると、疎通確認後にAES-256-GCMで暗号化してRedisへ保存します。通知先URLをクライアントへ返したりログへ出したりしません。

## 2. `/pomodoro` コマンド

1. [Discord Developer Portal](https://discord.com/developers/applications)でApplicationを作成する。
2. General InformationのPublic Keyを `DISCORD_PUBLIC_KEY` に設定する。
3. Interactions Endpoint URLを `https://<公開URL>/api/discord/interactions` に設定する。
4. Application IDを `DISCORD_APPLICATION_ID`、Bot Tokenを `DISCORD_BOT_TOKEN` に設定する。
5. 開発中だけ特定サーバーへ即時反映する場合は `DISCORD_GUILD_ID` も設定する。
6. 環境変数を読み込んだ端末で `npm run discord:register` を一度実行する。

コマンド応答は実行者だけに見えるephemeralメッセージでホスト用ボタンを返し、Interaction follow-upでチャンネルへ参加者用ボタンを公開投稿します。ホストトークンはURLフラグメントで一度だけブラウザへ渡し、Session Storageへ保存後にアドレス欄から除去します。

## 3. Discord Activity

1. Developer PortalでActivitiesを有効化する。
2. Activity URL Mappingで `/` をVercelの公開オリジンへ割り当てる。
3. OAuth2 Redirectsへ `https://127.0.0.1` を追加する。Embedded App SDKがActivity内の戻り処理を担当するための必須設定です。
4. OAuth2 Client Secretを `DISCORD_CLIENT_SECRET`、Application IDを `NEXT_PUBLIC_DISCORD_CLIENT_ID` に設定して再デプロイする。
5. ActivityのEntry Pointを設定し、Discordデスクトップ・Web・モバイルで起動確認する。

Discord内で起動された場合だけEmbedded App SDKを初期化し、`identify` と `rpc.activities.write` を要求します。OAuthコードはサーバーで交換し、アクセストークンは永続保存しません。同じActivity `instance_id` の参加者は同じルームへ自動参加し、最初の参加者だけがホストになります。Rich Presenceには集中・休憩・一時停止と終了時刻だけを表示します。音声権限は要求しません。

### 現在の設定・確認状況

- [x] Developer Applicationを作成
- [x] ActivitiesとActivity URL Mappingを設定
- [x] OAuth2 Redirectsへ `https://127.0.0.1` を設定
- [x] `DISCORD_CLIENT_SECRET` と `NEXT_PUBLIC_DISCORD_CLIENT_ID` をVercelへ設定して再デプロイ
- [x] Activity Entry Pointを設定
- [x] Discordデスクトップ版でActivityの起動、OAuth認証、タイマー操作を確認
- [x] 招待権限の事前確認が不確定でも、警告を常時表示せずダイアログを直接試行するよう修正
- [ ] 招待ダイアログとRPCエラー時のリンク共有フォールバックを実機確認
- [ ] 同じActivityへ2人で参加し、同一ルームへの自動参加と参加人数を確認
- [ ] Discord Web版で確認
- [ ] Discord iOS版・Android版で確認

## リリース確認

- 無効な署名のInteractionが401になる
- `/pomodoro` から作成した本人だけがホストになる
- 共有URLを開いた別ブラウザは参加者になる
- Webhookの接続テスト、開始、切替、解除が動作する
- Activity内の招待可否が正しく判定され、招待ダイアログまたは理由付きリンク共有が動作する
- 同じActivityへ参加した2人が同じ `instance_id` から同じルームへ自動参加する
- 集中開始・一時停止・休憩でRich Presenceが更新される
- Discord未設定の通常ブラウザでエラーが出ない

### 2ユーザー自動参加の実機手順

1. 同じボイスチャンネルで1人目がActivityを起動し、表示されたルーム名を控える。
2. DiscordのActivity参加導線から2人目が同じ実行中Activityへ参加する。各自が別々にActivityを新規起動しない。
3. 両画面のルーム名が一致し、Discord Activityの接続人数とルーム下部の参加人数が2人になることを確認する。
4. 2人目から開始・停止・リセット・スキップを行い、両画面へ反映されることを確認する。
5. ホスト側Activityを閉じ、約15〜25秒後に残った側が「ホスト」表示へ変わることを確認する。

サーバー側では同じ `instance_id` をSHA-256で同じルームIDへ写像する。再参加・別ユーザー・異なるinstanceの分離はユニットテストで固定しているが、Discordが両ユーザーへ同じ `instance_id` を渡すことは上記手順で実機確認する。

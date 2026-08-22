# Discord連携セットアップ

最終更新: 2026-08-22

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

コマンド応答は実行者だけに見えるephemeralメッセージです。ホストトークンはURLフラグメントで一度だけブラウザへ渡し、Session Storageへ保存後にアドレス欄から除去します。参加者へはアプリ内の共有ボタンで、トークンを含まないURLを送ります。

## 3. Discord Activity

1. Developer PortalでActivitiesを有効化する。
2. Activity URL Mappingで `/` をVercelの公開オリジンへ割り当てる。
3. Application IDを `NEXT_PUBLIC_DISCORD_CLIENT_ID` に設定して再デプロイする。
4. ActivityのEntry Pointを設定し、Discordデスクトップ・Web・モバイルで起動確認する。

Discord内で起動された場合だけEmbedded App SDKを初期化し、Activity参加人数と公式の招待ダイアログを表示します。初期化できない場合は通常のWeb版へフォールバックします。OAuthを必要とするユーザー情報や音声権限は要求しません。

## リリース確認

- 無効な署名のInteractionが401になる
- `/pomodoro` から作成した本人だけがホストになる
- 共有URLを開いた別ブラウザは参加者になる
- Webhookの接続テスト、開始、切替、解除が動作する
- Activity内の招待と参加人数が動作する
- Discord未設定の通常ブラウザでエラーが出ない

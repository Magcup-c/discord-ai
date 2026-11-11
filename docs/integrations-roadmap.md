# 外部サービス連携設計

このドキュメントは discord-ai の外部サービス連携方針を定義します。アカウント連携は **personal** を採用し、各 Discord ユーザーが自分のアカウントを接続します。Bot 管理者の共通アカウントを全ユーザーに共有する設計にはしません。

## 1. 全体構成

```text
Discord user
  └─ /connect google | microsoft | discord
       └─ Cloudflare Worker OAuth start endpoint
            └─ Provider consent page
                 └─ OAuth callback (state + PKCE validation)
                      └─ Encrypted token storage in D1
                           └─ Tool registry
                                ├─ Google APIs
                                ├─ Microsoft Graph
                                └─ Discord API
```

- Discord user ID を全連携レコードの所有者とし、すべての取得・更新・切断クエリに user ID を含める。
- OAuth callback の `state` は暗号学的乱数で生成し、短時間で失効する一回限りの値として D1 に保存する。
- Authorization Code + PKCE を利用できるプロバイダーでは必ず PKCE を使う。
- リダイレクト URI は環境変数で管理し、許可済み URI と完全一致させる。
- access token / refresh token は AES-GCM で暗号化し、暗号鍵は Cloudflare Worker Secret に置く。鍵やトークンをログ・Discordメッセージ・Gitに出さない。
- OAuth scope は機能ごとの最小権限とし、最初は読み取り専用を基本にする。
- 接続・切断は Discord の本人操作から開始し、他人の接続情報を列挙できないようにする。

## 2. プロバイダーと対象機能

| Provider | OAuth / API | 初期スコープ案 | 機能候補 |
| --- | --- | --- | --- |
| Google | Google OAuth 2.0 + Gmail API / Drive API / Calendar API | Gmail readonly, Drive readonly, Calendar events readonly | メール検索、ファイル検索、予定確認 |
| Microsoft | Microsoft identity platform + Microsoft Graph | User.Read, Mail.Read, Files.Read, Calendars.Read | Outlook検索、OneDrive検索、予定確認 |
| Discord | Discord OAuth2 + Discord REST API | identify。必要機能に応じて guilds / guilds.members.read 等を個別検討 | アカウント確認、許可されたサーバー情報の参照 |

Discord Bot Token と Discord user OAuth token は別物です。通常のユーザーアカウントをBotのように自動操作する self-bot は実装しません。BotはBot API、ユーザー本人の連携はOAuth2の許可された範囲に限定します。

## 3. D1データモデル案

`oauth_connections`:
- `id` (primary key)
- `user_id` (Discord user ID)
- `provider` (google / microsoft / discord)
- `provider_subject` (provider側のユーザー識別子)
- `access_token_ciphertext`
- `refresh_token_ciphertext`
- `expires_at`
- `scopes`
- `created_at`, `updated_at`

Unique constraint: `(user_id, provider)`.

`oauth_states`:
- `state_hash` (primary key; raw state は保存しない)
- `user_id`
- `provider`
- `code_verifier_ciphertext`
- `expires_at`
- `consumed_at`

Callback は state を一度だけ消費し、期限切れ・不一致・再利用を拒否します。state にはユーザーIDなどの信頼していない情報を直接埋め込まず、サーバー側レコードから所有者を復元します。

## 4. Worker Secret / Variables

OAuth 実装時にプロバイダーごとに以下を登録します。

- `OAUTH_TOKEN_ENCRYPTION_KEY` (AES-GCM用の32-byte鍵を安全に生成してSecretへ登録)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`
- `DISCORD_OAUTH_CLIENT_ID`, `DISCORD_OAUTH_CLIENT_SECRET`, `DISCORD_OAUTH_REDIRECT_URI`

Client secret は OAuth callback のサーバー側交換処理でのみ使い、ブラウザーやDiscordの応答に返しません。ローカルの `.dev.vars` は Git 管理対象外にします。

## 5. 実装フェーズ

1. **検索基盤**: Tavily API をプロバイダーアダプターとして追加。APIキーは `TAVILY_API_KEY` Secret。既存の `web_search` ツール名と戻り値形式を維持する。
2. **OAuth共通基盤**: state/PKCE、暗号化、接続テーブル、/connect・/connections・/disconnect。
3. **Google**: Gmail / Drive / Calendar の読み取り専用ツールから追加。
4. **Microsoft**: Graph の Mail / OneDrive / Calendar 読み取り専用ツールを追加。
5. **Discord OAuth**: user identity を確認し、必要性が明確なユーザー許可済み情報だけを追加。
6. **書き込み操作**: メール送信、予定作成、ファイル変更などは読み取り機能とは分離し、操作ごとの確認ステップを必須にする。

## 6. 運用上の条件

- ユーザーごとのレート制限、プロバイダー別エラー処理、タイムアウトを設ける。
- refresh token のローテーションに対応し、更新後の値を暗号化して保存する。
- `/disconnect` は該当ユーザー・プロバイダーのトークンを削除し、必要に応じてプロバイダー側 revoke endpoint も呼ぶ。
- OAuth scope の変更は再同意を必要とする。
- D1バックアップ・ログにもトークン平文が残らないことを確認する。
- Google/Microsoft/Discordの開発者コンソールでOAuthアプリ登録、redirect URI、同意画面設定が必要。これらはリポジトリのPRだけでは完了しない。

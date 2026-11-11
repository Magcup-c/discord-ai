# Google OAuth連携（個人アカウント）

## このPRの範囲

このPRでは、DiscordユーザーごとのGoogle OAuth 2.0連携、暗号化トークン保存、トークン更新、切断、Google Drive / Calendarの読み取り検索を実装します。GmailはRestricted scopeを含むため、このPRでは要求しません。GmailはGoogle OAuthアプリの審査・データ取り扱い条件を確認した別フェーズで追加します。

## Google Cloud設定

1. Google Cloud Consoleでプロジェクトを作成します。
2. Google Drive APIとGoogle Calendar APIを有効化します。
3. OAuth同意画面を設定し、アプリの利用者をテスト中にする場合は、連携を試すGoogleアカウントをテストユーザーに追加します。
4. OAuthクライアントIDを作成し、アプリケーションの種類を「ウェブアプリケーション」にします。
5. 承認済みリダイレクトURIに、Workerの `https://<worker-domain>/oauth/google/callback` を完全一致で登録します。

GoogleのOAuthリダイレクトURIは登録値と完全一致が必要です。サーバー側WebアプリのOAuthではstate検証、offline access、refresh tokenの安全な保管が必要です。公式ガイド: https://developers.google.com/identity/protocols/oauth2/web-server

## Cloudflare Worker Secrets

以下を設定します。

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REDIRECT_URI
npx wrangler secret put OAUTH_TOKEN_ENCRYPTION_KEY
```

暗号鍵は32バイトのランダム値をBase64化したものです。Node.jsで生成する場合:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

`GOOGLE_REDIRECT_URI` はGoogle Cloud Consoleに登録したURIと同じ値にします。暗号鍵を紛失すると保存済みトークンを復号できなくなるため、秘密管理基盤で安全にバックアップしてください。鍵を変更する場合は既存トークンの再暗号化が必要です。

## D1 Migration

```bash
npx wrangler d1 migrations apply discord-ai-db --remote
```

ローカル開発では `--local` を利用します。

## Discordコマンド

- `/connect provider:google`: 個人Googleアカウントの認可URLをエフェメラル応答で表示します。
- `/connections`: 自分の連携状態だけを表示します。
- `/disconnect provider:google`: 自分のGoogleトークンを失効要求し、D1から削除します。

認可URLは10分で失効し、一度しか使用できません。OAuth stateはハッシュ化して保存し、PKCE verifierとトークンはAES-GCMで暗号化します。接続レコードの検索・更新・削除は必ずDiscord user IDで絞り込みます。

## AIツール

`google_search` は `service=drive` または `service=calendar` を受け取り、連携した本人のデータだけを検索します。初期スコープは以下です。

- `openid`, `email`, `profile`
- `https://www.googleapis.com/auth/drive.metadata.readonly`
- `https://www.googleapis.com/auth/calendar.readonly`

このツールは読み取り専用です。ファイル内容のダウンロード、変更、メール送信、予定作成は行いません。検索結果はAIモデルに渡るため、ユーザーがGoogleから許可した情報がAIプロバイダーに送信される点をアプリのプライバシー説明に明記してください。

## 運用上の注意

- GoogleのOAuth同意画面がTestingの場合、テストユーザーの追加が必要です。
- 公開アプリではGoogleのOAuth verificationやscopeに応じた追加要件が発生する場合があります。
- Gmailの `gmail.readonly` はRestricted scopeです。Gmail対応はデータ処理・審査要件を確認してから別PRで追加します。
- トークン、認可コード、state、PKCE verifierをログに出さないでください。
- 本番公開前にプライバシーポリシー、利用規約、データ削除手順を整備してください。

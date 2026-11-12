# GAS連携（Phase 1：接続基盤）

このフェーズでは、個人用GASと管理者共有GASの接続・認証・疎通確認を実装します。AIからの任意処理実行やSheets/Drive/Calendarの操作はまだ有効化しません。

## 1. 個人用GASを接続する

1. Google Apps Scriptで新しいプロジェクトを作成します。
2. リポジトリの src/gas-app/Code.gs をスクリプトへコピーします。
3. デプロイ > 新しいデプロイ > ウェブアプリを選択します。
4. 実行ユーザーはスクリプト所有者、アクセスできるユーザーは「全員」に設定します。公開エンドポイントになりますが、署名検証に成功したリクエストだけを処理します。
5. デプロイURLをコピーします。
6. Discordで /gas connect endpoint:<WebアプリURL> を実行します。
7. 応答に一度だけ表示される秘密鍵をコピーします。
8. Apps Scriptのプロジェクトの設定 > スクリプト プロパティで DISCORD_AI_SECRET を作成し、秘密鍵を設定します。
9. Discordで /gas test scope:personal を実行します。

秘密鍵はephemeral応答に一度だけ表示されます。応答を閉じる前にScript Propertiesへ登録してください。紛失した場合は /gas connect を再実行して鍵をローテーションします。

## 2. 共有GASを設定する

管理者が共有用GAS Webアプリをデプロイし、同じCode.gsを配置します。共有用の長いランダム秘密鍵をScript Propertiesの DISCORD_AI_SECRET に設定します。

Cloudflare Workerに次のSecret/Variableを登録します。

- GAS_SHARED_WEB_APP_URL: 共有GASのWebアプリURL
- GAS_SHARED_SECRET: 共有GASのScript Propertiesに設定した秘密鍵
- GAS_SHARED_NAME: 任意の表示名（Variable）

例：

~~~sh
npx wrangler secret put GAS_SHARED_WEB_APP_URL
npx wrangler secret put GAS_SHARED_SECRET
~~~

共有GASはスクリプト所有者の権限で動作し得るため、Phase 1では疎通確認だけを実装し、共有接続の実処理はまだ提供しません。共有接続のアクション実行には、Phase 2以降でユーザー別許可リストを追加します。

## 3. 認証プロトコル

Workerは次の値を含むJSONをPOSTします。

- version: プロトコルバージョン（1）
- request_id: リクエストごとのUUID
- timestamp: Unix秒
- nonce: リクエストごとのランダム値
- action: Phase 1では system.ping のみ
- payload: アクション引数
- signature: HMAC-SHA256の16進表現

署名対象は、version・timestamp・nonce・request_id・action・payload JSONを改行で連結した文字列です。GASは時刻差（5分以内）、nonceの再利用、署名を検証します。WorkerはGASのリダイレクト先をGoogle Apps Scriptの配信ドメインに限定して追跡します。

## 4. 暗号化・権限

- 個人用秘密鍵はAES-GCMで暗号化してD1に保存します。
- 暗号化鍵 OAUTH_TOKEN_ENCRYPTION_KEY は既存のWorker Secretを再利用します。
- 個人用接続はDiscordユーザーIDに一意に紐付けます。
- 共有接続はWorker Secretで管理し、秘密鍵をリポジトリやDiscord応答へ出しません。
- 秘密鍵や署名、リクエスト本文の機密情報をログへ出力しません。
- Phase 1ではGAS側で system.ping 以外を拒否します。

## 5. Phase 1コマンド

- /gas connect endpoint:<URL>: 個人用GASを登録し、秘密鍵を一度だけ発行
- /gas disconnect: 自分の個人用接続を削除
- /gas connections: 個人用・共有用の接続状態を表示
- /gas test scope:<personal|shared>: 接続テスト

D1 migrationを適用してからコマンドを再登録してください。

~~~sh
npx wrangler d1 migrations apply discord-ai-db --remote
npm run register-commands
~~~

OAUTH_TOKEN_ENCRYPTION_KEYがWorker Secretに登録済みであることも確認してください。

## 6. 次フェーズ

Phase 2でSheets/Drive/Calendarの読み取りアクションとユーザー別許可リストを追加します。Phase 3で書き込み操作の承認キューを追加し、Phase 4でCustomアクションとScheduleを実装します。

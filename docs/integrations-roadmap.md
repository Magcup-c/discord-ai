# 外部サービス連携設計

このドキュメントは discord-ai の外部サービス連携方針を定義します。OAuth接続はpersonalを基本とし、各Discordユーザーが自分のアカウントを接続します。GASはユーザーごとの個人接続と、管理者が環境変数で登録する共有接続の両方をサポートします。

## 1. Google OAuthとGASの役割

- Google OAuth: discord-aiがGoogle APIを直接呼び出すためのユーザー認可。OAuth scopeは必要最小限にする。
- GAS bridge: ユーザー独自のApps Scriptや複数処理をまとめたワークフローを実行する拡張経路。Google OAuth接続とは別管理にする。
- GAS Webアプリは公開URLになるため、URLを秘密として扱わず、リクエストごとのHMAC署名・時刻・nonceを検証する。

## 2. 接続モデル

### Personal

- DiscordユーザーIDに一意に紐付ける。
- WebアプリURLと秘密鍵を登録する。
- 秘密鍵は既存のAES-GCM暗号化機能で暗号化してD1に保存する。
- 接続情報の取得・更新・切断は必ず所有者のDiscordユーザーIDで制限する。

### Shared

- 管理者がCloudflare Worker Secret/Variableで接続先と秘密鍵を設定する。
- GAS_SHARED_WEB_APP_URLとGAS_SHARED_SECRETを使用する。
- 共有GASはスクリプト所有者の権限で動作し得るため、利用者・アクションの許可リストを必須にする。共有接続の機能実行は、個別認可が導入されるまで有効化しない。

## 3. GASリクエスト認証

- HMAC-SHA256署名をJSON本文に含める。
- Unix timestampの許容差は5分。
- requestごとにランダムnonceを発行し、GAS側で再利用を拒否する。
- Worker側はGASのリダイレクト先をGoogle Apps Scriptの配信ドメインに限定する。
- 初期アクションは system.ping のみ。任意関数実行は実装しない。

## 4. 機能ロードマップ

1. Phase 1 — 接続基盤: 個人・共有接続、暗号化、HMAC、nonce、接続テスト。
2. Phase 2 — 読み取り: Sheets/Drive/Calendar読み取り、ユーザー別・アクション別許可。
3. Phase 3 — 書き込み: Sheets更新、Drive作成・更新、Calendar作成・変更・削除。D1承認キューで本人確認を必須にする。
4. Phase 4 — Custom / Schedule: 登録済みアクションのみ実行し、ScheduleはWorkers CronとD1で管理する。

## 5. 運用条件

- OAuth tokenとGAS秘密鍵をログ・Discordメッセージ・Gitへ出さない。
- Worker Secretに暗号鍵・共有接続秘密鍵を登録する。
- 個人用接続の秘密鍵はAES-GCMで暗号化する。
- ユーザーごとのレート制限と実行ログを追加する。
- 書き込み操作は読み取り操作と分離し、承認ステップを必須にする。
- Google OAuth接続はGAS接続と独立して維持する。

# discord-ai

Cloudflare Workers 上で動作する、Groq / OpenAI 互換 API 対応の拡張可能な Discord AI Bot です。

## 主な機能

- Discord Interactions の Ed25519 署名検証（署名・タイムスタンプを確認）
- `/ask` AIアシスタントとの会話（D1の履歴を利用）
- `/forget` 現在のチャンネルに保存された自分の会話履歴を削除
- `/memory` 明示的に追加した記憶の確認・追加・削除
- `/tools` 利用可能なツールの一覧表示
- `/search` Tavily API によるWeb検索（APIキーが必要）
- `/settings` 言語・応答スタイル・記憶機能の個人設定
- `/usage` ユーザーごとのAPIリクエスト数・トークン使用量
- Groq または OpenAI 互換 API の切り替え
- ツール登録基盤（天気・ウェブ検索・計算）
- D1 による会話履歴・記憶・設定・利用量の保存

## コマンド

| コマンド | 説明 |
| --- | --- |
| `/ask prompt:` | AIに質問 |
| `/forget` | 現在のチャンネルの自分の会話履歴を削除（記憶は削除しない） |
| `/memory action:view` | 記憶を確認 |
| `/memory action:add key: value:` | 記憶を明示的に保存 |
| `/memory action:delete key:` | 指定した記憶を削除 |
| `/memory action:clear` | 自分の記憶をすべて削除 |
| `/tools` | 利用可能なツールを表示 |
| `/search query:` | Web検索 |
| `/settings action:view` | 個人設定を表示 |
| `/settings action:set key: value:` | 個人設定を変更 |
| `/usage period:` | API使用量を確認 |

記憶はユーザーが `/memory action:add` で明示的に保存した内容だけを保持します。記憶の自動抽出は行いません。`/forget` は会話履歴のみを削除し、記憶は `/memory` で別に管理します。

## 必要なもの

- Node.js 22 以降を推奨
- Cloudflare アカウントと Wrangler
- Discord Application / Bot
- Groq API キー（または利用する OpenAI 互換 API のキー）
- Web検索はTavilyのキー不要モード（共有レート制限あり）で試せます。専用枠を使う場合のみTAVILY_API_KEYを登録します。
- 天気機能を使う場合は OpenWeatherMap API キー

## セットアップ

1. 依存関係をインストールします。

   ```bash
   npm install
   ```

2. D1 データベースを作成します。

   ```bash
   npx wrangler d1 create discord-ai-db
   ```

   表示された database ID を `wrangler.toml` の `database_id` に設定します。プレースホルダーのままではデプロイできません。

3. D1 マイグレーションを適用します。

   ```bash
   npx wrangler d1 migrations apply discord-ai-db --remote
   ```

4. Cloudflare Secrets を登録します。

   Groq を使う場合:

   ```bash
   npx wrangler secret put DISCORD_PUBLIC_KEY
   npx wrangler secret put GROQ_API_KEY
   npx wrangler secret put WEATHER_API_KEY
   npx wrangler secret put TAVILY_API_KEY
   ```

   `DISCORD_PUBLIC_KEY` は Discord Developer Portal の Application Public Key です。`WEATHER_API_KEY` は天気機能を使う場合のみ必要です。

   OpenAI 互換 API を使う場合は、`OPENAI_COMPATIBLE_API_KEY` を Secret として登録し、`wrangler.toml` の `[vars]` に次を設定します。

   ```toml
   LLM_PROVIDER = "openai-compatible"
   OPENAI_COMPATIBLE_MODEL = "利用するモデル名"
   OPENAI_COMPATIBLE_BASE_URL = "https://api.openai.com/v1"
   ```

   接続先が別の OpenAI 互換サービスなら、そのサービスが指定する Base URL とモデル名を設定してください。秘密値を Git にコミットしないでください。

5. Discord のスラッシュコマンドを登録します。ローカル環境で次の環境変数を設定して実行します。

   - `DISCORD_APPLICATION_ID`
   - `DISCORD_BOT_TOKEN`

   ```bash
   npm run register-commands
   ```

6. Worker をデプロイします。

   ```bash
   npm run deploy
   ```

7. Discord Developer Portal の **Interactions Endpoint URL** に、デプロイ先の `https://<worker-domain>/interactions` を設定します。保存時に Discord の PING 検証が行われます。

## ローカル開発

```bash
npx wrangler dev
```

ローカル開発では `.dev.vars` を使って Secret を指定できますが、必ず Git 管理対象外にしてください。

## Web検索の設定

`TAVILY_API_KEY` を Cloudflare Worker Secret に登録すると、`/search` と AI の `web_search` ツールでTavilyを利用します。個人設定の言語はAIへの応答言語として使われます。検索結果の言語・地域は検索語や検索プロバイダー側の判定にも依存します。

外部サービスの個人アカウント連携方針とOAuth設計は [docs/integrations-roadmap.md](docs/integrations-roadmap.md) を参照してください。OAuth連携自体は別フェーズです。

## ツールの追加

1. `src/tools/` にツール実装を追加します。
2. `src/tools/index.js` で `registerTool(definition, handler)` を呼びます。
3. `src/discord/commands.js` の `ALLOWED_TOOLS` にツール名を追加します。

ツール定義はユーザーに許可されたものだけをモデルへ公開し、実行時にも権限と引数スキーマを検証します。外部検索ツールの結果は未検証データとして扱い、結果内に含まれる命令をシステム命令として実行しないでください。

## 注意

- `web_search` はTavily Search APIを利用します。`TAVILY_API_KEY` が未設定の場合は検索を実行できません。
- 天気機能は現在の天気のみを取得します。予報機能は別途追加が必要です。
- `/usage` はプロバイダーから返されたトークン数を記録します。料金はプロバイダー・モデル別の単価を設定していないため、現時点では表示しません。
- Cloudflare Workers の `waitUntil` は長時間ジョブの永続キューではありません。重い処理や複数段階の長時間タスクには Cloudflare Queues 等を追加してください。
- 会話履歴・記憶・設定・利用量はDiscordユーザーIDで分離して保存します。共有チャンネルでの利用者に保存方針を周知し、必要に応じて保存期間の自動削除を追加してください。

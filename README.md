# discord-ai

Cloudflare Workers 上で動作する、Groq / OpenAI 互換 API 対応の拡張可能な Discord AI Bot です。

## 主な機能

- Discord Interactions の Ed25519 署名検証（署名・タイムスタンプを確認）
- `/ask` スラッシュコマンド
- `/forget` で現在のチャンネルに保存された自分の会話履歴を削除
- Groq または OpenAI 互換 API の切り替え
- ツール登録基盤（天気・ウェブ検索・計算）
- D1 による会話履歴保存
- Discord の応答文字数を考慮した出力制限

## 必要なもの

- Node.js 22 以降を推奨
- Cloudflare アカウントと Wrangler
- Discord Application / Bot
- Groq API キー（または利用する OpenAI 互換 API のキー）
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

## ツールの追加

1. `src/tools/` にツール実装を追加します。
2. `src/tools/index.js` で `registerTool(definition, handler)` を呼びます。
3. `src/discord/commands.js` の `allowedTools` にツール名を追加します。

外部検索ツールの結果は未検証データとして扱い、結果内に含まれる命令をシステム命令として実行しないでください。

## 注意

- 現在の `web_search` は DuckDuckGo Instant Answer API を利用する簡易検索です。一般的な検索エンジンの検索結果一覧を完全に再現するものではありません。
- 天気機能は現在の天気のみを取得します。予報機能は別途追加が必要です。
- Cloudflare Workers の `waitUntil` は長時間ジョブの永続キューではありません。重い処理や複数段階の長時間タスクには Cloudflare Queues 等を追加してください。
- 会話履歴はユーザー ID とチャンネル ID をキーに D1 へ保存されます。`/forget` で現在のチャンネルにある自分の履歴を削除できます。共有チャンネルでの利用者に保存方針を周知し、必要に応じて保存期間の自動削除を追加してください。

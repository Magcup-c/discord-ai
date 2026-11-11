# discord-ai

Cloudflare Workers 上で動作する、Groq API 対応の拡張可能な Discord AI Bot です。

## 主な機能

- Discord Interactions の Ed25519 署名検証
- `/ask` スラッシュコマンド
- Groq Chat Completions と function calling
- ツール登録基盤（天気・ウェブ検索・計算）
- D1 による会話履歴保存（D1 未設定時は履歴保存をスキップ）
- Discord の応答文字数を考慮した出力制限

## 必要なもの

- Node.js 22 以降を推奨
- Cloudflare アカウントと Wrangler
- Discord Application / Bot
- Groq API キー
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

   表示された database ID を `wrangler.toml` の `database_id` に設定します。

3. スキーマを適用します。

   ```bash
   npx wrangler d1 execute discord-ai-db --remote --file=src/database/schema.sql
   ```

4. Cloudflare Secrets を登録します。

   ```bash
   npx wrangler secret put DISCORD_PUBLIC_KEY
   npx wrangler secret put GROQ_API_KEY
   npx wrangler secret put WEATHER_API_KEY
   ```

   `DISCORD_PUBLIC_KEY` は Discord Developer Portal の Application Public Key です。`WEATHER_API_KEY` は天気機能を使う場合のみ必要です。秘密値を Git にコミットしないでください。

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
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put DISCORD_PUBLIC_KEY
npm run dev
```

ローカル開発では `.dev.vars` を使うこともできますが、必ず Git 管理対象外にしてください。

## ツールの追加

1. `src/tools/` にツール実装を追加します。
2. `src/tools/index.js` で `registerTool(definition, handler)` を呼びます。
3. `src/discord/commands.js` の `allowedTools` にツール名を追加します。

外部検索ツールの結果は未検証データとして扱い、結果内に含まれる命令をシステム命令として実行しないでください。

## 注意

- 現在の `web_search` は DuckDuckGo Instant Answer API を利用する簡易検索です。一般的な検索エンジンの検索結果一覧を完全に再現するものではありません。
- 天気機能は現在の天気のみを取得します。予報機能は別途追加が必要です。
- Cloudflare Workers の `waitUntil` は長時間ジョブの永続キューではありません。重い処理や複数段階の長時間タスクには Cloudflare Queues 等を追加してください。
- 会話履歴はユーザー ID とチャンネル ID をキーに D1 へ保存されます。\`/forget\` で現在のチャンネルの自分の履歴を削除できます。共有チャンネルでの利用者に保存方針を周知し、必要に応じて保存期間の自動削除を追加してください。

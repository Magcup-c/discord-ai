
import test from "node:test";
import assert from "node:assert/strict";
import {
  loadLatestSearchContext,
  loadRecentMessages,
  saveMessage,
  saveSearchContext
} from "../src/database/conversations.js";
import { formatSearchReferences } from "../src/core/orchestrator.js";

const testEnv = {
  D1_DATA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
};

function createMemoryDb() {
  const rows = [];
  let nextId = 1;

  return {
    rows,
    prepare(sql) {
      let values = [];

      return {
        bind(...args) {
          values = args;
          return this;
        },

        async run() {
          if (sql.startsWith("INSERT INTO messages")) {
            const role = sql.includes("'assistant'") ? "assistant" : values[1];
            const content = sql.includes("'assistant'") ? values[1] : values[2];

            rows.push({
              id: nextId++,
              conversation_id: values[0],
              role,
              content
            });
          }

          return { success: true };
        },

        async all() {
          const [conversationId, limit] = values;

          return {
            results: rows
              .filter(row => row.conversation_id === conversationId)
              .sort((a, b) => b.id - a.id)
              .slice(0, limit)
          };
        },

        async first() {
          const [conversationId] = values;

          return rows
            .filter(row => row.conversation_id === conversationId)
            .filter(row => row.role === "assistant")
            .sort((a, b) => b.id - a.id)[0] || null;
        }
      };
    }
  };
}

test("search context is persisted per conversation and hidden from normal chat history", async () => {
  const db = createMemoryDb();

  await saveMessage(db, "user-1", "channel-1", "user", "最初の質問", null, testEnv);
  await saveMessage(db, "user-1", "channel-1", "assistant", "最初の回答", null, testEnv);

  await saveSearchContext(db, "user-1", "channel-1", {
    query: "Cloudflare Workers",
    results: [{
      title: "料金",
      text: "無料枠について",
      url: "https://example.com/pricing"
    }]
  }, null, testEnv);

  const context = await loadLatestSearchContext(
    db, "user-1", "channel-1", undefined, testEnv
  );

  assert.equal(context.query, "Cloudflare Workers");
  assert.equal(context.results[0].url, "https://example.com/pricing");

  const history = await loadRecentMessages(
    db, "user-1", "channel-1", 12, testEnv
  );

  assert.deepEqual(
    history.map(item => item.content),
    ["最初の質問", "最初の回答"]
  );

  assert.equal(
    await loadLatestSearchContext(
      db, "user-2", "channel-1", undefined, testEnv
    ),
    null
  );
});

test("search context expires after the configured lifetime", async () => {
  const db = createMemoryDb();

  await saveSearchContext(db, "user-1", "channel-1", {
    query: "old query",
    results: [{
      title: "Old",
      text: "Old result",
      url: "https://example.com"
    }]
  }, null, testEnv);

  const context = await loadLatestSearchContext(
    db, "user-1", "channel-1", -1, testEnv
  );

  assert.equal(context, null);
});

test("search references include only safe HTTP(S) URLs and retain citation order", () => {
  const references = formatSearchReferences([
    { title: "First", url: "https://example.com/a" },
    { title: "Second", url: "https://example.com/b" },
    { title: "Unsafe", url: "javascript:alert(1)" }
  ]);

  assert.match(references, /\[1\] First/);
  assert.match(references, /\[2\] Second/);
  assert.doesNotMatch(references, /Unsafe/);
  assert.doesNotMatch(references, /javascript:/);
});

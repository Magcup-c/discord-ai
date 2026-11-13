import test from "node:test";
import assert from "node:assert/strict";
import { searchWeb } from "../src/tools/web-search.js";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("searchWeb sends a Japanese-region Tavily request and normalizes results", async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return Response.json({
      results: [
        { title: "日本語のページ", content: "検索結果の説明", url: "https://example.jp/", score: 0.9 },
        { title: "英語ページ", content: "English result", url: "https://example.com/" }
      ]
    });
  };

  const result = await searchWeb(
    { query: "日本語の検索" },
    { env: { TAVILY_API_KEY: "test-key" }, language: "ja" }
  );

  assert.equal(request.url, "https://api.tavily.com/search");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer test-key");
  assert.deepEqual(JSON.parse(request.options.body), {
    query: "日本語の検索",
    topic: "general",
    search_depth: "basic",
    max_results: 5,
    include_answer: false,
    include_raw_content: false,
    country: "Japan"
  });
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].title, "日本語のページ");
  assert.equal(result.results[0].text, "検索結果の説明");
  assert.equal(result.results[0].url, "https://example.jp/");
});

test("searchWeb uses the injected keyless client without requiring a key", async () => {
  let received;
  const result = await searchWeb(
    { query: "multilingual search" },
    {
      language: "en",
      tavilyClient: {
        search: async (query, options) => {
          received = { query, options };
          return { results: [{ title: "Example", content: "Snippet", url: "https://example.com" }] };
        }
      }
    }
  );

  assert.equal(received.query, "multilingual search");
  assert.equal(received.options.country, "United States");
  assert.equal(result.results[0].url, "https://example.com/");
});

test("searchWeb validates query length and emptiness", async () => {
  await assert.rejects(searchWeb({ query: " " }, { env: { TAVILY_API_KEY: "x" } }), /Invalid search query/);
  await assert.rejects(searchWeb({ query: "x".repeat(301) }, { env: { TAVILY_API_KEY: "x" } }), /Invalid search query/);
});

test("searchWeb surfaces provider HTTP errors without leaking response bodies", async () => {
  globalThis.fetch = async () => new Response("private provider diagnostic", { status: 401 });
  await assert.rejects(
    searchWeb({ query: "test" }, { env: { TAVILY_API_KEY: "x" } }),
    error => {
      assert.match(error.message, /status 401/);
      assert.doesNotMatch(error.message, /private provider diagnostic/);
      return true;
    }
  );
});

test("searchWeb returns a helpful empty-result note", async () => {
  globalThis.fetch = async () => Response.json({ results: [] });
  const result = await searchWeb({ query: "unknown" }, { env: { TAVILY_API_KEY: "x" } });
  assert.equal(result.results.length, 0);
  assert.match(result.note, /検索結果が見つかりません/);
});

test("searchWeb drops non-HTTP and credential-bearing result URLs", async () => {
  globalThis.fetch = async () => Response.json({
    results: [
      { title: "Safe", content: "Safe page", url: "https://example.com/safe" },
      { title: "Script", content: "Unsafe scheme", url: "javascript:alert(1)" },
      { title: "Credentials", content: "Unsafe credentials", url: "https://user:pass@example.com/private" }
    ]
  });
  const result = await searchWeb({ query: "safe URLs" }, { env: { TAVILY_API_KEY: "x" } });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].title, "Safe");
  assert.equal(result.results[0].url, "https://example.com/safe");
});

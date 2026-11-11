const TAVILY_SEARCH_ENDPOINT = "https://api.tavily.com/search";
const SEARCH_TIMEOUT_MS = 12_000;
const MAX_QUERY_LENGTH = 300;

function normalizeResults(data, query) {
  const results = (Array.isArray(data.results) ? data.results : [])
    .filter(item => item && typeof item.url === "string")
    .slice(0, 5)
    .map(item => ({
      title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : item.url,
      text: typeof item.content === "string" ? item.content.trim() : "",
      url: item.url,
      score: typeof item.score === "number" ? item.score : undefined
    }));

  return {
    query,
    results,
    note: results.length ? undefined : "検索結果が見つかりませんでした。別の検索語で試してください。"
  };
}

export async function searchWeb({ query }, context = {}) {
  if (typeof query !== "string" || !query.trim() || query.length > MAX_QUERY_LENGTH) {
    throw new Error("Invalid search query");
  }

  const normalizedQuery = query.trim();
  const country = context.language === "ja"
    ? "Japan"
    : context.language === "en"
      ? "United States"
      : undefined;
  const searchOptions = {
    topic: "general",
    searchDepth: "basic",
    maxResults: 5,
    includeAnswer: false,
    includeRawContent: false,
    ...(country ? { country } : {})
  };

  // An API key enables the dedicated quota. Without one, use Tavily's
  // official SDK keyless mode (shared rate limits; no card registration).
  if (!context.env?.TAVILY_API_KEY && context.tavilyClient) {
    const data = await context.tavilyClient.search(normalizedQuery, searchOptions);
    return normalizeResults(data, normalizedQuery);
  }

  if (!context.env?.TAVILY_API_KEY) {
    const { tavily } = await import("@tavily/core");
    const client = tavily();
    const data = await client.search(normalizedQuery, searchOptions);
    return normalizeResults(data, normalizedQuery);
  }

  const response = await fetch(TAVILY_SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.env.TAVILY_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      query: normalizedQuery,
      topic: "general",
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
      ...(country ? { country } : {})
    }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS)
  });

  if (!response.ok) {
    // Do not include provider response bodies: they may contain request data.
    throw new Error(`Tavily search failed with status ${response.status}`);
  }

  return normalizeResults(await response.json(), normalizedQuery);
}

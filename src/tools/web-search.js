const TAVILY_SEARCH_ENDPOINT = "https://api.tavily.com/search";
const SEARCH_TIMEOUT_MS = 12_000;
const MAX_QUERY_LENGTH = 300;

export async function searchWeb({ query }, context = {}) {
  if (typeof query !== "string" || !query.trim() || query.length > MAX_QUERY_LENGTH) {
    throw new Error("Invalid search query");
  }

  const apiKey = context.env?.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  const response = await fetch(TAVILY_SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      query: query.trim(),
      topic: "general",
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: false
    }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS)
  });

  if (!response.ok) {
    // Do not include provider response bodies: they may contain request data.
    throw new Error(`Tavily search failed with status ${response.status}`);
  }

  const data = await response.json();
  const results = (Array.isArray(data.results) ? data.results : [])
    .filter(item => item && typeof item.url === "string")
    .slice(0, 5)
    .map(item => ({
      title: typeof item.title === "string" && item.title.trim()
        ? item.title.trim()
        : item.url,
      text: typeof item.content === "string" ? item.content.trim() : "",
      url: item.url,
      score: typeof item.score === "number" ? item.score : undefined
    }));

  return {
    query: query.trim(),
    results,
    note: results.length ? undefined : "検索結果が見つかりませんでした。別の検索語で試してください。"
  };
}

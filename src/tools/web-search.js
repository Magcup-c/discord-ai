export async function searchWeb({ query }) {
  if (typeof query !== "string" || !query.trim() || query.length > 300) {
    throw new Error("Invalid search query");
  }
  const url = new URL("https://api.duckduckgo.com/");
  url.search = new URLSearchParams({
    q: query.trim(),
    format: "json",
    no_html: "1",
    skip_disambig: "1"
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("Search request failed");
  const data = await response.json();

  const results = [];
  if (data.AbstractText) {
    results.push({
      title: data.Heading || "概要",
      text: data.AbstractText,
      url: data.AbstractURL || null
    });
  }
  for (const item of data.RelatedTopics || []) {
    if (item.Text && item.FirstURL) {
      results.push({ title: item.Text.slice(0, 100), url: item.FirstURL });
    } else if (Array.isArray(item.Topics)) {
      for (const nested of item.Topics) {
        if (nested.Text && nested.FirstURL) {
          results.push({ title: nested.Text.slice(0, 100), url: nested.FirstURL });
        }
      }
    }
    if (results.length >= 6) break;
  }
  return {
    query: query.trim(),
    results: results.slice(0, 6),
    note: results.length ? undefined : "検索APIから要約結果が返りませんでした。別の検索語で試してください。"
  };
}

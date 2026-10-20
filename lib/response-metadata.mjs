/** Keep provider citations intact in the model history; expose only safe source metadata. */
export function appendCitationDelta(citations, delta) {
  const previous = Array.isArray(citations) ? citations : [];
  if (delta?.type !== "citations_delta" || !delta.citation || typeof delta.citation !== "object" || Array.isArray(delta.citation)) return previous;
  return [...previous, delta.citation];
}

function sourceId(value) {
  // Stable across tool rounds so the same real source is not shown repeatedly.
  let a = 2166136261, b = 3339675911;
  for (const char of value) {
    a = Math.imul(a ^ char.codePointAt(0), 16777619);
    b = Math.imul(b ^ char.codePointAt(0), 2246822519);
  }
  return `source-${(a >>> 0).toString(36)}-${(b >>> 0).toString(36)}`;
}

/** No URL extraction from prose or tool results: only native structured citations count. */
export function responseSources(content) {
  if (!Array.isArray(content)) return [];
  const sources = new Map();
  for (const block of content) {
    if (block?.type !== "text" || !Array.isArray(block.citations)) continue;
    for (const citation of block.citations) {
      if (!citation || typeof citation !== "object" || Array.isArray(citation)) continue;
      const web = ["web_search_result_location", "search_result_location"].includes(citation.type);
      const document = ["page_location", "char_location", "content_block_location"].includes(citation.type);
      if (!web && !document) continue;
      if (web) {
        if (typeof citation.url !== "string") continue;
        let url;
        try { url = new URL(citation.url); } catch { continue; }
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) continue;
        const domain = url.hostname.replace(/^www\./u, "");
        const title = typeof citation.title === "string" && citation.title.trim() ? citation.title.trim() : domain;
        const key = `url:${url.href}`;
        sources.set(key, { id: sourceId(key), title, domain, url: url.href });
      } else {
        if (!Number.isSafeInteger(citation.document_index) || citation.document_index < 0) continue;
        const title = typeof citation.document_title === "string" && citation.document_title.trim() ? citation.document_title.trim() : `Document ${citation.document_index + 1}`;
        const key = `document:${citation.document_index}:${title}`;
        sources.set(key, { id: sourceId(key), title, domain: "Document joint" });
      }
    }
  }
  return [...sources.values()];
}

export function responseStatus(runId, runStatus) {
  if (!runId) return "unknown";
  if (runStatus === "streaming") return "streaming";
  if (runStatus === "completed") return "complete";
  if (runStatus === "cancelled") return "cancelled";
  if (runStatus === "failed" || runStatus === "partial") return "error";
  return "unknown";
}

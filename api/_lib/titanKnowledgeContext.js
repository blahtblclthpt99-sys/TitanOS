export function normalizeKnowledgeQuery(question = "") {
  return String(question || "")
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function safeKnowledgeRow(row) {
  return {
    slug: String(row?.slug || "").slice(0, 120),
    domain: String(row?.domain || "general").slice(0, 80),
    title: String(row?.title || "").slice(0, 240),
    content: String(row?.content || "").slice(0, 1800),
    tags: Array.isArray(row?.tags) ? row.tags.map((tag) => String(tag).slice(0, 60)).slice(0, 12) : [],
    source: String(row?.source || "titanos").slice(0, 120),
    quality: Math.max(0, Math.min(1, Number(row?.quality_score ?? 0.8))),
    classification: "TITAN_KNOWLEDGE",
  };
}

export async function loadTitanKnowledgeContext(admin, question = "", { limit = 8 } = {}) {
  if (!admin) return [];
  const query = normalizeKnowledgeQuery(question);
  if (query.length < 2) return [];

  const boundedLimit = Math.max(1, Math.min(12, Number(limit) || 8));
  const { data, error } = await admin
    .from("titan_ai_knowledge")
    .select("slug,domain,title,content,tags,source,quality_score")
    .eq("enabled", true)
    .textSearch("search_document", query, { type: "websearch", config: "english" })
    .order("quality_score", { ascending: false })
    .limit(boundedLimit);

  if (error || !Array.isArray(data)) return [];
  return data.map(safeKnowledgeRow);
}

export function formatTitanKnowledgeForPrompt(items = []) {
  if (!Array.isArray(items) || items.length === 0) return "(no relevant Titan knowledge retrieved)";
  return items
    .slice(0, 12)
    .map((item, index) => {
      const tags = item.tags?.length ? ` | tags=${item.tags.join(",")}` : "";
      return `${index + 1}. [${item.classification || "TITAN_KNOWLEDGE"}] ${item.title} (${item.domain}) — ${item.content}${tags} | source=${item.source} | quality=${item.quality}`;
    })
    .join("\n");
}

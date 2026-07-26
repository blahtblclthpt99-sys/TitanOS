/**
 * Persist Titan AI turns so global search can index conversations.
 * Session UI still owns live state; this is a searchable rolling log.
 */
import { readLocal, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_ai_chat";
const MAX_TURNS = 200;

function turns(userId) {
  return readLocal(PREFIX, userId, "turns", []);
}

export function appendAiConversationTurn(userId, { role, text, at } = {}) {
  if (!userId) return;
  const body = String(text || "").trim();
  if (!body) return;
  const row = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: role === "assistant" ? "assistant" : "user",
    text: body.slice(0, 2000),
    at: at || new Date().toISOString(),
  };
  const next = [...turns(userId), row].slice(-MAX_TURNS);
  writeLocal(PREFIX, userId, "turns", next);
  return row;
}

export function clearAiConversations(userId) {
  if (!userId) return;
  writeLocal(PREFIX, userId, "turns", []);
}

export function listAiConversationDocs(userId) {
  if (!userId) return [];
  return turns(userId).map((t) => {
    const snippet = t.text.length > 80 ? `${t.text.slice(0, 80)}…` : t.text;
    return {
      id: `ai-${t.id}`,
      group: "AI conversations",
      label: snippet,
      hint: t.role === "assistant" ? "Titan AI reply" : "You asked Titan AI",
      path: `/assistant?q=${encodeURIComponent(t.text.slice(0, 120))}`,
      haystack: `${t.text} titan ai assistant conversation chat`,
      boost: 5,
    };
  });
}

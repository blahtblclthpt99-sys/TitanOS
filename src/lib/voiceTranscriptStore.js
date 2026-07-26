/**
 * Voice transcript log for global search (dock / AI mic / coach).
 */
import { readLocal, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_voice_tx";
const MAX = 100;

function rows(userId) {
  return readLocal(PREFIX, userId, "transcripts", []);
}

export function appendVoiceTranscript(userId, text, source = "voice") {
  if (!userId) return null;
  const body = String(text || "").trim();
  if (!body) return null;
  const row = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: body.slice(0, 1000),
    source: String(source || "voice"),
    at: new Date().toISOString(),
  };
  writeLocal(PREFIX, userId, "transcripts", [...rows(userId), row].slice(-MAX));
  return row;
}

export function listVoiceTranscriptDocs(userId) {
  if (!userId) return [];
  return rows(userId).map((t) => {
    const snippet = t.text.length > 72 ? `${t.text.slice(0, 72)}…` : t.text;
    return {
      id: `voice-${t.id}`,
      group: "Voice transcripts",
      label: snippet,
      hint: `Voice · ${t.source}`,
      path: "/assistant",
      haystack: `${t.text} voice transcript speech ${t.source}`,
      boost: 4,
    };
  });
}

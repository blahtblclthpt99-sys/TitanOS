/**
 * TitanComms channel catalog — local-first with optional Supabase tables (030).
 * Live audio uses Realtime; this module stores channel membership + text.
 */
import { supabase, isSupabaseConfigured } from "@/api/supabaseClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";

const PREFIX = "titanos_comms";

/** Stable public network channels so any signed-in user can meet on Realtime. */
export const NETWORK_CHANNELS = Object.freeze([
  {
    id: "tc-general",
    name: "General",
    description: "Company-wide push-to-talk",
    kind: "public",
    icon: "radio",
  },
  {
    id: "tc-dispatch",
    name: "Dispatch",
    description: "Drivers and dispatchers",
    kind: "public",
    icon: "truck",
  },
  {
    id: "tc-drivers",
    name: "Drivers",
    description: "Field drivers only",
    kind: "public",
    icon: "car",
  },
  {
    id: "tc-emergency",
    name: "Emergency",
    description: "SOS and urgent crew alerts",
    kind: "emergency",
    icon: "siren",
  },
]);

export const VOICE_STATUSES = Object.freeze([
  { id: "available", label: "Available", color: "text-emerald-400" },
  { id: "busy", label: "Busy", color: "text-titan-amber" },
  { id: "driving", label: "Driving", color: "text-sky-400" },
  { id: "dnd", label: "Do Not Disturb", color: "text-rose-400" },
  { id: "emergency", label: "Emergency", color: "text-red-400" },
  { id: "offline", label: "Offline", color: "text-muted-foreground" },
]);

function customChannels(userId) {
  return readLocal(PREFIX, userId, "channels", []);
}

function saveCustom(userId, rows) {
  writeLocal(PREFIX, userId, "channels", rows);
}

function memberships(userId) {
  return readLocal(PREFIX, userId, "memberships", {});
}

function saveMemberships(userId, map) {
  writeLocal(PREFIX, userId, "memberships", map);
}

function messagesLocal(channelId) {
  return readLocal(PREFIX, "global", `msg_${channelId}`, []);
}

function saveMessagesLocal(channelId, rows) {
  writeLocal(PREFIX, "global", `msg_${channelId}`, rows);
}

export function listChannels(userId) {
  if (!userId) return [...NETWORK_CHANNELS];
  const joined = memberships(userId);
  const custom = customChannels(userId).filter((c) => joined[c.id] || c.created_by_id === userId);
  const network = NETWORK_CHANNELS.map((c) => ({
    ...c,
    joined: Boolean(joined[c.id] ?? true),
  }));
  // Auto-join network channels on first visit
  let map = { ...joined };
  let dirty = false;
  for (const c of NETWORK_CHANNELS) {
    if (map[c.id] == null) {
      map[c.id] = { role: "member", joined_at: new Date().toISOString() };
      dirty = true;
    }
  }
  if (dirty) saveMemberships(userId, map);
  return [...network, ...custom.map((c) => ({ ...c, joined: true }))];
}

export async function createChannel(user, { name, description = "", kind = "private" }) {
  const row = {
    id: uid(),
    name: String(name || "").trim() || "New channel",
    description: String(description || "").trim(),
    kind: kind === "public" ? "public" : "private",
    created_by_id: user.id,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("titan_comms_channels")
        .insert({
          name: row.name,
          description: row.description,
          kind: row.kind,
          created_by_id: user.id,
        })
        .select("*")
        .single();
      if (!error && data) {
        await supabase.from("titan_comms_members").insert({
          channel_id: data.id,
          user_id: user.id,
          role: "owner",
        });
        const mapped = {
          id: data.id,
          name: data.name,
          description: data.description || "",
          kind: data.kind,
          created_by_id: data.created_by_id,
          created_at: data.created_at,
        };
        saveCustom(user.id, [mapped, ...customChannels(user.id)]);
        const map = memberships(user.id);
        map[mapped.id] = { role: "owner", joined_at: new Date().toISOString() };
        saveMemberships(user.id, map);
        return mapped;
      }
    } catch {
      /* local fallback */
    }
  }

  saveCustom(user.id, [row, ...customChannels(user.id)]);
  const map = memberships(user.id);
  map[row.id] = { role: "owner", joined_at: new Date().toISOString() };
  saveMemberships(user.id, map);
  return row;
}

export function getVoiceStatus(userId) {
  return readLocal(PREFIX, userId, "voice_status", "available");
}

export function setVoiceStatus(userId, status) {
  const allowed = VOICE_STATUSES.map((s) => s.id);
  const next = allowed.includes(status) ? status : "available";
  writeLocal(PREFIX, userId, "voice_status", next);
  return next;
}

export function listChannelMessages(channelId) {
  return messagesLocal(channelId).slice(-100);
}

export async function postChannelMessage(user, channelId, body, messageType = "text", metadata = {}) {
  const row = {
    id: uid(),
    channel_id: channelId,
    sender_id: user.id,
    sender_name: user.full_name || user.email || "User",
    body: String(body || "").trim(),
    message_type: messageType,
    metadata,
    created_at: new Date().toISOString(),
  };
  if (!row.body && messageType === "text") throw new Error("Message is empty");

  saveMessagesLocal(channelId, [...messagesLocal(channelId), row]);

  if (isSupabaseConfigured() && !String(channelId).startsWith("tc-")) {
    try {
      await supabase.from("titan_comms_messages").insert({
        channel_id: channelId,
        sender_id: user.id,
        body: row.body,
        message_type: messageType,
        metadata,
      });
    } catch {
      /* local ok */
    }
  }
  return row;
}

export function getShareLocation(userId) {
  return Boolean(readLocal(PREFIX, userId, "share_location", false));
}

export function setShareLocation(userId, on) {
  writeLocal(PREFIX, userId, "share_location", Boolean(on));
  return Boolean(on);
}

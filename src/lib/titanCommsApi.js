/**
 * TitanCom channel catalog — local-first with optional Supabase tables (030/031).
 * Live audio uses Realtime; this module stores channel membership + text.
 *
 * Rules:
 * - Channel creator is the sole admin (no transfers).
 * - Free users: custom channels expire end-of-day (must remake).
 * - Premium/Business: custom channels persist.
 * - Public custom channels are discoverable so coworkers/friends can join.
 */
import { supabase, isSupabaseConfigured } from "@/api/supabaseClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { canPersistTitanComChannels, isPaidPlan } from "@/lib/plan";
import { endOfLocalDayIso, isChannelAdmin, isChannelExpired } from "@/lib/titanComRules.js";

export { endOfLocalDayIso, isChannelAdmin, isChannelExpired } from "@/lib/titanComRules.js";

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
    id: "tc-rideshare",
    name: "Rideshare",
    description: "Uber / Lyft / passenger trips",
    kind: "public",
    icon: "car",
  },
  {
    id: "tc-delivery",
    name: "Delivery",
    description: "DoorDash / food / package runs",
    kind: "public",
    icon: "package",
  },
  {
    id: "tc-warehouse",
    name: "Warehouse",
    description: "Dock, staging, and load-out",
    kind: "public",
    icon: "warehouse",
  },
  {
    id: "tc-yard",
    name: "Yard",
    description: "Lot, staging, and vehicle check-in",
    kind: "public",
    icon: "map",
  },
  {
    id: "tc-site",
    name: "Site Ops",
    description: "Job-site crews and supervisors",
    kind: "public",
    icon: "hardhat",
  },
  {
    id: "tc-night",
    name: "Night Shift",
    description: "After-hours and overnight crews",
    kind: "public",
    icon: "moon",
  },
  {
    id: "tc-break",
    name: "Break Room",
    description: "Casual chatter — keep work channels clean",
    kind: "public",
    icon: "coffee",
  },
  {
    id: "tc-training",
    name: "Training",
    description: "Onboarding and how-to talk",
    kind: "public",
    icon: "book",
  },
  {
    id: "tc-roadside",
    name: "Roadside",
    description: "Tow, jump, and breakdown help",
    kind: "public",
    icon: "wrench",
  },
  {
    id: "tc-events",
    name: "Events",
    description: "Concerts, venues, and temp gigs",
    kind: "public",
    icon: "calendar",
  },
  {
    id: "tc-emergency",
    name: "Emergency",
    description: "Urgent crew channel — switch here when needed",
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

function publicBoard() {
  return readLocal(PREFIX, "global", "public_channels", []);
}

function savePublicBoard(rows) {
  writeLocal(PREFIX, "global", "public_channels", rows);
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

function normalizeCustom(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    kind: row.kind === "public" ? "public" : "private",
    created_by_id: row.created_by_id,
    created_at: row.created_at,
    expires_at: row.expires_at || null,
    admin_id: row.admin_id || row.created_by_id,
    custom: true,
  };
}

function pruneExpiredFromStores(userId) {
  const mine = customChannels(userId).filter((c) => !isChannelExpired(c));
  if (mine.length !== customChannels(userId).length) saveCustom(userId, mine);

  const board = publicBoard().filter((c) => !isChannelExpired(c));
  if (board.length !== publicBoard().length) savePublicBoard(board);

  const map = memberships(userId);
  let dirty = false;
  for (const id of Object.keys(map)) {
    if (String(id).startsWith("tc-")) continue;
    const known =
      mine.find((c) => c.id === id) ||
      board.find((c) => c.id === id);
    if (known && isChannelExpired(known)) {
      delete map[id];
      dirty = true;
    }
  }
  if (dirty) saveMemberships(userId, map);
}

/**
 * List network + custom channels. Public customs appear for everyone (joinable).
 * Expired free-tier customs are dropped.
 */
export function listChannels(userId) {
  if (!userId) return [...NETWORK_CHANNELS];
  pruneExpiredFromStores(userId);

  const joined = memberships(userId);
  const mine = customChannels(userId);
  const board = publicBoard().filter(
    (c) => c.kind === "public" && c.created_by_id !== userId && !isChannelExpired(c)
  );

  const network = NETWORK_CHANNELS.map((c) => ({
    ...c,
    joined: Boolean(joined[c.id] ?? true),
    custom: false,
  }));

  let map = { ...joined };
  let dirty = false;
  for (const c of NETWORK_CHANNELS) {
    if (map[c.id] == null) {
      map[c.id] = { role: "member", joined_at: new Date().toISOString() };
      dirty = true;
    }
  }
  if (dirty) saveMemberships(userId, map);

  const customs = [
    ...mine.map((c) => ({
      ...normalizeCustom(c),
      joined: true,
      expired: isChannelExpired(c),
      isAdmin: isChannelAdmin(c, userId),
    })),
    ...board.map((c) => ({
      ...normalizeCustom(c),
      joined: Boolean(map[c.id]),
      expired: false,
      isAdmin: false,
    })),
  ].filter((c) => !c.expired);

  return [...network, ...customs];
}

export async function createChannel(user, { name, description = "", kind = "public" } = {}) {
  if (!user?.id) throw new Error("Sign in to create a channel");
  const trimmed = String(name || "").trim();
  if (trimmed.length < 2) throw new Error("Channel name needs at least 2 characters");
  if (trimmed.length > 48) throw new Error("Channel name is too long");

  const persist = canPersistTitanComChannels(user);
  const channelKind = kind === "private" ? "private" : "public";
  const row = {
    id: uid(),
    name: trimmed,
    description: String(description || "").trim().slice(0, 160),
    kind: channelKind,
    created_by_id: user.id,
    admin_id: user.id,
    created_at: new Date().toISOString(),
    expires_at: persist ? null : endOfLocalDayIso(),
    custom: true,
  };

  if (isSupabaseConfigured()) {
    try {
      const insert = {
        name: row.name,
        description: row.description,
        kind: row.kind,
        created_by_id: user.id,
      };
      // expires_at column added in 031 — ignore if missing
      try {
        insert.expires_at = row.expires_at;
      } catch {
        /* noop */
      }
      const { data, error } = await supabase
        .from("titan_comms_channels")
        .insert(insert)
        .select("*")
        .single();
      if (!error && data) {
        await supabase.from("titan_comms_members").insert({
          channel_id: data.id,
          user_id: user.id,
          role: "admin",
        });
        const mapped = normalizeCustom({
          id: data.id,
          name: data.name,
          description: data.description || "",
          kind: data.kind,
          created_by_id: data.created_by_id,
          admin_id: data.created_by_id,
          created_at: data.created_at,
          expires_at: data.expires_at || row.expires_at,
        });
        saveCustom(user.id, [mapped, ...customChannels(user.id).filter((c) => c.id !== mapped.id)]);
        if (mapped.kind === "public") {
          savePublicBoard([mapped, ...publicBoard().filter((c) => c.id !== mapped.id)]);
        }
        const map = memberships(user.id);
        map[mapped.id] = { role: "admin", joined_at: new Date().toISOString() };
        saveMemberships(user.id, map);
        return mapped;
      }
    } catch {
      /* local fallback */
    }
  }

  saveCustom(user.id, [row, ...customChannels(user.id)]);
  if (row.kind === "public") {
    savePublicBoard([row, ...publicBoard().filter((c) => c.id !== row.id)]);
  }
  const map = memberships(user.id);
  map[row.id] = { role: "admin", joined_at: new Date().toISOString() };
  saveMemberships(user.id, map);
  return row;
}

/** Join a public custom channel (coworkers / friends). Creator remains sole admin. */
export async function joinChannel(user, channelId) {
  if (!user?.id) throw new Error("Sign in required");
  if (String(channelId).startsWith("tc-")) {
    const map = memberships(user.id);
    map[channelId] = { role: "member", joined_at: new Date().toISOString() };
    saveMemberships(user.id, map);
    return { id: channelId, role: "member" };
  }

  const board = publicBoard();
  const mine = customChannels(user.id);
  const channel = board.find((c) => c.id === channelId) || mine.find((c) => c.id === channelId);
  if (!channel) throw new Error("Channel not found");
  if (isChannelExpired(channel)) throw new Error("This channel expired — ask the creator to remake it");
  if (channel.kind !== "public" && channel.created_by_id !== user.id) {
    throw new Error("This channel is private");
  }

  const map = memberships(user.id);
  if (map[channelId]?.role === "admin") return { id: channelId, role: "admin" };
  map[channelId] = { role: "member", joined_at: new Date().toISOString() };
  saveMemberships(user.id, map);

  if (isSupabaseConfigured() && !String(channelId).startsWith("tc-")) {
    try {
      await supabase.from("titan_comms_members").upsert(
        { channel_id: channelId, user_id: user.id, role: "member" },
        { onConflict: "channel_id,user_id" }
      );
    } catch {
      /* local ok */
    }
  }
  return { id: channelId, role: "member" };
}

/** Admin-only delete. No admin transfer — delete and remake if needed. */
export async function deleteChannel(user, channelId) {
  if (!user?.id) throw new Error("Sign in required");
  const mine = customChannels(user.id);
  const channel = mine.find((c) => c.id === channelId);
  if (!channel || !isChannelAdmin(channel, user.id)) {
    throw new Error("Only the channel admin can delete this channel");
  }
  saveCustom(
    user.id,
    mine.filter((c) => c.id !== channelId)
  );
  savePublicBoard(publicBoard().filter((c) => c.id !== channelId));
  const map = memberships(user.id);
  delete map[channelId];
  saveMemberships(user.id, map);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from("titan_comms_channels").delete().eq("id", channelId).eq("created_by_id", user.id);
    } catch {
      /* local ok */
    }
  }
  return true;
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

export function freeChannelHint(user) {
  if (isPaidPlan(user) || canPersistTitanComChannels(user)) {
    return "Your channels stay until you delete them. You are the only admin.";
  }
  return "Free plan: custom channels expire tonight. Remake tomorrow, or upgrade to keep them.";
}

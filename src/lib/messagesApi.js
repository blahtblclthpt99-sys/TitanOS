/**
 * Unified messaging — threads, receipts, typing, attachments, search, notify.
 * Local-first with MarketplaceMessage remote when available.
 */
import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { pushNotification } from "@/lib/notificationsApi";
import { showMessagePush } from "@/lib/messagePush";

const PREFIX = "titanos_dm";
const TYPING_TTL_MS = 3500;
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

function allMessages() {
  return readLocal(PREFIX, "global", "messages", []);
}

function saveMessages(rows) {
  writeLocal(PREFIX, "global", "messages", rows);
}

function allThreads() {
  return readLocal(PREFIX, "global", "threads", []);
}

function saveThreads(rows) {
  writeLocal(PREFIX, "global", "threads", rows);
}

export function threadIdFor(userA, userB, context = "dm") {
  const pair = [String(userA), String(userB)].sort().join("_");
  return `${context}_${pair}`;
}

function previewFor(message) {
  if (!message) return "";
  if (message.type === "image") return "📷 Photo";
  if (message.type === "file") return `📎 ${message.attachment?.name || "File"}`;
  if (message.type === "voice") return "🎤 Voice message";
  return String(message.body || "").slice(0, 120);
}

function upsertThread(threadPatch) {
  const threads = allThreads();
  const idx = threads.findIndex((t) => t.id === threadPatch.id);
  if (idx >= 0) {
    threads[idx] = { ...threads[idx], ...threadPatch };
  } else {
    threads.unshift({
      created_at: new Date().toISOString(),
      ...threadPatch,
    });
  }
  saveThreads(threads);
  return threads.find((t) => t.id === threadPatch.id);
}

function seedIfEmpty(user) {
  if (!user?.id) return;
  const mine = allThreads().filter((t) => (t.participant_ids || []).includes(user.id));
  if (mine.length) return;

  const supportId = "titan_support";
  const tid = threadIdFor(user.id, supportId, "dm");
  const now = Date.now();
  const welcome = {
    id: uid(),
    thread_id: tid,
    sender_id: supportId,
    recipient_id: user.id,
    body: "Welcome to Titan Messages. Send texts, photos, files, or voice notes — and search any conversation anytime.",
    type: "text",
    attachment: null,
    read_at: null,
    created_at: new Date(now - 60000).toISOString(),
    created_by_id: supportId,
  };
  const tip = {
    id: uid(),
    thread_id: tid,
    sender_id: supportId,
    recipient_id: user.id,
    body: "Tip: Use the paperclip for files, the camera for images, and the mic for voice. Read receipts appear under your messages.",
    type: "text",
    attachment: null,
    read_at: null,
    created_at: new Date(now - 30000).toISOString(),
    created_by_id: supportId,
  };
  saveMessages([...allMessages(), welcome, tip]);
  upsertThread({
    id: tid,
    participant_ids: [user.id, supportId],
    participant_names: {
      [user.id]: user.full_name || user.username || "You",
      [supportId]: "Titan Support",
    },
    title: "Titan Support",
    last_message_at: tip.created_at,
    last_preview: previewFor(tip),
    context: "dm",
  });
}

export async function ensureDemoInbox(user) {
  seedIfEmpty(user);
}

export async function listConversations(userId) {
  if (!userId) return [];
  seedIfEmpty({ id: userId });

  // Merge marketplace_messages when remote works
  try {
    const remote = await api.entities.MarketplaceMessage.list("-created_date", 200);
    mergeRemoteMessages(userId, remote || []);
  } catch {
    /* local only */
  }

  const threads = allThreads()
    .filter((t) => (t.participant_ids || []).includes(userId))
    .map((t) => enrichThread(t, userId))
    .sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
  return threads;
}

function enrichThread(thread, userId) {
  const msgs = allMessages().filter((m) => m.thread_id === thread.id);
  const unread = msgs.filter((m) => m.recipient_id === userId && !m.read_at).length;
  const peerId = (thread.participant_ids || []).find((id) => id !== userId) || "";
  const peerName =
    thread.title ||
    thread.participant_names?.[peerId] ||
    (peerId === "titan_support" ? "Titan Support" : "Conversation");
  return {
    ...thread,
    peer_id: peerId,
    peer_name: peerName,
    unread,
    message_count: msgs.length,
  };
}

function mergeRemoteMessages(userId, remoteRows) {
  const existing = allMessages();
  const byId = new Map(existing.map((m) => [m.id, m]));
  let changed = false;
  for (const row of remoteRows) {
    if (!row?.id) continue;
    if (row.sender_id !== userId && row.recipient_id !== userId) continue;
    if (byId.has(row.id)) continue;
    const msg = {
      id: row.id,
      thread_id: row.thread_id || threadIdFor(row.sender_id, row.recipient_id, row.hire_job_id ? "hire" : row.listing_id ? "listing" : "dm"),
      sender_id: row.sender_id,
      recipient_id: row.recipient_id,
      body: row.body || "",
      type: row.type || "text",
      attachment: row.attachment || null,
      read_at: row.read_at || null,
      created_at: row.created_at || row.created_date || new Date().toISOString(),
      created_by_id: row.created_by_id || row.sender_id,
      listing_id: row.listing_id || null,
      hire_job_id: row.hire_job_id || null,
    };
    existing.push(msg);
    byId.set(msg.id, msg);
    changed = true;
    upsertThread({
      id: msg.thread_id,
      participant_ids: [msg.sender_id, msg.recipient_id],
      participant_names: {},
      last_message_at: msg.created_at,
      last_preview: previewFor(msg),
      listing_id: msg.listing_id,
      hire_job_id: msg.hire_job_id,
      context: msg.hire_job_id ? "hire" : msg.listing_id ? "listing" : "dm",
    });
  }
  if (changed) saveMessages(existing);
}

export async function listMessages(userId, threadId) {
  if (!userId || !threadId) return [];
  return allMessages()
    .filter((m) => m.thread_id === threadId && (m.sender_id === userId || m.recipient_id === userId))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export async function markThreadRead(userId, threadId) {
  if (!userId || !threadId) return;
  const now = new Date().toISOString();
  const rows = allMessages().map((m) => {
    if (m.thread_id !== threadId || m.recipient_id !== userId || m.read_at) return m;
    return { ...m, read_at: now };
  });
  saveMessages(rows);

  try {
    const remote = await api.entities.MarketplaceMessage.filter({ thread_id: threadId });
    await Promise.all(
      (remote || [])
        .filter((m) => m.recipient_id === userId && !m.read_at)
        .map((m) => api.entities.MarketplaceMessage.update(m.id, { read_at: now }))
    );
  } catch {
    /* ignore */
  }
}

export async function ensureThread(user, { peerId, peerName, context = "dm", listingId = null, hireJobId = null, title = null }) {
  if (!user?.id || !peerId) throw new Error("Missing participants");
  const id =
    context === "listing" && listingId
      ? `${listingId}_${[user.id, peerId].sort().join("_")}`
      : context === "hire" && hireJobId
        ? `hire_${hireJobId}_${[user.id, peerId].sort().join("_")}`
        : threadIdFor(user.id, peerId, "dm");

  return upsertThread({
    id,
    participant_ids: [user.id, peerId],
    participant_names: {
      [user.id]: user.full_name || user.username || "You",
      [peerId]: peerName || title || "Contact",
    },
    title: title || peerName || null,
    listing_id: listingId,
    hire_job_id: hireJobId,
    context,
    last_message_at: allThreads().find((t) => t.id === id)?.last_message_at || new Date().toISOString(),
    last_preview: allThreads().find((t) => t.id === id)?.last_preview || "",
  });
}

export async function sendMessage(
  user,
  {
    threadId,
    recipientId,
    body = "",
    type = "text",
    attachment = null,
    listingId = null,
    hireJobId = null,
    recipientName = null,
  }
) {
  if (!user?.id || !recipientId) throw new Error("Missing sender or recipient");
  const tid = threadId || threadIdFor(user.id, recipientId, hireJobId ? "hire" : listingId ? "listing" : "dm");
  const text = String(body || "").trim();
  if (type === "text" && !text) throw new Error("Empty message");
  if ((type === "image" || type === "file" || type === "voice") && !attachment?.url) {
    throw new Error("Missing attachment");
  }

  const payload = {
    thread_id: tid,
    sender_id: user.id,
    recipient_id: recipientId,
    body: text,
    type,
    attachment,
    read_at: null,
    listing_id: listingId,
    hire_job_id: hireJobId,
    created_by_id: user.id,
  };

  let saved;
  try {
    saved = await api.entities.MarketplaceMessage.create({
      ...payload,
      body: type === "text" ? text : text || previewFor({ type, attachment, body: text }),
    });
    saved = {
      ...payload,
      id: saved.id,
      created_at: saved.created_at || saved.created_date || new Date().toISOString(),
    };
  } catch {
    saved = { id: uid(), created_at: new Date().toISOString(), ...payload };
  }

  const rows = allMessages();
  rows.push(saved);
  saveMessages(rows);

  upsertThread({
    id: tid,
    participant_ids: [user.id, recipientId],
    participant_names: {
      [user.id]: user.full_name || user.username || "You",
      [recipientId]: recipientName || "Contact",
    },
    title: recipientName || null,
    listing_id: listingId,
    hire_job_id: hireJobId,
    context: hireJobId ? "hire" : listingId ? "listing" : "dm",
    last_message_at: saved.created_at,
    last_preview: previewFor(saved),
  });

  clearTyping(tid, user.id);

  const preview = previewFor(saved);
  const senderLabel = user.full_name || user.username || "Someone";
  await pushNotification(
    recipientId,
    {
      type: "messages",
      category: "messages",
      title: `Message from ${senderLabel}`,
      body: preview,
      link: `/messages?thread=${encodeURIComponent(tid)}`,
      meta: { thread_id: tid, message_id: saved.id },
    },
    null
  );
  showMessagePush({
    title: `Message from ${senderLabel}`,
    body: preview,
    threadId: tid,
  });

  return saved;
}

/** File / image → data URL attachment (size-capped). */
export function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file"));
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return reject(new Error("File must be under 4 MB"));
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        url: reader.result,
        name: file.name || "file",
        mime: file.type || "application/octet-stream",
        size: file.size || 0,
      });
    };
    reader.onerror = () => reject(new Error("Couldn't read file"));
    reader.readAsDataURL(file);
  });
}

export function setTyping(threadId, userId, name = "") {
  if (!threadId || !userId) return;
  writeLocal(PREFIX, threadId, "typing", {
    user_id: userId,
    name,
    at: Date.now(),
  });
}

export function clearTyping(threadId, userId) {
  const cur = readLocal(PREFIX, threadId, "typing", null);
  if (cur?.user_id === userId) {
    writeLocal(PREFIX, threadId, "typing", null);
  }
}

export function getTyping(threadId, excludeUserId) {
  const cur = readLocal(PREFIX, threadId, "typing", null);
  if (!cur?.user_id || cur.user_id === excludeUserId) return null;
  if (Date.now() - (cur.at || 0) > TYPING_TTL_MS) return null;
  return cur;
}

/**
 * Conversation + message search (sync for global search).
 */
export function searchConversationsSync(userId, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!userId || !q) return [];
  const threads = allThreads().filter((t) => (t.participant_ids || []).includes(userId));
  const msgs = allMessages().filter((m) => m.sender_id === userId || m.recipient_id === userId);
  const hits = [];

  for (const t of threads) {
    const peerId = (t.participant_ids || []).find((id) => id !== userId);
    const name = (t.title || t.participant_names?.[peerId] || "").toLowerCase();
    const preview = (t.last_preview || "").toLowerCase();
    if (name.includes(q) || preview.includes(q)) {
      hits.push({
        id: `thread-${t.id}`,
        label: t.title || t.participant_names?.[peerId] || "Conversation",
        hint: t.last_preview || "Conversation",
        path: `/messages?thread=${encodeURIComponent(t.id)}`,
        group: "Messages",
        score: name.includes(q) ? 75 : 55,
      });
    }
  }

  for (const m of msgs) {
    const body = String(m.body || "").toLowerCase();
    const fname = String(m.attachment?.name || "").toLowerCase();
    if (!body.includes(q) && !fname.includes(q)) continue;
    const thread = threads.find((t) => t.id === m.thread_id);
    const peerId = thread ? (thread.participant_ids || []).find((id) => id !== userId) : null;
    hits.push({
      id: `msg-${m.id}`,
      label: previewFor(m) || "Message",
      hint: thread?.title || thread?.participant_names?.[peerId] || "Message match",
      path: `/messages?thread=${encodeURIComponent(m.thread_id)}`,
      group: "Messages",
      score: 50,
    });
  }

  const seen = new Set();
  return hits
    .filter((h) => {
      if (seen.has(h.path + h.label)) return false;
      seen.add(h.path + h.label);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export async function searchConversations(userId, query) {
  return searchConversationsSync(userId, query);
}

export async function unreadMessageCount(userId) {
  if (!userId) return 0;
  return allMessages().filter((m) => m.recipient_id === userId && !m.read_at).length;
}

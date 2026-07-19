import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { locationLabel } from "@/lib/platformConstants";
import {
  assertCleanLanguage,
  assertCommunityPostRateLimit,
  countPostsInWindow,
  COMMUNITY_POST_LIMIT,
} from "@/lib/contentModeration";

const PREFIX = "titanos_community";

/** Never include customer name, company, address, or dollar amounts. */
export function sanitizeCommunityPost(input, user) {
  return {
    author_id: user.id,
    author_username: user.username || (user.full_name || "Worker").split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") + String(user.id).slice(0, 2),
    city: user.privacy_prefs?.show_city === false ? "" : user.city || input.city || "",
    state: user.state || input.state || "",
    category: input.category || "General",
    description: (input.description || "").trim().slice(0, 500),
    photos: Array.isArray(input.photos) ? input.photos.slice(0, 4) : [],
    job_id: input.job_id || null,
    like_count: 0,
    comment_count: 0,
    status: "published",
    created_by_id: user.id,
  };
}

export async function listCommunityPosts(limit = 40) {
  try {
    const rows = await api.entities.CommunityPost.list("-created_date", limit);
    return rows.filter((p) => p.status === "published");
  } catch {
    return readLocal(PREFIX, "global", "posts", []);
  }
}

async function listAuthorPosts(userId) {
  try {
    const rows = await api.entities.CommunityPost.filter({ author_id: userId });
    return rows || [];
  } catch {
    return readLocal(PREFIX, "global", "posts", []).filter(
      (p) => String(p.author_id) === String(userId) || String(p.created_by_id) === String(userId)
    );
  }
}

export async function getCommunityPostQuota(userId) {
  const mine = await listAuthorPosts(userId);
  const used = countPostsInWindow(mine, userId);
  return { used, limit: COMMUNITY_POST_LIMIT, remaining: Math.max(0, COMMUNITY_POST_LIMIT - used) };
}

export async function createCommunityPost(user, input) {
  if (!user.community_opt_in && !user.privacy_prefs?.share_completed_jobs) {
    throw new Error("Enable community sharing in Settings → Privacy first.");
  }
  assertCleanLanguage(input.description, "posts");
  const mine = await listAuthorPosts(user.id);
  assertCommunityPostRateLimit(countPostsInWindow(mine, user.id));

  const payload = sanitizeCommunityPost(input, user);
  try {
    const post = await api.entities.CommunityPost.create(payload);
    await publishActivity({
      actor_id: user.id,
      actor_name: payload.author_username,
      event_type: "job_completed",
      category: payload.category,
      city: payload.city,
      state: payload.state,
      summary: `${payload.author_username} completed a ${payload.category} job${payload.city ? ` in ${locationLabel(payload.city, payload.state)}` : ""}.`,
    });
    return post;
  } catch (error) {
    if (error?.message?.includes("foul language") || error?.message?.includes("every 12 hours") || error?.message?.includes("Enable community")) {
      throw error;
    }
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
    const all = readLocal(PREFIX, "global", "posts", []);
    all.unshift(row);
    writeLocal(PREFIX, "global", "posts", all);
    return row;
  }
}

export async function toggleLike(userId, postId) {
  try {
    const existing = await api.entities.CommunityLike.filter({ user_id: userId, post_id: postId });
    if (existing.length) {
      await api.entities.CommunityLike.delete(existing[0].id);
      return false;
    }
    await api.entities.CommunityLike.create({ user_id: userId, post_id: postId, created_by_id: userId });
    return true;
  } catch {
    const likes = readLocal(PREFIX, userId, "likes", []);
    const i = likes.indexOf(postId);
    if (i >= 0) {
      likes.splice(i, 1);
      writeLocal(PREFIX, userId, "likes", likes);
      return false;
    }
    likes.push(postId);
    writeLocal(PREFIX, userId, "likes", likes);
    return true;
  }
}

export async function addComment(user, postId, body) {
  assertCleanLanguage(body, "comments");
  const payload = {
    post_id: postId,
    author_id: user.id,
    author_username: user.username || user.full_name?.split(" ")[0] || "User",
    body: body.trim(),
    status: "published",
    created_by_id: user.id,
  };
  try {
    return await api.entities.CommunityComment.create(payload);
  } catch (error) {
    if (error?.message?.includes("foul language")) throw error;
    const rows = readLocal(PREFIX, "global", "comments", []);
    rows.push({ id: uid(), created_at: new Date().toISOString(), ...payload });
    writeLocal(PREFIX, "global", "comments", rows);
    return rows[rows.length - 1];
  }
}

export async function listComments(postId) {
  try {
    return await api.entities.CommunityComment.filter({ post_id: postId });
  } catch {
    return readLocal(PREFIX, "global", "comments", []).filter((c) => c.post_id === postId);
  }
}

export async function deleteCommunityPost(userId, id) {
  try {
    await api.entities.CommunityPost.delete(id);
  } catch {
    writeLocal(
      PREFIX,
      "global",
      "posts",
      readLocal(PREFIX, "global", "posts", []).filter((row) => row.id !== id)
    );
  }
}

export async function publishActivity(event) {
  const payload = {
    ...event,
    meta: event.meta || {},
    created_by_id: event.actor_id || null,
  };
  try {
    return await api.entities.ActivityEvent.create(payload);
  } catch {
    const rows = readLocal(PREFIX, "global", "activity", []);
    rows.unshift({ id: uid(), created_at: new Date().toISOString(), ...payload });
    writeLocal(PREFIX, "global", "activity", rows.slice(0, 100));
    return rows[0];
  }
}

export async function listActivity(limit = 30) {
  try {
    return await api.entities.ActivityEvent.list("-created_date", limit);
  } catch {
    return readLocal(PREFIX, "global", "activity", []).slice(0, limit);
  }
}

/** Poll-friendly activity fetch — UI should call on interval / focus. */
export async function listActivitySince(isoTimestamp) {
  const all = await listActivity(50);
  if (!isoTimestamp) return all;
  const t = new Date(isoTimestamp).getTime();
  return all.filter((e) => new Date(e.created_at || e.created_date).getTime() > t);
}

/**
 * Community content moderation: foul language + post rate limits.
 */

export const COMMUNITY_POST_LIMIT = 2;
export const COMMUNITY_POST_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours

/** Common profanity / abuse terms (normalized matching). */
const BLOCKED_TERMS = [
  "asshole",
  "assholes",
  "bastard",
  "bitch",
  "bitches",
  "bollocks",
  "bullshit",
  "cock",
  "cocksucker",
  "cunt",
  "damn",
  "dick",
  "dickhead",
  "dumbass",
  "faggot",
  "fuck",
  "fucker",
  "fucking",
  "fucked",
  "fuckin",
  "motherfucker",
  "nigger",
  "nigga",
  "piss",
  "pussy",
  "retard",
  "retarded",
  "shit",
  "shitty",
  "slut",
  "whore",
];

function normalizeForModeration(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[@#$%^&*0-9]/g, (ch) => {
      const map = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };
      return map[ch] ?? "";
    })
    .replace(/[^a-z\s]/g, " ")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns a blocked term if foul language is detected, otherwise null.
 */
export function findFoulLanguage(text) {
  const normalized = normalizeForModeration(text);
  if (!normalized) return null;
  for (const term of BLOCKED_TERMS) {
    const re = new RegExp(`(?:^|\\s)${term}(?:$|\\s)`);
    if (re.test(normalized)) return term;
  }
  return null;
}

export function assertCleanLanguage(text, label = "message") {
  const hit = findFoulLanguage(text);
  if (hit) {
    throw new Error(`Please keep ${label} professional — foul language isn't allowed.`);
  }
}

/**
 * Count how many of the user's community posts fall inside the 12h window.
 */
export function countPostsInWindow(posts, userId, now = Date.now()) {
  const cutoff = now - COMMUNITY_POST_WINDOW_MS;
  return (posts || []).filter((post) => {
    if (String(post.author_id) !== String(userId) && String(post.created_by_id) !== String(userId)) {
      return false;
    }
    const ts = new Date(post.created_at || post.created_date || 0).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  }).length;
}

export function assertCommunityPostRateLimit(recentCount) {
  if (recentCount >= COMMUNITY_POST_LIMIT) {
    throw new Error(
      `You can share up to ${COMMUNITY_POST_LIMIT} community posts every 12 hours. Try again later.`
    );
  }
}

export function remainingCommunityPosts(recentCount) {
  return Math.max(0, COMMUNITY_POST_LIMIT - (recentCount || 0));
}

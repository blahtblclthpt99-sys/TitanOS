/**
 * Professional profile — career bio, portfolio, social links, skills, work
 * history and achievements. Platform trust fields are never user-authored.
 * Local-first with optional profiles.professional_profile sync.
 */
import { api } from "@/api/apiClient";
import { readLocal, writeLocal } from "@/lib/localStore";
import { averageRating, listReviewsForUser } from "@/lib/jobReviewsApi";

const PREFIX = "titanos_pro_profile";
const INDEX_KEY = "by_slug";

export const SKILL_SUGGESTIONS = [
  "Customer service",
  "Project management",
  "Scheduling",
  "Sales",
  "Data entry",
  "Microsoft Office",
  "Warehouse operations",
  "Forklift",
  "Delivery",
  "CDL Class A",
  "CDL Class B",
  "Safety compliance",
  "Fleet operations",
  "HVAC",
  "Plumbing",
  "Electrical",
];

// Kept as metadata for rendering server-authoritative badges only. These are
// not user-selectable and are stripped from user-authored profile payloads.
export const BADGE_CATALOG = [
  { id: "verified", label: "Verified pro", description: "Identity or credentials reviewed by TitanOS" },
];

const TRUST_PROFILE_KEYS = new Set([
  "verified",
  "verification_notes",
  "badges",
  "jobs_completed",
  "years_experience",
  "rating",
  "review_count",
  "reliability_rate",
  "titan_score",
]);

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function cleanString(value, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanSocial(raw = {}) {
  return {
    website: cleanString(raw.website, 2048),
    linkedin: cleanString(raw.linkedin, 2048),
    instagram: cleanString(raw.instagram, 2048),
    facebook: cleanString(raw.facebook, 2048),
    youtube: cleanString(raw.youtube, 2048),
    x: cleanString(raw.x, 2048),
  };
}

function cleanList(raw, maxItems, mapper) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, maxItems).map(mapper).filter(Boolean);
}

function trustedProfileState(user = {}) {
  const verified = user.verified_worker === true;
  return {
    verified,
    verification_notes: verified ? cleanString(user.verification_notes, 1000) : "",
    badges: verified ? ["verified"] : [],
  };
}

/**
 * Remove any platform-owned trust/reputation fields from a user-authored patch.
 * This is defense in depth; the database trigger enforces the same boundary.
 */
export function stripUserTrustClaims(raw = {}) {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw).filter(([key]) => !TRUST_PROFILE_KEYS.has(key)));
}

export function emptyProfessionalProfile(user = {}) {
  const username = user.username || slugify(user.full_name) || "pro";
  return {
    user_id: user.id || "",
    slug: slugify(username) || `pro-${(user.id || "user").slice(0, 8)}`,
    display_name: user.full_name || user.username || "Professional",
    headline: "",
    bio: user.bio || "",
    avatar_url: user.avatar_url || "",
    city: user.city || "",
    state: user.state || "",
    company_name: user.company_name || "",
    ...trustedProfileState(user),
    social: cleanSocial(),
    skills: [],
    portfolio: [],
    work_history: [],
    achievements: [],
    public: true,
    updated_at: new Date().toISOString(),
  };
}

export function normalizeProfile(raw, user = {}) {
  const base = emptyProfessionalProfile(user);
  if (!raw || typeof raw !== "object") return base;
  const editable = stripUserTrustClaims(raw);

  return {
    ...base,
    user_id: user.id || cleanString(editable.user_id, 128) || base.user_id,
    slug: slugify(editable.slug || base.slug) || base.slug,
    display_name: cleanString(editable.display_name || base.display_name, 120) || base.display_name,
    headline: cleanString(editable.headline, 180),
    bio: cleanString(editable.bio, 5000),
    avatar_url: cleanString(editable.avatar_url, 2048),
    city: cleanString(editable.city, 120),
    state: cleanString(editable.state, 120),
    company_name: cleanString(editable.company_name, 180),
    social: cleanSocial(editable.social),
    skills: cleanList(editable.skills, 24, (skill) => cleanString(skill, 120)).filter(Boolean),
    portfolio: cleanList(editable.portfolio, 24, (item) => {
      if (!item || typeof item !== "object") return null;
      return {
        id: cleanString(item.id, 128),
        title: cleanString(item.title, 180),
        description: cleanString(item.description, 3000),
        image_url: cleanString(item.image_url, 2048),
        year: cleanString(item.year, 20),
      };
    }),
    work_history: cleanList(editable.work_history, 40, (item) => {
      if (!item || typeof item !== "object") return null;
      return {
        id: cleanString(item.id, 128),
        role: cleanString(item.role, 180),
        company: cleanString(item.company, 180),
        start: cleanString(item.start, 40),
        end: cleanString(item.end, 40),
        summary: cleanString(item.summary, 4000),
      };
    }),
    achievements: cleanList(editable.achievements, 24, (item) => {
      if (!item || typeof item !== "object") return null;
      return {
        id: cleanString(item.id, 128),
        title: cleanString(item.title, 180),
        year: cleanString(item.year, 20),
        description: cleanString(item.description, 3000),
      };
    }),
    public: editable.public !== false,
    updated_at: cleanString(editable.updated_at, 64) || new Date().toISOString(),
    ...trustedProfileState(user),
  };
}

function readIndex() {
  return readLocal(PREFIX, "global", INDEX_KEY, {});
}

function writeIndex(index) {
  writeLocal(PREFIX, "global", INDEX_KEY, index);
}

function readOwned(userId) {
  return readLocal(PREFIX, userId, "profile", null);
}

function writeOwned(userId, profile) {
  writeLocal(PREFIX, userId, "profile", profile);
  const index = readIndex();
  if (profile.public && profile.slug) {
    index[profile.slug] = { user_id: userId, updated_at: profile.updated_at };
  } else if (profile.slug) {
    delete index[profile.slug];
  }
  writeIndex(index);
  // Public mirror is display content only. Trust claims are stripped again on
  // public read unless supplied by an authoritative server identity.
  if (profile.public) {
    writeLocal(PREFIX, "public", profile.slug, stripUserTrustClaims(profile));
  }
}

function seedDemoIfNeeded(user) {
  if (!user?.id) return;
  if (readOwned(user.id)) return;

  // Empty starter only — never invent portfolio, work history, or badges.
  const profile = normalizeProfile(
    {
      headline: "",
      bio: user.bio || "",
      skills: [],
      portfolio: [],
      work_history: [],
      achievements: [],
      social: cleanSocial(),
      public: false,
    },
    user
  );
  writeOwned(user.id, profile);
}

export async function getMyProfessionalProfile(user) {
  if (!user?.id) return emptyProfessionalProfile();
  seedDemoIfNeeded(user);
  let local = normalizeProfile(readOwned(user.id), user);
  try {
    const me = await api.auth.me();
    if (me?.professional_profile) {
      // Top-level verification fields returned by auth are authoritative; the
      // nested professional_profile object is still treated as user-authored.
      local = normalizeProfile({ ...local, ...me.professional_profile }, {
        ...user,
        verified_worker: me.verified_worker === true,
        verification_notes: me.verification_notes || "",
      });
    }
  } catch {
    /* local */
  }
  return local;
}

export async function saveProfessionalProfile(user, patch) {
  if (!user?.id) throw new Error("Sign in to save your profile");
  const current = await getMyProfessionalProfile(user);
  const editablePatch = stripUserTrustClaims(patch);
  let next = normalizeProfile(
    {
      ...current,
      ...editablePatch,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    },
    user
  );
  next.slug = slugify(editablePatch?.slug || next.slug || user.username || user.full_name) || next.slug;

  // Ensure unique slug locally
  const index = readIndex();
  if (index[next.slug] && index[next.slug].user_id !== user.id) {
    next.slug = `${next.slug}-${String(user.id).slice(0, 6)}`;
  }

  writeOwned(user.id, next);

  try {
    // Never forward top-level or nested verification/reputation authority from
    // profile editing. updateMe also excludes privileged top-level columns.
    const serverProfile = stripUserTrustClaims(next);
    await api.auth.updateMe({
      professional_profile: serverProfile,
      bio: next.bio,
      username: next.slug,
    });
  } catch {
    /* local-first */
  }

  return next;
}

export async function getPublicProfileBySlug(slug) {
  const key = slugify(slug);
  if (!key) return null;

  const mirrored = readLocal(PREFIX, "public", key, null);
  if (mirrored?.public !== false) {
    // A browser-local mirror can never establish verification or reputation.
    return normalizeProfile(stripUserTrustClaims(mirrored));
  }

  const index = readIndex();
  const hit = index[key];
  if (hit?.user_id) {
    const owned = readOwned(hit.user_id);
    if (owned?.public !== false) return normalizeProfile(stripUserTrustClaims(owned));
  }

  return null;
}

export async function getProfileReviews(userId) {
  if (!userId) return { reviews: [], average: 0, count: 0 };
  const reviews = await listReviewsForUser(userId);
  return {
    reviews: reviews.sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    ),
    average: averageRating(reviews),
    count: reviews.length,
  };
}

export function badgeMeta(badgeId) {
  return BADGE_CATALOG.find((b) => b.id === badgeId) || { id: badgeId, label: badgeId, description: "" };
}

export function publicProfilePath(slug) {
  return `/u/${encodeURIComponent(slugify(slug) || "profile")}`;
}

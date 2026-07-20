/**
 * Professional profile — bio, ratings, portfolio, verification, social,
 * skills, work history, achievements, reviews, badges.
 * Local-first with optional profiles.professional_profile sync.
 */
import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { averageRating, listReviewsForUser } from "@/lib/jobReviewsApi";

const PREFIX = "titanos_pro_profile";
const INDEX_KEY = "by_slug";

export const SKILL_SUGGESTIONS = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Roofing",
  "Landscaping",
  "CDL Class A",
  "CDL Class B",
  "Project management",
  "Customer service",
  "Estimating",
  "Safety compliance",
  "Fleet operations",
];

export const BADGE_CATALOG = [
  { id: "verified", label: "Verified pro", description: "Identity and credentials reviewed" },
  { id: "top_rated", label: "Top rated", description: "Consistently high customer ratings" },
  { id: "reliable", label: "Reliable", description: "On-time and dependable" },
  { id: "fast_response", label: "Fast response", description: "Quick to reply and schedule" },
  { id: "community", label: "Community contributor", description: "Active in Titan Community" },
  { id: "milestone_10", label: "10 jobs", description: "Completed 10+ jobs on TitanOS" },
  { id: "milestone_50", label: "50 jobs", description: "Completed 50+ jobs on TitanOS" },
  { id: "rising_star", label: "Rising star", description: "Strong early reputation" },
];

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
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
    verified: Boolean(user.verified_worker),
    verification_notes: user.verification_notes || "",
    social: {
      website: "",
      linkedin: "",
      instagram: "",
      facebook: "",
      youtube: "",
      x: "",
    },
    skills: [],
    portfolio: [],
    work_history: [],
    achievements: [],
    badges: user.verified_worker ? ["verified"] : [],
    public: true,
    updated_at: new Date().toISOString(),
  };
}

export function normalizeProfile(raw, user = {}) {
  const base = emptyProfessionalProfile(user);
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    social: { ...base.social, ...(raw.social || {}) },
    skills: Array.isArray(raw.skills) ? raw.skills : [],
    portfolio: Array.isArray(raw.portfolio) ? raw.portfolio : [],
    work_history: Array.isArray(raw.work_history) ? raw.work_history : [],
    achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
    badges: Array.isArray(raw.badges) ? raw.badges : base.badges,
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
  // Public mirror for slug lookup
  if (profile.public) {
    writeLocal(PREFIX, "public", profile.slug, profile);
  }
}

function seedDemoIfNeeded(user) {
  if (!user?.id) return;
  if (readOwned(user.id)) return;

  const profile = normalizeProfile(
    {
      headline: "Trusted field professional on TitanOS",
      bio:
        user.bio ||
        "I help customers get quality work done on time — from estimates to completed jobs. View my portfolio, skills, and reviews below.",
      skills: ["Customer service", "Estimating", "Safety compliance"],
      portfolio: [
        {
          id: uid(),
          title: "Residential HVAC upgrade",
          description: "Full system replacement with efficiency improvements.",
          image_url: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=800&h=600&fit=crop",
          year: "2025",
        },
        {
          id: uid(),
          title: "Commercial maintenance contract",
          description: "Ongoing service for a multi-unit property.",
          image_url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop",
          year: "2024",
        },
      ],
      work_history: [
        {
          id: uid(),
          role: user.company_name ? "Owner / Operator" : "Field technician",
          company: user.company_name || "Independent",
          start: "2020",
          end: "Present",
          summary: "Leading jobs, customer communication, and quality control.",
        },
      ],
      achievements: [
        {
          id: uid(),
          title: "Customer satisfaction focus",
          year: "2025",
          description: "Maintained strong review averages across completed jobs.",
        },
      ],
      badges: user.verified_worker ? ["verified", "reliable", "rising_star"] : ["reliable", "rising_star"],
      social: {
        website: "",
        linkedin: "",
        instagram: "",
        facebook: "",
        youtube: "",
        x: "",
      },
      public: true,
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
      local = normalizeProfile({ ...local, ...me.professional_profile }, user);
    }
  } catch {
    /* local */
  }
  return local;
}

export async function saveProfessionalProfile(user, patch) {
  if (!user?.id) throw new Error("Sign in to save your profile");
  const current = await getMyProfessionalProfile(user);
  let next = normalizeProfile(
    {
      ...current,
      ...patch,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    },
    user
  );
  next.slug = slugify(patch?.slug || next.slug || user.username || user.full_name) || next.slug;

  // Ensure unique slug locally
  const index = readIndex();
  if (index[next.slug] && index[next.slug].user_id !== user.id) {
    next.slug = `${next.slug}-${String(user.id).slice(0, 6)}`;
  }

  writeOwned(user.id, next);

  try {
    await api.auth.updateMe({
      professional_profile: next,
      bio: next.bio,
      username: next.slug,
      verified_worker: next.verified,
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
    return normalizeProfile(mirrored);
  }

  const index = readIndex();
  const hit = index[key];
  if (hit?.user_id) {
    const owned = readOwned(hit.user_id);
    if (owned?.public !== false) return normalizeProfile(owned);
  }

  // Demo public profiles for discovery
  if (key === "titan-demo" || key === "demo") {
    return normalizeProfile({
      slug: "titan-demo",
      display_name: "Alex Titan",
      headline: "Licensed trades & field operations",
      bio: "Demo professional profile showcasing portfolio, skills, verification, and reviews on TitanOS.",
      city: "Dallas",
      state: "TX",
      verified: true,
      skills: ["HVAC", "Electrical", "Project management"],
      portfolio: [
        {
          id: "p1",
          title: "Kitchen remodel coordination",
          description: "Managed subcontractors and punch-list to finish.",
          image_url: "https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=800&h=600&fit=crop",
          year: "2025",
        },
      ],
      work_history: [
        {
          id: "w1",
          role: "Lead technician",
          company: "Titan Field Services",
          start: "2018",
          end: "Present",
          summary: "Crew leadership and customer-facing quality checks.",
        },
      ],
      achievements: [
        {
          id: "a1",
          title: "Zero safety incidents",
          year: "2024",
          description: "Full year without recordable incidents.",
        },
      ],
      badges: ["verified", "top_rated", "fast_response", "milestone_50"],
      social: { website: "https://titanos-web.vercel.app", linkedin: "", instagram: "", facebook: "", youtube: "", x: "" },
      public: true,
    });
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

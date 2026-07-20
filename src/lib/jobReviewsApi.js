import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { notifyUser } from "@/lib/notify";

const PREFIX = "titanos_reviews";

function localKey(userId) {
  return userId || "global";
}

export async function createJobReview(user, {
  jobId,
  hireJobId,
  revieweeId,
  reviewerRole,
  rating,
  body,
  badges = [],
}) {
  if (!user?.id) {
    throw new Error("Sign in to submit a review.");
  }

  const target = String(revieweeId || jobId || hireJobId || "").trim();
  if (!target) {
    throw new Error("Missing review target.");
  }

  const payload = {
    job_id: jobId || null,
    hire_job_id: hireJobId || null,
    reviewer_id: String(user.id),
    reviewee_id: target,
    reviewer_role: reviewerRole === "customer" ? "customer" : "worker",
    rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    body: (body || "").trim(),
    badges: Array.isArray(badges) ? badges : [],
  };

  const persistLocal = (row) => {
    const key = localKey(user.id);
    const rows = readLocal(PREFIX, key, "all", []);
    rows.unshift(row);
    writeLocal(PREFIX, key, "all", rows);
    // Also keep a global mirror for Reputation aggregates
    const global = readLocal(PREFIX, "global", "all", []);
    global.unshift(row);
    writeLocal(PREFIX, "global", "all", global.slice(0, 500));
    return row;
  };

  try {
    const row = await api.entities.JobReview.create(payload);
    // Don't fail the whole submit if notify errors
    if (target && !target.includes(":") && target !== String(jobId || "")) {
      try {
        await notifyUser(target, {
          type: "reviews",
          title: "New review received",
          body: `${user.full_name || "Someone"} left you a ${payload.rating}-star review.`,
          link: "/reputation",
        });
      } catch {
        /* ignore */
      }
    }
    persistLocal({ ...row, id: row.id || uid(), created_at: row.created_at || new Date().toISOString() });
    return row;
  } catch (err) {
    // Persist locally so ratings never silently vanish if JobReview table/RLS blocks
    const row = {
      id: uid(),
      created_at: new Date().toISOString(),
      created_by_id: user.id,
      ...payload,
      _local: true,
      _error: err?.message || "remote_failed",
    };
    return persistLocal(row);
  }
}

export async function listReviewsForUser(userId) {
  try {
    const remote = await api.entities.JobReview.filter({ reviewee_id: userId });
    if (remote?.length) return remote;
  } catch {
    /* fall through */
  }
  return readLocal(PREFIX, "global", "all", []).filter((r) => r.reviewee_id === userId);
}

export function averageRating(reviews = []) {
  if (!reviews.length) return 0;
  return reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length;
}

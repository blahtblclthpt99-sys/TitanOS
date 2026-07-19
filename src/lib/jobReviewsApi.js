import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { notifyUser } from "@/lib/notify";

const PREFIX = "titanos_reviews";

export async function createJobReview(user, {
  jobId,
  hireJobId,
  revieweeId,
  reviewerRole,
  rating,
  body,
  badges = [],
}) {
  const payload = {
    job_id: jobId || null,
    hire_job_id: hireJobId || null,
    reviewer_id: user.id,
    reviewee_id: revieweeId,
    reviewer_role: reviewerRole,
    rating: Number(rating),
    body: (body || "").trim(),
    badges,
    created_by_id: user.id,
  };

  try {
    const row = await api.entities.JobReview.create(payload);
    await notifyUser(revieweeId, {
      type: "reviews",
      title: "New review received",
      body: `${user.full_name || "Someone"} left you a ${rating}-star review.`,
      link: "/notifications",
    });
    return row;
  } catch {
    const rows = readLocal(PREFIX, "global", "all", []);
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
    rows.unshift(row);
    writeLocal(PREFIX, "global", "all", rows);
    return row;
  }
}

export async function listReviewsForUser(userId) {
  try {
    return await api.entities.JobReview.filter({ reviewee_id: userId });
  } catch {
    return readLocal(PREFIX, "global", "all", []).filter((r) => r.reviewee_id === userId);
  }
}

export function averageRating(reviews = []) {
  if (!reviews.length) return 0;
  return reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length;
}

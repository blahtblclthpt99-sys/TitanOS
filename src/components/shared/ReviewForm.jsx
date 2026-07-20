import React, { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { createJobReview } from "@/lib/jobReviewsApi";
import { useAuth } from "@/lib/AuthContext";

export default function ReviewForm({
  revieweeId,
  reviewerRole = "customer",
  jobId,
  hireJobId,
  onSubmitted,
}) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!user?.id || saving) return;
    const targetId = revieweeId || jobId || hireJobId;
    if (!targetId) {
      toast({
        variant: "destructive",
        title: "Link a customer first",
        description: "Open the job, add a customer, then submit the rating.",
      });
      return;
    }
    setSaving(true);
    try {
      const row = await createJobReview(user, {
        jobId,
        hireJobId,
        revieweeId: targetId,
        reviewerRole,
        rating,
        body,
      });
      toast({
        title: "Review submitted",
        description: row?._local
          ? "Saved on this device (server sync pending)."
          : "Thanks for your feedback.",
      });
      setBody("");
      onSubmitted?.();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't submit review",
        description: err.message || "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">Leave a rating</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className="p-1"
            aria-label={`${n} stars`}
          >
            <Star
              className={`w-5 h-5 ${n <= rating ? "text-titan-amber fill-titan-amber" : "text-muted-foreground"}`}
            />
          </button>
        ))}
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share how the job went…"
        className="bg-muted border-border text-foreground rounded-xl min-h-[80px]"
      />
      <Button
        type="submit"
        disabled={saving}
        className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-10 disabled:opacity-50"
      >
        {saving ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}

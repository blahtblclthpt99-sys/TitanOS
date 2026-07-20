import React, { useEffect, useState } from "react";
import { Copy, Star } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import { listReviewsForUser } from "@/lib/jobReviewsApi";

export default function Reputation() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reply, setReply] = useState(
    "Thank you for your review! We appreciate the opportunity to serve you."
  );

  const load = () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    let alive = true;
    listReviewsForUser(user.id)
      .then((rows) => {
        if (alive) setReviews(rows);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  };

  useEffect(() => {
    const cleanup = load();
    return typeof cleanup === "function" ? cleanup : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (loading) return <PageLoader variant="list" label="Loading reputation" />;
  if (error) return <ErrorState title="Couldn't load reviews" onRetry={load} />;

  return (
    <div className="page-pad max-w-5xl mx-auto">
      <PageHeader title="Reputation" subtitle="Review feedback and customer replies" />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          {reviews.map((row) => (
            <article key={row.id} className="titan-surface p-4">
              <div className="flex text-titan-amber" aria-label={`${row.rating} stars`}>
                {Array.from({ length: Number(row.rating) || 0 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" aria-hidden="true" />
                ))}
              </div>
              <p className="mt-2 text-foreground">{row.body}</p>
            </article>
          ))}
          {!reviews.length && (
            <EmptyState title="No reviews yet" description="Completed jobs with ratings will show up here." />
          )}
        </section>
        <section className="titan-surface h-fit p-5">
          <h2 className="font-semibold text-foreground">AI reply draft</h2>
          <p className="my-2 text-xs text-muted-foreground">Personalize this before posting.</p>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="min-h-36 bg-muted border-border text-foreground"
            aria-label="Reply draft"
          />
          <Button
            type="button"
            onClick={() => navigator.clipboard?.writeText(reply)}
            className="mt-3"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy reply
          </Button>
        </section>
      </div>
    </div>
  );
}

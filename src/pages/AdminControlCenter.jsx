import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Shield, Users, MessageSquare, Store, Percent, Landmark } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { api } from "@/api/apiClient";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { isUserAdmin } from "@/lib/isAdmin";

async function ensureValidAdminSession() {
  const current = await supabase.auth.getUser();
  if (!current.error && current.data?.user) return current.data.user;

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data?.session?.access_token) {
    const error = new Error("Your administrator session expired. Sign in again, then reopen Control Center.");
    error.code = "ADMIN_SESSION_EXPIRED";
    throw error;
  }

  const verified = await supabase.auth.getUser();
  if (verified.error || !verified.data?.user) {
    const error = new Error("Your administrator session could not be verified. Sign in again, then reopen Control Center.");
    error.code = "ADMIN_SESSION_INVALID";
    throw error;
  }
  return verified.data.user;
}

export default function AdminControlCenter() {
  const { user, authChecked } = useAuth();
  const [data, setData] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [error, setError] = useState("");
  const [feedbackWarning, setFeedbackWarning] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setFeedbackWarning(false);
    try {
      // Validate/refresh once before privileged requests. This prevents two
      // concurrent admin calls from racing session recovery on an expired JWT.
      await ensureValidAdminSession();

      const summary = await api.functions.invoke("adminControl", { action: "summary" });
      setData(summary);

      // Feedback is useful but non-critical. A feedback-only failure should not
      // take the entire Control Center offline after platform health loaded.
      try {
        const inbox = await api.functions.invoke("adminControl", { action: "feedback" });
        setFeedback(inbox.feedback || []);
      } catch (feedbackError) {
        if (Number(feedbackError?.status || 0) === 401 || Number(feedbackError?.status || 0) === 403) {
          throw feedbackError;
        }
        setFeedback([]);
        setFeedbackWarning(true);
      }
    } catch (loadError) {
      setData(null);
      setError(
        loadError?.code === "ADMIN_SESSION_EXPIRED" || loadError?.code === "ADMIN_SESSION_INVALID"
          ? loadError.message
          : Number(loadError?.status || 0) === 401
            ? "Your administrator session expired. Sign in again, then reopen Control Center."
            : Number(loadError?.status || 0) === 403
              ? "This signed-in account does not currently have server administrator access."
              : "The administrator service could not load. Retry after checking your connection."
      );
    }
  }, []);

  useEffect(() => {
    if (authChecked && isUserAdmin(user)) load();
  }, [authChecked, user, load]);

  if (!authChecked) return <PageLoader label="Checking administrator access" />;
  if (!isUserAdmin(user)) return <ErrorState title="Access denied" description="Administrator access is required." />;
  if (error) return <ErrorState title="Control Center unavailable" description={error} onRetry={load} />;
  if (!data) return <PageLoader label="Loading Control Center" />;

  const cards = [
    ["Users", data.counts.users, Users],
    ["Unread feedback", data.counts.unread_feedback, MessageSquare],
    ["Jobs", data.counts.jobs, Shield],
    ["Listings", data.counts.listings, Store],
  ];

  return (
    <PageShell maxWidth="xl" className="space-y-5">
      <PageHeader eyebrow="Hidden · Administrators only" title="Administrator Control Center" subtitle="Platform health, users, feedback, commerce, and moderation." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value, Icon]) => (
          <div key={label} className="titan-surface p-4">
            <Icon className="h-5 w-5 text-primary" />
            <p className="mt-3 text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Button asChild variant="outline" className="min-h-[48px]"><Link to="/admin/moderation"><Store className="mr-2 h-4 w-4" />Moderation</Link></Button>
        <Button asChild variant="outline" className="min-h-[48px]"><Link to="/admin/fees"><Percent className="mr-2 h-4 w-4" />Fees & Stripe</Link></Button>
        <Button asChild variant="outline" className="min-h-[48px]"><Link to="/admin/tax-rules"><Landmark className="mr-2 h-4 w-4" />Tax rules</Link></Button>
      </div>
      <section className="titan-surface p-4 space-y-3">
        <h2 className="font-semibold">Feedback inbox</h2>
        {feedbackWarning ? <p className="text-sm text-amber-600">Feedback could not load, but the rest of Control Center is available. Retry to refresh the inbox.</p> : null}
        {feedback.length === 0 ? <p className="text-sm text-muted-foreground">No feedback yet.</p> : feedback.slice(0, 50).map((item) => (
          <article key={item.id} className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium capitalize">{item.category || item.type}</p>
              <select
                value={item.status}
                onChange={async (event) => {
                  const status = event.target.value;
                  await api.functions.invoke("adminControl", { action: "feedback_status", id: item.id, status });
                  setFeedback((rows) => rows.map((row) => row.id === item.id ? { ...row, status } : row));
                }}
                className="min-h-[44px] rounded-md border border-border bg-muted px-2 text-sm"
              >
                <option value="unread">Unread</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{item.message}</p>
            <p className="mt-2 text-xs text-muted-foreground">{item.email || "Unknown user"} · {item.app_version || "Unknown version"} · {new Date(item.created_at).toLocaleString()}</p>
            {item.screenshot_url ? <a href={item.screenshot_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary underline">View screenshot</a> : null}
          </article>
        ))}
      </section>
    </PageShell>
  );
}

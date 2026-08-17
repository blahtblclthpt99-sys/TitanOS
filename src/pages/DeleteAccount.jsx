import React, { useState } from "react";
import { Link } from "react-router";
import { Trash2, ShieldCheck } from "lucide-react";
import { api } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/marketing/SiteFooter";

const SUPPORT_EMAIL = "titanosmail@protonmail.com";

export default function DeleteAccount() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const requestDeletion = async () => {
    if (!user?.id || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await api.functions.invoke("accountDeletionRequest", {});
      setSubmitted(true);
    } catch (err) {
      setError(err?.message || "We couldn't record your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="flex-1 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
            <Trash2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold">Delete your TitanOS account</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            You can request deletion of your TitanOS account and associated personal data from this page without reinstalling the app.
            We process verified deletion requests and delete or anonymize associated personal data within 30 days, except records we must retain for legitimate legal, fraud-prevention, security, tax, or payment-compliance reasons.
          </p>

          <div className="titan-surface mt-8 p-5">
            {submitted ? (
              <div role="status" className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  Deletion request recorded
                </div>
                <p className="text-sm text-muted-foreground">
                  Your request is in TitanOS's deletion queue. You do not need to submit it again.
                </p>
              </div>
            ) : user?.id ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Signed in as <span className="font-medium text-foreground">{user.email || user.full_name || "your TitanOS account"}</span>.
                  Submitting below records a permanent account-deletion request. This action does not create a charge.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={submitting}
                  onClick={requestDeletion}
                  className="min-h-[44px]"
                >
                  {submitting ? "Submitting request…" : "Request account and data deletion"}
                </Button>
                {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Sign in on the TitanOS website to submit a verified deletion request. You do not need the mobile app installed.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild><Link to="/login">Sign in to request deletion</Link></Button>
                  <Button asChild variant="outline">
                    <a href={`mailto:${SUPPORT_EMAIL}?subject=TitanOS%20Account%20Deletion%20Request`}>Email privacy support</a>
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 space-y-3 text-sm text-muted-foreground">
            <p><strong className="text-foreground">What deletion covers:</strong> account profile and personal data associated with your TitanOS account, subject to legitimate retention requirements.</p>
            <p><strong className="text-foreground">Need help?</strong> Email {SUPPORT_EMAIL} and include the email address associated with your TitanOS account.</p>
            <p><Link to="/privacy-policy" className="text-primary underline underline-offset-2">Read the TitanOS Privacy Policy</Link></p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

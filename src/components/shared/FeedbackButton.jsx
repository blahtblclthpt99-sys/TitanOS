import React, { useState, useImperativeHandle, forwardRef } from "react";
import { Bug, Lightbulb, Star, Send, Check, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { api } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import FormField from "@/components/shared/FormField";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const TYPES = [
  { id: "bug", label: "Bug", icon: Bug },
  { id: "feature", label: "Feature", icon: Lightbulb },
  { id: "general", label: "General", icon: Star },
];

function saveFeedbackLocally(payload) {
  try {
    const pending = JSON.parse(localStorage.getItem("titanos_beta_feedback") || "[]");
    pending.push({ ...payload, saved_at: new Date().toISOString() });
    localStorage.setItem("titanos_beta_feedback", JSON.stringify(pending));
  } catch {
    /* ignore */
  }
}

/**
 * Feedback as a Radix Dialog only — opened from the action dock / AI menu.
 * No floating trigger (avoids chrome collision with MobileNav).
 */
const FeedbackButton = forwardRef(function FeedbackButton(_props, ref) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("general");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [screenshot, setScreenshot] = useState(null);

  const resetForm = () => {
    setType("general");
    setMessage("");
    setSubmitted(false);
    setError("");
    setLoading(false);
    setScreenshot(null);
  };

  useImperativeHandle(ref, () => ({
    open: () => {
      resetForm();
      setOpen(true);
    },
  }));

  const handleOpenChange = (next) => {
    setOpen(next);
    if (next) resetForm();
    if (!next) resetForm();
  };

  const handleSubmit = async () => {
    if (!message.trim() || loading) return;
    setLoading(true);
    setError("");

    const payload = {
      category: type,
      message: message.trim(),
      page: typeof window !== "undefined" ? window.location.pathname : undefined,
      app_version: import.meta.env.VITE_APP_VERSION || "unknown",
      device: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    };

    try {
      if (screenshot) {
        const uploaded = await api.integrations.Core.UploadFile({ file: screenshot });
        payload.screenshot_url = uploaded.file_url;
      }
      await api.functions.invoke("submitFeedback", payload);

      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, 1600);
    } catch (err) {
      saveFeedbackLocally({ ...payload, email: user?.email || undefined, status: "unread" });
      setError(err?.message || "Could not send feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>Help us improve TitanOS.</DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-foreground">Thank you</p>
            <p className="text-xs text-muted-foreground mt-1">Your feedback was recorded.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2" role="group" aria-label="Feedback type">
              {TYPES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  aria-pressed={type === t.id}
                  onClick={() => setType(t.id)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-2.5 min-h-[44px] rounded-md border text-xs font-medium transition-colors focus-ring",
                    type === t.id
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <t.icon className="w-4 h-4" aria-hidden="true" />
                  {t.label}
                </button>
              ))}
            </div>

            <FormField label="Your message" required error={error || undefined}>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  type === "bug"
                    ? "Describe what happened and how to reproduce it…"
                    : type === "feature"
                      ? "What feature would make TitanOS better for you?"
                      : "Share your thoughts…"
                }
                rows={4}
                className="resize-none min-h-[44px]"
              />
            </FormField>

            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40">
              <Paperclip className="h-4 w-4" aria-hidden="true" />
              <span className="truncate">{screenshot ? screenshot.name : "Attach screenshot (optional)"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => setScreenshot(event.target.files?.[0] || null)}
              />
            </label>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !message.trim()}
              className="w-full gap-2 min-h-[44px]"
            >
              {loading ? (
                "Sending…"
              ) : (
                <>
                  <Send className="w-4 h-4" aria-hidden="true" /> Send feedback
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});

export default FeedbackButton;

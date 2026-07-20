import React, { useState, useImperativeHandle, forwardRef } from "react";
import { MessageSquare, Bug, Lightbulb, Star, Send, Check } from "lucide-react";
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

const FeedbackButton = forwardRef(function FeedbackButton({ hideTrigger = false }, ref) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("general");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setError("");
    },
  }));

  const handleSubmit = async () => {
    if (!message.trim() || loading) return;
    setLoading(true);
    setError("");

    const payload = {
      type,
      message: message.trim(),
      email: user?.email || undefined,
      status: "new",
      page: typeof window !== "undefined" ? window.location.pathname : undefined,
    };

    try {
      try {
        await api.entities.BetaFeedback.create(payload);
      } catch {
        saveFeedbackLocally(payload);
      }

      try {
        await api.integrations.Core.SendEmail({
          to: "hello@titanos.app",
          subject: `[${type.toUpperCase()}] TitanOS Feedback`,
          body: `Type: ${type}\nUser: ${user?.email || "Unknown"}\nPage: ${payload.page || "/"}\n\nMessage:\n${payload.message}`,
        });
      } catch {
        /* optional */
      }

      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setMessage("");
        setType("general");
        setError("");
      }, 1600);
    } catch (err) {
      setError(err?.message || "Could not send feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setError("");
          }}
          className="fixed bottom-[5.5rem] md:bottom-20 right-3 md:right-6 z-[60] min-h-[44px] min-w-[44px] rounded-md bg-secondary hover:bg-secondary/90 transition-colors shadow-soft flex items-center justify-center border border-border focus-ring"
          aria-label="Send feedback"
        >
          <MessageSquare className="w-4 h-4 text-foreground" aria-hidden="true" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>Help us improve TitanOS during public beta.</DialogDescription>
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

              <FormField label="Your message" required>
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
                  className="resize-none"
                />
              </FormField>

              {error ? (
                <p className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !message.trim()}
                className="w-full gap-2"
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
    </>
  );
});

export default FeedbackButton;

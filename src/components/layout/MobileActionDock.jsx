import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import {
  Calendar,
  DollarSign,
  FileText,
  MessageSquare,
  Mic,
  MicOff,
  Plus,
  Receipt,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { QUICK_CREATE_ACTIONS } from "@/lib/nav-items";
import { matchVoiceCommand, speechSupported } from "@/lib/voiceCommands";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { appendVoiceTranscript, listVoiceTranscriptDocs } from "@/lib/voiceTranscriptStore";
import { upsertSearchDocs } from "@/lib/searchIndex";

const AI_SUGGESTIONS = [
  { icon: Calendar, label: "Schedule a job", action: "/jobs?new=1" },
  { icon: FileText, label: "Create estimate", action: "/estimates?new=1" },
  { icon: Receipt, label: "Create an invoice", action: "/invoices?new=1" },
  { icon: DollarSign, label: "Who owes me money?", action: "/invoices" },
  { icon: Users, label: "Find a customer", action: "/customers" },
];

/**
 * Single mobile action dock above the bottom nav — Create, AI, Voice.
 * Hidden throughout Driver Hub so its offer and voice controls own the thumb zone.
 */
export default function MobileActionDock({ onOpenFeedback }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const reduceMotion = usePrefersReducedMotion();
  const hiddenForDriverHub = pathname === "/driver";
  const rootRef = useRef(null);
  const [menu, setMenu] = useState(null);
  const [voiceSupported] = useState(() => speechSupported());
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (hiddenForDriverHub) setMenu(null);
  }, [hiddenForDriverHub]);

  useEffect(() => {
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setMenu(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(
    () => () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        /* ignore */
      }
    },
    []
  );

  const toggleVoice = () => {
    if (listening) {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        /* ignore */
      }
      setListening(false);
      return;
    }
    if (!voiceSupported) {
      toast({ title: "Voice not supported", description: "Try Chrome or Edge on this device." });
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      toast({ variant: "destructive", title: "Couldn't hear that — try again" });
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (user?.id && transcript.trim()) {
        appendVoiceTranscript(user.id, transcript, "dock");
        upsertSearchDocs(user.id, listVoiceTranscriptDocs(user.id));
      }
      const match = matchVoiceCommand(transcript);
      if (match?.path) {
        toast({ title: match.label, description: `“${transcript}”` });
        navigate(match.path);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const dockBtn =
    "inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border bg-card text-foreground shadow-soft transition-colors focus-ring hover:bg-muted aria-expanded:bg-primary aria-expanded:text-primary-foreground aria-expanded:border-primary";

  if (hiddenForDriverHub) return null;

  return (
    <div
      ref={rootRef}
      className="md:hidden fixed z-50 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
      style={{ bottom: "var(--mobile-chrome-bottom, calc(env(safe-area-inset-bottom) + 4.75rem))" }}
    >
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-auto mb-1 w-[min(92vw,280px)] overflow-hidden rounded-lg border border-border bg-card shadow-lift"
            role="menu"
            aria-label={menu === "create" ? "Create" : "Ask Titan"}
          >
            <p className="border-b border-border px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {menu === "create" ? "Quick create" : "Ask Titan"}
            </p>
            {menu === "create"
              ? QUICK_CREATE_ACTIONS.map((action) => (
                  <button
                    key={action.path}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(null);
                      navigate(action.path);
                    }}
                    className="flex min-h-[48px] w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-sm font-semibold text-foreground last:border-0 hover:bg-muted focus-ring"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <action.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {action.label}
                  </button>
                ))
              : (
                  <>
                    {AI_SUGGESTIONS.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenu(null);
                          navigate(s.action);
                        }}
                        className="flex min-h-[48px] w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted focus-ring"
                      >
                        <s.icon className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                        {s.label}
                      </button>
                    ))}
                    {typeof onOpenFeedback === "function" && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenu(null);
                          onOpenFeedback();
                        }}
                        className="flex min-h-[48px] w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted focus-ring"
                      >
                        <MessageSquare className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                        Send feedback
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenu(null);
                        navigate("/assistant");
                      }}
                      className="flex min-h-[48px] w-full items-center justify-center px-4 py-3 text-sm font-semibold text-primary hover:bg-muted focus-ring"
                    >
                      Open full AI assistant →
                    </button>
                  </>
                )}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border bg-card/95 p-1.5 shadow-lift backdrop-blur-xl"
        role="toolbar"
        aria-label="Quick actions"
      >
        <button
          type="button"
          className={cn(dockBtn, menu === "create" && "bg-primary text-primary-foreground border-primary")}
          aria-label={menu === "create" ? "Close create menu" : "Create new"}
          aria-expanded={menu === "create"}
          aria-haspopup="menu"
          onClick={() => setMenu((m) => (m === "create" ? null : "create"))}
        >
          {menu === "create" ? <X className="h-5 w-5" aria-hidden="true" /> : <Plus className="h-5 w-5" aria-hidden="true" />}
        </button>

        <button
          type="button"
          className={cn(
            dockBtn,
            "bg-gradient-to-br from-titan-navy to-titan-electric text-white border-transparent",
            menu === "ai" && "ring-2 ring-primary/40"
          )}
          aria-label={menu === "ai" ? "Close Titan menu" : "Open Titan AI"}
          aria-expanded={menu === "ai"}
          aria-haspopup="menu"
          onClick={() => setMenu((m) => (m === "ai" ? null : "ai"))}
        >
          {menu === "ai" ? <X className="h-5 w-5" aria-hidden="true" /> : <Sparkles className="h-5 w-5" aria-hidden="true" />}
        </button>

        {voiceSupported && (
          <button
            type="button"
            className={cn(dockBtn, listening && "bg-destructive text-destructive-foreground border-destructive")}
            aria-label={listening ? "Stop listening" : "Voice command"}
            aria-pressed={listening}
            onClick={toggleVoice}
          >
            {listening ? <MicOff className="h-5 w-5" aria-hidden="true" /> : <Mic className="h-5 w-5" aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { matchVoiceCommand, speechSupported } from "@/lib/voiceCommands";
import { toast } from "@/components/ui/use-toast";

export default function FloatingVoiceButton() {
  const navigate = useNavigate();
  const [supported] = useState(() => speechSupported());
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      /* ignore */
    }
  }, []);

  const start = () => {
    if (!supported) {
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
      setHeard(transcript);
      const match = matchVoiceCommand(transcript);
      if (match?.path) {
        toast({ title: match.label, description: `“${transcript}”` });
        navigate(match.path);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stop = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    setListening(false);
  };

  if (!supported) return null;

  return (
    <div
      className="fixed z-50 left-4 md:left-[calc(var(--sidebar-width,72px)+1rem)]"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 6.5rem)" }}
    >
      <AnimatePresence>
        {heard && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-2 max-w-[200px] text-xs bg-card border border-border rounded-xl px-3 py-2 text-foreground shadow-soft"
          >
            “{heard}”
          </motion.p>
        )}
      </AnimatePresence>
      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={listening ? stop : start}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lift border ${
          listening
            ? "bg-destructive text-destructive-foreground border-destructive"
            : "bg-card text-foreground border-border"
        }`}
        aria-label={listening ? "Stop listening" : "Voice command"}
      >
        {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </motion.button>
    </div>
  );
}

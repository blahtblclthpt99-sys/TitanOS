import React from "react";
import { Brain } from "lucide-react";
import { useNavigate } from "react-router";

/** One persistent Invisible Interface entry — no duplicate mini assistant/menu. */
export default function FloatingAIButton() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate("/second-me")}
      className="fixed z-50 right-4 md:right-6 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] md:bottom-6 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#06B6D4] text-white shadow-[0_0_24px_rgba(37,99,235,0.42)] transition-transform active:scale-95 focus-ring"
      aria-label="Open 2nd Self"
      title="2nd Self"
    >
      <Brain className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

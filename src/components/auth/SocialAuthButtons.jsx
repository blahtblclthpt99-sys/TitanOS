import React, { useState } from "react";
import { api } from "@/api/apiClient";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.8-4.1 2.8-7 0-.7-.1-1.3-.2-1.9H12z" />
      <path fill="#34A853" d="M6.6 14.3l-.7.5-2.3 1.8C5.2 19.3 8.4 21 12 21c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 1-3.6 1-2.8 0-5.1-1.9-5.9-4.4z" />
      <path fill="#4A90E2" d="M3.6 7.4C3.1 8.5 2.8 9.7 2.8 11s.3 2.5.8 3.6c0 .1 3.8-2.9 3.8-2.9-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8L3.6 7.4z" />
      <path fill="#FBBC05" d="M12 5.8c1.5 0 2.8.5 3.9 1.5l2.9-2.9C16.9 2.6 14.7 1.8 12 1.8 8.4 1.8 5.2 3.5 3.6 6.3l3.8 2.9C8.1 7.2 9.9 5.8 12 5.8z" />
    </svg>
  );
}

const PROVIDERS = [{ id: "google", label: "Continue with Google", Icon: GoogleIcon }];

export default function SocialAuthButtons({ onError }) {
  const [loadingProvider, setLoadingProvider] = useState("");

  const start = async (provider) => {
    setLoadingProvider(provider);
    try {
      await api.auth.loginWithProvider(provider);
    } catch (err) {
      setLoadingProvider("");
      const raw = err?.message || "";
      const message =
        /provider is not enabled|Unsupported provider|validation_failed/i.test(raw)
          ? "Google sign-in is not enabled yet in Supabase. Use email for now, or finish GOOGLE_AUTH.md setup."
          : raw || "Google sign-in failed";
      onError?.(message);
    }
  };

  return (
    <div className="space-y-2.5">
      {PROVIDERS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => start(id)}
          disabled={Boolean(loadingProvider)}
          className={cn(
            "w-full h-12 rounded-xl border border-slate-200 bg-white text-slate-700 text-[15px] font-medium",
            "flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors",
            "disabled:opacity-60"
          )}
        >
          {loadingProvider === id ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
          {label}
        </button>
      ))}
    </div>
  );
}

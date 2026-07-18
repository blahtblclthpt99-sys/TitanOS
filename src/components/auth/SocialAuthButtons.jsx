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

function MicrosoftIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F25022" d="M3 3h8.5v8.5H3z" />
      <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
      <path fill="#00A4EF" d="M3 12.5H11.5V21H3z" />
      <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
    </svg>
  );
}

function FacebookIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.54-4.7 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.5 0-1.96.93-1.96 1.89v2.27h3.34l-.53 3.49h-2.81V24C19.61 23.1 24 18.1 24 12.07z"
      />
    </svg>
  );
}

function AppleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#111827"
        d="M16.7 12.6c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.8-.8-2.9-.8-1.5 0-2.9.9-3.6 2.2-1.6 2.7-.4 6.7 1.1 8.9.7 1.1 1.6 2.3 2.8 2.2 1.1 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-.1 2.8-2.2.7-1.1 1-2.2 1-2.2-.1 0-1.9-.7-1.9-3.4zM14.7 5.8c.6-.7 1-1.8.9-2.8-0.9.0-1.9.6-2.6 1.3-.5.6-1 1.6-.9 2.6 1 .1 1.9-.5 2.6-1.1z"
      />
    </svg>
  );
}

const PROVIDERS = [
  { id: "google", label: "Continue with Google", Icon: GoogleIcon },
  { id: "azure", label: "Continue with Microsoft", Icon: MicrosoftIcon },
  { id: "facebook", label: "Continue with Facebook", Icon: FacebookIcon },
  { id: "apple", label: "Continue with Apple", Icon: AppleIcon },
];

export default function SocialAuthButtons({ onError }) {
  const [loadingProvider, setLoadingProvider] = useState("");

  const start = async (provider) => {
    setLoadingProvider(provider);
    try {
      await api.auth.loginWithProvider(provider);
    } catch (err) {
      setLoadingProvider("");
      const message =
        err?.message?.includes("provider is not enabled") || err?.status === 400
          ? `${provider === "azure" ? "Microsoft" : provider} sign-in is not enabled yet. Use email, or enable it in Supabase Auth.`
          : err?.message || "Social sign-in failed";
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

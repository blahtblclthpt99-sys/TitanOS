import React, { useEffect } from "react";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";
import { applyTheme, getStoredTheme } from "@/lib/theme";

/**
 * Public auth shell: fixed light card for readability on Login/Register.
 * Restores the user's theme preference when leaving auth screens.
 */
export default function AuthLayout({ title, subtitle, children, footer = null }) {
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  return (
    <div
      className="auth-shell min-h-screen flex items-center justify-center px-4 py-10 bg-background text-foreground"
      style={{
        paddingTop: "max(2.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <div className="w-full max-w-[420px]">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-lift sm:p-10">
          <div className="text-center mb-6">
            <div className="inline-flex justify-center mb-4">
              <TitanBrandLogo layout="stacked" imgClassName="h-[4.5rem]" />
            </div>
            <h1 className="text-[28px] sm:text-[30px] font-bold tracking-tight text-foreground leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-muted-foreground mt-2 text-base">{subtitle}</p>
            )}
          </div>
          {children}
          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

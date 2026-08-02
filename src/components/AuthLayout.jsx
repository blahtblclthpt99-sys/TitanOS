import React, { useEffect } from "react";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";
import { applyTheme, getStoredTheme } from "@/lib/theme";

/**
 * Public auth shell: fixed light card for readability on Login/Register.
 * Restores the user's theme preference when leaving auth screens.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", "#F8FAFC");
    return () => {
      applyTheme(getStoredTheme());
    };
  }, []);

  return (
    <div
      className="auth-shell min-h-screen flex items-center justify-center px-4 py-10 bg-[#F8FAFC] text-slate-900"
      style={{
        paddingTop: "max(2.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <div className="grid w-full max-w-[980px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.14)] lg:grid-cols-[1.1fr_.9fr]">
        <div className="relative hidden min-h-[680px] overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,.38),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(37,99,235,.34),transparent_38%),linear-gradient(145deg,#020617,#0f172a_55%,#082f49)]" />
          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(56,189,248,.25)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,.25)_1px,transparent_1px)] [background-size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
          <div className="absolute left-[18%] top-[28%] h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_32px_10px_rgba(34,211,238,.35)] motion-safe:animate-pulse" />
          <div className="absolute right-[22%] top-[48%] h-3 w-3 rounded-full bg-blue-400 shadow-[0_0_36px_12px_rgba(59,130,246,.35)] motion-safe:animate-pulse" />
          <div className="relative z-10"><TitanBrandLogo layout="stacked" imgClassName="h-20 brightness-0 invert" /></div>
          <div className="relative z-10 max-w-md">
            <p className="text-xs font-bold uppercase tracking-[.28em] text-cyan-300">Field intelligence · connected</p>
            <h2 className="mt-4 text-4xl font-bold leading-tight">Run the work. Know what’s next.</h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300">One secure operating system for field teams, drivers, customers, jobs, and business decisions.</p>
          </div>
        </div>
        <div className="w-full p-8 sm:p-10 lg:flex lg:items-center">
          <div className="w-full max-w-[420px] mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex justify-center mb-4">
              <TitanBrandLogo layout="stacked" imgClassName="h-[4.5rem]" />
            </div>
            <h1 className="text-[28px] sm:text-[30px] font-bold tracking-tight text-slate-900 leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-slate-500 mt-2 text-base">{subtitle}</p>
            )}
          </div>
          {children}
          {footer && <div className="mt-6">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

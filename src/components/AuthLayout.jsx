import React, { useEffect } from "react";
import TitanMark from "@/components/brand/TitanMark";

/**
 * Public auth shell matching titanfieldos.com look:
 * light page, white card, TitanOS mark — no Base44.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const previousTheme = themeMeta?.getAttribute("content");
    if (themeMeta) themeMeta.setAttribute("content", "#F8FAFC");
    return () => {
      if (themeMeta && previousTheme) themeMeta.setAttribute("content", previousTheme);
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
      <div className="w-full max-w-[420px]">
        <div className="bg-white rounded-2xl shadow-[0_10px_40px_rgba(15,23,42,0.08)] border border-slate-200/80 p-8 sm:p-10">
          <div className="text-center mb-6">
            <div className="inline-flex justify-center mb-3">
              <TitanMark className="w-[88px] h-[88px]" />
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
  );
}

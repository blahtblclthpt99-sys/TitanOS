import React, { useId, useMemo } from "react";
import { Link } from "react-router";
import { ArrowUpRight, BriefcaseBusiness, CheckCircle2, Clock3, Navigation, ShieldCheck, Sparkles } from "lucide-react";

/**
 * Command Center hero — high-density, field-first visual hierarchy.
 * Keeps the existing live-data contract while matching the TitanOS reference language.
 */
export default function OverviewTodayCard({
  jobsCompleted = 0,
  jobsToday = 0,
  onTimePct = null,
  onTimeDelta = null,
  goalPct = 0,
}) {
  const gradId = useId().replace(/:/g, "");
  const pct = Math.max(0, Math.min(100, Math.round(Number(goalPct) || 0)));
  const safeOnTime = onTimePct == null ? null : Math.max(0, Math.min(100, Math.round(Number(onTimePct) || 0)));
  const remaining = Math.max(0, jobsToday - jobsCompleted);
  const arc = useMemo(() => {
    const r = 44;
    const c = 2 * Math.PI * r;
    return { dash: (pct / 100) * c, gap: c - (pct / 100) * c };
  }, [pct]);

  return (
    <section className="relative mb-5 overflow-hidden rounded-[24px] border border-cyan-400/20 bg-[#07111f] text-white shadow-[0_28px_80px_-40px_rgba(0,174,255,0.75)]" aria-label="Today's command overview">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(0,194,255,0.16),transparent_34%),radial-gradient(circle_at_90%_85%,rgba(124,58,237,0.16),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />

      <div className="relative p-4 sm:p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-cyan-300">TitanOS · Live</p>
            </div>
            <h2 className="!text-white text-xl font-extrabold tracking-tight sm:text-2xl">Command Center</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-300">Run the day from one live operating view.</p>
          </div>
          <Link to="/reports" className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3.5 text-xs font-bold text-cyan-200 transition hover:border-cyan-300/50 hover:bg-cyan-400/15 focus-ring">
            Full report <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric icon={BriefcaseBusiness} label="Stops today" value={jobsToday} sub={`${remaining} remaining`} tone="cyan" />
          <Metric icon={CheckCircle2} label="Completed" value={jobsCompleted} sub={`${pct}% of today's work`} tone="emerald" />
          <Metric icon={Clock3} label="On time" value={safeOnTime == null ? "—" : `${safeOnTime}%`} sub={onTimeDelta == null ? "Live shift signal" : `${onTimeDelta >= 0 ? "+" : ""}${Math.round(onTimeDelta)}% trend`} tone="violet" />
          <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur lg:col-span-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Titan score</p>
                <p className="mt-1 text-sm font-semibold text-white">Today&apos;s completion</p>
                <p className="mt-1 text-xs text-slate-400">Live from your jobs</p>
              </div>
              <div className="relative h-20 w-20 shrink-0">
                <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90" aria-hidden="true">
                  <circle cx="52" cy="52" r="44" fill="none" stroke="rgba(148,163,184,.14)" strokeWidth="8" />
                  <circle cx="52" cy="52" r="44" fill="none" stroke={`url(#${gradId})`} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${arc.dash} ${arc.gap}`} />
                  <defs><linearGradient id={gradId}><stop stopColor="#00d9ff"/><stop offset=".55" stopColor="#1688ff"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient></defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-white">{pct}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[1.6fr_.9fr]">
          <Link to="/jobs" className="group flex min-h-[92px] items-center gap-4 rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-400/[0.08] to-blue-500/[0.04] p-4 transition hover:border-cyan-300/40 hover:bg-cyan-400/[0.1] focus-ring">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300"><Navigation className="h-6 w-6" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-300">Next up</span>
              <span className="mt-1 block text-base font-bold text-white">Open today&apos;s jobs</span>
              <span className="mt-1 block text-xs text-slate-400">Schedule, location, check-in and proof ready</span>
            </span>
            <ArrowUpRight className="h-5 w-5 shrink-0 text-cyan-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <div className="flex min-h-[92px] items-center gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.045] p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
            <div><p className="text-sm font-bold text-white">Field ready</p><p className="mt-1 text-xs leading-relaxed text-slate-400">Jobs, proof and progress stay connected.</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value, sub, tone }) {
  const tones = {
    cyan: "border-cyan-400/20 bg-cyan-400/[0.055] text-cyan-300",
    emerald: "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300",
    violet: "border-violet-400/20 bg-violet-400/[0.05] text-violet-300",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.cyan}`}>
      <div className="mb-4 flex items-center justify-between"><Icon className="h-5 w-5" aria-hidden="true" /><span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" /></div>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

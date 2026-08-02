import React, { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Brain,
  Target,
  Clock,
  Calendar,
  ChevronRight,
  Sparkles,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import OfferAnalyzerPanel from "@/components/driver/activity/OfferAnalyzerPanel";
import VehicleTrueCostPanel from "@/components/driver/activity/VehicleTrueCostPanel";
import { formatDuration } from "@/lib/driverHubApi";
import {
  collectTrips,
  dailySummary,
  weeklyByWeekday,
  weekdayWeekendCompare,
  rushPeriodStats,
  buildCoachInsights,
  filterTripsByPeriod,
  summarizeTrips,
  goalsProgress,
} from "@/lib/driverActivity/intelligence";
import { buildCoachMoneySnapshot } from "@/lib/driverActivity/driverCoach";
import { readDriverGoals, saveDriverGoals } from "@/lib/driverActivity/goals";

function ProgressBar({ pct, label, current, target, prefix = "" }) {
  if (target == null || target <= 0) return null;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground">
          {prefix}
          {current}
          <span className="text-muted-foreground"> / {prefix}{target}</span>
          {pct != null ? ` · ${pct}%` : ""}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-titan-cyan transition-[width]"
          style={{ width: `${Math.min(100, pct || 0)}%` }}
        />
      </div>
    </div>
  );
}

const TONE_STYLES = {
  good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  warn: "border-titan-amber/40 bg-titan-amber/10 text-titan-amber",
  bad: "border-red-500/30 bg-red-500/10 text-red-200",
  action: "border-titan-cyan/40 bg-titan-cyan/10 text-foreground",
  info: "border-border bg-muted/30 text-foreground/90",
};

/**
 * Driver Hub V2 — AI Driver Intelligence panel (read-only over Hub history).
 */
export default function DriverIntelligencePanel({
  userId,
  history,
  liveSession,
  stops,
  mpg = 22,
  gasUsd = 3.5,
  defaultZip = "",
}) {
  const [goals, setGoals] = useState(() => (userId ? readDriverGoals(userId) : {}));
  const [editingGoals, setEditingGoals] = useState(false);

  const { sessions } = useMemo(
    () => collectTrips(history, liveSession, stops, { mpg, gasUsd, userId }),
    [history, liveSession, stops, mpg, gasUsd, userId]
  );

  const today = useMemo(() => dailySummary(sessions), [sessions]);
  const week = useMemo(() => summarizeTrips(filterTripsByPeriod(sessions, "week")), [sessions]);
  const month = useMemo(() => summarizeTrips(filterTripsByPeriod(sessions, "month")), [sessions]);
  const byDay = useMemo(() => weeklyByWeekday(sessions), [sessions]);
  const ww = useMemo(() => weekdayWeekendCompare(sessions), [sessions]);
  const rush = useMemo(() => rushPeriodStats(sessions), [sessions]);
  const coach = useMemo(
    () => buildCoachInsights(sessions, { userId, mpg, gasUsd }),
    [sessions, userId, mpg, gasUsd]
  );
  const moneySnap = useMemo(
    () =>
      buildCoachMoneySnapshot({
        userId,
        mpg,
        gasUsd,
        weekSummary: week,
        todaySummary: today,
      }),
    [userId, mpg, gasUsd, week, today]
  );
  const progress = useMemo(
    () => goalsProgress(goals, { today, week, month }),
    [goals, today, week, month]
  );

  const currentRush = rush.find((r) => {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    if (r.startHour < r.endHour) return h >= r.startHour && h < r.endHour;
    return h >= r.startHour || h < r.endHour;
  });

  const saveGoals = () => {
    if (!userId) return;
    setGoals(saveDriverGoals(userId, goals));
    setEditingGoals(false);
  };

  return (
    <div className="space-y-4">
      <FeatureHonestyBanner tone="info">
        Driver Coach analyzes sessions on this device with your all-in $/mi (fuel + 10–13¢ maint +
        tires + vehicle). Platforms aren’t connected — log payouts on trips to unlock earnings scoring.
      </FeatureHonestyBanner>

      {/* Hero KPIs */}
      <section className="titan-surface p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Brain className="w-4 h-4 text-titan-cyan" /> Driver Intelligence
          </h2>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded-full px-2 py-0.5">
            {currentRush?.label || "Off-peak"}
          </span>
        </div>

        <div
          className={cn(
            "rounded-xl border px-3 py-2.5 flex flex-wrap items-center justify-between gap-2",
            moneySnap.configured
              ? "border-titan-cyan/40 bg-titan-cyan/10"
              : "border-titan-amber/40 bg-titan-amber/10"
          )}
        >
          <div className="flex items-start gap-2 min-w-0">
            <Gauge className="w-4 h-4 text-titan-cyan mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold tabular-nums">
                Need ≥ ${moneySnap.need_per_mile.toFixed(2)}/mi · all-in $
                {moneySnap.true_cost_per_mile.toFixed(3)}/mi
              </p>
              <p className="text-[11px] text-muted-foreground leading-snug">{moneySnap.tip}</p>
            </div>
          </div>
          {moneySnap.week_avg_per_mile != null ? (
            <p
              className={cn(
                "text-[11px] font-semibold tabular-nums shrink-0",
                moneySnap.week_clears_floor ? "text-emerald-400" : "text-titan-amber"
              )}
            >
              Week avg ${moneySnap.week_avg_per_mile}/mi
              {moneySnap.week_margin != null
                ? ` (${moneySnap.week_margin >= 0 ? "+" : ""}${moneySnap.week_margin.toFixed(2)})`
                : ""}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Today trips", value: today.trips },
            { label: "Today miles", value: today.miles },
            {
              label: "Drive time",
              value: formatDuration(today.drive_sec),
            },
            {
              label: "Idle",
              value: formatDuration(today.idle_sec),
            },
            {
              label: "Earnings logged",
              value: `$${today.earnings.toFixed(0)}`,
            },
            {
              label: "Profit est.",
              value: `$${today.profit.toFixed(0)}`,
            },
            {
              label: "$ / mi",
              value: today.avg_dollars_per_mile != null ? `$${today.avg_dollars_per_mile}` : "—",
            },
            {
              label: "$ / hr",
              value: today.avg_dollars_per_hour != null ? `$${today.avg_dollars_per_hour}` : "—",
            },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card/60 px-3 py-2.5">
              <p className="text-[10px] uppercase text-muted-foreground">{c.label}</p>
              <p className="text-lg font-bold tabular-nums text-foreground">{c.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Coach */}
      <section className="titan-surface p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-titan-cyan" /> Money Coach
        </h3>
        <ul className="space-y-2">
          {coach.map((c) => (
            <li
              key={c.id}
              className={cn(
                "text-sm rounded-xl border px-3 py-2 leading-snug",
                TONE_STYLES[c.tone] || TONE_STYLES.info
              )}
            >
              {c.text}
            </li>
          ))}
        </ul>
      </section>

      {/* Offer ACCEPT / DENY formula — uses ZIP averages from logged trips */}
      <OfferAnalyzerPanel
        userId={userId}
        mpg={mpg}
        gasUsd={gasUsd}
        history={history}
        defaultZip={defaultZip}
      />

      <section className="titan-surface p-4">
        <VehicleTrueCostPanel userId={userId} mpg={mpg} gasUsd={gasUsd} />
      </section>
      {/* Goals */}
      <section className="titan-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Target className="w-4 h-4 text-titan-cyan" /> Goals
          </h3>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditingGoals((v) => !v)}>
            {editingGoals ? "Cancel" : "Edit"}
          </Button>
        </div>
        {editingGoals ? (
          <div className="grid grid-cols-2 gap-2">
            {[
              ["daily_earnings", "Daily $"],
              ["weekly_earnings", "Weekly $"],
              ["monthly_earnings", "Monthly $"],
              ["daily_trips", "Daily trips"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] uppercase text-muted-foreground">{label}</label>
                <Input
                  type="number"
                  value={goals[key] ?? ""}
                  onChange={(e) => setGoals((g) => ({ ...g, [key]: Number(e.target.value) }))}
                  className="h-9 bg-muted border-border"
                />
              </div>
            ))}
            <Button type="button" className="col-span-2" onClick={saveGoals}>
              Save goals
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <ProgressBar
              label="Daily earnings"
              prefix="$"
              current={progress.daily_earnings.current}
              target={progress.daily_earnings.target}
              pct={progress.daily_earnings.pct}
            />
            <ProgressBar
              label="Weekly earnings"
              prefix="$"
              current={progress.weekly_earnings.current}
              target={progress.weekly_earnings.target}
              pct={progress.weekly_earnings.pct}
            />
            <ProgressBar
              label="Daily trips"
              current={progress.daily_trips.current}
              target={progress.daily_trips.target}
              pct={progress.daily_trips.pct}
            />
          </div>
        )}
      </section>

      {/* Rush + weekday */}
      <div className="grid md:grid-cols-2 gap-4">
        <section className="titan-surface p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-titan-cyan" /> Rush windows
          </h3>
          <ul className="space-y-1.5 max-h-56 overflow-y-auto">
            {rush.map((r) => (
              <li
                key={r.id}
                className={`flex justify-between gap-2 text-sm rounded-lg px-2 py-1.5 ${
                  r.id === currentRush?.id ? "bg-primary/10 border border-primary/25" : ""
                }`}
              >
                <span className="text-foreground/90">{r.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {r.trips} trips · {r.miles} mi
                  {r.avg_dollars_per_hour != null ? ` · $${r.avg_dollars_per_hour}/hr` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="titan-surface p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-titan-cyan" /> Weekday vs weekend
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-border p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Weekdays</p>
              <p className="font-bold tabular-nums">${ww.weekday.earnings.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">
                {ww.weekday.trips} trips · {ww.weekday.miles} mi
              </p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Weekends</p>
              <p className="font-bold tabular-nums">${ww.weekend.earnings.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">
                {ww.weekend.trips} trips · {ww.weekend.miles} mi
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{ww.recommendation}</p>
          {byDay.best_day ? (
            <p className="text-xs text-foreground/80">
              Best day: <strong>{byDay.best_day.name}</strong>
              {byDay.worst_day ? (
                <>
                  {" "}
                  · Softest: <strong>{byDay.worst_day.name}</strong>
                </>
              ) : null}
            </p>
          ) : null}
        </section>
      </div>

      {/* Trip history */}
      <section className="titan-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Individual trips</h3>
          <span className="text-xs text-muted-foreground">{sessions.length} recorded</span>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No trips yet. Start a work session with Auto GPS — each ended shift becomes its own trip
            record.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {sessions.slice(0, 20).map((t) => (
              <li key={t.id}>
                <Link
                  to={`/driver/trip/${encodeURIComponent(t.id)}`}
                  className="flex items-center justify-between gap-3 py-2.5 hover:bg-muted/40 -mx-1 px-1 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      Trip #{t.trip_number} · {t.date}
                      {t.active ? " · Live" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.miles} mi · {formatDuration(t.drive_sec)} drive · {t.stop_count} stops
                      {t.rush_label ? ` · ${t.rush_label}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

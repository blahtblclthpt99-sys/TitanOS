import React, { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { readShiftHistory, readPrefs, estimateGasPriceUsd } from "@/lib/driverHubApi";
import {
  collectTrips,
  summarizeTrips,
  weeklyByWeekday,
  rushPeriodStats,
  classifyRushWindow,
} from "@/lib/driverActivity/intelligence.js";
import { composeSmartCoachTip } from "@/lib/driverActivity/driverCoach.js";

function buildObservations(userId) {
  const prefs = readPrefs(userId) || {};
  const history = readShiftHistory(userId) || [];
  const gasUsd = estimateGasPriceUsd(prefs.zip || "");
  const { sessions } = collectTrips(history, null, [], {
    mpg: Number(prefs.mpg) || 22,
    gasUsd: typeof gasUsd === "number" ? gasUsd : 3.5,
    userId,
  });
  const week = summarizeTrips(sessions.slice(0, 40));
  const weekday = weeklyByWeekday(sessions);
  const rush = rushPeriodStats(sessions);
  const liveRush = classifyRushWindow(new Date());
  const coach = composeSmartCoachTip({
    userId,
    mode: prefs.mode || "driving",
    mpg: Number(prefs.mpg) || 22,
    gasUsd: typeof gasUsd === "number" ? gasUsd : 3.5,
    rush: liveRush,
    weekSummary: week,
  });

  const observations = [];
  if (coach?.full || coach?.tip) {
    observations.push(coach.full || coach.tip);
  }

  const bestDay = weekday?.best_day;
  if (bestDay?.name && bestDay.earnings > 0) {
    observations.push(
      `Your strongest day historically is ${bestDay.name} (~$${bestDay.earnings.toFixed(0)} logged earnings).`
    );
  }

  const topRush = [...(rush || [])].filter((r) => r.trips > 0).sort((a, b) => (b.avg_dollars_per_hour || 0) - (a.avg_dollars_per_hour || 0))[0];
  if (topRush?.label && topRush.avg_dollars_per_hour) {
    observations.push(
      `You average about $${Math.round(topRush.avg_dollars_per_hour)}/hr during ${topRush.label}.`
    );
  }

  if (week.avg_dollars_per_mile != null) {
    observations.push(`Recent logged pace is about $${week.avg_dollars_per_mile}/mi.`);
  }

  if (observations.length < 2) {
    observations.push("Keep logging payouts after each trip so Titan AI can spot rush and weekday patterns.");
  }

  return observations;
}

export default function AiFolder({ user }) {
  const observations = useMemo(() => (user?.id ? buildObservations(user.id) : []), [user?.id]);

  if (!user?.id) {
    return <p className="text-sm text-muted-foreground">Sign in for Titan AI insights.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
        Continuous observations from your trip history
      </p>
      <ul className="space-y-2">
        {observations.map((line, i) => (
          <li
            key={i}
            className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-3 text-sm text-foreground leading-relaxed"
          >
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

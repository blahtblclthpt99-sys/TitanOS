import { supabase, isSupabaseConfigured } from "@/api/supabaseClient";

export async function syncDriverPerformanceSummary(userId, summary) {
  if (!userId || summary?.score == null || !isSupabaseConfigured()) return { ok: false, benchmark: null };
  const payload = {
    user_id: userId,
    score: summary.score,
    profit_per_hour: summary.profitPerHour,
    profit_per_mile: summary.profitPerMile,
    utilization: summary.utilization,
    trips: summary.trips,
    platform_count: summary.platforms.length,
    period_days: summary.periodDays,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("driver_performance_summaries").upsert(payload, { onConflict: "user_id" });
  if (error) return { ok: false, benchmark: null, reason: error.message };
  const { data, error: benchmarkError } = await supabase.rpc("get_driver_performance_benchmark");
  if (benchmarkError) return { ok: true, benchmark: null, reason: benchmarkError.message };
  return { ok: true, benchmark: Array.isArray(data) ? data[0] || null : data || null };
}

export function percentileLabel(percentile) {
  if (percentile == null || percentile === "") return null;
  const value = Number(percentile);
  if (!Number.isFinite(value)) return null;
  if (value >= 90) return "Top 10%";
  if (value >= 75) return "Top 25%";
  if (value >= 50) return "Above median";
  if (value >= 25) return "Building toward median";
  return "Room to improve";
}

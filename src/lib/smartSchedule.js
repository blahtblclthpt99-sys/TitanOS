/** Cluster today's jobs by city/zip and suggest tighter day plans. */
export function buildSmartScheduleTips(jobs = [], weather = null) {
  const tips = [];
  const today = new Date().toISOString().slice(0, 10);
  const todays = jobs.filter((j) => j.scheduled_date === today && j.status !== "cancelled");

  if (!todays.length) {
    tips.push({
      type: "empty",
      text: "No jobs today — batch estimates or open Emergency Jobs for same-day work.",
      path: "/emergency",
    });
  } else {
    const byArea = {};
    for (const job of todays) {
      const key = (job.city || job.zip || job.state || "Unknown area").trim() || "Unknown area";
      byArea[key] = byArea[key] || [];
      byArea[key].push(job);
    }
    const clusters = Object.entries(byArea).sort((a, b) => b[1].length - a[1].length);
    if (clusters[0]?.[1].length >= 2) {
      tips.push({
        type: "cluster",
        text: `Cluster ${clusters[0][1].length} stops in ${clusters[0][0]} together to cut drive time.`,
        path: "/routes",
      });
    }
    if (clusters.length >= 3) {
      tips.push({
        type: "spread",
        text: `Jobs span ${clusters.length} areas today — open Route Planner to optimize order.`,
        path: "/routes",
      });
    }
  }

  if (weather?.warning) {
    tips.push({
      type: "weather",
      text: weather.warning,
      path: "/schedule",
    });
  } else if (weather?.temp != null && weather.temp >= 95) {
    tips.push({
      type: "heat",
      text: `Heat alert: ${weather.temp}° — schedule outdoor work early and hydrate.`,
      path: "/schedule",
    });
  }

  if (!tips.length) {
    tips.push({
      type: "ok",
      text: "Schedule looks balanced. Keep confirming tomorrow’s jobs tonight.",
      path: "/jobs",
    });
  }
  return tips.slice(0, 4);
}

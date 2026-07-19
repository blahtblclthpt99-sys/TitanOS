import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar, Clock, User } from "lucide-react";
import { addDays, addWeeks, format } from "date-fns";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { useEntityData } from "@/hooks/useEntityData";
import {
  formatISO,
  formatMonthDay,
  formatMonthDayYear,
  formatShortDay,
  formatDayNum,
  getWeekDays,
  isToday,
} from "@/lib/date-utils";
import { fetchOpenMeteo } from "@/lib/weatherApi";
import { buildSmartScheduleTips } from "@/lib/smartSchedule";
import { useNavigate } from "react-router-dom";

const STATUS_BORDER = {
  scheduled:   "border-l-titan-cyan",
  in_progress: "border-l-titan-amber",
  completed:   "border-l-emerald-400",
  cancelled:   "border-l-red-400",
};

export default function Schedule() {
  const navigate = useNavigate();
  const { data: [jobs], loading, error, reload } = useEntityData([
    { entity: "Job", method: "list", args: ["-scheduled_date", 100] },
  ]);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    const loadWeather = (lat = 41.88, lon = -87.63) => fetchOpenMeteo(lat, lon).then(setWeather);
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition((position) => loadWeather(position.coords.latitude, position.coords.longitude), () => loadWeather(), { timeout: 5000 });
    else loadWeather();
  }, []);

  const weekDays = getWeekDays(currentDate);
  const navigateWeek = (dir) => setCurrentDate((prev) => addWeeks(prev, dir));

  const getJobsForDay = (date) =>
    jobs
      .filter((j) => j.scheduled_date === formatISO(date))
      .sort((a, b) => (a.scheduled_time || "").localeCompare(b.scheduled_time || ""));

  const totalThisWeek = weekDays.reduce((s, d) => s + getJobsForDay(d).length, 0);
  const weekEnd = addDays(weekDays[0], 6);

  if (loading) return <PageLoader variant="list" label="Loading schedule" />;
  if (error) return <ErrorState title="Couldn't load schedule" onRetry={reload} />;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMonthDay(weekDays[0])} – {formatMonthDayYear(weekEnd)}
            {totalThisWeek > 0 && <span className="ml-2 text-titan-cyan">· {totalThisWeek} job{totalThisWeek !== 1 ? "s" : ""}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}
            className="border-border text-muted-foreground hover:text-foreground rounded-xl text-xs h-8">
            Today
          </Button>
          <button type="button" onClick={() => navigateWeek(-1)} aria-label="Previous week"
            className="p-2 rounded-xl bg-muted text-muted-foreground border border-border hover:text-foreground hover:bg-muted transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => navigateWeek(1)} aria-label="Next week"
            className="p-2 rounded-xl bg-muted text-muted-foreground border border-border hover:text-foreground hover:bg-muted transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      {weather && <div className="glass rounded-2xl px-4 py-3 mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"><span className="font-semibold text-titan-cyan">{weather.temp}° · {weather.label}</span><span className="text-muted-foreground">Wind {weather.wind} mph</span>{weather.warning && <span className="text-titan-amber">{weather.warning}</span>}</div>}
      {!loading && (
        <div className="grid sm:grid-cols-2 gap-2 mb-5">
          {buildSmartScheduleTips(jobs, weather).map((tip) => (
            <button
              key={tip.text}
              type="button"
              onClick={() => tip.path && navigate(tip.path)}
              className="glass rounded-xl px-4 py-3 text-left text-sm text-foreground hover:border-primary/30 border border-transparent transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Smart schedule</span>
              <p className="mt-1">{tip.text}</p>
            </button>
          ))}
        </div>
      )}

      <div className="hidden md:grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const dayJobs = getJobsForDay(day);
          const today = isToday(day);
          return (
            <div key={formatISO(day)}>
              <div className={`text-center py-2.5 mb-2 rounded-xl ${today ? "bg-titan-cyan/10" : ""}`}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{formatShortDay(day)}</p>
                <p className={`text-lg font-bold mt-0.5 ${today ? "text-titan-cyan" : "text-foreground/90"}`}>{formatDayNum(day)}</p>
              </div>
              <div className="space-y-1 min-h-[120px]">
                {dayJobs.map((job) => (
                  <motion.div key={job.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className={`p-2 rounded-lg border-l-2 bg-muted/50 hover:bg-white/[0.06] transition-colors cursor-pointer ${STATUS_BORDER[job.status] || STATUS_BORDER.scheduled}`}>
                    <p className="text-[11px] font-medium text-foreground truncate leading-tight">{job.title}</p>
                    {job.scheduled_time && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                        <Clock className="w-2.5 h-2.5" />{job.scheduled_time}
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="md:hidden space-y-4">
        {weekDays.map((day) => {
          const dayJobs = getJobsForDay(day);
          const today = isToday(day);
          return (
            <div key={formatISO(day)}>
              <div className={`flex items-center gap-3 mb-2 px-1 ${today ? "text-titan-cyan" : "text-muted-foreground"}`}>
                <span className="text-xs font-semibold uppercase tracking-wider">{format(day, "EEE, MMM d")}</span>
                {today && <span className="text-[10px] bg-titan-cyan/15 text-titan-cyan px-2 py-0.5 rounded-full font-semibold">Today</span>}
              </div>
              {dayJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-1 pb-2">No jobs</p>
              ) : (
                <div className="space-y-2">
                  {dayJobs.map((job) => (
                    <motion.div key={job.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                      className={`glass rounded-xl p-3 border-l-2 ${STATUS_BORDER[job.status] || STATUS_BORDER.scheduled}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{job.title}</p>
                          <div className="flex items-center gap-3 mt-1">
                            {job.scheduled_time && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />{job.scheduled_time}
                              </span>
                            )}
                            {job.customer_name && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                                <User className="w-3 h-3 flex-shrink-0" />{job.customer_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={job.status} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {totalThisWeek === 0 && (
          <EmptyState icon={Calendar} title="No jobs this week" description="Nothing scheduled — enjoy the calm or add a new job." />
        )}
      </div>
    </div>
  );
}

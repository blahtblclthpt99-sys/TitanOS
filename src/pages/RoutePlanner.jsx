import React, { useEffect, useState } from "react";
import { ExternalLink, MapPin, Route, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import { api } from "@/api/apiClient";
import { optimizeWithProvider, mapsDirectionsUrl } from "@/lib/routeOptimize";

const today = () => new Date().toISOString().slice(0, 10);
const label = (job) => job.title || job.customer_name || "Untitled job";
const location = (job) => job.address || [job.city, job.state].filter(Boolean).join(", ") || "Address not provided";

export default function RoutePlanner() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState({ ordered: [], totalMiles: 0, legs: [], method: "nearest_neighbor" });
  const [optimizing, setOptimizing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await api.entities.Job.list("-scheduled_date", 200);
      const filtered = rows.filter((job) => job.scheduled_date === today() || ["scheduled", "in_progress"].includes(job.status));
      setJobs(filtered);
      setOptimizing(true);
      const optimized = await optimizeWithProvider(filtered);
      setRoute(optimized);
    } catch {
      toast({ variant: "destructive", title: "Couldn't load today's jobs" });
    } finally {
      setLoading(false);
      setOptimizing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openMaps = () => {
    const url = mapsDirectionsUrl(route.ordered);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-24">
      <PageHeader title="Route Planner" subtitle={`Optimize ${today()}'s service stops`} />
      <div className="glass rounded-2xl p-5 border border-titan-cyan/15 mb-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Estimated route distance</p>
          <p className="text-3xl font-bold text-foreground">
            {route.totalMiles.toLocaleString()} <span className="text-base text-foreground/45">miles</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {optimizing ? "Optimizing…" : route.method === "mapbox_optimized_trips" ? "Mapbox optimized trip" : "Nearest-neighbor (add MAPBOX_ACCESS_TOKEN for live Directions)"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} variant="outline" className="border-border text-foreground"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Button onClick={openMaps} disabled={!route.ordered.length} className="bg-titan-cyan text-black font-semibold"><ExternalLink className="w-4 h-4 mr-2" />Open in Google Maps</Button>
        </div>
      </div>
      {loading ? (
        <p className="text-foreground/45">Loading route…</p>
      ) : !jobs.length ? (
        <div className="glass rounded-2xl p-12 text-center border border-border">
          <Route className="w-9 h-9 text-titan-cyan mx-auto mb-3" />
          <p className="font-semibold text-foreground">No scheduled stops today</p>
          <p className="text-sm text-muted-foreground mt-1">Schedule jobs to build a route.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="glass rounded-2xl p-5 border border-border">
            <h2 className="font-semibold text-foreground mb-4">Original order</h2>
            <div className="space-y-3">{jobs.map((job, index) => <Stop key={job.id} index={index + 1} job={job} />)}</div>
          </section>
          <section className="glass rounded-2xl p-5 border border-titan-cyan/15">
            <h2 className="font-semibold text-foreground mb-4">Optimized order</h2>
            <div className="space-y-3">
              {route.ordered.map((job, index) => (
                <div key={job.id}>
                  <Stop index={index + 1} job={job} />
                  <p className="text-xs text-titan-cyan/75 ml-10 mt-1">
                    {route.legs[index] ? `${route.legs[index].miles ?? "—"} mi to next stop` : "Final stop"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Stop({ index, job }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3 flex gap-3">
      <span className="w-7 h-7 rounded-full bg-titan-cyan/15 text-titan-cyan text-xs font-bold flex items-center justify-center flex-none">{index}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label(job)}</p>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{location(job)}</p>
      </div>
    </div>
  );
}

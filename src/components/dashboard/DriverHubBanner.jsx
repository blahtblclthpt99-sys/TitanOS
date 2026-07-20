import React from "react";
import { useNavigate } from "react-router-dom";
import { Car, ChevronRight, Fuel, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Prominent Home entry into rideshare / delivery Driver Hub */
export default function DriverHubBanner() {
  const navigate = useNavigate();

  return (
    <section
      className="mb-5 rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/15 via-card to-card overflow-hidden"
      style={{ overflowAnchor: "none" }}
      aria-label="Driver Hub"
    >
      <button
        type="button"
        onClick={() => navigate("/driver")}
        className="w-full text-left p-4 sm:p-5 flex items-stretch gap-4 hover:bg-amber-500/5 transition-colors min-h-[88px]"
      >
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
          <Car className="w-6 h-6 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Driver Hub</p>
          <h2 className="text-base sm:text-lg font-bold text-foreground mt-0.5">
            Uber · DoorDash · Lyft & more
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
            Start driving, track miles & stops, hotspot map, fuel costs — auto-fills Tax Center.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
              <MapPin className="w-3 h-3" /> Hotspots
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
              <Fuel className="w-3 h-3" /> Gas + tax
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end justify-between flex-shrink-0">
          <ChevronRight className="w-5 h-5 text-amber-400" />
          <Button
            type="button"
            size="sm"
            className="mt-auto bg-amber-500 hover:bg-amber-500/90 text-black font-semibold h-8 px-3"
            onClick={(e) => {
              e.stopPropagation();
              navigate("/driver");
            }}
          >
            Open
          </Button>
        </div>
      </button>
    </section>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Play, Volume2, VolumeX } from "lucide-react";
import { listMarketplaceListings } from "@/lib/listingsApi";

const TITAN_CLIPS = [
  {
    id: "ai",
    title: "Ask Titan AI",
    subtitle: "Schedule, invoice, and chase payments",
    cta: "Open AI",
    path: "/assistant",
    badge: "AI",
    poster: "https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=600",
    video: null,
    tint: "from-indigo-950/85 via-indigo-900/35 to-transparent",
  },
  {
    id: "jobs",
    title: "Finish jobs faster",
    subtitle: "Check in, photos, and AI summaries",
    cta: "Open Jobs",
    path: "/jobs",
    badge: "Tip",
    poster: "https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=600",
    video: null,
    tint: "from-slate-950/85 via-slate-900/40 to-transparent",
  },
  {
    id: "estimates",
    title: "Win more quotes",
    subtitle: "Price estimator with market ranges",
    cta: "Estimates",
    path: "/job-estimator",
    badge: "Tip",
    poster: "https://images.pexels.com/photos/8293778/pexels-photo-8293778.jpeg?auto=compress&cs=tinysrgb&w=600",
    video: null,
    tint: "from-emerald-950/85 via-emerald-900/30 to-transparent",
  },
  {
    id: "payments",
    title: "Get paid",
    subtitle: "Checkout links with platform fees",
    cta: "Payments",
    path: "/payments",
    badge: "Money",
    poster: "https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=600",
    video: null,
    tint: "from-cyan-950/85 via-cyan-900/30 to-transparent",
  },
  {
    id: "marketing",
    title: "AI Marketing",
    subtitle: "Posts for Facebook, IG, Google & email",
    cta: "Marketing",
    path: "/marketing",
    badge: "Grow",
    poster: "https://images.pexels.com/photos/6476589/pexels-photo-6476589.jpeg?auto=compress&cs=tinysrgb&w=600",
    video: null,
    tint: "from-violet-950/85 via-violet-900/30 to-transparent",
  },
  {
    id: "driver",
    title: "On the road",
    subtitle: "Miles, stops & tax sync when you need it",
    cta: "Driver Hub",
    path: "/driver",
    badge: "Tools",
    poster: "https://images.pexels.com/photos/1112598/pexels-photo-1112598.jpeg?auto=compress&cs=tinysrgb&w=600",
    video: null,
    tint: "from-amber-950/85 via-amber-900/30 to-transparent",
  },
];

function ClipCard({ clip, onSelect }) {
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onSelect(clip.path)}
      className="relative flex-shrink-0 w-[148px] sm:w-[168px] h-[260px] sm:h-[290px] rounded-2xl overflow-hidden border border-border text-left shadow-soft opacity-95 hover:opacity-100"
      aria-label={`${clip.title}. ${clip.cta}`}
    >
      {!failed && clip.video ? (
        <video
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          src={clip.video}
          poster={clip.poster}
          muted
          playsInline
          preload="none"
          onError={() => setFailed(true)}
        />
      ) : (
        <img
          src={clip.poster}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          loading="lazy"
          decoding="async"
        />
      )}

      <div className={`absolute inset-0 bg-gradient-to-t ${clip.tint || "from-black/80 via-black/30 to-transparent"}`} />

      <div className="absolute top-3 left-2 right-2 flex items-center justify-between gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/90 text-slate-900">
          {clip.badge}
        </span>
        <Play className="w-3.5 h-3.5 text-white drop-shadow" aria-hidden="true" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
        <p className="text-sm font-bold leading-snug drop-shadow-sm">{clip.title}</p>
        <p className="text-[11px] text-white/85 mt-0.5 line-clamp-2">{clip.subtitle}</p>
        <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-white">
          {clip.cta} <ExternalLink className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
}

/**
 * Static tip reel — no auto-advance, no timers, no programmatic scroll.
 * Idle auto-advance was jumping Home back to the top on mobile.
 */
export default function HomeAdClips({ isActive = true }) {
  const navigate = useNavigate();
  const [muted, setMuted] = useState(true);
  const [marketClips, setMarketClips] = useState([]);

  useEffect(() => {
    if (!isActive) return undefined;
    let alive = true;
    listMarketplaceListings({ page: 0, pageSize: 12 })
      .then((rows) => {
        if (!alive) return;
        const ads = (rows || [])
          .filter((r) => r.images?.[0] || r.title)
          .slice(0, 6)
          .map((r) => ({
            id: `mkt-${r.id}`,
            title: r.title || "Featured service",
            subtitle: r.location_label || r.category || "Nearby marketplace",
            cta: "View listing",
            path: "/marketplace",
            badge: "Featured",
            poster:
              r.images?.[0] ||
              "https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=600",
            video: null,
            tint: "from-slate-950/85 via-slate-900/40 to-transparent",
          }));
        setMarketClips(ads);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isActive]);

  const clips = useMemo(() => [...TITAN_CLIPS, ...marketClips], [marketClips]);

  if (clips.length === 0) return null;

  return (
    <section className="mb-6 -mx-1" aria-label="Short ads and tips" style={{ overflowAnchor: "none" }}>
      <div className="flex items-center justify-between px-1 mb-2.5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">For you</p>
          <p className="text-sm text-muted-foreground">
            {clips.length} tips · swipe sideways (no auto-scroll)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-muted border border-border text-foreground text-xs font-semibold hover:bg-secondary transition-colors"
          aria-label={muted ? "Unmute clips" : "Mute clips"}
        >
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          {muted ? "Muted" : "Sound"}
        </button>
      </div>

      <div
        className="flex gap-3 overflow-x-auto pb-2 px-1 scrollbar-none"
        style={{
          WebkitOverflowScrolling: "touch",
          overflowAnchor: "none",
          overscrollBehaviorX: "contain",
          overscrollBehaviorY: "none",
        }}
      >
        {clips.map((clip) => (
          <ClipCard key={clip.id} clip={clip} onSelect={(path) => navigate(path)} />
        ))}
      </div>
    </section>
  );
}

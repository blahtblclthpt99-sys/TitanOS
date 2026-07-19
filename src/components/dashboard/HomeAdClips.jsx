import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Volume2, VolumeX, ExternalLink } from "lucide-react";
import { listMarketplaceListings } from "@/lib/listingsApi";

const CLIP_MS = 6500;

/** Short Titan promo clips — muted looping video + CTA. */
const TITAN_CLIPS = [
  {
    id: "payments",
    title: "Get paid faster",
    subtitle: "Send a Stripe checkout link in seconds",
    cta: "Open Payments",
    path: "/payments",
    badge: "Titan tip",
    poster:
      "https://images.pexels.com/photos/4386370/pexels-photo-4386370.jpeg?auto=compress&cs=tinysrgb&w=600",
    video: "https://videos.pexels.com/video-files/7578552/7578552-sd_640_360_30fps.mp4",
    tint: "from-blue-950/80 via-blue-900/40 to-transparent",
  },
  {
    id: "marketplace",
    title: "Win more jobs",
    subtitle: "Showcase services on Marketplace",
    cta: "Browse Market",
    path: "/marketplace",
    badge: "Grow",
    poster:
      "https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?auto=compress&cs=tinysrgb&w=600",
    video: "https://videos.pexels.com/video-files/5752729/5752729-sd_640_360_30fps.mp4",
    tint: "from-slate-950/80 via-slate-900/35 to-transparent",
  },
  {
    id: "ai",
    title: "Ask Titan AI",
    subtitle: "Schedule, invoice, and chase payments by chat",
    cta: "Try Assistant",
    path: "/assistant",
    badge: "New",
    poster:
      "https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=600",
    video: "https://videos.pexels.com/video-files/3129671/3129671-sd_640_360_30fps.mp4",
    tint: "from-indigo-950/85 via-indigo-900/40 to-transparent",
  },
  {
    id: "hire",
    title: "Need backup?",
    subtitle: "Hire vetted workers for busy weeks",
    cta: "Hire Workers",
    path: "/hire",
    badge: "Staffing",
    poster:
      "https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=600",
    video: "https://videos.pexels.com/video-files/3571264/3571264-sd_640_360_30fps.mp4",
    tint: "from-emerald-950/80 via-emerald-900/35 to-transparent",
  },
  {
    id: "tax",
    title: "Stay tax-ready",
    subtitle: "Track miles & 1099 expenses all year",
    cta: "Tax Center",
    path: "/tax-center",
    badge: "Money",
    poster:
      "https://images.pexels.com/photos/6863183/pexels-photo-6863183.jpeg?auto=compress&cs=tinysrgb&w=600",
    video: "https://videos.pexels.com/video-files/3773486/3773486-sd_640_360_30fps.mp4",
    tint: "from-amber-950/80 via-amber-900/35 to-transparent",
  },
];

function ClipCard({ clip, active, muted, onSelect, onActivate }) {
  const videoRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || failed) return;
    el.muted = muted;
    if (active) {
      el.play().catch(() => {});
    } else {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }, [active, muted, failed]);

  return (
    <button
      type="button"
      onClick={() => {
        onActivate();
        onSelect(clip.path);
      }}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      className={`relative flex-shrink-0 w-[148px] sm:w-[168px] h-[260px] sm:h-[290px] rounded-2xl overflow-hidden border text-left shadow-soft transition-all duration-300 ${
        active ? "border-primary ring-2 ring-primary/30 scale-[1.02]" : "border-border opacity-90 hover:opacity-100"
      }`}
      aria-label={`${clip.title}. ${clip.cta}`}
    >
      {!failed && clip.video ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src={clip.video}
          poster={clip.poster}
          muted={muted}
          playsInline
          loop
          preload="metadata"
          onError={() => setFailed(true)}
        />
      ) : (
        <img
          src={clip.poster}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover ${active ? "animate-[ken_8s_ease-in-out_infinite_alternate]" : ""}`}
          loading="lazy"
        />
      )}

      <div className={`absolute inset-0 bg-gradient-to-t ${clip.tint || "from-black/80 via-black/30 to-transparent"}`} />

      {/* Progress bar for active clip */}
      {active && (
        <div className="absolute top-2 left-2 right-2 h-1 rounded-full bg-white/25 overflow-hidden">
          <motion.div
            key={clip.id + String(active)}
            className="h-full bg-white rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: CLIP_MS / 1000, ease: "linear" }}
          />
        </div>
      )}

      <div className="absolute top-3.5 left-2 right-2 flex items-center justify-between gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/90 text-slate-900">
          {clip.badge}
        </span>
        {!active && <Play className="w-3.5 h-3.5 text-white drop-shadow" aria-hidden="true" />}
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

export default function HomeAdClips() {
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [marketClips, setMarketClips] = useState([]);
  const scrollerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    listMarketplaceListings({ page: 0, pageSize: 4 })
      .then((rows) => {
        if (!alive) return;
        const ads = (rows || [])
          .filter((r) => r.images?.[0] || r.title)
          .slice(0, 3)
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
  }, []);

  const clips = useMemo(() => [...TITAN_CLIPS, ...marketClips], [marketClips]);

  useEffect(() => {
    if (clips.length === 0) return undefined;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % clips.length);
    }, CLIP_MS);
    return () => window.clearInterval(id);
  }, [clips.length]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const child = scroller.children[active];
    if (child?.scrollIntoView) {
      child.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [active]);

  if (clips.length === 0) return null;

  return (
    <section className="mb-6 -mx-1" aria-label="Short ads and tips">
      <div className="flex items-center justify-between px-1 mb-2.5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">For you</p>
          <p className="text-sm text-muted-foreground">Short clips · tips & featured services</p>
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
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto pb-2 px-1 snap-x snap-mandatory scrollbar-none"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {clips.map((clip, index) => (
          <div key={clip.id} className="snap-center">
            <ClipCard
              clip={clip}
              active={index === active}
              muted={muted}
              onActivate={() => setActive(index)}
              onSelect={(path) => navigate(path)}
            />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes ken {
          from { transform: scale(1); }
          to { transform: scale(1.08); }
        }
      `}</style>
    </section>
  );
}

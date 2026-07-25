import React from "react";
import { Link } from "react-router-dom";
import TitanMark from "@/components/brand/TitanMark";
import TitanWordmark from "@/components/brand/TitanWordmark";

const ASSET = {
  mark: "/brand/titanos-mark-glow.png",
  stacked: "/brand/titanos-stacked.png",
  horizontal: "/brand/titanos-horizontal.png",
  badge: "/brand/titanos-badge.png",
};

/**
 * Unified brand lockup for chrome + marketing.
 * - svg: crisp theme-aware mark + wordmark (default, preferred in app shell)
 * - stacked | horizontal | badge: raster assets from brand pack
 */
export default function TitanBrandLogo({
  to,
  layout = "svg",
  showTagline = false,
  markClassName = "h-8 w-8",
  className = "",
  imgClassName = "",
  onClick,
}) {
  let inner;

  if (layout === "stacked") {
    inner = (
      <img
        src={ASSET.stacked}
        alt="TitanOS"
        className={`h-16 w-auto object-contain ${imgClassName}`}
        loading="lazy"
        decoding="async"
      />
    );
  } else if (layout === "horizontal") {
    inner = (
      <img
        src={ASSET.horizontal}
        alt="TitanOS — Platform for Modern Business"
        className={`h-10 w-auto max-w-[220px] object-contain object-left ${imgClassName}`}
        loading="lazy"
        decoding="async"
      />
    );
  } else if (layout === "badge") {
    inner = (
      <img
        src={ASSET.badge}
        alt="TitanOS"
        className={`h-24 w-24 rounded-full object-cover shadow-soft ${imgClassName}`}
        loading="lazy"
        decoding="async"
      />
    );
  } else if (layout === "glow") {
    inner = (
      <span className="inline-flex items-center gap-2">
        <img
          src={ASSET.mark}
          alt=""
          aria-hidden="true"
          className={`h-9 w-9 object-contain ${imgClassName}`}
          loading="lazy"
          decoding="async"
        />
        <TitanWordmark showTagline={showTagline} />
      </span>
    );
  } else {
    inner = (
      <span className="inline-flex items-center gap-2 min-w-0">
        <TitanMark className={markClassName} />
        <TitanWordmark showTagline={showTagline} size={showTagline ? "md" : "sm"} />
      </span>
    );
  }

  const shared = `inline-flex items-center shrink-0 focus-ring rounded-md ${className}`;

  if (to) {
    return (
      <Link to={to} className={shared} onClick={onClick} aria-label="TitanOS home">
        {inner}
      </Link>
    );
  }

  return (
    <span className={shared} onClick={onClick}>
      {inner}
    </span>
  );
}

export { ASSET as TITAN_BRAND_ASSETS };

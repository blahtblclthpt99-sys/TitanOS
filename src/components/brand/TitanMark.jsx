import React, { useId } from "react";

/**
 * TitanOS shield mark — star + orbit. Theme-aware disc via CSS (light/dark).
 */
export default function TitanMark({ className = "h-8 w-8", title = "TitanOS" }) {
  const uid = useId().replace(/:/g, "");
  const grad = `titanShieldGrad-${uid}`;
  const shine = `titanShieldShine-${uid}`;

  return (
    <svg
      className={`titan-mark ${className}`}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <circle
        className="titan-mark-disc-light"
        cx="48"
        cy="48"
        r="46"
        fill="#EFF6FF"
        stroke="#BFDBFE"
        strokeWidth="2"
      />
      <circle
        className="titan-mark-disc-dark"
        cx="48"
        cy="48"
        r="46"
        fill="transparent"
        stroke="rgba(96,165,250,0.4)"
        strokeWidth="2"
      />
      <ellipse
        cx="48"
        cy="48"
        rx="34"
        ry="13"
        transform="rotate(-28 48 48)"
        stroke="var(--titan-orbit, #22D3EE)"
        strokeWidth="2.75"
        fill="none"
        opacity="0.95"
      />
      <path
        d="M48 16c-13 6.5-22 15-22 30 0 17 13 30 22 36 9-6 22-19 22-36 0-15-9-23.5-22-30z"
        fill={`url(#${grad})`}
      />
      <path
        d="M48 16c-13 6.5-22 15-22 30 0 17 13 30 22 36 9-6 22-19 22-36 0-15-9-23.5-22-30z"
        fill={`url(#${shine})`}
        opacity="0.45"
      />
      <path
        d="M48 30l3.2 9.6H62l-8.6 6.2 3.3 10.2L48 49.6l-8.7 6.4 3.3-10.2L34 39.6h10.8L48 30z"
        fill="#FFFFFF"
      />
      <circle cx="74" cy="40" r="2.2" fill="var(--titan-orbit, #22D3EE)" opacity="0.95" />
      <defs>
        <linearGradient id={grad} x1="30" y1="16" x2="66" y2="82" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id={shine} x1="40" y1="18" x2="58" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

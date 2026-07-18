import React from "react";

/** Original TitanOS mark — shield + star + orbit (not copied from any CDN). */
export default function TitanMark({ className = "w-20 h-20", title = "TitanOS" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <circle cx="48" cy="48" r="46" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="2" />
      <ellipse
        cx="48"
        cy="48"
        rx="34"
        ry="14"
        transform="rotate(-28 48 48)"
        stroke="#60A5FA"
        strokeWidth="2.5"
        fill="none"
        opacity="0.9"
      />
      <path
        d="M48 18c-12 6-20 14-20 28 0 16 12 28 20 34 8-6 20-18 20-34 0-14-8-22-20-28z"
        fill="#2563EB"
      />
      <path
        d="M48 28l3.4 10.4H62l-8.4 6.1 3.2 10.5L48 48.9l-8.8 6.1 3.2-10.5-8.4-6.1h10.6L48 28z"
        fill="#FFFFFF"
      />
      <text
        x="48"
        y="86"
        textAnchor="middle"
        fill="#1D4ED8"
        fontSize="11"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight="700"
      >
        TitanOS
      </text>
    </svg>
  );
}

import React, { useId } from "react";

/** Metallic Titan shield, shared by the in-app header and Android adaptive icon. */
export default function TitanMark({ className = "h-8 w-8", title = "TitanOS" }) {
  const uid = useId().replace(/:/g, "");
  const silver = `titan-silver-${uid}`;
  const blue = `titan-blue-${uid}`;
  return (
    <svg className={`titan-mark shrink-0 ${className}`} viewBox="0 0 108 108"
      xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title}>
      <defs>
        <linearGradient id={silver} x1="28" y1="33" x2="74" y2="76" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" /><stop offset=".48" stopColor="#D6E6F7" /><stop offset="1" stopColor="#718EAC" />
        </linearGradient>
        <linearGradient id={blue} x1="19" y1="24" x2="84" y2="89" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4ED5FF" /><stop offset="1" stopColor="#0058C7" />
        </linearGradient>
      </defs>
      <path d="M54 16 88 34 83 70 54 92 25 70 20 34Z" fill="#102A48" stroke="#FFBD43" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M54 23 79 37 75 65 54 82 33 65 29 37Z" fill={`url(#${blue})`} />
      <path d="M54 27 74 39 70 62 54 76 38 62 34 39Z" fill="#061A35" />
      <path d="M32 38H76L70 49H60V71L54 78 48 71V49H38Z" fill={`url(#${silver})`} />
      <path d="M34 39H73L69 43H39Z" fill="#FFFFFF" opacity=".85" />
    </svg>
  );
}

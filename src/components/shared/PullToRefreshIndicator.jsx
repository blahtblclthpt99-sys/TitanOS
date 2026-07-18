import React from "react";
import { RefreshCw } from "lucide-react";

export default function PullToRefreshIndicator({ pullProgress, isRefreshing, pullDist }) {
  const size = 32;
  const show = pullProgress > 0.05 || isRefreshing;
  if (!show) return null;
  const deg = isRefreshing ? undefined : pullProgress * 360;

  return (
    <div
      className="flex items-center justify-center transition-all duration-150 overflow-hidden"
      style={{ height: isRefreshing ? 48 : Math.min(pullDist * 0.65, 48) }}
    >
      <div
        className={`w-8 h-8 rounded-full bg-titan-cyan/10 border border-titan-cyan/20 flex items-center justify-center ${isRefreshing ? "animate-spin" : ""}`}
        style={!isRefreshing ? { transform: `rotate(${deg}deg)` } : undefined}
      >
        <RefreshCw className="w-4 h-4 text-titan-cyan" />
      </div>
    </div>
  );
}
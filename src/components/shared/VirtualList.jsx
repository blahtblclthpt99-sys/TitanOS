import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

const VIRTUAL_THRESHOLD = 25;
const DEFAULT_ESTIMATE = 120;

export function shouldVirtualize(count) {
  return count > VIRTUAL_THRESHOLD;
}

/**
 * Virtualized list with dynamic row measurement so expanded cards
 * (Jobs field ops, maps, photos) do not overlap neighbors.
 */
export default function VirtualList({
  items,
  renderItem,
  estimateSize = DEFAULT_ESTIMATE,
  className = "",
  gap = 8,
  scrollRef = null,
}) {
  const internalRef = useRef(null);
  const scrollElementRef = scrollRef ?? internalRef;
  const useExternalScroll = Boolean(scrollRef);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => (typeof estimateSize === "function" ? estimateSize() : estimateSize) + gap,
    measureElement:
      typeof window !== "undefined" && typeof window.ResizeObserver !== "undefined"
        ? (el) => el?.getBoundingClientRect().height ?? DEFAULT_ESTIMATE + gap
        : undefined,
    overscan: 6,
  });

  const listBody = (
    <div
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        width: "100%",
        position: "relative",
      }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const item = items[virtualRow.index];
        return (
          <div
            key={item.id ?? virtualRow.index}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
              paddingBottom: gap,
            }}
          >
            {renderItem(item, virtualRow.index)}
          </div>
        );
      })}
    </div>
  );

  if (useExternalScroll) {
    return <div className={className}>{listBody}</div>;
  }

  return (
    <div
      ref={internalRef}
      className={`overflow-y-auto ${className}`}
      style={{ maxHeight: "calc(100svh - 16rem)" }}
    >
      {listBody}
    </div>
  );
}

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

const VIRTUAL_THRESHOLD = 25;
const DEFAULT_ESTIMATE = 88;

export function shouldVirtualize(count) {
  return count > VIRTUAL_THRESHOLD;
}

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
    estimateSize: () => estimateSize + gap,
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

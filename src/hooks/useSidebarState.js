import { useCallback, useEffect, useState } from "react";
import { readBooleanStorage, writeStorage } from "@/lib/storage";

const SIDEBAR_STORAGE_KEY = "titanos_sidebar_expanded";

export function useSidebarState() {
  const [expanded, setExpanded] = useState(() =>
    readBooleanStorage(SIDEBAR_STORAGE_KEY, false)
  );

  const toggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  useEffect(() => {
    writeStorage(SIDEBAR_STORAGE_KEY, String(expanded));
    document.documentElement.style.setProperty(
      "--sidebar-width",
      expanded ? "256px" : "72px"
    );
  }, [expanded]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return { expanded, setExpanded, toggle };
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TitanAttentionApp from "@/attention/App.jsx";
import attentionCss from "@/attention/index.css?inline";

function isolateAttentionCss(css) {
  return String(css || "")
    .replace(/:root\s*\{/g, ":host {")
    .replace(/(^|})\s*html\s*\{/gm, "$1 :host {")
    .replace(/(^|})\s*body\s*\{/gm, "$1 .attention-root {");
}

/**
 * Titan Attention is intentionally isolated from the TitanOS design system.
 * Its legacy global stylesheet is injected into a shadow root so generic
 * selectors (body, h1, button, etc.) cannot leak into the main application.
 */
export default function TitanAttention() {
  const hostRef = useRef(null);
  const [portalTarget, setPortalTarget] = useState(null);
  const scopedCss = useMemo(() => isolateAttentionCss(attentionCss), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });

    let style = shadow.querySelector("style[data-titan-attention]");
    if (!style) {
      style = document.createElement("style");
      style.dataset.titanAttention = "true";
      style.textContent = scopedCss;
      shadow.appendChild(style);
    }

    let mount = shadow.querySelector("[data-titan-attention-root]");
    if (!mount) {
      mount = document.createElement("div");
      mount.dataset.titanAttentionRoot = "true";
      shadow.appendChild(mount);
    }

    setPortalTarget(mount);
    return () => setPortalTarget(null);
  }, [scopedCss]);

  return (
    <div ref={hostRef} style={{ display: "block", minHeight: "100vh" }}>
      {portalTarget
        ? createPortal(
            <div className="attention-root">
              <TitanAttentionApp />
            </div>,
            portalTarget
          )
        : null}
    </div>
  );
}

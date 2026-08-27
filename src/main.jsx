import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { installAttentionUxRuntime } from "./lib/attentionUxRuntime.js";
import "./index.css";
import "./styles/attention-polish.css";
import "./styles/attention-refine.css";
import "./styles/attention-interaction.css";

async function purgeLegacyClientState() {
  if (typeof window === "undefined") return;
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if (window.caches?.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    for (const key of Object.keys(localStorage)) {
      if (/^(titanos-|titan-|second-|driver-|job-|business-)/i.test(key) && !/^titan-attention/i.test(key)) {
        localStorage.removeItem(key);
      }
    }
    for (const key of Object.keys(sessionStorage)) {
      if (/^(titanos-|titan-|second-|driver-|job-|business-)/i.test(key) && !/^titan-attention/i.test(key)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Cleanup is best-effort; rendering must never depend on it.
  }
}

purgeLegacyClientState();
installAttentionUxRuntime();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

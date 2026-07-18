/** Google Play listing for the official Capacitor app */
export const TITANOS_PLAY_STORE_URL =
  import.meta.env.VITE_TITANOS_PLAY_STORE_URL ||
  "https://play.google.com/store/apps/details?id=com.titanos.myapp";

/** Closed / open testing opt-in (testers must open this once while signed into Google) */
export const TITANOS_PLAY_TESTING_URL =
  import.meta.env.VITE_TITANOS_PLAY_TESTING_URL ||
  "https://play.google.com/apps/testing/com.titanos.myapp";

/** Direct APK/AAB download URLs — override with VITE_TITANOS_APK_URL / VITE_TITANOS_AAB_URL */
export const TITANOS_APK_URL =
  import.meta.env.VITE_TITANOS_APK_URL || "/static/TitanOS.apk";

export const TITANOS_AAB_URL =
  import.meta.env.VITE_TITANOS_AAB_URL || "/static/TitanOS.aab";

export const TITANOS_APK_FILENAME = "TitanOS.apk";
export const TITANOS_AAB_FILENAME = "TitanOS.aab";

function triggerDownload(href, filename) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function openPlayStore() {
  if (typeof window === "undefined") return;
  window.open(TITANOS_PLAY_STORE_URL, "_blank", "noopener,noreferrer");
}

export function openPlayTestingOptIn() {
  if (typeof window === "undefined") return;
  window.open(TITANOS_PLAY_TESTING_URL, "_blank", "noopener,noreferrer");
}

export function downloadTitanOSApk() {
  triggerDownload(TITANOS_APK_URL, TITANOS_APK_FILENAME);
}

export function downloadTitanOSAab() {
  triggerDownload(TITANOS_AAB_URL, TITANOS_AAB_FILENAME);
}

export const DOWNLOAD_PACKAGES = [
  {
    id: "play",
    label: "Play",
    name: "Google Play (recommended)",
    desc: "Install from Play — required for closed testers. Use the same Google account invited in Play Console.",
    url: TITANOS_PLAY_STORE_URL,
    filename: "Play Store",
    size: "Official listing",
    primary: true,
    download: openPlayStore,
  },
  {
    id: "apk",
    label: "APK",
    name: "Direct APK (sideload)",
    desc: "Only if Play install fails. Enable Install unknown apps for your browser.",
    url: TITANOS_APK_URL,
    filename: TITANOS_APK_FILENAME,
    size: "Android APK",
    primary: false,
    download: downloadTitanOSApk,
  },
  {
    id: "aab",
    label: "AAB",
    name: "App Bundle (developers)",
    desc: "For Play Console upload / Android Studio — not for phone install.",
    url: TITANOS_AAB_URL,
    filename: TITANOS_AAB_FILENAME,
    size: "Android AAB",
    primary: false,
    download: downloadTitanOSAab,
  },
];

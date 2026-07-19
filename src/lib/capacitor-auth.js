import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

/**
 * When Google OAuth returns to com.titanos.myapp://auth/callback?...
 * close the system browser and route into the SPA hash router.
 */
export function installNativeAuthDeepLinks() {
  if (!Capacitor.isNativePlatform()) return () => {};

  const sub = App.addListener("appUrlOpen", async ({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.host === "auth" && parsed.pathname.startsWith("/callback")) {
        try {
          await Browser.close();
        } catch {
          // Browser may already be closed
        }
        const target = `/#/auth/callback${parsed.search || ""}${parsed.hash || ""}`;
        window.location.replace(target);
      }
    } catch {
      // ignore malformed deep links
    }
  });

  return () => {
    sub.then((handle) => handle.remove()).catch(() => {});
  };
}

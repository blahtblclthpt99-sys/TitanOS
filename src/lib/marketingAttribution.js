const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const STORAGE_KEY = "titanos_marketing_attribution_v1";

export function captureMarketingAttribution(search = typeof location !== "undefined" ? location.search : "") {
  const params = new URLSearchParams(search || "");
  const attribution = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) attribution[key] = value.slice(0, 100);
  }
  if (Object.keys(attribution).length) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
    } catch {
      /* attribution is best effort */
    }
  }
  return attribution;
}

export function registrationHref(extra = {}) {
  let attribution = {};
  try {
    attribution = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    attribution = {};
  }
  if (typeof location !== "undefined") {
    attribution = { ...attribution, ...captureMarketingAttribution(location.search) };
  }
  const params = new URLSearchParams({ ...attribution, ...extra });
  const query = params.toString();
  return query ? `/register?${query}` : "/register";
}

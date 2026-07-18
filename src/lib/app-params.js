const isNode = typeof window === "undefined";
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const toSnakeCase = (str) => str.replace(/([A-Z])/g, "_$1").toLowerCase();
const STORAGE_PREFIX = "titanos_";

function readStorage(key) {
  return storage.getItem(`${STORAGE_PREFIX}${key}`);
}

function writeStorage(key, value) {
  storage.setItem(`${STORAGE_PREFIX}${key}`, value);
}

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
  if (isNode) return defaultValue;

  const storageKey = toSnakeCase(paramName);
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);

  if (removeFromUrl) {
    urlParams.delete(paramName);
    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }

  if (searchParam) {
    writeStorage(storageKey, searchParam);
    return searchParam;
  }

  if (defaultValue) {
    writeStorage(storageKey, defaultValue);
    return defaultValue;
  }

  const storedValue = readStorage(storageKey);
  if (storedValue) return storedValue;

  return null;
};

const getAppParams = () => {
  if (getAppParamValue("clear_access_token") === "true") {
    storage.removeItem("titanos_access_token");
    storage.removeItem("token");
  }

  return {
    token: getAppParamValue("access_token", { removeFromUrl: true }),
    fromUrl: getAppParamValue("from_url", {
      defaultValue: typeof window !== "undefined" ? window.location.href : undefined,
    }),
  };
};

export const appParams = {
  ...getAppParams(),
};

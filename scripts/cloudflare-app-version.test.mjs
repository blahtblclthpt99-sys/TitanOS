import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { dispatchNativeApi, hasNativeApiRoute } from "../cloudflare/api-router.js";

const ROUTE = "/api/functions/appVersion";
const URL = `https://preview.titanos.invalid${ROUTE}`;
const KEYS = ["APP_LATEST_VERSION", "APP_MINIMUM_VERSION", "ANDROID_STORE_URL", "IOS_STORE_URL"];
const original = new Map();

function setEnv(name, value) {
  if (value == null) delete process.env[name];
  else process.env[name] = value;
}

async function dispatch(method = "GET") {
  return dispatchNativeApi(
    new Request(URL, {
      method,
      headers: {
        Origin: "https://titanos.app",
        "X-Request-Id": "app-version-contract-test",
      },
    }),
    "app-version-contract-test",
  );
}

beforeEach(() => {
  for (const key of KEYS) original.set(key, process.env[key]);
});

afterEach(() => {
  for (const key of KEYS) setEnv(key, original.get(key));
  original.clear();
});

describe("Cloudflare appVersion route", () => {
  it("is explicitly registered as a native Worker route", () => {
    assert.equal(hasNativeApiRoute(ROUTE), true);
  });

  it("returns only explicit valid release metadata", async () => {
    setEnv("APP_LATEST_VERSION", "2.1.3");
    setEnv("APP_MINIMUM_VERSION", "2.0.0");
    setEnv("ANDROID_STORE_URL", "https://play.google.com/store/apps/details?id=com.titanos.myapp");
    setEnv("IOS_STORE_URL", "https://apps.apple.com/app/id123456789");

    const response = await dispatch("GET");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-titanos-api-runtime"), "cloudflare-workers-native");

    const body = await response.json();
    assert.deepEqual(body, {
      latest: "2.1.3",
      minimum: "2.0.0",
      android_url: "https://play.google.com/store/apps/details?id=com.titanos.myapp",
      ios_url: "https://apps.apple.com/app/id123456789",
    });
  });

  it("fails closed when release metadata is absent", async () => {
    setEnv("APP_LATEST_VERSION", null);
    setEnv("APP_MINIMUM_VERSION", null);

    const response = await dispatch("GET");
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, "APP_VERSION_UNCONFIGURED");
  });

  it("fails closed when either configured version is malformed", async () => {
    setEnv("APP_LATEST_VERSION", "latest");
    setEnv("APP_MINIMUM_VERSION", "2.0.0");

    let response = await dispatch("GET");
    assert.equal(response.status, 503);

    setEnv("APP_LATEST_VERSION", "2.1.0");
    setEnv("APP_MINIMUM_VERSION", "2.x");
    response = await dispatch("GET");
    assert.equal(response.status, 503);
  });

  it("accepts HEAD and rejects mutating methods", async () => {
    setEnv("APP_LATEST_VERSION", "2.1.0");
    setEnv("APP_MINIMUM_VERSION", "2.0.0");

    const head = await dispatch("HEAD");
    assert.equal(head.status, 200);

    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const response = await dispatch(method);
      assert.equal(response.status, 405, `${method} must be rejected`);
      const body = await response.json();
      assert.equal(body.error, "Method not allowed");
    }
  });
});

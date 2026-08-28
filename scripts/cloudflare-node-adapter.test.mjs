import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { invokeNodeHandler } from "../cloudflare/node-handler-adapter.js";

function request(path, init = {}) {
  return new Request(`https://preview.example${path}`, init);
}

describe("Cloudflare Node handler adapter", () => {
  it("preserves method, auth header, repeated query keys, parsed JSON, and exact raw body", async () => {
    const raw = '{"hello":"world","count":2}';
    const response = await invokeNodeHandler(
      async (req, res) => {
        assert.equal(req.method, "PATCH");
        assert.equal(req.headers.authorization, "Bearer test-token");
        assert.deepEqual(req.query.tag, ["one", "two"]);
        assert.equal(req.query.single, "yes");
        assert.deepEqual(req.body, { hello: "world", count: 2 });
        assert.equal(req.rawBody.toString("utf8"), raw);
        assert.equal(req.hostname, "preview.example");
        assert.equal(req.secure, true);
        return res.status(202).json({ ok: true });
      },
      request("/api/test?tag=one&tag=two&single=yes", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.9",
        },
        body: raw,
      }),
      { "X-Adapter-Test": "passed" },
    );

    assert.equal(response.status, 202);
    assert.equal(response.headers.get("x-adapter-test"), "passed");
    assert.deepEqual(await response.json(), { ok: true });
  });

  it("preserves raw binary bodies without coercing them to text", async () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const response = await invokeNodeHandler(
      async (req, res) => {
        assert.ok(Buffer.isBuffer(req.body));
        assert.deepEqual([...req.body], [...bytes]);
        assert.deepEqual([...req.rawBody], [...bytes]);
        return res.status(204).end();
      },
      request("/api/binary", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: bytes,
      }),
    );

    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
  });

  it("preserves redirects and response headers", async () => {
    const response = await invokeNodeHandler(
      async (_req, res) => {
        res.setHeader("Cache-Control", "no-store");
        return res.redirect(303, "https://example.org/complete");
      },
      request("/api/redirect"),
    );

    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "https://example.org/complete");
    assert.equal(response.headers.get("cache-control"), "no-store");
  });

  it("preserves multiple Set-Cookie values", async () => {
    const response = await invokeNodeHandler(
      async (_req, res) => {
        res.setHeader("Set-Cookie", [
          "session=abc; Path=/; HttpOnly; Secure; SameSite=Lax",
          "csrf=xyz; Path=/; Secure; SameSite=Strict",
        ]);
        return res.status(200).send("ok");
      },
      request("/api/cookies"),
    );

    const getSetCookie = response.headers.getSetCookie;
    assert.equal(typeof getSetCookie, "function");
    assert.deepEqual(response.headers.getSetCookie(), [
      "session=abc; Path=/; HttpOnly; Secure; SameSite=Lax",
      "csrf=xyz; Path=/; Secure; SameSite=Strict",
    ]);
  });

  it("supports writeHead + buffered write/end for non-streaming handlers", async () => {
    const response = await invokeNodeHandler(
      async (_req, res) => {
        res.writeHead(201, { "Content-Type": "text/plain; charset=utf-8" });
        res.write("part-a");
        res.end("-part-b");
      },
      request("/api/write"),
    );

    assert.equal(response.status, 201);
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(await response.text(), "part-a-part-b");
  });
});

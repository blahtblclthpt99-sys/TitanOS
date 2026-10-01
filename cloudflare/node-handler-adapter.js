import { Buffer } from "node:buffer";

function headersToObject(headers) {
  const out = {};
  for (const [key, value] of headers.entries()) out[key.toLowerCase()] = value;
  return out;
}

function queryToObject(url) {
  const out = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      out[key] = Array.isArray(out[key]) ? [...out[key], value] : [out[key], value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function readRequestBody(request) {
  if (request.method === "GET" || request.method === "HEAD") {
    return { rawBody: Buffer.alloc(0), body: undefined };
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.length) return { rawBody: bytes, body: undefined };

  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    try {
      return { rawBody: bytes, body: JSON.parse(bytes.toString("utf8")) };
    } catch {
      return { rawBody: bytes, body: undefined };
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(bytes.toString("utf8"));
    return { rawBody: bytes, body: Object.fromEntries(params.entries()) };
  }

  return { rawBody: bytes, body: bytes.toString("utf8") };
}

function makeNodeRequest(request, url, bodyState) {
  const headers = headersToObject(request.headers);
  const ip = headers["cf-connecting-ip"] || headers["x-forwarded-for"]?.split(",")[0]?.trim() || "";

  const req = {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    originalUrl: `${url.pathname}${url.search}`,
    headers,
    query: queryToObject(url),
    body: bodyState.body,
    rawBody: bodyState.rawBody,
    ip,
    socket: { remoteAddress: ip },
    connection: { remoteAddress: ip },
  };

  req[Symbol.asyncIterator] = async function* () {
    if (bodyState.rawBody?.length) yield bodyState.rawBody;
  };

  return req;
}

function makeNodeResponse() {
  let statusCode = 200;
  let body = null;
  let ended = false;
  const headers = new Headers();

  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(value) {
      const next = Number(value);
      if (Number.isInteger(next) && next >= 100 && next <= 599) statusCode = next;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    setHeader(name, value) {
      if (Array.isArray(value)) {
        headers.delete(name);
        for (const item of value) headers.append(name, String(item));
      } else {
        headers.set(name, String(value));
      }
      return res;
    },
    getHeader(name) {
      return headers.get(name) ?? undefined;
    },
    removeHeader(name) {
      headers.delete(name);
      return res;
    },
    json(value) {
      if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
      body = JSON.stringify(value ?? null);
      ended = true;
      return res;
    },
    send(value) {
      if (value == null) body = null;
      else if (typeof value === "string" || value instanceof Uint8Array || value instanceof ArrayBuffer) body = value;
      else {
        if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
        body = JSON.stringify(value);
      }
      ended = true;
      return res;
    },
    writeHead(code, nextHeaders = {}) {
      res.status(code);
      for (const [name, value] of Object.entries(nextHeaders)) res.setHeader(name, value);
      return res;
    },
    write(value) {
      const text = value == null ? "" : String(value);
      body = body == null ? text : `${body}${text}`;
      return true;
    },
    end(value) {
      if (value !== undefined) res.send(value);
      ended = true;
      return res;
    },
    redirect(first, second) {
      const code = second === undefined ? 302 : Number(first);
      const location = second === undefined ? first : second;
      res.status(code).setHeader("Location", location).end();
      return res;
    },
    _toResponse() {
      if (!ended && statusCode === 204) return new Response(null, { status: 204, headers });
      return new Response(body, { status: statusCode, headers });
    },
  };

  return res;
}

export async function runNodeHandler(handler, request) {
  if (typeof handler !== "function") {
    return Response.json({ error: "API handler unavailable" }, { status: 500 });
  }

  const url = new URL(request.url);
  const bodyState = await readRequestBody(request);
  const req = makeNodeRequest(request, url, bodyState);
  const res = makeNodeResponse();

  try {
    await handler(req, res);
    return res._toResponse();
  } catch (error) {
    console.error("cloudflare:node-handler", {
      path: url.pathname,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

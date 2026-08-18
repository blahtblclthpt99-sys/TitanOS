import { Buffer } from "node:buffer";

function headerObject(headers) {
  const out = {};
  for (const [key, value] of headers.entries()) {
    out[String(key).toLowerCase()] = value;
  }
  return out;
}

function queryObject(url) {
  const out = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (out[key] === undefined) out[key] = value;
    else if (Array.isArray(out[key])) out[key].push(value);
    else out[key] = [out[key], value];
  }
  return out;
}

async function parseBody(request) {
  if (request.method === "GET" || request.method === "HEAD") {
    return { body: {}, rawBody: Buffer.alloc(0) };
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  if (!rawBody.length) return { body: {}, rawBody };

  if (contentType.includes("application/json")) {
    try {
      return { body: JSON.parse(rawBody.toString("utf8")), rawBody };
    } catch {
      return { body: {}, rawBody };
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return {
      body: Object.fromEntries(new URLSearchParams(rawBody.toString("utf8"))),
      rawBody,
    };
  }

  return { body: rawBody.toString("utf8"), rawBody };
}

function createResponseBuilder() {
  let statusCode = 200;
  const headers = new Headers();
  let response = null;

  const finish = (value = null) => {
    if (response) return response;
    const noBody = statusCode === 204 || statusCode === 304;
    response = new Response(noBody ? null : value, { status: statusCode, headers });
    return response;
  };

  const res = {
    setHeader(name, value) {
      if (Array.isArray(value)) headers.set(name, value.join(", "));
      else headers.set(name, String(value));
      return this;
    },
    getHeader(name) {
      return headers.get(name);
    },
    status(code) {
      statusCode = Number(code) || 200;
      return this;
    },
    json(value) {
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json; charset=utf-8");
      return finish(JSON.stringify(value ?? null));
    },
    send(value) {
      if (value != null && typeof value === "object" && !Buffer.isBuffer(value)) return this.json(value);
      return finish(value == null ? null : value);
    },
    end(value) {
      return finish(value == null ? null : value);
    },
  };

  Object.defineProperty(res, "statusCode", {
    get() {
      return statusCode;
    },
    set(value) {
      statusCode = Number(value) || 200;
    },
  });

  return {
    res,
    getResponse() {
      return response || finish(null);
    },
  };
}

function populateProcessEnv(env) {
  if (typeof process === "undefined" || !process.env || !env) return;
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && process.env[key] === undefined) process.env[key] = value;
  }
  // Preserve the production behavior that existing handlers used on Vercel.
  // Several security gates (registration confirmation, durable protections,
  // telemetry labels) key off these environment names.
  if (!process.env.NODE_ENV) process.env.NODE_ENV = "production";
  if (!process.env.VERCEL_ENV) process.env.VERCEL_ENV = "production";
  if (!process.env.PUBLIC_APP_URL) process.env.PUBLIC_APP_URL = "https://titanfieldos.com";
  if (!process.env.VITE_TITANOS_PUBLIC_ORIGIN) {
    process.env.VITE_TITANOS_PUBLIC_ORIGIN = "https://titanfieldos.com";
  }
}

export async function runVercelHandler(handler, context) {
  populateProcessEnv(context.env);

  const request = context.request;
  const url = new URL(request.url);
  const { body, rawBody } = await parseBody(request.clone());
  const headers = headerObject(request.headers);
  const clientIp = headers["cf-connecting-ip"] || headers["x-forwarded-for"] || "unknown";

  const req = {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers,
    query: queryObject(url),
    body,
    rawBody,
    socket: { remoteAddress: clientIp },
    connection: { remoteAddress: clientIp },
    async *[Symbol.asyncIterator]() {
      if (rawBody?.length) yield rawBody;
    },
  };

  const builder = createResponseBuilder();
  const returned = await handler(req, builder.res);
  if (returned instanceof Response) return returned;
  return builder.getResponse();
}

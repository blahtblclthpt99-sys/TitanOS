import { Buffer } from "node:buffer";

function headersToNodeObject(headers) {
  const output = Object.create(null);
  for (const [name, value] of headers.entries()) {
    const lower = name.toLowerCase();
    output[lower] = value;
    output[name] = value;
  }
  return output;
}

function queryToNodeObject(url) {
  const query = Object.create(null);
  for (const [key, value] of url.searchParams.entries()) {
    if (!(key in query)) {
      query[key] = value;
      continue;
    }
    if (Array.isArray(query[key])) query[key].push(value);
    else query[key] = [query[key], value];
  }
  return query;
}

function parseBody(rawBody, contentType) {
  if (!rawBody.length) return undefined;
  const type = String(contentType || "").toLowerCase();

  if (type.includes("application/json") || type.includes("+json")) {
    try {
      return JSON.parse(rawBody.toString("utf8"));
    } catch {
      // Preserve the raw payload. Existing handlers can reject malformed JSON
      // through their own validation without the adapter inventing semantics.
      return rawBody.toString("utf8");
    }
  }

  if (type.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(rawBody.toString("utf8")));
  }

  if (type.startsWith("text/")) return rawBody.toString("utf8");
  return rawBody;
}

async function createNodeRequest(request) {
  const url = new URL(request.url);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const rawBody = hasBody ? Buffer.from(await request.arrayBuffer()) : Buffer.alloc(0);
  const headers = headersToNodeObject(request.headers);

  const req = {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    originalUrl: `${url.pathname}${url.search}`,
    headers,
    query: queryToNodeObject(url),
    body: parseBody(rawBody, request.headers.get("content-type")),
    rawBody,
    hostname: url.hostname,
    protocol: url.protocol.replace(/:$/, ""),
    secure: url.protocol === "https:",
    socket: {
      remoteAddress: request.headers.get("cf-connecting-ip") || "",
    },
  };

  req.connection = req.socket;
  req[Symbol.asyncIterator] = async function* requestBodyIterator() {
    if (rawBody.length) yield rawBody;
  };

  return req;
}

function appendHeader(headers, name, value) {
  if (Array.isArray(value)) {
    for (const item of value) headers.append(name, String(item));
    return;
  }
  headers.set(name, String(value));
}

function createNodeResponse() {
  const headers = new Headers();
  const chunks = [];
  let ended = false;
  let explicitBody;

  const res = {
    statusCode: 200,
    statusMessage: "",
    headersSent: false,

    status(code) {
      this.statusCode = Number(code);
      return this;
    },

    setHeader(name, value) {
      headers.delete(name);
      appendHeader(headers, name, value);
      return this;
    },

    appendHeader(name, value) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(name, String(item));
      } else {
        headers.append(name, String(value));
      }
      return this;
    },

    getHeader(name) {
      return headers.get(name);
    },

    getHeaders() {
      return Object.fromEntries(headers.entries());
    },

    hasHeader(name) {
      return headers.has(name);
    },

    removeHeader(name) {
      headers.delete(name);
      return this;
    },

    writeHead(code, statusOrHeaders, maybeHeaders) {
      this.statusCode = Number(code);
      const candidate =
        typeof statusOrHeaders === "object" && statusOrHeaders !== null
          ? statusOrHeaders
          : maybeHeaders;
      if (candidate) {
        for (const [name, value] of Object.entries(candidate)) this.setHeader(name, value);
      }
      this.headersSent = true;
      return this;
    },

    write(chunk) {
      if (ended) throw new Error("write after end");
      this.headersSent = true;
      if (chunk !== undefined && chunk !== null) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      return true;
    },

    end(chunk) {
      if (chunk !== undefined && chunk !== null) this.write(chunk);
      ended = true;
      this.headersSent = true;
      return this;
    },

    json(value) {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json; charset=utf-8");
      }
      explicitBody = JSON.stringify(value);
      ended = true;
      this.headersSent = true;
      return this;
    },

    send(value) {
      if (value === undefined || value === null) explicitBody = "";
      else if (Buffer.isBuffer(value) || value instanceof Uint8Array) explicitBody = value;
      else if (typeof value === "object") {
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json; charset=utf-8");
        }
        explicitBody = JSON.stringify(value);
      } else explicitBody = String(value);
      ended = true;
      this.headersSent = true;
      return this;
    },

    redirect(statusOrUrl, maybeUrl) {
      const status = maybeUrl === undefined ? 302 : Number(statusOrUrl);
      const location = maybeUrl === undefined ? statusOrUrl : maybeUrl;
      this.statusCode = status;
      headers.set("Location", String(location));
      explicitBody = "";
      ended = true;
      this.headersSent = true;
      return this;
    },

    _toResponse(extraHeaders = {}) {
      for (const [name, value] of Object.entries(extraHeaders)) headers.set(name, String(value));
      const body =
        this.statusCode === 204 || this.statusCode === 304
          ? null
          : explicitBody !== undefined
            ? explicitBody
            : chunks.length
              ? Buffer.concat(chunks)
              : null;
      return new Response(body, {
        status: this.statusCode,
        statusText: this.statusMessage || undefined,
        headers,
      });
    },
  };

  return res;
}

export async function invokeNodeHandler(handler, request, extraResponseHeaders = {}) {
  const req = await createNodeRequest(request);
  const res = createNodeResponse();

  await handler(req, res);

  return res._toResponse(extraResponseHeaders);
}

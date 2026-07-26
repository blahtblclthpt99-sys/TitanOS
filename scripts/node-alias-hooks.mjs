/**
 * Resolve Vite-style @/ and @shared/ aliases + extensionless relative imports for node --test.
 * Also rewrites import.meta.env.* to globalThis.__VITE_ENV__ so Vite modules load under Node.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveFile(absBase) {
  const bare = String(absBase).split("?")[0];
  const candidates = [
    bare,
    `${bare}.js`,
    `${bare}.jsx`,
    `${bare}.mjs`,
    `${bare}.ts`,
    `${bare}.tsx`,
    path.join(bare, "index.js"),
    path.join(bare, "index.jsx"),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    } catch {
      /* */
    }
  }
  return null;
}

function asFileUrl(absPath) {
  return { shortCircuit: true, url: pathToFileURL(absPath).href };
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = resolveFile(path.join(root, "src", specifier.slice(2)));
    if (target) return asFileUrl(target);
  }
  if (specifier.startsWith("@shared/")) {
    const target = resolveFile(path.join(root, "shared", specifier.slice("@shared/".length)));
    if (target) return asFileUrl(target);
  }

  // Vite allows extensionless relative imports; Node ESM does not.
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !path.extname(specifier.split("?")[0]) &&
    context.parentURL
  ) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const target = resolveFile(path.resolve(parentDir, specifier));
    if (target) return asFileUrl(target);
  }

  return nextResolve(specifier, context);
}

function rewriteViteEnv(source) {
  if (!source || !source.includes("import.meta.env")) return source;
  return source
    .replace(/import\.meta\.env\.([A-Za-z0-9_]+)/g, "globalThis.__VITE_ENV__.$1")
    .replace(/import\.meta\.env\b/g, "globalThis.__VITE_ENV__");
}

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (result.format !== "module") return result;

  let source = result.source;
  if (source == null && url.startsWith("file:")) {
    try {
      source = fs.readFileSync(fileURLToPath(url), "utf8");
    } catch {
      return result;
    }
  }
  if (typeof source !== "string") return result;
  if (!url.includes("/src/") && !url.includes("\\src\\")) return result;

  const rewritten = rewriteViteEnv(source);
  if (rewritten === source) return result;
  return { format: "module", source: rewritten, shortCircuit: true };
}

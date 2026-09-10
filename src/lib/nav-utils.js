function canonicalNavPath(value = "/") {
  if (value === "/autopilot") return "/titan-auto";
  return value;
}

export function isRouteActive(pathname, path) {
  const current = canonicalNavPath(pathname);
  const target = canonicalNavPath(path);
  if (target === "/") return current === "/";
  return current === target || current.startsWith(`${target}/`);
}

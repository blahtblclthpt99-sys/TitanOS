/**
 * Safe link renderer for AI markdown — http(s) and in-app paths only.
 */
export function SafeMarkdownLink({ href, children, ...props }) {
  const url = String(href || "");
  const safe =
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("/");
  if (!safe) {
    return <span {...props}>{children}</span>;
  }
  const external = url.startsWith("http");
  return (
    <a
      href={url}
      {...props}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  );
}

export const safeMarkdownComponents = {
  a: SafeMarkdownLink,
};

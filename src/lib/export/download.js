/**
 * Shared download primitive for CSV / Excel / PDF blobs.
 */
export function downloadBlob(filename, blob) {
  if (typeof document === "undefined" || !blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "titanos-export";
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export function downloadTextFile(filename, text, mime = "text/plain;charset=utf-8") {
  return downloadBlob(filename, new Blob([text], { type: mime }));
}

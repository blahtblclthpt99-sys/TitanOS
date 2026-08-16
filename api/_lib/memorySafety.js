const SENSITIVE_MEMORY_PATTERNS = [
  /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/i,
  /\b(?:password|passcode|api[_ -]?key|secret|access[_ -]?token|refresh[_ -]?token|credential)\b\s*(?:is|=|:)\s*\S+/i,
  /\bpin\b\s*(?:is|=|:)\s*\d{3,12}\b/i,
  /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
  /\b(?:sk|rk|pk)_(?:live|test)_[a-zA-Z0-9_-]{12,}\b/i,
  /\bsb_(?:secret|publishable)_[a-zA-Z0-9_-]{12,}\b/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:\d[ -]?){13,19}\b/,
];

export function containsSensitiveMemoryText(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return SENSITIVE_MEMORY_PATTERNS.some((pattern) => pattern.test(text));
}

export function assertMemoryIsSafe(value) {
  if (!containsSensitiveMemoryText(value)) return;
  const err = new Error(
    "2nd Me will not store passwords, authentication tokens, private keys, Social Security numbers, or payment-card numbers in durable memory."
  );
  err.status = 400;
  err.code = "SENSITIVE_MEMORY_BLOCKED";
  throw err;
}

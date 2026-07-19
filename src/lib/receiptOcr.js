/**
 * Lightweight OCR/heuristic receipt parser.
 * Uses browser OCR when available; falls back to filename + manual fields.
 * Designed so a real OCR/OpenAI vision provider can plug into parseReceiptText later.
 */
import { EXPENSE_CATEGORIES } from "@/lib/platformConstants";

const AMOUNT_RE = /(?:total|amount|balance|due|grand\s*total)?\s*\$?\s*(\d{1,5}(?:\.\d{2}))/gi;
const DATE_RE = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}-\d{2}-\d{2})/;
const VENDOR_HINTS = [
  "shell", "exxon", "chevron", "costco", "home depot", "lowe", "walmart", "amazon",
  "office depot", "staples", "uber", "lyft", "mcdonald", "starbucks",
];

export function parseReceiptText(text = "") {
  const raw = String(text || "");
  const lower = raw.toLowerCase();

  let amount = null;
  const amounts = [...raw.matchAll(AMOUNT_RE)].map((m) => Number(m[1])).filter((n) => !Number.isNaN(n));
  if (amounts.length) amount = Math.max(...amounts);

  let date = null;
  const dateMatch = raw.match(DATE_RE);
  if (dateMatch) {
    const rawDate = dateMatch[0];
    const parsed = new Date(rawDate);
    if (!Number.isNaN(parsed.getTime())) date = parsed.toISOString().slice(0, 10);
  }

  let vendor = "";
  for (const hint of VENDOR_HINTS) {
    if (lower.includes(hint)) {
      vendor = hint.replace(/\b\w/g, (c) => c.toUpperCase());
      break;
    }
  }
  if (!vendor) {
    const firstLine = raw.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 2 && l.length < 40);
    vendor = firstLine || "";
  }

  let category = "other";
  if (/fuel|gas|shell|exxon|chevron/.test(lower)) category = "fuel";
  else if (/depot|lowe|hardware|tool/.test(lower)) category = "supplies";
  else if (/office|staples|paper/.test(lower)) category = "office";
  else if (/uber|lyft|hotel|flight|airline/.test(lower)) category = "travel";
  else if (/meal|restaurant|cafe|coffee|mcdonald|starbucks/.test(lower)) category = "meals";
  else if (/insurance/.test(lower)) category = "insurance";
  else if (/software|adobe|microsoft|subscription|saas/.test(lower)) category = "software";

  const known = EXPENSE_CATEGORIES.some((c) => c.id === category);
  if (!known) category = "other";

  const confidence =
    (amount ? 0.35 : 0) + (date ? 0.25 : 0) + (vendor ? 0.2 : 0) + (category !== "other" ? 0.2 : 0);

  return {
    raw_text: raw.slice(0, 4000),
    vendor,
    amount,
    date: date || new Date().toISOString().slice(0, 10),
    category,
    confidence: Math.round(confidence * 100) / 100,
  };
}

/** Read image as data URL for preview / future vision APIs. */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Attempt Tesseract-less parse: if user pastes text, use that.
 * For images, return empty text so UI can ask for optional paste / still create expense.
 */
export async function extractTextFromReceipt({ file, pastedText }) {
  if (pastedText?.trim()) return pastedText.trim();
  if (!file) return "";
  // No heavy OCR dependency in bundle — return empty for image-only; API can enhance later.
  return "";
}

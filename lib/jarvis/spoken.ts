/**
 * Voice formatting for Jarvis. Tool results are rewritten before the LLM sees
 * them so it never has to do paise maths or invent Indian number words:
 * every `*_paise` field gains a `*_rupees` number and a `*_spoken` phrase
 * ("about one lakh twenty-three thousand rupees"), percentages are rounded and
 * bulky chart arrays are trimmed. Client-safe (no server imports).
 */

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function below100(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  return n % 10 ? `${t}-${ONES[n % 10]}` : t;
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (!h) return below100(rest);
  return rest ? `${ONES[h]} hundred ${below100(rest)}` : `${ONES[h]} hundred`;
}

/** Integer → words in the Indian system (thousand, lakh, crore). */
export function numberToIndianWords(value: number): string {
  let n = Math.round(Math.abs(value));
  if (n === 0) return "zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1e3);
  n %= 1e3;
  if (crore) parts.push(`${crore >= 1000 ? numberToIndianWords(crore) : below1000(crore)} crore`);
  if (lakh) parts.push(`${below100(lakh)} lakh`);
  if (thousand) parts.push(`${below100(thousand)} thousand`);
  if (n) parts.push(below1000(n));
  return `${value < 0 ? "minus " : ""}${parts.join(" ")}`;
}

/**
 * Paise → a natural spoken amount, rounded to a sensible precision:
 * ₹450 → "four hundred fifty rupees", ₹1,23,456 → "about one lakh twenty-three thousand rupees".
 */
export function spokenINR(paise: number): string {
  const rupees = Math.round(paise / 100);
  const abs = Math.abs(rupees);
  const step = abs < 1_000 ? 1 : abs < 1e5 ? 100 : abs < 1e7 ? 1_000 : 1e5;
  const rounded = Math.round(rupees / step) * step;
  const approx = rounded !== rupees || Math.round(paise) % 100 !== 0;
  return `${approx ? "about " : ""}${numberToIndianWords(rounded)} rupee${Math.abs(rounded) === 1 ? "" : "s"}`;
}

const MAX_ARRAY = 25;
/** Chart-only payloads the panels use but the voice model doesn't need. */
const DROP_KEYS = new Set(["cells", "downloads", "next_statuses", "menu_item_id", "image_url", "payments"]);

function isRange(v: unknown): v is { label: string; from: string; fromDate: string } {
  return !!v && typeof v === "object" && "label" in v && "fromDate" in v && "from" in v;
}

/** Deep-rewrites a tool result for the voice model (see file header). */
export function voiceSafe(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map(voiceSafe);
  if (isRange(value)) return value.label;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (DROP_KEYS.has(k)) continue;
    if (k.endsWith("_paise") && typeof v === "number") {
      const base = k.slice(0, -"_paise".length);
      out[`${base}_rupees`] = Math.round(v / 100);
      out[`${base}_spoken`] = spokenINR(v);
      continue;
    }
    if (/percent|share/.test(k) && typeof v === "number") {
      out[k] = Math.round(v);
      continue;
    }
    if (Array.isArray(v) && v.length > MAX_ARRAY) out[`${k}_total_count`] = v.length;
    out[k] = voiceSafe(v);
  }
  return out;
}

/** JSON string for a Deepgram FunctionCallResponse, capped so one call can't flood the context. */
export function voiceContent(value: unknown, maxChars = 6000): string {
  const s = JSON.stringify(voiceSafe(value));
  return s.length > maxChars ? `${s.slice(0, maxChars)}…(truncated)` : s;
}

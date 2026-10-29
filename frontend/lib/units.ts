// All values in the app are stored as decimal feet.

export const SQFT_TO_SQM = 0.09290304;

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** 17.25 -> 17'-3"   (inches are shown to one decimal only when needed) */
export function formatFeetInches(feet: number): string {
  if (!Number.isFinite(feet)) return "";
  const totalInches = Math.round(feet * 120) / 10;
  const ft = Math.floor(totalInches / 12);
  const inch = totalInches - ft * 12;
  const inchText = Number.isInteger(inch) ? String(inch) : inch.toFixed(1);
  return `${ft}'-${inchText}"`;
}

/**
 * Accepts: 17.25 | 17'-3" | 17' 3 | 17-3 | 17'
 * Returns decimal feet, or null when the text can't be understood.
 */
export function parseFeet(input: string): number | null {
  const s = input
    .trim()
    .replace(/[’′]/g, "'")
    .replace(/[”″]/g, '"');
  if (!s) return null;

  if (/^\d+(?:\.\d+)?$/.test(s)) return parseFloat(s);

  const m = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft)?\s*-?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in)?)?$/i);
  if (!m) return null;

  const feet = parseFloat(m[1]);
  const inches = m[2] ? parseFloat(m[2]) : 0;
  if (inches >= 12) return null;
  return feet + inches / 12;
}

/**
 * Area box input: a plain number (3887.8) or a multi-part sum written the way the
 * client's sheet does it (214.5+891.87). Returns the total and, for sums, the expression.
 */
export function parseAreaInput(input: string): { value: number; expr?: string } | null {
  const s = input.replace(/\s+/g, "").replace(/^=/, "");
  if (!s) return null;
  if (/^\d+(?:\.\d+)?$/.test(s)) return { value: parseFloat(s) };
  if (/^\d+(?:\.\d+)?(?:\+\d+(?:\.\d+)?)+$/.test(s)) {
    const total = s.split("+").reduce((sum, part) => sum + parseFloat(part), 0);
    return { value: round2(total), expr: s };
  }
  return null;
}

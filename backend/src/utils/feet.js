// Feet / inches helpers (all internal values are decimal feet)

export const SQFT_TO_SQM = 0.09290304;

export const round2 = (n) => Math.round(n * 100) / 100;
// Sizes keep extra precision (9'-10" = 9.8333 ft) so areas are not skewed by early rounding
export const round4 = (n) => Math.round(n * 10000) / 10000;

export function formatFeetInches(feet) {
  if (!Number.isFinite(feet)) return '';
  const totalInches = Math.round(feet * 120) / 10; // keep one decimal of an inch
  const ft = Math.floor(totalInches / 12);
  const inch = totalInches - ft * 12;
  return `${ft}'-${Number.isInteger(inch) ? inch : inch.toFixed(1)}"`;
}

// Prevent spreadsheet formula injection when text from a drawing is exported to CSV
export function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

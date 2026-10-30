// Feet / inches / metric helpers (all internal values are stored as decimal feet)

export const SQFT_TO_SQM = 0.09290304;
export const SQM_TO_SQFT = 1 / SQFT_TO_SQM;
export const FEET_TO_METERS = 0.3048;
export const METERS_TO_FEET = 1 / 0.3048;

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

export function formatMeters(meters) {
  if (!Number.isFinite(meters)) return '';
  return `${meters.toFixed(2)} m`;
}

/**
 * Returns scale factor that converts drawing coordinate units into decimal feet.
 * INSUNITS:
 * 1 = Inches, 2 = Feet, 4 = Millimeters, 5 = Centimeters, 6 = Meters
 */
export function getUnitScale(insUnits, maxCoord = 0) {
  switch (insUnits) {
    case 1: // Inches
      return { factorToFeet: 1 / 12, unitName: 'in', system: 'imperial' };
    case 2: // Feet
      return { factorToFeet: 1, unitName: 'ft', system: 'imperial' };
    case 4: // Millimeters
      return { factorToFeet: 1 / 304.8, unitName: 'mm', system: 'metric' };
    case 5: // Centimeters
      return { factorToFeet: 1 / 30.48, unitName: 'cm', system: 'metric' };
    case 6: // Meters
      return { factorToFeet: METERS_TO_FEET, unitName: 'm', system: 'metric' };
    default:
      // Heuristic fallback: if coordinates exceed 1,000, drawing is in millimeters
      if (maxCoord > 1000) {
        return { factorToFeet: 1 / 304.8, unitName: 'mm', system: 'metric' };
      }
      return { factorToFeet: 1, unitName: 'ft', system: 'imperial' };
  }
}

// Prevent spreadsheet formula injection when text from a drawing is exported to CSV
export function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

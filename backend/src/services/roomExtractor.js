import { cleanTextLines } from './textUtils.js';
import { round2, round4, METERS_TO_FEET } from '../utils/feet.js';

// e.g.  17'-0" x 11'-5"   |  5' x 6'-9"   |  7'-5" x 5'-11"
const PART = String.raw`(\d+(?:\.\d+)?)\s*'\s*(?:-?\s*(\d+(?:\.\d+)?)\s*["”″]?)?`;
const DIM_RE = new RegExp(`${PART}\\s*[xX×]\\s*${PART}`);
const toFeet = (ft, inch) => Number(ft) + (inch ? Number(inch) / 12 : 0);

// Metric dimension regex: e.g. 4.50m x 3.20m  |  4.50 x 3.20 m
const MET_DIM_RE = /(\d+(?:\.\d+)?)\s*(?:m|meter)?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:m|meter)?/i;

// Door / window tags and other non-room labels
const NOT_A_ROOM = /^(?:[DWV]\d*|MD|SD|ROOM|DOOR|WINDOW|SCHEDULE|DETAIL|SECTION|ELEVATION)$/i;

/**
 * Finds room labels with written dimensions (e.g. "<NAME> <length>' x <breadth>'").
 * This is the primary, exact algorithm for drawings with written dimensions.
 */
export function extractRoomLabels(texts) {
  const rooms = [];
  const seen = new Set();

  for (const t of texts) {
    const lines = cleanTextLines(t.raw);
    if (!lines.length) continue;

    const joined = lines.join(' ');
    // Imperial dimension match
    const m = joined.match(DIM_RE);
    if (m) {
      const name = joined
        .slice(0, m.index)
        .replace(/[:\-–,]+\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (name && /[A-Za-z]/.test(name) && !NOT_A_ROOM.test(name)) {
        const length = toFeet(m[1], m[2]);
        const breadth = toFeet(m[3], m[4]);
        if (length > 0 && breadth > 0) {
          const key = `${name}|${length}|${breadth}|${Math.round(t.x)}|${Math.round(t.y)}`;
          if (!seen.has(key)) {
            seen.add(key);
            rooms.push({
              name,
              length: round4(length),
              breadth: round4(breadth),
              areaFt2: round2(length * breadth),
              x: t.x,
              y: t.y,
              source: 'label',
            });
          }
          continue;
        }
      }
    }

    // Metric dimension match (e.g. 4.50m x 3.20m)
    const met = joined.match(MET_DIM_RE);
    if (met) {
      const name = joined
        .slice(0, met.index)
        .replace(/[:\-–,]+\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (name && /[A-Za-z]/.test(name) && !NOT_A_ROOM.test(name)) {
        const lenMeters = parseFloat(met[1]);
        const breMeters = parseFloat(met[2]);
        if (lenMeters > 0 && breMeters > 0) {
          const lengthFt = lenMeters * METERS_TO_FEET;
          const breadthFt = breMeters * METERS_TO_FEET;
          const key = `${name}|${round2(lengthFt)}|${round2(breadthFt)}|${Math.round(t.x)}|${Math.round(t.y)}`;
          if (!seen.has(key)) {
            seen.add(key);
            rooms.push({
              name,
              length: round4(lengthFt),
              breadth: round4(breadthFt),
              areaFt2: round2(lengthFt * breadthFt),
              x: t.x,
              y: t.y,
              source: 'label',
            });
          }
        }
      }
    }
  }
  return rooms;
}

/**
 * Parses enumerated legend text:
 * e.g., "1. Electrical Room 2. Store Room 3. Changing Room 4. Shoe Changing+Locker..."
 */
function parseLegendEntries(text) {
  const map = new Map();
  const regex = /(\d+)\s*[\.\-:]\s*([A-Za-z][A-Za-z0-9\s/&+–-]*?)(?=(?:\s+\d+\s*[\.\-:])|$)/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const num = parseInt(m[1], 10);
    const name = m[2].trim().replace(/\s+/g, ' ');
    if (name && !NOT_A_ROOM.test(name)) {
      map.set(num, name);
    }
  }
  return map;
}

/**
 * Orthogonal ray-casting from (rx, ry) against wall lines.
 */
function rayCastRoomBounds(rx, ry, lines, maxDist = 20000) {
  let minX = -Infinity, maxX = Infinity;
  let minY = -Infinity, maxY = Infinity;

  for (const l of lines) {
    // Horizontal rays: Y = ry
    if ((l.y1 - ry) * (l.y2 - ry) <= 0 && Math.abs(l.y1 - l.y2) > 1e-4) {
      const t = (ry - l.y1) / (l.y2 - l.y1);
      const ix = l.x1 + t * (l.x2 - l.x1);
      if (ix > rx && (ix - rx) <= maxDist && ix < maxX) maxX = ix;
      if (ix < rx && (rx - ix) <= maxDist && ix > minX) minX = ix;
    }
    // Vertical rays: X = rx
    if ((l.x1 - rx) * (l.x2 - rx) <= 0 && Math.abs(l.x1 - l.x2) > 1e-4) {
      const t = (rx - l.x1) / (l.x2 - l.x1);
      const iy = l.y1 + t * (l.y2 - l.y1);
      if (iy > ry && (iy - ry) <= maxDist && iy < maxY) maxY = iy;
      if (iy < ry && (ry - iy) <= maxDist && iy > minY) minY = iy;
    }
  }

  const spanX = (maxX < Infinity && minX > -Infinity) ? (maxX - minX) : 0;
  const spanY = (maxY < Infinity && minY > -Infinity) ? (maxY - minY) : 0;
  return { spanX, spanY };
}

/**
 * Type 2 extraction: Extracts rooms from legend blocks + number markers,
 * measuring dimensions from wall geometry via ray-casting.
 * Crucially: Only extracts markers that match an actual legend entry to prevent
 * mistaking grid axis numbers or elevation tags for rooms.
 */
export function extractLegendRooms({ texts, lines, units }) {
  const factorToFeet = units.factorToFeet;
  const rooms = [];
  const seenKeys = new Set();
  const legends = [];
  const allLegendNums = new Set();

  // Find legend blocks
  for (const t of texts) {
    const linesOfText = cleanTextLines(t.raw);
    const joined = linesOfText.join(' ');
    if (/\b1\s*[\.\-:]\s*[A-Za-z]/.test(joined) && /\b2\s*[\.\-:]\s*[A-Za-z]/.test(joined)) {
      const map = parseLegendEntries(joined);
      if (map.size > 0) {
        legends.push({ x: t.x, y: t.y, map });
        for (const k of map.keys()) allLegendNums.add(k);
      }
    }
  }

  if (legends.length === 0) return [];

  const maxSearchUnits = units.system === 'metric' ? 20000 : 65;

  // Collect number markers that match a known legend entry
  const numberMarkers = [];
  for (const t of texts) {
    const linesOfText = cleanTextLines(t.raw);
    const joined = linesOfText.join(' ');
    if (/^0?\d{1,2}$/.test(joined)) {
      const num = parseInt(joined, 10);
      if (allLegendNums.has(num)) {
        numberMarkers.push({ num, x: t.x, y: t.y });
      }
    }
  }

  for (const m of numberMarkers) {
    let roomName = null;
    let closestDist = Infinity;
    for (const leg of legends) {
      if (leg.map.has(m.num)) {
        const d = Math.hypot(m.x - leg.x, m.y - leg.y);
        if (d < closestDist) {
          closestDist = d;
          roomName = leg.map.get(m.num);
        }
      }
    }
    if (!roomName) continue;

    const { spanX, spanY } = rayCastRoomBounds(m.x, m.y, lines, maxSearchUnits);
    const lengthFt = spanX * factorToFeet;
    const breadthFt = spanY * factorToFeet;
    const areaFt2 = round2(lengthFt * breadthFt);
    const key = `${roomName}|${Math.round(m.x)}|${Math.round(m.y)}`;

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      rooms.push({
        name: roomName,
        length: round4(lengthFt),
        breadth: round4(breadthFt),
        areaFt2,
        x: m.x,
        y: m.y,
        source: (spanX > 0 && spanY > 0) ? 'measured' : 'label',
      });
    }
  }

  return rooms;
}

import { cleanTextLines } from './textUtils.js';
import { round4 } from '../utils/feet.js';

// e.g.  17'-0" x 11'-5"   |  5' x 6'-9"   |  7'-5" x 5'-11"
const PART = String.raw`(\d+(?:\.\d+)?)\s*'\s*(?:-?\s*(\d+(?:\.\d+)?)\s*["”″]?)?`;
const DIM_RE = new RegExp(`${PART}\\s*[xX×]\\s*${PART}`);

const toFeet = (ft, inch) => Number(ft) + (inch ? Number(inch) / 12 : 0);

// Door / window tags and other non-room labels
const NOT_A_ROOM = /^(?:[DWV]\d*|MD|SD|ROOM|DOOR|WINDOW)$/i;

/**
 * Finds room labels of the form "<NAME> <length>' x <breadth>'" in the drawing text.
 * Door/window schedules have dimensions but no name, so they are skipped.
 */
export function extractRoomLabels(texts) {
  const rooms = [];
  const seen = new Set();

  for (const t of texts) {
    const lines = cleanTextLines(t.raw);
    if (!lines.length) continue;

    const joined = lines.join(' ');
    const m = joined.match(DIM_RE);
    if (!m) continue;

    const name = joined
      .slice(0, m.index)
      .replace(/[:\-–,]+\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!name || !/[A-Za-z]/.test(name) || NOT_A_ROOM.test(name)) continue;

    const length = toFeet(m[1], m[2]);
    const breadth = toFeet(m[3], m[4]);
    if (!(length > 0) || !(breadth > 0)) continue;

    // The same label can be drawn twice on top of itself — keep one
    const key = `${name}|${length}|${breadth}|${Math.round(t.x)}|${Math.round(t.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rooms.push({ name, length: round4(length), breadth: round4(breadth), x: t.x, y: t.y });
  }
  return rooms;
}

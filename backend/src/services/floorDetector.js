import { cleanTextLines } from './textUtils.js';

const TITLE_RE = /(?:FLOOR|BASEMENT)\s+PLAN|^BASEMENT\s+PLAN/i;
const MAX_DX = 800;     // how far (left/right) a room label may be from its plan title
const MAX_DY = 1500;    // how far above the title the plan extends

const RANK = [
  [/BASEMENT/i, 0], [/GROUND/i, 1], [/FIRST/i, 2], [/SECOND/i, 3],
  [/THIRD/i, 4], [/FOURTH/i, 5], [/FIFTH/i, 6], [/SIXTH/i, 7], [/TOP/i, 99],
];
const rankOf = (name) => (RANK.find(([re]) => re.test(name)) ?? [null, 50])[1];

/** Finds the floor-plan titles (they sit just below each plan in the drawing). */
export function findPlanTitles(texts) {
  const titles = [];
  for (const t of texts) {
    const lines = cleanTextLines(t.raw);
    const first = lines[0];
    if (!first || /SITE\s+PLAN/i.test(first) || !TITLE_RE.test(first)) continue;

    let name = first.replace(/\s*PLAN\s*$/i, '').trim().toUpperCase();
    if (!/FLOOR/.test(name)) name += ' FLOOR';

    titles.push({
      name,
      merged: /,|\bAND\b|\bTO\b/.test(name),
      info: lines.slice(1).join(' '),
      x: t.x,
      y: t.y,
    });
  }
  return titles;
}

/**
 * Plans are drawn above their title. A room belongs to the closest title that is
 * below it, measured by horizontal distance.
 */
export function assignRoomsToPlans(rooms, titles) {
  const buckets = titles.map(() => []);
  const unassigned = [];

  for (const room of rooms) {
    let best = -1;
    let bestDx = Infinity;
    titles.forEach((t, i) => {
      const dx = Math.abs(room.x - t.x);
      const dy = room.y - t.y;
      if (dy >= -5 && dy <= MAX_DY && dx <= MAX_DX && dx < bestDx) {
        best = i;
        bestDx = dx;
      }
    });
    if (best === -1) unassigned.push(room);
    else buckets[best].push(room);
  }

  const groups = titles
    .map((t, i) => ({ title: t, rooms: buckets[i] }))
    .filter((g) => g.rooms.length > 0)
    .sort((a, b) => rankOf(a.title.name) - rankOf(b.title.name) || a.title.y - b.title.y);

  return { groups, unassigned };
}

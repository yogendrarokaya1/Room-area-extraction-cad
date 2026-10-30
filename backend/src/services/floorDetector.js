import { cleanTextLines } from './textUtils.js';

const TITLE_RE = /(?:FLOOR|BASEMENT|TERRACE|ROOF)\s+PLAN/i;
const MAX_DX = 800; // how far (left/right) a room label may be from its plan title
const MAX_DY = 1500; // how far above the title the plan extends
const MAX_DY_NEG = 5; // how far BELOW the title we still accept a room (in drawing units)

const RANK = [
  [/BASEMENT/i, 0],
  [/GROUND/i, 1],
  [/FIRST/i, 2],
  [/SECOND/i, 3],
  [/THIRD/i, 4],
  [/FOURTH/i, 5],
  [/FIFTH/i, 6],
  [/SIXTH/i, 7],
  [/SEVENTH/i, 8],
  [/EIGHTH/i, 9],
  [/LOWER TERRACE/i, 90],
  [/UPPER TERRACE/i, 91],
  [/TERRACE/i, 92],
  [/ROOF/i, 95],
  [/TOP/i, 99],
];
const rankOf = (name) => (RANK.find(([re]) => re.test(name)) ?? [null, 50])[1];

/**
 * Finds the floor-plan titles (they sit just below each plan in the drawing).
 */
export function findPlanTitles(texts) {
  const titles = [];
  for (const t of texts) {
    const lines = cleanTextLines(t.raw);
    const first = lines[0];
    if (!first || /SITE\s+PLAN/i.test(first) || !TITLE_RE.test(first)) continue;

    let name = first.replace(/\s*PLAN\s*$/i, '').trim().toUpperCase();
    if (!/FLOOR|TERRACE|ROOF/.test(name)) name += ' FLOOR';

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
 * Plans are drawn above their title. A room belongs to the title that is
 * below it with the **smallest vertical distance (dy)**, within the allowed
 * horizontal band (maxDx). This avoids ambiguity when two floor plans share
 * nearly the same X coordinate (e.g. Basement and Ground Floor stacked vertically).
 *
 * @param {number} maxDyNeg  How far (in drawing units) BELOW the title we still
 *                           accept a room marker.  Positive = below title.
 *                           Defaults to MAX_DY_NEG (5 units for imperial).
 *                           Pass a larger value (e.g. 5000) for metric drawings.
 */
export function assignRoomsToPlans(rooms, titles, maxDx = MAX_DX, maxDy = MAX_DY, maxDyNeg = MAX_DY_NEG) {
  if (rooms.length === 0) {
    return { groups: [], unassigned: [] };
  }

  // Fallback: If no floor titles exist, auto-cluster rooms by spatial Y coordinates
  if (!titles || titles.length === 0) {
    return autoClusterFloors(rooms);
  }

  const buckets = titles.map(() => []);
  const unassigned = [];

  for (const room of rooms) {
    let best = -1;
    let bestDy = Infinity; // prefer the title whose dy is smallest (closest floor below)
    titles.forEach((t, i) => {
      const dx = Math.abs(room.x - t.x);
      const dy = room.y - t.y; // positive = room is above title (normal)
      if (dy >= -maxDyNeg && dy <= maxDy && dx <= maxDx && dy < bestDy) {
        best = i;
        bestDy = dy;
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

/**
 * Automatic Floor Segmentation Fallback:
 * When no floor labels are written in the drawing, clusters rooms vertically into Floor 1, Floor 2...
 */
function autoClusterFloors(rooms) {
  const sorted = [...rooms].sort((a, b) => a.y - b.y);
  const clusters = [];
  let currentCluster = [];
  const GAP = 1000;

  for (const r of sorted) {
    if (currentCluster.length === 0) {
      currentCluster.push(r);
    } else {
      const last = currentCluster[currentCluster.length - 1];
      if (Math.abs(r.y - last.y) > GAP) {
        clusters.push(currentCluster);
        currentCluster = [r];
      } else {
        currentCluster.push(r);
      }
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const groups = clusters.map((clusterRooms, idx) => ({
    title: {
      name: `Floor ${idx + 1}`,
      merged: false,
      info: 'Automatically segmented from drawing layout',
      x: clusterRooms[0].x,
      y: clusterRooms[0].y,
    },
    rooms: clusterRooms,
  }));

  return { groups, unassigned: [] };
}

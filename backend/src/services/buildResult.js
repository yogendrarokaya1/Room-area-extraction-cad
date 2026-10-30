import { randomUUID } from 'node:crypto';
import { parseDwg } from './dwgParser.js';
import { extractRoomLabels, extractLegendRooms } from './roomExtractor.js';
import { findPlanTitles, assignRoomsToPlans } from './floorDetector.js';
import { round2 } from '../utils/feet.js';

// Reading order inside a plan: top to bottom, then left to right
const readingOrder = (a, b) => (Math.abs(b.y - a.y) > 15 ? b.y - a.y : a.x - b.x);

const makeRoom = (r) => ({
  id: randomUUID(),
  name: r.name,
  length: r.length,
  breadth: r.breadth,
  areaFt2: r.areaFt2 > 0 ? r.areaFt2 : round2(r.length * r.breadth),
  areaOverridden: false,
  source: r.source === 'measured' ? 'measured' : 'label',
});

export async function buildResult({ id, originalName, buffer }) {
  const { texts, lines, units, stats } = await parseDwg(buffer);

  // 1. Primary path (Type 1): extract rooms with written dimension labels
  let rooms = extractRoomLabels(texts);
  const titles = findPlanTitles(texts);
  const isType1 = rooms.length > 0;
  let maxDx = 800;
  let maxDy = 1500;

  // 2. Secondary path (Type 2): if no written room dimensions, use legend + markers + ray-casting
  if (!isType1) {
    rooms = extractLegendRooms({ texts, lines, units });
    const scaleFactor = units.system === 'metric' ? 304.8 : 1;
    maxDx = 800 * scaleFactor;
    maxDy = 1500 * scaleFactor;
  }

  // 3. Assign rooms to floor plans
  // For metric drawings, allow markers to be up to 5000 mm below their floor title
  // (some title blocks use ATTRIB text that may sit slightly below the annotation)
  const maxDyNeg = units.system === 'metric' ? 5000 : 5;
  const { groups, unassigned } = assignRoomsToPlans(rooms, titles, maxDx, maxDy, maxDyNeg);

  const out = groups.map((g) => ({
    id: randomUUID(),
    name: g.title.name,
    merged: g.title.merged,
    info: g.title.info,
    rooms: g.rooms.sort(readingOrder).map(makeRoom),
  }));

  if (unassigned.length) {
    out.push({
      id: randomUUID(),
      name: 'UNASSIGNED',
      merged: false,
      info: 'Rooms that could not be matched to a floor plan title',
      rooms: unassigned.sort(readingOrder).map(makeRoom),
    });
  }

  // Fallback: If drawing had geometry but groups ended up empty
  if (out.length === 0 && lines.length > 0) {
    out.push({
      id: randomUUID(),
      name: 'Floor 1',
      merged: false,
      info: 'Default floor',
      rooms: [
        makeRoom({
          name: 'Room 1',
          length: 0,
          breadth: 0,
          areaFt2: 0,
          source: 'label',
        }),
      ],
    });
  }

  return {
    id,
    originalName,
    uploadedAt: new Date().toISOString(),
    units,
    stats: {
      ...stats,
      textEntities: texts.length,
      roomLabels: rooms.length,
      floorTitles: titles.length,
      unitSystem: units.system,
      unitName: units.unitName,
    },
    groups: out,
  };
}

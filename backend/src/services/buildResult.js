import { randomUUID } from 'node:crypto';
import { parseDwg } from './dwgParser.js';
import { extractRoomLabels } from './roomExtractor.js';
import { findPlanTitles, assignRoomsToPlans } from './floorDetector.js';
import { round2 } from '../utils/feet.js';

// Reading order inside a plan: top to bottom, then left to right
const readingOrder = (a, b) => (Math.abs(b.y - a.y) > 15 ? b.y - a.y : a.x - b.x);

const makeRoom = (r) => ({
  id: randomUUID(),
  name: r.name,
  length: r.length,
  breadth: r.breadth,
  areaFt2: round2(r.length * r.breadth),
  areaOverridden: false,
  source: 'label',
});

export async function buildResult({ id, originalName, buffer }) {
  const { texts, stats } = await parseDwg(buffer);

  const labels = extractRoomLabels(texts);
  const titles = findPlanTitles(texts);
  const { groups, unassigned } = assignRoomsToPlans(labels, titles);

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

  return {
    id,
    originalName,
    uploadedAt: new Date().toISOString(),
    stats: { ...stats, textEntities: texts.length, roomLabels: labels.length, floorTitles: titles.length },
    groups: out,
  };
}

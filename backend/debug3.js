import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LibreDwg, Dwg_File_Type } from '@mlightcad/libredwg-web';
import { cleanTextLines } from './src/services/textUtils.js';

const WASM_DIR = fileURLToPath(new URL('./node_modules/@mlightcad/libredwg-web/wasm/', import.meta.url))
  .replace(/\\/g, '/')
  .replace(/\/?$/, '/');

async function main() {
  const filePath = path.resolve('uploads/0680a5db-25d9-4ac8-ae37-dd1528052722.dwg');
  const buffer = await fs.readFile(filePath);
  const lib = await LibreDwg.create(WASM_DIR);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const dwg = lib.dwg_read_data(arrayBuffer, Dwg_File_Type.DWG);
  const db = lib.convert(dwg);

  const texts = [];
  for (const e of db.entities || []) {
    if (e.type === 'TEXT' || e.type === 'MTEXT' || e.type === 'ATTRIB') {
      const raw = typeof e.text === 'string' ? e.text : (e.text?.text ?? '');
      const p = e.startPoint || e.insertionPoint || e.text?.startPoint;
      if (raw && p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
        texts.push({ raw, x: p.x, y: p.y, layer: e.layer ?? '', type: e.type });
      }
    }
  }

  // Extended search: all numbers 1-10 in wider range around Ground Floor
  console.log('=== ALL texts in x-range 620000-660000 y-range 185000-245000 ===');
  for (const t of texts) {
    if (t.y >= 185000 && t.y <= 245000 && t.x >= 620000 && t.x <= 660000) {
      const joined = cleanTextLines(t.raw).join(' ').trim();
      if (joined && /^0?\d{1,2}$/.test(joined)) {
        const num = parseInt(joined, 10);
        if (num >= 1 && num <= 10) {
          console.log(`  "${joined}" (num=${num}) at (${Math.round(t.x)}, ${Math.round(t.y)}) layer=${t.layer} type=${t.type}`);
        }
      }
    }
  }

  // Floor titles
  const TITLE_RE = /(?:FLOOR|BASEMENT|TERRACE|ROOF)\s+PLAN/i;
  const titles = [];
  for (const t of texts) {
    const lines = cleanTextLines(t.raw);
    const first = lines[0];
    if (!first || /SITE\s+PLAN/i.test(first) || !TITLE_RE.test(first)) continue;
    let name = first.replace(/\s*PLAN\s*$/i, '').trim().toUpperCase();
    if (!/FLOOR|TERRACE|ROOF/.test(name)) name += ' FLOOR';
    titles.push({ name, x: t.x, y: t.y });
  }
  console.log('\n=== Floor titles ===');
  titles.forEach(t => console.log(`  "${t.name}" at (${Math.round(t.x)}, ${Math.round(t.y)})`));

  // Simulate fixed assignRoomsToPlans for Ground Floor
  const gfTitle = titles.find(t => /GROUND/i.test(t.name));
  const bfTitle = titles.find(t => /BASEMENT/i.test(t.name));
  console.log(`\nGround Floor title: (${Math.round(gfTitle?.x)}, ${Math.round(gfTitle?.y)})`);
  console.log(`Basement Floor title: (${Math.round(bfTitle?.x)}, ${Math.round(bfTitle?.y)})`);

  const maxDx = 800 * 304.8;
  const maxDy = 1500 * 304.8;
  const dyTolerance = 5000; // how far below the title we accept a marker (mm)

  console.log(`\n=== Markers with FIXED tolerance (dy >= -${dyTolerance}) assigned to Ground Floor ===`);
  for (const t of texts) {
    const joined = cleanTextLines(t.raw).join(' ').trim();
    if (/^0?\d{1,2}$/.test(joined)) {
      const num = parseInt(joined, 10);
      if (num >= 1 && num <= 10) {
        const dx = Math.abs(t.x - gfTitle.x);
        const dy = t.y - gfTitle.y;
        const inRange = dy >= -dyTolerance && dy <= maxDy && dx <= maxDx;
        if (inRange) {
          console.log(`  marker "${joined}" (num=${num}) at (${Math.round(t.x)}, ${Math.round(t.y)}) dx=${Math.round(dx)} dy=${Math.round(dy)}`);
        }
      }
    }
  }

  console.log(`\n=== Markers with FIXED tolerance assigned to Basement Floor ===`);
  for (const t of texts) {
    const joined = cleanTextLines(t.raw).join(' ').trim();
    if (/^0?\d{1,2}$/.test(joined)) {
      const num = parseInt(joined, 10);
      if (num >= 1 && num <= 10) {
        const dxB = Math.abs(t.x - bfTitle.x);
        const dyB = t.y - bfTitle.y;
        const inRangeB = dyB >= -dyTolerance && dyB <= maxDy && dxB <= maxDx;
        if (inRangeB) {
          console.log(`  marker "${joined}" (num=${num}) at (${Math.round(t.x)}, ${Math.round(t.y)}) dx=${Math.round(dxB)} dy=${Math.round(dyB)}`);
        }
      }
    }
  }
}

main().catch(console.error);


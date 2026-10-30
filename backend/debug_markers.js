import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LibreDwg, Dwg_File_Type } from '@mlightcad/libredwg-web';
import { cleanTextLines } from './src/services/textUtils.js';

const WASM_DIR = fileURLToPath(new URL('./node_modules/@mlightcad/libredwg-web/wasm/', import.meta.url))
  .replace(/\\/g, '/')
  .replace(/\/?$/, '/');

const PART = String.raw`(\d+(?:\.\d+)?)\s*'\s*(?:-?\s*(\d+(?:\.\d+)?)\s*[""″]?)?`;
const DIM_RE = new RegExp(`${PART}\\s*[xX×]\\s*${PART}`);

function parseLegendEntries(text) {
  const map = new Map();
  const regex = /(\d+)\s*[\.\-:]\s*([A-Za-z][A-Za-z0-9\s/&+–-]*?)(?=(?:\s+\d+\s*[\.\-:])|$)/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const num = parseInt(m[1], 10);
    const name = m[2].trim().replace(/\s+/g, ' ');
    if (name) map.set(num, name);
  }
  return map;
}

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
        texts.push({ raw, x: p.x, y: p.y, layer: e.layer ?? '' });
      }
    }
  }

  // All floor titles
  const TITLE_RE = /(?:FLOOR|BASEMENT|TERRACE|ROOF|LEVEL)\s+PLAN|^BASEMENT\s+PLAN|^GROUND\s+LEVEL/i;
  const titles = [];
  for (const t of texts) {
    const lines = cleanTextLines(t.raw);
    const first = lines[0];
    if (!first || /SITE\s+PLAN/i.test(first) || !TITLE_RE.test(first)) continue;
    let name = first.replace(/\s*PLAN\s*$/i, '').trim().toUpperCase();
    if (!/FLOOR|TERRACE|ROOF|LEVEL/.test(name)) name += ' FLOOR';
    titles.push({ name, x: t.x, y: t.y });
  }
  console.log('Floor titles:');
  titles.forEach(t => console.log(`  "${t.name}" at (${Math.round(t.x)}, ${Math.round(t.y)})`));

  // All legends
  const legends = [];
  const allLegendNums = new Set();
  for (const t of texts) {
    const joined = cleanTextLines(t.raw).join(' ');
    if (/\b1\s*[\.\-:]\s*[A-Za-z]/.test(joined) && /\b2\s*[\.\-:]\s*[A-Za-z]/.test(joined)) {
      const map = parseLegendEntries(joined);
      if (map.size > 0) {
        legends.push({ x: t.x, y: t.y, map });
        for (const k of map.keys()) allLegendNums.add(k);
      }
    }
  }
  console.log(`\nTotal legends: ${legends.length}`);
  console.log('All legend numbers:', [...allLegendNums].sort((a,b) => a-b));
  legends.forEach(l => {
    console.log(`  Legend at (${Math.round(l.x)}, ${Math.round(l.y)}): ${[...l.map.entries()].map(([k,v]) => `${k}=${v}`).join(', ')}`);
  });

  // All number markers
  console.log('\nAll number markers (1-10 matching legend):');
  for (const t of texts) {
    const joined = cleanTextLines(t.raw).join(' ');
    if (/^\d{1,2}$/.test(joined)) {
      const num = parseInt(joined, 10);
      if (allLegendNums.has(num)) {
        console.log(`  Marker ${num} at (${Math.round(t.x)}, ${Math.round(t.y)}) layer=${t.layer}`);
      }
    }
  }

  // Ground floor title coordinates
  const gf = titles.find(t => /GROUND/i.test(t.name));
  if (gf) {
    console.log(`\nGround Floor Plan title at: (${Math.round(gf.x)}, ${Math.round(gf.y)})`);
    console.log('Expected room markers near (x: 625000-655000, y: 189000-235000)');

    // All number markers including those NOT in legend (to see what's in the area)
    console.log('\nAll isolated numbers in Y range 189000-235000:');
    for (const t of texts) {
      const joined = cleanTextLines(t.raw).join(' ');
      if (/^\d{1,2}$/.test(joined) && t.y >= 189000 && t.y <= 235000) {
        console.log(`  Number "${joined}" at (${Math.round(t.x)}, ${Math.round(t.y)}) layer=${t.layer}`);
      }
    }
  }
}

main().catch(console.error);


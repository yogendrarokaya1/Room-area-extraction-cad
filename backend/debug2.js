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

  console.log('=== All texts in Ground Floor Y range (189000-235000) ===');
  for (const t of texts) {
    if (t.y >= 189000 && t.y <= 235000 && t.x >= 620000 && t.x <= 660000) {
      const joined = cleanTextLines(t.raw).join(' ');
      if (joined.trim()) {
        console.log(`  "${joined}" at (${Math.round(t.x)}, ${Math.round(t.y)}) layer=${t.layer} type=${t.type}`);
      }
    }
  }

  console.log('\n=== All texts matching /^0?\\d{1,2}$/ (including zero-padded) in full drawing ===');
  for (const t of texts) {
    const joined = cleanTextLines(t.raw).join(' ').trim();
    if (/^0?\d{1,2}$/.test(joined)) {
      const num = parseInt(joined, 10);
      if (num >= 1 && num <= 10) {
        console.log(`  "${joined}" (parsed=${num}) at (${Math.round(t.x)}, ${Math.round(t.y)}) layer=${t.layer}`);
      }
    }
  }

  console.log('\n=== All texts containing "01" or "02" or "1" or "2" near Ground Floor y-range ===');
  for (const t of texts) {
    if (t.y >= 185000 && t.y <= 242000 && t.x >= 620000 && t.x <= 660000) {
      const joined = cleanTextLines(t.raw).join(' ').trim();
      console.log(`  "${joined}" at (${Math.round(t.x)}, ${Math.round(t.y)}) layer=${t.layer} type=${t.type}`);
    }
  }

  // Check what title coordinates and floor assignment would look like
  console.log('\n=== Floor titles found by floorDetector TITLE_RE ===');
  const TITLE_RE = /(?:FLOOR|BASEMENT)\s+PLAN/i;
  for (const t of texts) {
    const lines = cleanTextLines(t.raw);
    const first = lines[0];
    if (!first || /SITE\s+PLAN/i.test(first) || !TITLE_RE.test(first)) continue;
    let name = first.replace(/\s*PLAN\s*$/i, '').trim().toUpperCase();
    if (!/FLOOR/.test(name)) name += ' FLOOR';
    console.log(`  Title: "${name}" at (${Math.round(t.x)}, ${Math.round(t.y)})`);
  }

  // Show rooms with dx/dy from Ground Floor title
  const gfTitle = { x: 628047, y: 189867 };
  console.log(`\n=== Marker distance from Ground Floor title (628047, 189867) ===`);
  console.log(`maxDx = ${800 * 304.8}, maxDy = ${1500 * 304.8}`);
  for (const t of texts) {
    const joined = cleanTextLines(t.raw).join(' ').trim();
    if (/^0?\d{1,2}$/.test(joined)) {
      const num = parseInt(joined, 10);
      if (num >= 1 && num <= 10) {
        const dx = Math.abs(t.x - gfTitle.x);
        const dy = t.y - gfTitle.y;
        const inRange = dy >= -5 && dy <= (1500 * 304.8) && dx <= (800 * 304.8);
        console.log(`  marker "${joined}" at (${Math.round(t.x)}, ${Math.round(t.y)}) dx=${Math.round(dx)} dy=${Math.round(dy)} inRange=${inRange}`);
      }
    }
  }
}

main().catch(console.error);


import { LibreDwg, Dwg_File_Type } from '@mlightcad/libredwg-web';
import { fileURLToPath } from 'node:url';

// The WebAssembly files ship inside the package; LibreDwg needs the folder (with trailing slash)
const WASM_DIR =
  fileURLToPath(new URL('../../node_modules/@mlightcad/libredwg-web/wasm/', import.meta.url))
    .replace(/\\/g, '/')
    .replace(/\/?$/, '/');

let libPromise;
const getLib = () => (libPromise ??= LibreDwg.create(WASM_DIR));

/**
 * Reads a DWG buffer and returns only what we need:
 * all TEXT / MTEXT entities (with position) plus a few stats.
 */
export async function parseDwg(buffer) {
  const lib = await getLib();
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  const dwg = lib.dwg_read_data(arrayBuffer, Dwg_File_Type.DWG);
  if (!dwg) throw new Error('The DWG file could not be read');

  const db = lib.convert(dwg);
  if (!db || !Array.isArray(db.entities) || db.entities.length === 0) {
    throw new Error('The DWG file contains no readable drawing entities');
  }

  const texts = [];
  for (const e of db.entities) {
    if (e.type !== 'TEXT' && e.type !== 'MTEXT') continue;
    const p = e.startPoint || e.insertionPoint;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    texts.push({ raw: e.text ?? '', x: p.x, y: p.y, layer: e.layer ?? '' });
  }

  return {
    texts,
    stats: {
      entities: db.entities.length,
      layers: db.tables?.LAYER?.entries?.length ?? 0,
      insUnits: db.header?.INSUNITS ?? null,
    },
  };
}

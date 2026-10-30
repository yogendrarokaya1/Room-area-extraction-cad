import { LibreDwg, Dwg_File_Type } from '@mlightcad/libredwg-web';
import { fileURLToPath } from 'node:url';
import { getUnitScale } from '../utils/feet.js';

// The WebAssembly files ship inside the package; LibreDwg needs the folder (with trailing slash)
const WASM_DIR =
  fileURLToPath(new URL('../../node_modules/@mlightcad/libredwg-web/wasm/', import.meta.url))
    .replace(/\\/g, '/')
    .replace(/\/?$/, '/');

let libPromise;
const getLib = () => (libPromise ??= LibreDwg.create(WASM_DIR));

/**
 * Reads a DWG buffer and returns:
 * - All TEXT, MTEXT, and ATTRIB entities (with positions)
 * - Boundary geometry lines (LINE, LWPOLYLINE) for ray-casting
 * - Unit metadata (INSUNITS, scale factors, system: metric/imperial)
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
  const lines = [];
  let maxCoord = 0;

  for (const e of db.entities) {
    // 1. Text & Attributes (handling text objects & string tags)
    if (e.type === 'TEXT' || e.type === 'MTEXT' || e.type === 'ATTRIB') {
      const raw = typeof e.text === 'string' ? e.text : (e.text?.text ?? '');
      const p = e.startPoint || e.insertionPoint || e.text?.startPoint;
      if (raw && p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
        texts.push({
          raw,
          tag: e.tag ?? '',
          x: p.x,
          y: p.y,
          layer: e.layer ?? '',
        });
        maxCoord = Math.max(maxCoord, Math.abs(p.x), Math.abs(p.y));
      }
    }

    // 2. Linear boundary geometry (LINE and LWPOLYLINE)
    const layer = String(e.layer ?? '');
    // Skip annotation / non-geometry layers
    if (/TEXT|DIMS|NOTE|LEGN|KEYN|DRTAG|WNTAG|RMTAG|DEFPOINTS/i.test(layer)) continue;

    if (e.type === 'LINE' && e.startPoint && e.endPoint) {
      if (Number.isFinite(e.startPoint.x) && Number.isFinite(e.endPoint.x)) {
        lines.push({
          x1: e.startPoint.x,
          y1: e.startPoint.y,
          x2: e.endPoint.x,
          y2: e.endPoint.y,
          layer,
        });
        maxCoord = Math.max(maxCoord, Math.abs(e.startPoint.x), Math.abs(e.endPoint.x));
      }
    } else if (e.type === 'LWPOLYLINE' && Array.isArray(e.vertices) && e.vertices.length > 1) {
      for (let i = 0; i < e.vertices.length - 1; i++) {
        const v1 = e.vertices[i];
        const v2 = e.vertices[i + 1];
        if (Number.isFinite(v1.x) && Number.isFinite(v2.x)) {
          lines.push({ x1: v1.x, y1: v1.y, x2: v2.x, y2: v2.y, layer });
          maxCoord = Math.max(maxCoord, Math.abs(v1.x), Math.abs(v2.x));
        }
      }
      if (e.isClosed && e.vertices.length > 2) {
        const first = e.vertices[0];
        const last = e.vertices[e.vertices.length - 1];
        if (Number.isFinite(first.x) && Number.isFinite(last.x)) {
          lines.push({ x1: last.x, y1: last.y, x2: first.x, y2: first.y, layer });
        }
      }
    }
  }

  const insUnits = db.header?.INSUNITS ?? null;
  const units = getUnitScale(insUnits, maxCoord);

  return {
    texts,
    lines,
    units,
    stats: {
      entities: db.entities.length,
      layers: db.tables?.LAYER?.entries?.length ?? 0,
      insUnits,
      boundaryLines: lines.length,
    },
  };
}

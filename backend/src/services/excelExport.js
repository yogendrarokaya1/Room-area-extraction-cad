import ExcelJS from 'exceljs';
import { SQFT_TO_SQM } from '../utils/feet.js';

// Matches the client's "LUX CALCULATION" sheet: Calibri, thin borders, bold centred headers,
// merged bold floor rows, one blank row between floors, m² via =CONVERT(...)
const FONT = 'Calibri';
const thin = { style: 'thin' };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };
const SMALL_WORDS = new Set(['and', 'to', 'of', 'the']);

/** "SECOND, THIRD AND FOURTH FLOOR" -> "Second, Third and Fourth Floor". Names typed by the user are kept as typed. */
export function floorTitle(name) {
  const n = String(name ?? '').trim();
  if (n !== n.toUpperCase()) return n;
  return n
    .toLowerCase()
    .split(/(\s+)/)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
}

function styleCell(cell, { bold = false, size = 11, h = 'center', border = true, wrap = false } = {}) {
  cell.font = { name: FONT, size, bold };
  cell.alignment = { horizontal: h, vertical: 'center', wrapText: wrap };
  if (border) cell.border = BORDER;
}

export async function buildAreaWorkbook(d) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CAD Area Extractor';

  /* ---------- Sheet 1: AREA SCHEDULE (client layout + Length / Breadth) ---------- */
  const ws = wb.addWorksheet('AREA SCHEDULE', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  [13.7, 30, 16.7, 16.7, 16.7, 17].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.mergeCells('A1:F1');
  ws.getCell('A1').value = 'ROOM AREA SCHEDULE';
  styleCell(ws.getCell('A1'), { bold: true, size: 16, border: false });
  ws.getRow(1).height = 20;

  ws.mergeCells('A3:F3');
  ws.getCell('A3').value = 'AREA CALCULATION SHEET';
  styleCell(ws.getCell('A3'), { bold: true, size: 14, border: false });

  ws.mergeCells('A4:F4');
  ws.getCell('A4').value = `Source drawing: ${d.originalName}`;
  ws.getCell('A4').font = { name: FONT, size: 10, italic: true, color: { argb: 'FF595959' } };
  ws.getCell('A4').alignment = { horizontal: 'center' };

  ['S.N.', 'Room', 'Length (ft)', 'Breadth (ft)', 'AREA (ft^2)', 'Area (m^2)'].forEach((label, i) => {
    const c = ws.getCell(5, i + 1);
    c.value = label;
    styleCell(c, { bold: true, size: 12, wrap: true });
  });
  ws.getRow(5).height = 30;

  let r = 6;
  const floors = [];

  for (const g of d.groups) {
    ws.mergeCells(`A${r}:B${r}`);
    const fc = ws.getCell(`A${r}`);
    fc.value = floorTitle(g.name);
    styleCell(fc, { bold: true, h: 'left' });
    ws.getCell(`B${r}`).border = BORDER;
    r += 1;

    const first = r;
    g.rooms.forEach((room, i) => {
      const cells = [1, 2, 3, 4, 5, 6].map((c) => ws.getCell(r, c));
      const [sn, name, len, bre, area, sqm] = cells;

      sn.value = i + 1; // S.N. restarts on every floor, like the client's sheet
      name.value = String(room.name ?? '');
      // Rooms measured from the plan (e.g. parking) have no length/breadth — leave those cells empty
      len.value = room.length > 0 ? room.length : null;
      bre.value = room.breadth > 0 ? room.breadth : null;

      if (room.areaExpr) {
        // multi-part room, written the way the client does it: =214.5+891.87
        area.value = { formula: room.areaExpr, result: room.areaFt2 };
      } else if (!room.areaOverridden) {
        area.value = { formula: `C${r}*D${r}`, result: room.length * room.breadth };
      } else {
        area.value = room.areaFt2; // typed / measured value
      }
      sqm.value = { formula: `CONVERT(E${r},"ft2","m2")`, result: room.areaFt2 * SQFT_TO_SQM };

      cells.forEach((c, idx) => styleCell(c, { h: idx === 1 ? 'left' : 'center' }));
      [len, bre, area, sqm].forEach((c) => (c.numFmt = '0.00'));
      r += 1;
    });
    floors.push({ title: floorTitle(g.name), merged: g.merged, first, last: r - 1, count: g.rooms.length, rooms: g.rooms });
    r += 1; // blank row between floors
  }

  /* ---------- Sheet 2: SUMMARY (floor totals as formulas) ---------- */
  const sm = wb.addWorksheet('SUMMARY', { pageSetup: { orientation: 'landscape' } });
  [34, 12, 20, 20].forEach((w, i) => (sm.getColumn(i + 1).width = w));
  ['Floor', 'Rooms', 'Total Area (ft^2)', 'Total Area (m^2)'].forEach((label, i) => {
    const c = sm.getCell(1, i + 1);
    c.value = label;
    styleCell(c, { bold: true, size: 12, wrap: true });
  });
  sm.getRow(1).height = 30;

  let sr = 2;
  floors.forEach((f) => {
    const total = f.rooms.reduce((s, x) => s + x.areaFt2, 0);
    sm.getCell(sr, 1).value = f.title;
    sm.getCell(sr, 2).value = f.count;
    sm.getCell(sr, 3).value =
      f.count > 0 ? { formula: `SUM('AREA SCHEDULE'!E${f.first}:E${f.last})`, result: total } : 0;
    sm.getCell(sr, 4).value = { formula: `CONVERT(C${sr},"ft2","m2")`, result: total * SQFT_TO_SQM };
    for (let c = 1; c <= 4; c++) styleCell(sm.getCell(sr, c), { h: c === 1 ? 'left' : 'center' });
    sm.getCell(sr, 3).numFmt = '0.00';
    sm.getCell(sr, 4).numFmt = '0.00';
    sr += 1;
  });

  const grand = floors.reduce((s, f) => s + f.rooms.reduce((a, x) => a + x.areaFt2, 0), 0);
  sm.getCell(sr, 1).value = 'TOTAL';
  sm.getCell(sr, 2).value = { formula: `SUM(B2:B${sr - 1})`, result: floors.reduce((s, f) => s + f.count, 0) };
  sm.getCell(sr, 3).value = { formula: `SUM(C2:C${sr - 1})`, result: grand };
  sm.getCell(sr, 4).value = { formula: `CONVERT(C${sr},"ft2","m2")`, result: grand * SQFT_TO_SQM };
  for (let c = 1; c <= 4; c++) styleCell(sm.getCell(sr, c), { bold: true, h: c === 1 ? 'left' : 'center' });
  sm.getCell(sr, 3).numFmt = '0.00';
  sm.getCell(sr, 4).numFmt = '0.00';

  const mergedNames = floors.filter((f) => f.merged).map((f) => f.title);
  if (mergedNames.length) {
    sm.mergeCells(`A${sr + 2}:D${sr + 2}`);
    const note = sm.getCell(`A${sr + 2}`);
    note.value = `Note: ${mergedNames.join('; ')} ${mergedNames.length > 1 ? 'are' : 'is'} drawn once but covers several floors, and is counted once above.`;
    note.font = { name: FONT, size: 10, italic: true, color: { argb: 'FF595959' } };
    note.alignment = { wrapText: true, vertical: 'top' };
    sm.getRow(sr + 2).height = 30;
  }

  return wb.xlsx.writeBuffer();
}

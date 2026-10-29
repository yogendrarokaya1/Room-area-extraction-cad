import { Router } from 'express';
import fs from 'node:fs/promises';
import { upload, hasDwgSignature } from '../middleware/upload.js';
import { buildResult } from '../services/buildResult.js';
import { saveResult, loadResult } from '../services/store.js';
import { formatFeetInches, round2, round4, SQFT_TO_SQM, csvCell } from '../utils/feet.js';
import { buildAreaWorkbook } from '../services/excelExport.js';

// Multi-part area typed like the client does it: 214.5+891.87
const EXPR_RE = /^\d+(?:\.\d+)?(?:\+\d+(?:\.\d+)?)*$/;

const router = Router();
const ok = (res, data, message = 'OK', status = 200) => res.status(status).json({ success: true, data, message });

// POST /api/drawings  — upload a DWG, extract rooms
router.post('/', upload.single('file'), async (req, res, next) => {
  const file = req.file;
  try {
    if (!file) return res.status(400).json({ success: false, message: 'No file received (field name must be "file")' });

    if (!(await hasDwgSignature(file.path))) {
      await fs.unlink(file.path).catch(() => {});
      return res.status(400).json({ success: false, message: 'This is not a valid DWG file' });
    }

    const buffer = await fs.readFile(file.path);
    const result = await buildResult({ id: req.drawingId, originalName: file.originalname, buffer });

    if (result.groups.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'The drawing was read, but no room labels with dimensions were found',
      });
    }

    await saveResult(result);
    ok(res, result, 'Drawing processed', 201);
  } catch (err) {
    if (file) await fs.unlink(file.path).catch(() => {});
    next(err);
  }
});

// GET /api/drawings/:id
router.get('/:id', async (req, res, next) => {
  try {
    ok(res, await loadResult(req.params.id));
  } catch (err) {
    next(err);
  }
});

// PUT /api/drawings/:id  — save edited groups/rooms
router.put('/:id', async (req, res, next) => {
  try {
    const current = await loadResult(req.params.id);
    const groups = req.body?.groups;
    if (!Array.isArray(groups)) return res.status(400).json({ success: false, message: 'groups must be an array' });

    const clean = groups.slice(0, 50).map((g) => ({
      id: String(g.id),
      name: String(g.name ?? '').slice(0, 120),
      merged: Boolean(g.merged),
      info: String(g.info ?? '').slice(0, 300),
      rooms: (Array.isArray(g.rooms) ? g.rooms : []).slice(0, 500).map((r) => {
        const length = Number(r.length);
        const breadth = Number(r.breadth);
        let areaFt2 = Number(r.areaFt2);
        if (![length, breadth, areaFt2].every((n) => Number.isFinite(n) && n >= 0)) {
          throw Object.assign(new Error('Length, breadth and area must be positive numbers'), { status: 400 });
        }
        let areaExpr;
        if (r.areaExpr) {
          areaExpr = String(r.areaExpr).replace(/\s+/g, '');
          if (areaExpr.length > 120 || !EXPR_RE.test(areaExpr)) {
            throw Object.assign(new Error('Area can only be a number or a sum like 214.5+891.87'), { status: 400 });
          }
          areaFt2 = areaExpr.split('+').reduce((s, p) => s + Number(p), 0); // the server decides the total
        }
        return {
          id: String(r.id),
          name: String(r.name ?? '').slice(0, 120),
          length: round4(length),
          breadth: round4(breadth),
          areaFt2: round2(areaFt2),
          areaOverridden: Boolean(r.areaOverridden) || Boolean(areaExpr),
          ...(areaExpr ? { areaExpr } : {}),
          source: r.source === 'measured' ? 'measured' : 'label',
        };
      }),
    }));

    await saveResult({ ...current, groups: clean, updatedAt: new Date().toISOString() });
    ok(res, { saved: true }, 'Changes saved');
  } catch (err) {
    next(err);
  }
});

// GET /api/drawings/:id/export.csv
router.get('/:id/export.csv', async (req, res, next) => {
  try {
    const d = await loadResult(req.params.id);
    const rows = [['Floor', 'SN', 'Room', 'Length (ft-in)', 'Breadth (ft-in)', 'Length (ft)', 'Breadth (ft)', 'Area (ft2)', 'Area (m2)']];
    let grand = 0;
    for (const g of d.groups) {
      let sub = 0;
      let sn = 1;
      for (const r of g.rooms) {
        rows.push([g.name, sn++, r.name, formatFeetInches(r.length), formatFeetInches(r.breadth),
          r.length, r.breadth, r.areaFt2.toFixed(2), (r.areaFt2 * SQFT_TO_SQM).toFixed(2)]);
        sub += r.areaFt2;
      }
      rows.push([`SUBTOTAL - ${g.name}`, '', '', '', '', '', '', sub.toFixed(2), (sub * SQFT_TO_SQM).toFixed(2)]);
      grand += sub;
    }
    rows.push(['TOTAL', '', '', '', '', '', '', grand.toFixed(2), (grand * SQFT_TO_SQM).toFixed(2)]);

    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="room-areas.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    next(err);
  }
});

// GET /api/drawings/:id/export.xlsx  — Excel in the client's layout
router.get('/:id/export.xlsx', async (req, res, next) => {
  try {
    const d = await loadResult(req.params.id);
    const buffer = await buildAreaWorkbook(d);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="room-areas.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
});

export default router;

import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export const UPLOAD_DIR = path.resolve(import.meta.dirname, '../../uploads');
const MAX_BYTES = Number(process.env.MAX_UPLOAD_MB || 50) * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // Never use the client's filename on disk — it can contain path tricks
  filename: (req, file, cb) => {
    req.drawingId = randomUUID();
    cb(null, `${req.drawingId}.dwg`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.dwg') {
      return cb(Object.assign(new Error('Only .dwg files are accepted'), { status: 400 }));
    }
    cb(null, true);
  },
});

/** A real DWG starts with a version tag such as "AC1021". Checks the bytes, not the extension. */
export async function hasDwgSignature(filePath) {
  const fh = await fs.open(filePath, 'r');
  try {
    const { buffer } = await fh.read(Buffer.alloc(6), 0, 6, 0);
    return /^AC10\d{2}$/.test(buffer.toString('ascii'));
  } finally {
    await fh.close();
  }
}

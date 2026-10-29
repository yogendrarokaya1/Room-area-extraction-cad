import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'node:fs/promises';
import multer from 'multer';
import drawingsRouter from './routes/drawings.routes.js';
import { UPLOAD_DIR } from './middleware/upload.js';

const app = express();
const PORT = process.env.PORT || 5000;

await fs.mkdir(UPLOAD_DIR, { recursive: true });

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, methods: ['GET', 'POST', 'PUT'] }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', node: process.version }, message: 'Backend is running' });
});

app.use('/api/drawings', drawingsRouter);

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Central error handler — never leak stack traces to the client
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({
      success: false,
      message: tooBig ? `File is too large (max ${process.env.MAX_UPLOAD_MB || 50} MB)` : err.message,
    });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ success: false, message: status >= 500 ? 'Could not process the drawing' : err.message });
});

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));

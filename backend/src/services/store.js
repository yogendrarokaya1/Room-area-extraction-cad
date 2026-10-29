import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(import.meta.dirname, '../../data');
export const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const fileFor = (id) => {
  if (!ID_RE.test(id)) throw Object.assign(new Error('Invalid drawing id'), { status: 400 });
  return path.join(DATA_DIR, `${id}.json`);
};

export async function saveResult(result) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(fileFor(result.id), JSON.stringify(result, null, 2));
}

export async function loadResult(id) {
  try {
    return JSON.parse(await fs.readFile(fileFor(id), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') throw Object.assign(new Error('Drawing not found'), { status: 404 });
    throw err;
  }
}

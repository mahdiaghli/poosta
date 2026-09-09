import fs from 'node:fs';
import path from 'node:path';
import { getDataDir, getDb } from '../server/db.mjs';

const backupDir = path.join(getDataDir(), 'backups');
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = path.join(backupDir, `poosta-${stamp}.sqlite`);

await getDb().backup(destination);
const stat = fs.statSync(destination);
console.log(`SQLite backup created: ${destination} (${stat.size} bytes)`);

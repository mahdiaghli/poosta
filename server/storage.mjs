import fs from 'node:fs';
import path from 'node:path';
import { getDataDir } from './db.mjs';

/** @typedef {{ put(key: string, data: Buffer|string): Promise<string>, get(key: string): Promise<Buffer|null>, exists(key: string): Promise<boolean> }} StorageDriver */

export class LocalStorageDriver {
  constructor(rootDir = path.join(getDataDir(), 'scans')) {
    this.rootDir = rootDir;
  }

  resolve(key) {
    const clean = String(key).replace(/^[/\\]+/, '').replace(/\.\./g, '');
    return path.join(this.rootDir, clean);
  }

  async put(key, data) {
    const full = this.resolve(key);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, data);
    return key;
  }

  async get(key) {
    const full = this.resolve(key);
    if (!fs.existsSync(full)) return null;
    return fs.readFileSync(full);
  }

  async exists(key) {
    return fs.existsSync(this.resolve(key));
  }
}

/** Stub for a later S3-compatible switch — not used in V1. */
export class S3StorageDriver {
  constructor() {
    throw new Error('S3StorageDriver is not configured in V1. Use LocalStorageDriver.');
  }
}

let driver;

export function getStorage() {
  if (!driver) driver = new LocalStorageDriver();
  return driver;
}

export function scanObjectPrefix(scanId, date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}/${m}/${d}/scan_${scanId}`;
}

export function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[\w+.-]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!match) throw new Error('Invalid image data URL');
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

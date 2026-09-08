import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

const DATA_DIR = path.resolve(process.env.POOSTA_DATA_DIR || 'data');
const DB_PATH = path.join(DATA_DIR, 'poosta.sqlite');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db;

export function getDataDir() {
  return DATA_DIR;
}

export function getDb() {
  if (db) return db;
  ensureDataDir();
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  ensureLocalDevTenant(db);
  return db;
}

function ensureColumn(database, table, column, sqlType) {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType}`);
  }
}

/** Allows POOSTA_LICENSE_REQUIRED=false scans without breaking FKs. */
function ensureLocalDevTenant(database) {
  database.prepare(`
    INSERT OR IGNORE INTO pharmacies (id, name, city, status, created_at, code, pin_hash)
    VALUES ('local-dev', 'Local Dev', null, 'active', ?, 'LOCAL', ?)
  `).run(nowIso(), hashPin('0000'));
  // older rows may lack code/pin
  database.prepare(`UPDATE pharmacies SET code = COALESCE(code, 'LOCAL'), pin_hash = COALESCE(pin_hash, ?) WHERE id = 'local-dev'`)
    .run(hashPin('0000'));
  database.prepare(`
    INSERT OR IGNORE INTO plans (id, name, max_devices) VALUES ('plan_dev', 'dev', 99)
  `).run();
  database.prepare(`
    INSERT OR IGNORE INTO devices (
      id, pharmacy_id, device_code, activation_code, status, registered_at
    ) VALUES ('dev_local', 'local-dev', 'LOCAL', 'PST-LOCAL-DEV0', 'active', ?)
  `).run(nowIso());
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS pharmacies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      max_devices INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS plan_features (
      plan_id TEXT NOT NULL,
      feature_key TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (plan_id, feature_key),
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      pharmacy_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id),
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      pharmacy_id TEXT NOT NULL,
      device_code TEXT NOT NULL UNIQUE,
      activation_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      last_seen TEXT,
      app_version TEXT,
      registered_at TEXT,
      FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id)
    );

    CREATE TABLE IF NOT EXISTS device_tokens (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (device_id) REFERENCES devices(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      pharmacy_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      ended_at TEXT,
      FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id),
      FOREIGN KEY (device_id) REFERENCES devices(id)
    );

    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      pharmacy_id TEXT NOT NULL,
      device_id TEXT,
      mode TEXT NOT NULL DEFAULT 'standard',
      status TEXT NOT NULL DEFAULT 'pending',
      provider TEXT,
      customer_result_json TEXT,
      original_key TEXT,
      overlay_key TEXT,
      annotations_key TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id),
      FOREIGN KEY (device_id) REFERENCES devices(id)
    );

    CREATE TABLE IF NOT EXISTS shared_routines (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      pharmacy_id TEXT NOT NULL,
      device_id TEXT,
      phone TEXT,
      payload_json TEXT NOT NULL,
      sms_status TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      pharmacy_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      display_name TEXT,
      created_at TEXT NOT NULL,
      last_seen_at TEXT,
      UNIQUE (pharmacy_id, phone),
      FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id)
    );

    CREATE TABLE IF NOT EXISTS pharmacy_products (
      id TEXT PRIMARY KEY,
      pharmacy_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      price REAL,
      currency TEXT DEFAULT 'IRT',
      stock INTEGER DEFAULT 0,
      available INTEGER DEFAULT 1,
      sku TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE (pharmacy_id, product_id),
      FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id)
    );

    CREATE TABLE IF NOT EXISTS staff_tokens (
      id TEXT PRIMARY KEY,
      pharmacy_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id)
    );
  `);

  ensureColumn(database, 'pharmacies', 'code', 'TEXT');
  ensureColumn(database, 'pharmacies', 'pin_hash', 'TEXT');
  ensureColumn(database, 'scans', 'customer_id', 'TEXT');
  ensureColumn(database, 'scans', 'recommendations_json', 'TEXT');
  ensureColumn(database, 'scans', 'routine_json', 'TEXT');
  ensureColumn(database, 'shared_routines', 'customer_id', 'TEXT');
}

export function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashPin(pin) {
  return crypto.createHash('sha256').update(`poosta-pin:${String(pin)}`).digest('hex');
}

export function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function randomActivationCode() {
  const part = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `PST-${part()}-${part()}`;
}

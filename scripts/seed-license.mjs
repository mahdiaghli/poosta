/**
 * Seeds plans, demo pharmacy (code DEMO / pin 1234), device, sample pharmacy_products.
 */
import { getDb, newId, nowIso, randomActivationCode, hashPin } from '../server/db.mjs';

const FEATURES = {
  basic: {
    skin_analysis: 1,
    accurate_analysis: 1,
    product_recommendation: 1,
    routine_sms: 1,
    pharmacy_dashboard: 1,
    advanced_analysis: 0,
    multi_device: 0,
  },
  pro: {
    skin_analysis: 1,
    accurate_analysis: 1,
    product_recommendation: 1,
    routine_sms: 1,
    pharmacy_dashboard: 1,
    advanced_analysis: 1,
    multi_device: 1,
  },
};

function upsertPlans(db) {
  db.prepare(`INSERT OR REPLACE INTO plans (id, name, max_devices) VALUES ('plan_basic', 'basic', 1)`).run();
  db.prepare(`INSERT OR REPLACE INTO plans (id, name, max_devices) VALUES ('plan_pro', 'pro', 3)`).run();
  const upsertFeature = db.prepare(`
    INSERT OR REPLACE INTO plan_features (plan_id, feature_key, enabled) VALUES (?, ?, ?)
  `);
  for (const [plan, feats] of Object.entries(FEATURES)) {
    const planId = `plan_${plan}`;
    for (const [key, enabled] of Object.entries(feats)) {
      upsertFeature.run(planId, key, enabled);
    }
  }
}

function main() {
  const db = getDb();
  upsertPlans(db);

  const pharmacyId = 'pharmacy_demo';
  db.prepare(`
    INSERT INTO pharmacies (id, name, city, status, created_at, code, pin_hash)
    VALUES (?, ?, ?, 'active', ?, 'DEMO', ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      city = excluded.city,
      code = COALESCE(pharmacies.code, excluded.code),
      pin_hash = COALESCE(pharmacies.pin_hash, excluded.pin_hash)
  `).run(pharmacyId, 'داروخانه نمونه پوستا', 'مشهد', nowIso(), hashPin('1234'));

  // ensure staff login works even if row existed without pin
  db.prepare(`UPDATE pharmacies SET code = 'DEMO', pin_hash = ? WHERE id = ?`)
    .run(hashPin('1234'), pharmacyId);

  const started = new Date();
  const expires = new Date(started);
  expires.setFullYear(expires.getFullYear() + 1);

  const existingSub = db.prepare(
    `SELECT id FROM subscriptions WHERE pharmacy_id = ? AND status = 'active'`,
  ).get(pharmacyId);

  if (!existingSub) {
    db.prepare(`
      INSERT INTO subscriptions (id, pharmacy_id, plan_id, started_at, expires_at, status)
      VALUES (?, ?, 'plan_basic', ?, ?, 'active')
    `).run(newId('sub'), pharmacyId, started.toISOString(), expires.toISOString());
  }

  let device = db.prepare(
    `SELECT * FROM devices WHERE pharmacy_id = ? AND status IN ('pending','active') ORDER BY registered_at DESC LIMIT 1`,
  ).get(pharmacyId);

  if (!device) {
    const activation = randomActivationCode();
    const deviceId = newId('device');
    db.prepare(`
      INSERT INTO devices (id, pharmacy_id, device_code, activation_code, status, registered_at)
      VALUES (?, ?, 'TABLET-001', ?, 'pending', ?)
    `).run(deviceId, pharmacyId, activation, nowIso());
    device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId);
  }

  // sample inventory rows (product ids from local catalog if present)
  const samples = [
    { product_id: 'cerave-foaming-cleanser', price: 890000, stock: 12 },
    { product_id: 'the-ordinary-niacinamide', price: 1290000, stock: 8 },
    { product_id: 'la-roche-posay-anthelios', price: 1850000, stock: 5 },
  ];
  for (const s of samples) {
    const exists = db.prepare(
      'SELECT id FROM pharmacy_products WHERE pharmacy_id = ? AND product_id = ?',
    ).get(pharmacyId, s.product_id);
    if (!exists) {
      db.prepare(`
        INSERT INTO pharmacy_products (id, pharmacy_id, product_id, price, currency, stock, available, updated_at)
        VALUES (?, ?, ?, ?, 'IRT', ?, 1, ?)
      `).run(newId('pp'), pharmacyId, s.product_id, s.price, s.stock, nowIso());
    }
  }

  console.log('Poosta license seed OK');
  console.log(`  Pharmacy: ${pharmacyId}`);
  console.log('  Staff login: code=DEMO  pin=1234');
  console.log(`  Plan: basic (1 year)`);
  console.log(`  Device: ${device.device_code} (${device.status})`);
  console.log(`  Activation code: ${device.activation_code}`);
  console.log('  Admin: set POOSTA_ADMIN_KEY and open /admin');
  console.log('  Training is manual — seed does not call ai:train.');
}

main();

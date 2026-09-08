import { getDb, newId, nowIso } from './db.mjs';

export function listPharmacyProducts(pharmacyId) {
  return getDb().prepare(`
    SELECT * FROM pharmacy_products WHERE pharmacy_id = ? ORDER BY updated_at DESC
  `).all(pharmacyId);
}

export function upsertPharmacyProduct(pharmacyId, body) {
  const productId = String(body.product_id || body.productId || '').trim();
  if (!productId) {
    const err = new Error('product_id الزامی است.');
    err.status = 400;
    err.code = 'BAD_REQUEST';
    throw err;
  }
  const db = getDb();
  const existing = db.prepare(
    'SELECT * FROM pharmacy_products WHERE pharmacy_id = ? AND product_id = ?',
  ).get(pharmacyId, productId);
  const price = body.price != null ? Number(body.price) : existing?.price ?? null;
  const stock = body.stock != null ? Number(body.stock) : existing?.stock ?? 0;
  const available = body.available != null ? (body.available ? 1 : 0) : existing?.available ?? 1;
  const sku = body.sku ?? existing?.sku ?? null;
  const currency = body.currency || existing?.currency || 'IRT';

  if (existing) {
    db.prepare(`
      UPDATE pharmacy_products
      SET price = ?, stock = ?, available = ?, sku = ?, currency = ?, updated_at = ?
      WHERE id = ?
    `).run(price, stock, available, sku, currency, nowIso(), existing.id);
    return db.prepare('SELECT * FROM pharmacy_products WHERE id = ?').get(existing.id);
  }
  const id = newId('pp');
  db.prepare(`
    INSERT INTO pharmacy_products (
      id, pharmacy_id, product_id, price, currency, stock, available, sku, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, pharmacyId, productId, price, currency, stock, available, sku, nowIso());
  return db.prepare('SELECT * FROM pharmacy_products WHERE id = ?').get(id);
}

/** Enrich recommended products with pharmacy price/stock when available. */
export function enrichRecommendations(pharmacyId, recommendations = []) {
  if (!Array.isArray(recommendations) || !recommendations.length) return [];
  const db = getDb();
  return recommendations.map((r) => {
    const id = r.id || r.productId;
    const row = id
      ? db.prepare('SELECT * FROM pharmacy_products WHERE pharmacy_id = ? AND product_id = ?').get(pharmacyId, id)
      : null;
    return {
      id,
      name: r.name,
      brand: r.brand,
      category: r.category,
      score: r.score,
      price: row?.price ?? r.price ?? null,
      currency: row?.currency || r.currency || 'IRT',
      stock: row?.stock ?? null,
      available: row ? Boolean(row.available) && (row.stock == null || row.stock > 0) : true,
      pharmacy_sku: row?.sku || null,
    };
  });
}

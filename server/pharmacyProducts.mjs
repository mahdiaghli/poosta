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
  const stock = body.stock != null ? Math.floor(Number(body.stock)) : existing?.stock ?? 0;
  const available = body.available != null ? (body.available ? 1 : 0) : existing?.available ?? 1;
  const sku = body.sku ?? existing?.sku ?? null;
  const currency = body.currency || existing?.currency || 'IRT';
  const lowStockThreshold = body.low_stock_threshold != null
    ? Math.floor(Number(body.low_stock_threshold))
    : existing?.low_stock_threshold ?? 3;
  if ((price != null && (!Number.isFinite(price) || price < 0))
    || !Number.isFinite(stock) || stock < 0
    || !Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
    const err = new Error('قیمت، موجودی یا حد هشدار معتبر نیست.');
    err.status = 400;
    err.code = 'INVALID_INVENTORY_VALUE';
    throw err;
  }

  if (existing) {
    db.prepare(`
      UPDATE pharmacy_products
      SET price = ?, stock = ?, available = ?, sku = ?, currency = ?, low_stock_threshold = ?, updated_at = ?
      WHERE id = ?
    `).run(price, stock, available, sku, currency, lowStockThreshold, nowIso(), existing.id);
    return db.prepare('SELECT * FROM pharmacy_products WHERE id = ?').get(existing.id);
  }
  const id = newId('pp');
  db.prepare(`
    INSERT INTO pharmacy_products (
      id, pharmacy_id, product_id, price, currency, stock, available, sku, low_stock_threshold, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, pharmacyId, productId, price, currency, stock, available, sku, lowStockThreshold, nowIso());
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
    const lowStockThreshold = row?.low_stock_threshold ?? 3;
    const inventoryStatus = !row
      ? 'not_stocked'
      : (!row.available || Number(row.stock) <= 0)
        ? 'out_of_stock'
        : Number(row.stock) <= lowStockThreshold
          ? 'low_stock'
          : 'available';
    return {
      id,
      name: r.name,
      brand: r.brand,
      category: r.category,
      score: r.score,
      price: row?.price ?? r.price ?? null,
      currency: row?.currency || r.currency || 'IRT',
      stock: row?.stock ?? null,
      available: inventoryStatus === 'available' || inventoryStatus === 'low_stock',
      stocked_here: Boolean(row),
      inventory_status: inventoryStatus,
      low_stock_threshold: lowStockThreshold,
      pharmacy_sku: row?.sku || null,
    };
  });
}

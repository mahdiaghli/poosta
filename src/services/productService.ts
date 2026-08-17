import type { Product, ProductCategory } from '@/types';
import catalog from '@/data/productCatalog.json';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PRODUCT_SELECT = `*, brands(name),
  product_prices(price,currency),
  product_skin_types(skin_types(key)),
  product_concerns(concern),
  product_ingredients(is_active_ingredient, ingredients(key))`;

const CATEGORY_SET = new Set<ProductCategory>([
  'cleanser','toner','essence','serum','moisturizer','sunscreen','treatment','body_care','lip_care'
]);
const SKIN_TYPES = new Set(['oily','dry','combination','normal','sensitive','unknown']);

function normalizeCategory(value: unknown): ProductCategory {
  return CATEGORY_SET.has(value as ProductCategory) ? value as ProductCategory : 'treatment';
}

function normalizeProduct(raw: any): Product {
  const skinTypes = Array.isArray(raw.skin_types) ? raw.skin_types.filter((x: any) => SKIN_TYPES.has(x)) : [];
  const concerns = Array.isArray(raw.concerns) ? raw.concerns.map(String) : [];
  const keyIngredients = Array.isArray(raw.key_ingredients) ? raw.key_ingredients : [];
  const actives = Array.isArray(raw.actives) ? raw.actives.map((a: any) => a?.ingredient).filter(Boolean) : [];
  return {
    id: String(raw.id), name: String(raw.name), brand: String(raw.brand ?? ''), category: normalizeCategory(raw.category),
    image: raw.image_url ?? raw.image ?? undefined, description: raw.notes ?? raw.description ?? undefined,
    price: typeof raw.price === 'number' && raw.price > 0 ? raw.price : undefined,
    currency: raw.currency ?? 'IRT', purchaseUrl: raw.purchase_url ?? undefined, officialUrl: raw.official_url ?? undefined,
    rating: typeof raw.rating === 'number' ? raw.rating : undefined, reviewCount: typeof raw.review_count === 'number' ? raw.review_count : undefined,
    barcode: raw.barcode ?? null, sizeOptionsMl: Array.isArray(raw.size_options_ml) ? raw.size_options_ml : undefined,
    skinTypes, concerns, ingredientKeys: keyIngredients, activeIngredientKeys: actives,
    concentrations: raw.concentration ?? {}, fragranceFree: raw.fragrance_free ?? null,
    alcoholFree: raw.alcohol_free ?? null, essentialOilFree: raw.essential_oil_free ?? null,
    pregnancySafety: raw.pregnancy_safety, irritationLevel: raw.irritation_level,
    amUsage: raw.am_usage ?? false, pmUsage: raw.pm_usage ?? false,
    interactionIds: raw.interaction_ids ?? [], iranAvailability: raw.iran_availability,
    availabilityType: raw.availability_type, lastVerifiedAt: raw.last_verified_at, notes: raw.notes,
  };
}

const LOCAL_CATALOG: Product[] = (catalog.products as any[]).map(normalizeProduct);

function mergeCatalog(dbProducts: Product[]): Product[] {
  const byId = new Map<string, Product>();
  for (const p of LOCAL_CATALOG) byId.set(p.id, p);
  for (const p of dbProducts) byId.set(p.id, { ...byId.get(p.id), ...p });
  return Array.from(byId.values());
}

function mapDbProduct(row: any): Product {
  return {
    id: row.id, name: row.name, brand: row.brands?.name ?? row.brand ?? '', image: row.image_url, description: row.description,
    category: normalizeCategory(row.category), price: row.product_prices?.[0]?.price ?? row.price ?? undefined,
    currency: row.product_prices?.[0]?.currency ?? row.currency ?? 'IRT', purchaseUrl: row.purchase_url, officialUrl: row.official_url,
    rating: row.rating, reviewCount: row.review_count, barcode: row.barcode,
    skinTypes: row.product_skin_types?.map((r: any) => r.skin_types?.key).filter(Boolean) ?? row.skinTypes ?? [],
    concerns: row.product_concerns?.map((r: any) => r.concern).filter(Boolean) ?? row.concerns ?? [],
    ingredientKeys: row.product_ingredients?.map((r: any) => r.ingredients?.key).filter(Boolean) ?? row.ingredientKeys ?? [],
    activeIngredientKeys: row.product_ingredients?.filter((r: any) => r.is_active_ingredient).map((r: any) => r.ingredients?.key).filter(Boolean) ?? row.activeIngredientKeys ?? [],
  };
}

export const productService = {
  async getAll(): Promise<Product[]> { await delay(20); return LOCAL_CATALOG; },
  async getById(id: string): Promise<Product | null> { return LOCAL_CATALOG.find((p) => p.id === id) ?? null; },
  async search(query: string): Promise<Product[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return LOCAL_CATALOG.filter((p) => [p.name, p.brand, p.id].some((v) => v.toLowerCase().includes(q)));
  },
  async findByBarcode(code: string): Promise<Product | null> {
    const normalized = code.replace(/\s+/g, '');
    return LOCAL_CATALOG.find((p) => p.barcode === normalized) ?? null;
  },
  async getByCategory(category: ProductCategory): Promise<Product[]> {
    return (await this.getAll()).filter((p) => p.category === category);
  },
};

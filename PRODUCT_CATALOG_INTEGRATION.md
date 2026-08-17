# Product Catalog Integration

- `src/data/productCatalog.json`: 75-product Iran-market catalog.
- `src/services/productService.ts`: Supabase is preferred, but the local catalog remains available and is merged with DB products.
- `src/pages/Products.tsx`: catalog is visible before a skin scan; search and category filters included.
- `src/pages/ProductDetail.tsx`: product detail at `/products/:id`.
- `src/components/product/ProductCard.tsx`: supports recommended and catalog products.
- `scripts/import-products-to-supabase.mjs`: optional seed utility.

Run the seed utility with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, then `npm run seed:products`.

Price and barcode can be null when the exact Iranian SKU could not be verified.

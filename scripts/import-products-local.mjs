import fs from 'node:fs';
const file='src/data/productCatalog.json';
const data=JSON.parse(fs.readFileSync(file,'utf8'));
console.log(`Local catalog ready: ${data.products?.length ?? 0} products`);

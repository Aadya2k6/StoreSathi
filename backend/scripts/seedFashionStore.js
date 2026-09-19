/**
 * StoreSathi — Fashion Store Demo Seed Script
 * 
 * Seeds "Vogue Threads" with a rich 14-day sales history designed to
 * trigger all intelligence rules in rulesEngine.js for the hackathon demo.
 *
 * Rules triggered:
 * C1 — Low Stock Alert    → Denim Jacket (stock=6, high sales)
 * C2 — Stockout Risk      → Denim Jacket, ~2 days left
 * C3 — Slow Moving        → Formal Trousers (stock=45, 0 sales)
 * C4 — Demand Spike       → Floral Dress (+350% this week vs last)
 * C5 — Growth Opportunity → Linen Co-ord Set (+167% rising)
 * C6 — Weather Alert      → Denim Jacket + Bomber (Outerwear + low stock)
 * C7 — Trend Promotion    → Floral Summer Dress (Dresses + "Floral")
 *
 * Run: node scripts/seedFashionStore.js
 */

require('dotenv').config();
const duckdb = require('duckdb');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve(__dirname, '../../data/store.db');
const db = new duckdb.Database(dbPath);
const con = db.connect();

const run = (sql, ...params) => new Promise((resolve, reject) => {
  con.run(sql, ...params, (err) => {
    if (err) return reject(err);
    resolve();
  });
});

const all = (sql, ...params) => new Promise((resolve, reject) => {
  con.all(sql, ...params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows);
  });
});

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

async function seed() {
  console.log('StoreSathi Fashion Store Seed - Starting...\n');

  // 1. Wipe existing data for a clean re-seed
  console.log('Clearing old data...');
  await run("DELETE FROM sale_items");
  await run("DELETE FROM sales");
  await run("DELETE FROM inventory_movements");
  await run("DELETE FROM products");
  await run("DELETE FROM users");
  await run("DELETE FROM stores");
  await run("DELETE FROM merchants");
  await run("DELETE FROM recommendations");
  await run("DELETE FROM actions");
  await run("DELETE FROM daily_metrics");
  console.log('Done.\n');

  // 2. Merchant & Store
  console.log('Creating Vogue Threads store...');
  await run('INSERT INTO merchants VALUES (?, ?, ?)', 'merchant_1', 'Ananya Sharma', daysAgo(30));
  await run('INSERT INTO stores VALUES (?, ?, ?, ?, ?)', 'store_1', 'merchant_1', 'Vogue Threads', 'Clothing', daysAgo(30));
  await run('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)', 'user_1', 'store_1', 'demo@storesathi.com', 'hashed_password', 'admin', daysAgo(30));
  console.log('Done.\n');

  // 3. Products
  console.log('Inserting fashion catalogue...');
  const products = [
    // C1/C2/C6: low stock Outerwear, cold weather incoming
    ['prod_1', 'Denim Jacket - Vintage Blue', 'Outerwear', 2499, 1000, 6],
    // C7/C4/C5: Floral Dresses are trending, demand spiking this week
    ['prod_2', 'Floral Summer Dress', 'Dresses', 1799, 700, 28],
    // C3: formal item with 0 sales and high stock = slow mover
    ['prod_3', 'Formal Pleated Trousers', 'Bottoms', 1499, 600, 45],
    // Normal product - baseline sales
    ['prod_4', 'Classic White T-Shirt', 'Tops', 599, 200, 55],
    // Normal stable mover
    ['prod_5', 'Cotton Polo Shirt - Navy', 'Tops', 899, 350, 38],
    // C5: Growing product - Linen Co-ord Set rising fast
    ['prod_6', 'Linen Co-ord Set - Beige', 'Sets', 2999, 1200, 32],
    // C6: Another outerwear, low stock
    ['prod_7', 'Quilted Bomber Jacket - Black', 'Outerwear', 3499, 1500, 8],
  ];

  for (const [id, name, category, price, cost, stock] of products) {
    await run(
      'INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, 'store_1', name, category, price, cost, stock, daysAgo(20)
    );
  }
  console.log('Inserted ' + products.length + ' products.\n');

  // 4. Sales History (14 days)
  console.log('Generating 14-day sales history...');

  const makeSale = async (daysAgoVal, items, paymentMethod) => {
    paymentMethod = paymentMethod || 'UPI';
    const saleId = uuidv4();
    const totalAmount = items.reduce(function (sum, item) { return sum + item[1] * item[2]; }, 0);
    await run(
      'INSERT INTO sales VALUES (?, ?, ?, ?, ?, ?)',
      saleId, 'store_1', uuidv4(), totalAmount, paymentMethod, daysAgo(daysAgoVal)
    );
    for (const item of items) {
      const productId = item[0];
      const qty = item[1];
      const price = item[2];
      const itemId = uuidv4();
      await run(
        'INSERT INTO sale_items VALUES (?, ?, ?, ?, ?, ?)',
        itemId, saleId, productId, qty, price, qty * price
      );
      await run(
        'INSERT INTO inventory_movements VALUES (?, ?, ?, ?, ?, ?, ?)',
        uuidv4(), 'store_1', productId, -qty, 'sale', saleId, daysAgo(daysAgoVal)
      );
    }
  };

  // PRIOR WEEK (days 8-14): Denim Jacket sells well, Floral Dress barely moves
  await makeSale(14, [['prod_1', 2, 2499], ['prod_4', 3, 599]]);
  await makeSale(13, [['prod_1', 2, 2499], ['prod_5', 2, 899]]);
  await makeSale(12, [['prod_1', 1, 2499], ['prod_4', 2, 599]]);
  await makeSale(11, [['prod_1', 2, 2499], ['prod_6', 1, 2999]]);
  await makeSale(10, [['prod_1', 2, 2499], ['prod_5', 3, 899]]);
  await makeSale(9, [['prod_1', 1, 2499], ['prod_4', 4, 599]]);
  await makeSale(8, [['prod_7', 1, 3499], ['prod_4', 2, 599]]);
  // Floral dress sold only 2 units in prior week
  await makeSale(11, [['prod_2', 1, 1799]]);
  await makeSale(9, [['prod_2', 1, 1799]]);
  // Linen co-ord - 3 units prior week
  await makeSale(12, [['prod_6', 1, 2999]]);
  await makeSale(10, [['prod_6', 2, 2999]]);

  // THIS WEEK (days 1-7): Floral Dress SPIKES (C4/C5/C7), Jacket continues selling
  // Floral Dress: 9 sold this week vs 2 last week = +350% spike
  await makeSale(7, [['prod_2', 2, 1799], ['prod_4', 3, 599]]);
  await makeSale(6, [['prod_2', 3, 1799], ['prod_5', 2, 899]]);
  await makeSale(5, [['prod_2', 1, 1799], ['prod_4', 2, 599]]);
  await makeSale(4, [['prod_2', 2, 1799], ['prod_6', 2, 2999]]);
  await makeSale(3, [['prod_2', 1, 1799], ['prod_7', 1, 3499]]);
  // Linen Co-ord: 8 units this week vs 3 last week = +167% growth (C5)
  await makeSale(6, [['prod_6', 2, 2999]]);
  await makeSale(4, [['prod_6', 3, 2999]]);
  await makeSale(2, [['prod_6', 3, 2999]]);
  // Denim Jacket sells 6 more this week - nearly out of stock!
  await makeSale(5, [['prod_1', 2, 2499]]);
  await makeSale(3, [['prod_1', 2, 2499]]);
  await makeSale(1, [['prod_1', 2, 2499]]);
  // prod_3 (Formal Trousers) = ZERO sales in all 14 days => C3 Slow Moving

  console.log('Done.\n');

  // 5. Summary
  const productRows = await all('SELECT name, stock_quantity FROM products WHERE store_id = ?', 'store_1');
  const salesCount = await all('SELECT count(*) as c FROM sales WHERE store_id = ?', 'store_1');
  const itemsCount = await all('SELECT count(*) as c FROM sale_items');

  console.log('==============================================');
  console.log('Vogue Threads — Seed Complete!\n');
  console.log('  Products    : ' + productRows.length);
  console.log('  Sales       : ' + salesCount[0].c);
  console.log('  Sale Items  : ' + itemsCount[0].c + '\n');
  console.log('  Current Stock:');
  productRows.forEach(function (p) {
    console.log('    ' + p.name + ' — stock=' + p.stock_quantity);
  });
  console.log('\n  Rules that WILL fire when plugin opens:');
  console.log('  C1 — Low Stock Alert     → Denim Jacket (stock=6)');
  console.log('  C2 — Stockout Risk       → Denim Jacket (~2 days left)');
  console.log('  C3 — Slow Moving         → Formal Pleated Trousers (0 sales)');
  console.log('  C4 — Demand Spike +350%  → Floral Summer Dress');
  console.log('  C5 — Growth Opportunity  → Linen Co-ord Set (+167%)');
  console.log('  C6 — Weather Alert       → Denim Jacket + Bomber Jacket');
  console.log('  C7 — Trend Promotion     → Floral Summer Dress (Trending!)');
  console.log('==============================================\n');

  db.close();
}

seed().catch(function (err) {
  console.error('Seed failed:', err);
  process.exit(1);
});

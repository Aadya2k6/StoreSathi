/**
 * Seed Script — Phase 2 Testing
 * 
 * Inserts realistic test product snapshots into DuckDB so you can
 * immediately test the opportunity engine without needing the extension.
 * 
 * Run from /backend: node seed.js
 */
const duckdb = require('duckdb');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/store.db');
const db = new duckdb.Database(dbPath);
const con = db.connect();

const snapshots = [
  // ── Gymshark Leggings (will trigger: UNDERPRICED vs others) ──
  {
    url: 'https://demo-store.com/products/essential-leggings',
    product_name: 'Essential Leggings - Black',
    price: 18.00,         // Much cheaper than similar items below → underpriced
    currency: 'GBP',
    stock_status: 'in_stock',
    reviews_count: 5,
    rating: 4.2,
    platform: 'seed',
  },
  {
    url: 'https://demo-store.com/products/essential-leggings-blue',
    product_name: 'Essential Leggings - Blue',
    price: 36.00,
    currency: 'GBP',
    stock_status: 'in_stock',
    reviews_count: 120,
    rating: 4.5,
    platform: 'seed',
  },
  {
    url: 'https://demo-store.com/products/essential-leggings-pink',
    product_name: 'Essential Leggings - Pink',
    price: 34.00,
    currency: 'GBP',
    stock_status: 'in_stock',
    reviews_count: 80,
    rating: 4.3,
    platform: 'seed',
  },
  // ── Low-rated item (will trigger: RESPONSE GAP) ──
  {
    url: 'https://demo-store.com/products/seamless-sports-bra',
    product_name: 'Seamless Sports Bra',
    price: 28.00,
    currency: 'GBP',
    stock_status: 'in_stock',
    reviews_count: 42,
    rating: 2.8,           // < 3.5 → response gap
    platform: 'seed',
  },
  // ── In-stock but barely any reviews (will trigger: SLOW-MOVING) ──
  {
    url: 'https://demo-store.com/products/premium-joggers',
    product_name: 'Premium Joggers - Grey',
    price: 45.00,
    currency: 'GBP',
    stock_status: 'in_stock',
    reviews_count: 3,      // < 10 reviews + price > 20 → slow-moving
    rating: 4.0,
    platform: 'seed',
  },
  // ── Healthy item (no opportunity should be flagged) ──
  {
    url: 'https://demo-store.com/products/training-shorts',
    product_name: 'Training Shorts',
    price: 30.00,
    currency: 'GBP',
    stock_status: 'in_stock',
    reviews_count: 200,
    rating: 4.6,
    platform: 'seed',
  },
];

const insertSnapshot = (snap) => new Promise((resolve, reject) => {
  const stmt = con.prepare(`
    INSERT INTO snapshots (url, product_name, price, currency, stock_status, reviews_count, rating, platform, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    snap.url, 
    snap.product_name, 
    snap.price, 
    snap.currency,
    snap.stock_status, 
    snap.reviews_count, 
    snap.rating, 
    snap.platform,
    new Date().toISOString(),
    (err) => { 
      if (err) reject(err); 
      else resolve(); 
    }
  );
  stmt.finalize();
});

const seed = async () => {
  console.log('🌱 Seeding test snapshots into DuckDB...\n');

  // Ensure the snapshots table exists
  await new Promise((res, rej) => {
    con.run(`CREATE TABLE IF NOT EXISTS snapshots (
      url VARCHAR, product_name VARCHAR, price DOUBLE, currency VARCHAR,
      stock_status VARCHAR, reviews_count INTEGER, rating DOUBLE,
      platform VARCHAR, timestamp VARCHAR
    )`, (err) => err ? rej(err) : res());
  });

  for (const snap of snapshots) {
    await insertSnapshot(snap);
    console.log(`  ✅ Inserted: ${snap.product_name} (${snap.currency} ${snap.price})`);
  }

  console.log(`\n✅ Seeded ${snapshots.length} snapshots.`);
  console.log('\nNow run the opportunity engine:');
  console.log('  curl -X POST http://localhost:3000/opportunities/run');
  console.log('\nThen view the opportunities:');
  console.log('  http://localhost:3000/opportunities\n');

  con.close();
  db.close();
};

seed().catch(console.error);

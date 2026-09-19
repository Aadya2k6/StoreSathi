const { con } = require('../db');
const { v4: uuidv4 } = require('uuid');

// Parses "₹1,299", "Rs. 1299.50", "1,299/-" or a plain number into a float (0 if unparseable)
const parsePrice = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
  if (!value) return 0;
  const match = String(value).replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
};

const detectCurrency = (page) => {
  const text = `${page.price || ''} ${page.pageExcerpt || ''}`;
  if (/\$/.test(String(page.price || ''))) return '$';
  if (/₹|rs\.?\s*\d/i.test(text)) return '₹';
  return '₹';
};

const run = (sql, ...params) => new Promise((resolve, reject) => {
  con.run(sql, ...params, (err) => (err ? reject(err) : resolve()));
});

// Stores (or refreshes) the latest snapshot of a scraped page for a store.
// One row per (store, url) — the newest scrape replaces the previous one.
const saveSnapshot = async (storeId, page) => {
  const name = (page.name || '').trim();
  const price = parsePrice(page.price);
  const url = page.pageUrl || page.url;
  if (!storeId || !name || !url || price <= 0) return null;

  const reviewsMatch = page.reviewsSummary ? String(page.reviewsSummary).replace(/,/g, '').match(/\d+/) : null;
  const rating = page.rating != null && page.rating !== '' ? parseFloat(page.rating) : null;

  const snap = {
    id: uuidv4(),
    store_id: storeId,
    url,
    product_name: name,
    price,
    currency: detectCurrency(page),
    stock_status: page.stockStatus || null,
    rating: Number.isFinite(rating) ? rating : null,
    reviews_count: reviewsMatch ? parseInt(reviewsMatch[0], 10) : null,
    captured_at: new Date().toISOString()
  };

  await run('DELETE FROM snapshots WHERE store_id = ? AND url = ?', storeId, url);
  await run(
    'INSERT INTO snapshots (id, store_id, url, product_name, price, currency, stock_status, rating, reviews_count, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    snap.id, snap.store_id, snap.url, snap.product_name, snap.price, snap.currency,
    snap.stock_status, snap.rating, snap.reviews_count, snap.captured_at
  );
  return snap;
};

const getSnapshots = (storeId) => new Promise((resolve, reject) => {
  const sql = storeId ? 'SELECT * FROM snapshots WHERE store_id = ?' : 'SELECT * FROM snapshots';
  const cb = (err, rows) => (err ? reject(err) : resolve(rows || []));
  if (storeId) con.all(sql, storeId, cb);
  else con.all(sql, cb);
});

module.exports = { saveSnapshot, getSnapshots, parsePrice };

const { con } = require('../db');
const { v4: uuidv4 } = require('uuid');

// Market trend feed. Simulated for the demo (no live social-media API), each entry lists the words
// that make a web page relevant to it.
const TREND_FEED = [
  { keyword: 'Floral', category: 'Dresses', match: ['floral', 'dress', 'gown', 'maxi'], spike: '+350%', source: 'Instagram Fashion Trends' },
  { keyword: 'Bomber', category: 'Outerwear', match: ['bomber', 'jacket', 'coat', 'puffer', 'winter wear'], spike: '+180%', source: 'Google Search Trends (winter wear)' },
  { keyword: 'Co-ord', category: 'Sets', match: ['co-ord', 'coord', 'co ord', 'matching set'], spike: '+120%', source: 'Instagram Fashion Trends' },
];

const all = (sql, ...params) => new Promise((resolve, reject) => {
  con.all(sql, ...params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
});
const run = (sql, ...params) => new Promise((resolve, reject) => {
  con.run(sql, ...params, (err) => (err ? reject(err) : resolve()));
});

// Returns the trends that are relevant to the page being browsed, as recommendation objects.
// Used on websites that are NOT the merchant's own store — no inventory alerts, only new trends.
const findTrendsForPage = async (storeId, page) => {
  const haystack = `${page.name || ''} ${page.category || ''} ${page.pageUrl || ''} ${page.pageExcerpt || ''}`.toLowerCase();
  const relevant = TREND_FEED.filter(t => t.match.some(m => haystack.includes(m)));
  if (relevant.length === 0) return [];

  const products = await all('SELECT id, name, category, stock_quantity FROM products WHERE store_id = ?', storeId);
  const recs = [];

  for (const t of relevant) {
    // Prefer the product whose name carries the trend keyword, then any product in the trending category
    const stocked = products.find(p => p.name.toLowerCase().includes(t.keyword.toLowerCase())) ||
      products.find(p => p.category === t.category);

    const title = stocked
      ? `Trending Now: ${stocked.name} (${t.spike})`
      : `New Trend: ${t.keyword} ${t.category} (${t.spike})`;
    const description = stocked
      ? `${t.source} (simulated feed) shows ${t.spike} interest in ${t.keyword} items, and this page is covering it. You stock ${stocked.name} (${stocked.stock_quantity} units) — run a promotion.`
      : `${t.source} (simulated feed) shows ${t.spike} interest in ${t.keyword} ${t.category.toLowerCase()}, and this page is covering it. You don't stock this yet — consider adding it.`;

    const rec = {
      id: uuidv4(),
      store_id: storeId,
      type: stocked ? 'trend_promotion' : 'trend_insight',
      title,
      description,
      priority: stocked ? 'High' : 'Medium',
      evidence_data: JSON.stringify({
        source: 'trend_feed',
        priority: stocked ? 'High' : 'Medium',
        entity_id: stocked ? stocked.id : `trend:${t.keyword.toLowerCase()}`,
        page: page.pageUrl,
        action: stocked
          ? { kind: 'promo', product_id: stocked.id, product_name: stocked.name, label: 'TRENDING' }
          : undefined
      }),
      status: 'active',
      created_at: new Date().toISOString()
    };

    // One open card per trend: replace the previous one for this store
    await run("DELETE FROM recommendations WHERE store_id = ? AND status = 'active' AND title = ?", storeId, title);
    await run(
      'INSERT INTO recommendations (id, store_id, type, title, description, evidence_data, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      rec.id, rec.store_id, rec.type, rec.title, rec.description, rec.evidence_data, rec.status, rec.created_at
    );
    recs.push(rec);
  }
  return recs;
};

module.exports = { findTrendsForPage };

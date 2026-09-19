const { con } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { sendUrgentDigest } = require('./emailService');

const RESEND_AFTER_MS = 24 * 3600 * 1000; // an unresolved urgent alert is re-mailed at most once a day
const inFlight = new Set();               // stores currently being processed (page loads can fire in bursts)

const all = (sql, ...params) => new Promise((resolve, reject) => {
  con.all(sql, ...params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
});
const run = (sql, ...params) => new Promise((resolve, reject) => {
  con.run(sql, ...params, (err) => (err ? reject(err) : resolve()));
});

const parse = (json) => { try { return JSON.parse(json || '{}'); } catch (e) { return {}; } };

// Emails the merchant about every open URGENT recommendation that hasn't been mailed in the last 24h.
// Returns { found, emailed }.
const notifyUrgentAlerts = async (storeId) => {
  if (inFlight.has(storeId)) return { found: 0, emailed: 0, skipped: 'already running' };
  inFlight.add(storeId);
  try {
    const recs = await all("SELECT * FROM recommendations WHERE store_id = ? AND status = 'active'", storeId);
    const urgent = recs
      .map(r => ({ rec: r, ev: parse(r.evidence_data) }))
      .filter(({ rec, ev }) => (ev.priority || rec.priority) === 'Urgent');
    if (urgent.length === 0) return { found: 0, emailed: 0 };

    const cutoff = new Date(Date.now() - RESEND_AFTER_MS).toISOString();
    const already = new Set((await all('SELECT alert_key FROM alert_emails WHERE store_id = ? AND sent_at >= ?', storeId, cutoff)).map(r => r.alert_key));

    const seen = new Set();
    const fresh = [];
    for (const { rec, ev } of urgent) {
      const key = `${rec.type}|${ev.entity_id || rec.title}`;
      if (already.has(key) || seen.has(key)) continue;
      seen.add(key);
      fresh.push({ key, rec, ev });
    }
    if (fresh.length === 0) return { found: urgent.length, emailed: 0 };

    // Reserve the keys first so a concurrent run can't send the same alert twice
    const now = new Date().toISOString();
    for (const f of fresh) await run('INSERT INTO alert_emails (id, store_id, alert_key, sent_at) VALUES (?, ?, ?, ?)', uuidv4(), storeId, f.key, now);

    const [store] = await all('SELECT name FROM stores WHERE id = ?', storeId);
    const actionText = (ev) => {
      const a = ev.action;
      if (!a) return null;
      if (a.kind === 'restock') return `Restock +${a.add_qty} units of ${a.product_name}`;
      if (a.kind === 'price') return `Cut ${a.product_name} price by ${a.discount_pct}%`;
      return `Feature ${a.product_name} on your storefront`;
    };

    try {
      const info = await sendUrgentDigest(
        fresh.map(f => ({ title: f.rec.title, description: f.rec.description, action: actionText(f.ev) })),
        store ? store.name : storeId
      );
      if (!info) throw new Error('email not configured');
      return { found: urgent.length, emailed: fresh.length };
    } catch (err) {
      // Release the keys so the next run retries
      for (const f of fresh) await run('DELETE FROM alert_emails WHERE store_id = ? AND alert_key = ?', storeId, f.key);
      console.warn('[UrgentAlerts] Email failed:', err.message);
      return { found: urgent.length, emailed: 0, error: err.message };
    }
  } finally {
    inFlight.delete(storeId);
  }
};

module.exports = { notifyUrgentAlerts };

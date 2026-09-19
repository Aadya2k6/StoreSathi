const { con } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { processDrafts } = require('./draftingService');
const { getSnapshots } = require('../services/snapshotService');

// ─── Tier Decisions per Opportunity Type (architecture.md §5) ─────────────────
// Tier A: Draft & Guide — merchant manually applies the change (no store write-API)
// Tier B: Direct Execute — auto-apply (future, when store API is integrated)
const TIER = {
  underpriced: 'A',   // Guide merchant to raise the price
  response_gap: 'A',  // Guide merchant to respond to low-rated reviews
  'slow_moving': 'A',   // Guide merchant to discount/promote stuck inventory
  'low_stock': 'A',     // Guide merchant to restock or remove ads for low stock items
  'price_watch': 'A',   // General price intelligence for any product being tracked
};

// ─── Valid state machine transitions ─────────────────────────────────────────
const VALID_STATES = [
  'detected', 'drafted', 'sent_for_approval',
  'approved', 'rejected', 'executed', 'verified'
];

// ─── DB Helpers ────────────────────────────────────────────────────────────────
// Every check is scoped to the store so one merchant's alerts never suppress another's.
const opportunityExists = (storeId, url, type) => new Promise((resolve, reject) => {
  const stmt = con.prepare(`SELECT id FROM opportunities WHERE store_id = ? AND url = ? AND type = ? AND status NOT IN ('rejected', 'verified')`);
  stmt.all(storeId, url, type, (err, rows) => {
    if (err) reject(err);
    else resolve(rows.length > 0);
  });
  stmt.finalize();
});

const insertOpportunity = (opp) => new Promise((resolve, reject) => {
  const stmt = con.prepare(`
    INSERT INTO opportunities (id, store_id, type, product_name, url, status, tier, detected_at, details, notified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)
  `);

  stmt.run(
    opp.id,
    opp.store_id,
    opp.type,
    opp.product_name,
    opp.url,
    opp.status,
    opp.tier,
    opp.detected_at,
    opp.details,
    (err) => {
      if (err) reject(err);
      else resolve();
    }
  );
  stmt.finalize();
});

// ─── Rule 1: Underpriced Detection ────────────────────────────────────────────
// A product is flagged as underpriced if its price is more than 15% below
// the average price of comparable products (matched by first keyword in name).
// This signals the merchant is leaving money on the table.
const detectUnderpriced = async (snapshots) => {
  const created = [];

  for (const snap of snapshots) {
    if (!snap.price || snap.price <= 0) continue;

    const keyword = snap.product_name.split(/\s+/)[0].toLowerCase();
    const comparable = snapshots.filter(s =>
      s.url !== snap.url &&
      s.price > 0 &&
      s.product_name.toLowerCase().includes(keyword)
    );

    if (comparable.length < 1) continue;

    const avgPrice = comparable.reduce((sum, s) => sum + s.price, 0) / comparable.length;
    const priceDiffPct = ((avgPrice - snap.price) / avgPrice) * 100;

    if (priceDiffPct > 15) {
      const exists = await opportunityExists(snap.store_id, snap.url, 'underpriced');
      if (!exists) {
        created.push({
          id: uuidv4(),
          store_id: snap.store_id,
          type: 'underpriced',
          product_name: snap.product_name,
          url: snap.url,
          status: 'detected',
          tier: TIER.underpriced,
          detected_at: new Date().toISOString(),
          details: JSON.stringify({
            current_price: snap.price,
            avg_comparable_price: Math.round(avgPrice * 100) / 100,
            currency: snap.currency,
            price_gap_percent: Math.round(priceDiffPct * 10) / 10,
            comparable_count: comparable.length,
            suggestion: `Raise price by ~${Math.round(priceDiffPct)}% to match similar products`
          })
        });
      }
    }
  }
  return created;
};

// ─── Rule 2: Response Gap Detection ───────────────────────────────────────────
// A product is flagged if it has a low rating (< 3.5 stars), meaning
// customers are unhappy and the merchant should respond / take action.
const detectResponseGap = async (snapshots) => {
  const created = [];

  for (const snap of snapshots) {
    if (!snap.rating || snap.rating === 0) continue;
    if (snap.rating >= 3.5) continue;

    const exists = await opportunityExists(snap.store_id, snap.url, 'response_gap');
    if (!exists) {
      created.push({
        id: uuidv4(),
        store_id: snap.store_id,
        type: 'response_gap',
        product_name: snap.product_name,
        url: snap.url,
        status: 'detected',
        tier: TIER.response_gap,
        detected_at: new Date().toISOString(),
        details: JSON.stringify({
          rating: snap.rating,
          reviews_count: snap.reviews_count,
          suggestion: `Rating is ${snap.rating}/5 with ${snap.reviews_count} reviews. Respond to unhappy customers and consider a product improvement.`
        })
      });
    }
  }
  return created;
};

// ─── Rule 3: Slow-Moving Stock Detection ──────────────────────────────────────
// A product is flagged if it is in-stock but has very few reviews relative
// to its price — a signal that it is not converting (stuck inventory).
// Threshold: in_stock + fewer than 10 reviews + price > 20
const detectSlowMoving = async (snapshots) => {
  const created = [];

  for (const snap of snapshots) {
    // Accept any in-stock signal — 'in_stock', 'unknown', or anything truthy
    // (the extension often can't determine stock status on all sites)
    if (snap.stock_status && /out of stock|out_of_stock/i.test(snap.stock_status)) continue;
    if (snap.reviews_count == null) continue;       // No review data scraped — can't judge conversion
    if ((snap.reviews_count || 0) >= 200) continue; // Huge review count = clearly selling fine
    if (!snap.price || snap.price <= 5) continue;   // Skip trivially cheap items

    const exists = await opportunityExists(snap.store_id, snap.url, 'slow_moving');
    if (!exists) {
      created.push({
        id: uuidv4(),
        store_id: snap.store_id,
        type: 'slow_moving',
        product_name: snap.product_name,
        url: snap.url,
        status: 'detected',
        tier: TIER.slow_moving,
        detected_at: new Date().toISOString(),
        details: JSON.stringify({
          stock_status: snap.stock_status,
          reviews_count: snap.reviews_count || 0,
          price: snap.price,
          currency: snap.currency,
          suggestion: `Only ${snap.reviews_count || 0} reviews for a ${snap.currency} ${snap.price} item in stock. Consider a limited-time discount or bundle promotion.`
        })
      });
    }
  }
  return created;
};

// ─── Rule 3.5: Low Stock Detection ────────────────────────────────────────────
// A product is flagged if it has low stock (e.g., "only 3 left").
// The merchant is notified to restock or stop running ads on this product.
const detectLowStock = async (snapshots) => {
  const created = [];

  for (const snap of snapshots) {
    if (!snap.stock_status) continue;
    
    // Check if the stock status implies urgency or low quantity
    const isLowStock = /only|left|hurry|limited/i.test(snap.stock_status) || 
                       (snap.stock_status.match(/\d+/) && parseInt(snap.stock_status.match(/\d+/)[0]) <= 5);

    if (!isLowStock) continue;

    const exists = await opportunityExists(snap.store_id, snap.url, 'low_stock');
    if (!exists) {
      created.push({
        id: uuidv4(),
        store_id: snap.store_id,
        type: 'low_stock',
        product_name: snap.product_name,
        url: snap.url,
        status: 'detected',
        tier: TIER.low_stock,
        detected_at: new Date().toISOString(),
        details: JSON.stringify({
          stock_status: snap.stock_status,
          suggestion: `Product is running out of stock (${snap.stock_status}). Restock soon or pause advertising to avoid wasted ad spend.`
        })
      });
    }
  }
  return created;
};

// ─── Rule 4: Price Watch (Universal Fallback) ──────────────────────────────────
// This rule fires for EVERY newly ingested product we haven't seen before.
// It gives the merchant a general "you're being tracked" insight with a price
// positioning note — guaranteeing the sidebar always shows on real product pages.
const detectPriceWatch = async (snapshots) => {
  const created = [];

  for (const snap of snapshots) {
    if (!snap.price || snap.price <= 0 || !snap.product_name) continue;

    // Only fire if we have no other opportunity for this URL already
    const alreadyHasOpp = await new Promise((resolve, reject) => {
      const stmt = con.prepare(`SELECT id FROM opportunities WHERE store_id = ? AND url = ? AND type != 'price_watch' AND status NOT IN ('rejected','verified')`);
      stmt.all(snap.store_id, snap.url, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.length > 0);
      });
      stmt.finalize();
    });

    if (alreadyHasOpp) continue; // Another rule already flagged this — no need for generic watch

    const exists = await opportunityExists(snap.store_id, snap.url, 'price_watch');
    if (!exists) {
      created.push({
        id: uuidv4(),
        store_id: snap.store_id,
        type: 'price_watch',
        product_name: snap.product_name,
        url: snap.url,
        status: 'detected',
        tier: TIER.price_watch,
        detected_at: new Date().toISOString(),
        details: JSON.stringify({
          price: snap.price,
          currency: snap.currency,
          reviews_count: snap.reviews_count || 0,
          rating: snap.rating || 0,
          suggestion: `StoreSathi is now tracking ${snap.product_name} at ${snap.currency} ${snap.price}.`
        })
      });
    }
  }
  return created;
};

// ─── Engine Entry Point ────────────────────────────────────────────────────────
// Runs every rule against one store's snapshots (or every store's, when no storeId is given).
// Rules run in sequence and persist as they go, so price_watch can see what the other rules just created.
const runStoreRules = async (storeId, snapshots) => {
  const breakdown = { underpriced: 0, response_gap: 0, slow_moving: 0, low_stock: 0, price_watch: 0 };
  const rules = [
    ['underpriced', detectUnderpriced],
    ['response_gap', detectResponseGap],
    ['slow_moving', detectSlowMoving],
    ['low_stock', detectLowStock],
    ['price_watch', detectPriceWatch],
  ];

  for (const [name, detect] of rules) {
    const created = await detect(snapshots);
    for (const opp of created) await insertOpportunity(opp);
    breakdown[name] = created.length;
  }
  return breakdown;
};

const runEngine = async (storeId) => {
  const snapshots = await getSnapshots(storeId);

  if (snapshots.length === 0) {
    return {
      message: 'No snapshots to analyze. Visit some product pages with the extension first.',
      opportunities_created: 0
    };
  }

  const byStore = new Map();
  for (const snap of snapshots) {
    if (!byStore.has(snap.store_id)) byStore.set(snap.store_id, []);
    byStore.get(snap.store_id).push(snap);
  }

  const breakdown = { underpriced: 0, response_gap: 0, slow_moving: 0, low_stock: 0, price_watch: 0 };
  for (const [sid, snaps] of byStore) {
    const b = await runStoreRules(sid, snaps);
    for (const k of Object.keys(breakdown)) breakdown[k] += b[k];
  }

  // Generate plain-language drafts for all 'detected' opportunities
  const draftsCreated = await processDrafts();

  return {
    message: 'Engine run complete',
    snapshots_analyzed: snapshots.length,
    opportunities_created: Object.values(breakdown).reduce((a, b) => a + b, 0),
    drafts_created: draftsCreated,
    breakdown
  };
};

module.exports = { runEngine, VALID_STATES };

const { con } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { processDrafts } = require('./draftingService');

// ─── Tier Decisions per Opportunity Type (architecture.md §5) ─────────────────
// Tier A: Draft & Guide — merchant manually applies the change (no store write-API)
// Tier B: Direct Execute — auto-apply (future, when store API is integrated)
const TIER = {
  underpriced: 'A',   // Guide merchant to raise the price
  response_gap: 'A',  // Guide merchant to respond to low-rated reviews
  slow_moving: 'A',   // Guide merchant to discount/promote stuck inventory
  price_watch: 'A',   // General price intelligence for any product being tracked
};

// ─── Valid state machine transitions ─────────────────────────────────────────
const VALID_STATES = [
  'detected', 'drafted', 'sent_for_approval',
  'approved', 'rejected', 'executed', 'verified'
];

// ─── DB Helpers ────────────────────────────────────────────────────────────────
const getAllSnapshots = () => new Promise((resolve, reject) => {
  con.all('SELECT * FROM snapshots', (err, rows) => {
    if (err) return reject(err);
    resolve(rows || []);
  });
});

const opportunityExists = (url, type) => new Promise((resolve, reject) => {
  const stmt = con.prepare(`SELECT id FROM opportunities WHERE url = ? AND type = ? AND status NOT IN ('rejected', 'verified')`);
  stmt.all(url, type, (err, rows) => {
    if (err) reject(err);
    else resolve(rows.length > 0);
  });
  stmt.finalize();
});

const insertOpportunity = (opp) => new Promise((resolve, reject) => {
  const stmt = con.prepare(`
    INSERT INTO opportunities (id, type, product_name, url, status, tier, detected_at, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    opp.id, 
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
      const exists = await opportunityExists(snap.url, 'underpriced');
      if (!exists) {
        created.push({
          id: uuidv4(),
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

    const exists = await opportunityExists(snap.url, 'response_gap');
    if (!exists) {
      created.push({
        id: uuidv4(),
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
    if (snap.stock_status === 'out_of_stock') continue;
    if ((snap.reviews_count || 0) >= 200) continue; // Huge review count = clearly selling fine
    if (!snap.price || snap.price <= 5) continue;   // Skip trivially cheap items

    const exists = await opportunityExists(snap.url, 'slow_moving');
    if (!exists) {
      created.push({
        id: uuidv4(),
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
      const stmt = con.prepare(`SELECT id FROM opportunities WHERE url = ? AND type != 'price_watch' AND status NOT IN ('rejected','verified')`);
      stmt.all(snap.url, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.length > 0);
      });
      stmt.finalize();
    });

    if (alreadyHasOpp) continue; // Another rule already flagged this — no need for generic watch

    const exists = await opportunityExists(snap.url, 'price_watch');
    if (!exists) {
      created.push({
        id: uuidv4(),
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
const runEngine = async () => {
  const snapshots = await getAllSnapshots();

  if (snapshots.length === 0) {
    return {
      message: 'No snapshots to analyze. Visit some product pages with the extension first.',
      opportunities_created: 0
    };
  }

  // Run all rules in parallel
  const [underpriced, responseGap, slowMoving, priceWatch] = await Promise.all([
    detectUnderpriced(snapshots),
    detectResponseGap(snapshots),
    detectSlowMoving(snapshots),
    detectPriceWatch(snapshots),
  ]);

  const all = [...underpriced, ...responseGap, ...slowMoving, ...priceWatch];

  // Persist all new opportunities
  for (const opp of all) {
    await insertOpportunity(opp);
  }

  // Generate plain-language drafts for all 'detected' opportunities
  const draftsCreated = await processDrafts();

  return {
    message: 'Engine run complete',
    snapshots_analyzed: snapshots.length,
    opportunities_created: all.length,
    drafts_created: draftsCreated,
    breakdown: {
      underpriced: underpriced.length,
      response_gap: responseGap.length,
      slow_moving: slowMoving.length,
      price_watch: priceWatch.length,
    }
  };
};

module.exports = { runEngine, VALID_STATES };

const { con } = require('../db');

// ─── Drafting Service ────────────────────────────────────────────────────────
// Converts raw data into plain-language, non-technical explanations.
// Updates the opportunity's state from 'detected' to 'drafted'.

const generateDraft = (opp) => {
  let details = {};
  try {
    details = JSON.parse(opp.details);
  } catch (e) {
    console.error('Drafting service: Failed to parse details for', opp.id);
  }

  const draft = {
    headline: '',
    reason: '',
    action: ''
  };

  if (opp.type === 'underpriced') {
    draft.headline = `Price Optimization for ${opp.product_name}`;
    draft.reason = `Your item is currently priced at ${details.currency} ${details.current_price}. We analyzed ${details.comparable_count} similar products across the market and found the average price is ${details.currency} ${details.avg_comparable_price} (${details.price_gap_percent}% higher).`;
    draft.action = `Increase price by ${Math.round(details.price_gap_percent)}% to match market rates.`;
  } 
  
  else if (opp.type === 'response_gap') {
    draft.headline = `Customer Satisfaction Alert for ${opp.product_name}`;
    draft.reason = `This product currently has a low rating of ${details.rating}/5 from ${details.reviews_count} reviews. Unanswered negative reviews lower conversion rates by up to 30%.`;
    draft.action = `Draft a standardized response for unhappy customers and consider quality checks.`;
  } 
  
  else if (opp.type === 'slow_moving') {
    draft.headline = `Inventory Velocity Alert for ${opp.product_name}`;
    draft.reason = `This item is in stock but only has ${details.reviews_count} reviews, despite being a premium item (${details.currency} ${details.price}). This signals it is struggling to sell at full price.`;
    draft.action = `Run a limited-time 15% discount campaign to clear stale inventory.`;
  }

  else if (opp.type === 'low_stock') {
    draft.headline = `Low Stock Alert for ${opp.product_name}`;
    draft.reason = `The page shows "${details.stock_status}". Selling out unnoticed means lost sales and wasted ad spend.`;
    draft.action = `Restock ${opp.product_name} soon, or pause promotions on it until new stock arrives.`;
  }

  else if (opp.type === 'price_watch') {
    const ratingStr = details.rating > 0 ? ` It holds a ${details.rating}/5 rating with ${details.reviews_count} reviews.` : '';
    draft.headline = `Market Intelligence: ${opp.product_name}`;
    draft.reason = `StoreSathi is now tracking this product at ${details.currency} ${details.price}.${ratingStr} We will alert you if prices shift or a competitor undercuts this listing.`;
    draft.action = `No action needed right now. StoreSathi is watching this product for you.`;
  }

  return draft;
};

const processDrafts = () => new Promise((resolve, reject) => {
  con.all(`SELECT * FROM opportunities WHERE status = 'detected'`, async (err, rows) => {
    if (err) return reject(err);
    if (rows.length === 0) return resolve(0);

    let draftedCount = 0;
    const stmt = con.prepare('UPDATE opportunities SET details = ?, status = ? WHERE id = ?');

    for (const opp of rows) {
      const draft = generateDraft(opp);
      
      // Merge draft into existing details
      let details = {};
      try { details = JSON.parse(opp.details); } catch (e) {}
      
      details.draft = draft;

      await new Promise((res, rej) => {
        stmt.run(JSON.stringify(details), 'drafted', opp.id, (updateErr) => {
          if (updateErr) rej(updateErr);
          else res();
        });
      });
      draftedCount++;
    }

    stmt.finalize();
    resolve(draftedCount);
  });
});

module.exports = { processDrafts };

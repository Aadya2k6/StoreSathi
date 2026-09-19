const express = require('express');
const router = express.Router();
const rulesEngine = require('../engine/rulesEngine');
const { con } = require('../db');
const { saveSnapshot } = require('../services/snapshotService');
const { runEngine } = require('../engine/opportunityEngine');
const { notifyUrgentAlerts } = require('../services/urgentAlertService');

// GET /api/intelligence/run
// Manually triggers the rules engine (perfect for live demos)
router.get('/run', async (req, res) => {
  try {
    const result = await rulesEngine.runRules();
    notifyUrgentAlerts('store_1').catch(e => console.warn('Urgent alert mail failed:', e.message));
    res.json({ status: 'ok', message: 'Rules engine executed successfully', generated_count: result.count });
  } catch (error) {
    console.error('Rules Engine Error:', error);
    res.status(500).json({ error: 'Failed to run rules engine', details: error.message });
  }
});

// POST /api/intelligence/reset-demo
// Rehearsal helper: clears this store's alerts, action history, restock log, snapshots and
// opportunities so the golden path can be run again. Products are NOT touched — re-run
// "Approve & Feed to Portal" on the storefront to restore the page's prices/stock.
router.post('/reset-demo', async (req, res) => {
  try {
    const storeId = req.query.store_id || req.store_id || 'store_1';
    await dbRun('DELETE FROM actions WHERE recommendation_id IN (SELECT id FROM recommendations WHERE store_id = ?)', storeId);
    await dbRun('DELETE FROM recommendations WHERE store_id = ?', storeId);
    await dbRun("DELETE FROM inventory_movements WHERE store_id = ? AND reason = 'restock'", storeId);
    await dbRun('DELETE FROM snapshots WHERE store_id = ?', storeId);
    await dbRun('DELETE FROM alert_emails WHERE store_id = ?', storeId);
    await dbRun('DELETE FROM opportunities WHERE store_id = ?', storeId);
    res.json({ status: 'ok', message: `Demo state reset for ${storeId}. Re-run "Approve & Feed to Portal" to restore product prices/stock.` });
  } catch (error) {
    res.status(500).json({ error: 'Reset failed', details: error.message });
  }
});

// GET /api/intelligence/actions
// Fetches the history of approved actions for the Action History portal screen
router.get('/actions', (req, res) => {
  const storeId = req.query.store_id || req.store_id || 'store_1';
  
  const query = `
    SELECT a.*, r.title, r.description 
    FROM actions a
    JOIN recommendations r ON a.recommendation_id = r.id
    WHERE r.store_id = ?
    ORDER BY a.executed_at DESC
  `;

  con.all(query, storeId, (err, rows) => {
    if (err) {
      console.error('Fetch Actions Error:', err);
      return res.status(500).json({ error: 'Failed to fetch actions' });
    }
    res.json({ status: 'ok', data: rows });
  });
});

// GET /api/intelligence/recommendations
// Fetches the generated recommendations for the dashboard
router.get('/recommendations', (req, res) => {
  // Use the storeId from query param or auth context (fallback to store_1 for legacy support)
  const storeId = req.query.store_id || req.store_id || 'store_1';
  
  con.all("SELECT * FROM recommendations WHERE store_id = ? AND status = 'active' ORDER BY created_at DESC", storeId, (err, rows) => {
    if (err) {
      console.error('Database Error:', err);
      return res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
    const ordered = rulesEngine.prioritizeRecs(rows, 12);
    res.json({ status: 'ok', count: ordered.length, data: ordered });
  });
});

const { analyzeWithGemini } = require('../services/gemini');

// POST /api/intelligence/analyze-page
// Runs all 8 rules via Gemini AI against the scraped page + store context.
// Falls back to deterministic rules if Gemini key is not set.
router.post('/analyze-page', async (req, res) => {
  try {
    const scrapedPage = req.body || {};
    console.log(`Analyze-page: "${scrapedPage.name}" / ${scrapedPage.category}`);

    const storeId = req.query.store_id || req.body?.store_id || req.store_id || 'store_1';

    // 0. Record the scraped page as a snapshot and let the opportunity engine evaluate it
    //    (feeds the cron/email pipeline). Never let this break the analysis itself.
    try {
      await saveSnapshot(storeId, scrapedPage);
      await runEngine(storeId);
    } catch (snapErr) {
      console.warn('Snapshot/opportunity engine step failed:', snapErr.message);
    }

    // 1. Run deterministic rules engine for this store to refresh DB recs across all 8 rules
    await rulesEngine.runRules(storeId);

    // Automated mail for any new urgent alerts (non-blocking; failures are logged, never surfaced)
    notifyUrgentAlerts(storeId).catch(e => console.warn('Urgent alert mail failed:', e.message));

    // 2. Get all products and recommendations for store context
    const [allRecs, products] = await Promise.all([
      new Promise((resolve, reject) => {
        con.all("SELECT * FROM recommendations WHERE store_id = ? AND status = 'active' ORDER BY created_at DESC", storeId,
          (err, rows) => { if (err) return reject(err); resolve(rows || []); });
      }),
      new Promise((resolve, reject) => {
        con.all('SELECT id, name, category, price, stock_quantity FROM products WHERE store_id = ?', storeId,
          (err, rows) => { if (err) return reject(err); resolve(rows || []); });
      })
    ]);

    // 3. Build store context for Gemini
    const storeContext = {
      store_id: storeId,
      products: products,
      current_rule_alerts: allRecs.map(r => ({
        rule: r.type,
        title: r.title,
        priority: r.priority,
        description: r.description
      }))
    };

    // 4. Call Gemini for intelligent page-specific analysis
    let geminiRecs = [];
    try {
      geminiRecs = await analyzeWithGemini(scrapedPage, storeContext);
    } catch (geminiError) {
      console.warn('Gemini analysis failed:', geminiError.message);
      
      try {
        console.log('Attempting Groq Llama-3 fallback...');
        const { analyzeWithGroqFallback } = require('../services/groq');
        geminiRecs = await analyzeWithGroqFallback({ storeId, products, anomalies: allRecs }, scrapedPage);
      } catch (groqError) {
        console.warn('Groq analysis failed:', groqError.message);
      }
    }

    // 5. If AI returned results, combine them with top growth and urgent store alerts
    let finalRecs;
    if (geminiRecs.length > 0) {
      console.log(`Gemini returned ${geminiRecs.length} intelligent recommendations`);
      const growthDB = allRecs.filter(r => r.type === 'growth_opportunity' || (r.title && r.title.includes('Growth Opportunity'))).slice(0, 1);
      const urgentDB = allRecs.filter(r => r.priority === 'Urgent').slice(0, 1);
      finalRecs = [...geminiRecs, ...growthDB, ...urgentDB];
    } else {
      // Fallback: use deterministic rules across all 8 rules
      console.log('Using comprehensive deterministic rules engine results');
      const keywords = (scrapedPage.name || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
      
      const matchedRecs = allRecs.filter(rec => 
        keywords.some(kw => rec.title.toLowerCase().includes(kw) || (rec.description && rec.description.toLowerCase().includes(kw)))
      );

      const otherRecs = allRecs.filter(r => !matchedRecs.some(m => m.id === r.id));

      if (matchedRecs.length > 0 || otherRecs.length > 0) {
        finalRecs = rulesEngine.prioritizeRecs([...matchedRecs, ...otherRecs], 6);
      } else if ((scrapedPage.name || '').length > 3) {
        finalRecs = await rulesEngine.analyzeLiveProduct(scrapedPage, storeId);
      } else {
        finalRecs = rulesEngine.prioritizeRecs(allRecs, 6);
      }
    }

    // Deduplicate
    const seen = new Set();
    finalRecs = finalRecs.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });

    // Send automatic email if we generated live alerts (e.g. visited competitor)
    if (finalRecs.length > 0 && finalRecs.some(r => r.evidence_data && r.evidence_data.includes('live_rules'))) {
      const topAlert = finalRecs.find(r => r.evidence_data && r.evidence_data.includes('live_rules'));
      if (topAlert) {
        const { sendEmailAlert } = require('../services/emailService');
        sendEmailAlert(topAlert).catch(e => console.warn('Auto-email failed:', e.message));
      }
    }

    res.json({ status: 'ok', count: finalRecs.length, data: finalRecs, source: geminiRecs.length > 0 ? 'gemini' : 'deterministic' });

  } catch (error) {
    console.error('Analyze Page Error:', error);
    res.status(500).json({ error: 'Failed to analyze page', details: error.message });
  }
});


// POST /api/intelligence/recommendations/:id/approve
// Approves a recommendation, logs it to Action History, creates a Campaign if applicable, and sends an Email reminder
const { sendEmailAlert } = require('../services/emailService');
const { notifyMerchant } = require('../services/notificationService');
const { v4: uuidv4 } = require('uuid');

const dbAll = (sql, ...params) => new Promise((resolve, reject) => {
  con.all(sql, ...params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
});
const dbRun = (sql, ...params) => new Promise((resolve, reject) => {
  con.run(sql, ...params, (err) => (err ? reject(err) : resolve()));
});
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

// Executes the structured action stored on a recommendation against the real product row,
// and returns exactly what changed so the storefront can mirror it.
const applyRecommendationAction = async (rec, storeId) => {
  let ev = {};
  try { ev = JSON.parse(rec.evidence_data || '{}'); } catch (e) {}
  const a = ev.action;
  if (!a || !a.product_id) return null;

  const [p] = await dbAll('SELECT * FROM products WHERE id = ? AND store_id = ?', a.product_id, storeId);
  if (!p) return null;

  if (a.kind === 'restock') {
    const newStock = p.stock_quantity + a.add_qty;
    await dbRun('UPDATE products SET stock_quantity = ? WHERE id = ?', newStock, p.id);
    await require('../repositories/inventoryRepo').recordMovement({
      store_id: storeId, product_id: p.id, quantity_change: a.add_qty, reason: 'restock', reference_id: rec.id
    });
    return { kind: 'restock', product_id: p.id, product_name: p.name, old_stock: p.stock_quantity, new_stock: newStock, added: a.add_qty,
      summary: `${p.name}: stock ${p.stock_quantity} → ${newStock} units (+${a.add_qty})` };
  }
  if (a.kind === 'price') {
    const newPrice = Math.round(p.price * (1 - a.discount_pct / 100));
    await dbRun('UPDATE products SET price = ? WHERE id = ?', newPrice, p.id);
    return { kind: 'price', product_id: p.id, product_name: p.name, old_price: p.price, new_price: newPrice, discount_pct: a.discount_pct,
      summary: `${p.name}: price ${inr(p.price)} → ${inr(newPrice)} (${a.discount_pct}% off)` };
  }
  if (a.kind === 'promo') {
    return { kind: 'promo', product_id: p.id, product_name: p.name, label: a.label || 'FEATURED',
      summary: `${p.name} featured on the storefront` };
  }
  return null;
};

router.post('/recommendations/:id/approve', async (req, res) => {
  try {
    const recId = req.params.id;
    const storeId = req.query.store_id || req.store_id || 'store_1';

    // Fetch the REAL recommendation from DB
    const rec = await new Promise((resolve, reject) => {
      con.all('SELECT * FROM recommendations WHERE id = ?', recId, (err, rows) => {
        if (err) return reject(err);
        resolve(rows && rows[0] ? rows[0] : { id: recId, title: 'Live AI Alert', description: 'Real-time alert executed.' });
      });
    });

    // Already executed? Don't apply the price/stock change twice (double click, retry).
    if (rec.status === 'approved') {
      return res.json({ status: 'ok', message: 'This action was already approved and applied.', rec_title: rec.title, alreadyApproved: true, applied: null });
    }

    // Execute the change on the real product (price cut / restock) before logging it
    let applied = null;
    if (rec.store_id) {
      try { applied = await applyRecommendationAction(rec, storeId); }
      catch (applyErr) { console.warn('Failed to apply action to product:', applyErr.message); }
    }

    // 1. Log to actions table
    const actionId = uuidv4();
    
    // If this is a live rule, we must insert it into recommendations first so the JOIN works!
    if (rec.evidence_data && rec.evidence_data.includes('live_rules')) {
      await new Promise((resolve) => {
        con.run(
          'INSERT OR IGNORE INTO recommendations (id, store_id, type, title, description, evidence_data, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          rec.id, storeId, rec.type, rec.title, rec.description, rec.evidence_data, 'approved', new Date().toISOString(),
          () => resolve()
        );
      });
    } else {
      // Mark as approved in recommendations table
      await new Promise((resolve) => {
        con.run('UPDATE recommendations SET status = ? WHERE id = ?', 'approved', rec.id, () => resolve());
      });
    }

    await new Promise((resolve, reject) => {
      con.run(
        `INSERT INTO actions (id, recommendation_id, type, payload, status, executed_at) VALUES (?, ?, ?, ?, ?, ?)`,
        actionId, rec.id, rec.type || 'promotion', JSON.stringify({ storeId, applied }), 'Completed', new Date().toISOString(),
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    // 1.5 Auto-Ingest Product Data if it exists
    let ingested = false;
    if (rec.evidence_data) {
      try {
        const ev = JSON.parse(rec.evidence_data);
        if (ev.scraped_product && ev.scraped_product.name) {
          const sp = ev.scraped_product;
          const newProdId = `prod_${Date.now()}`;
          const prodPrice = sp.price || 0;
          await new Promise((resolve, reject) => {
            con.run(
              'INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              newProdId, storeId, sp.name, sp.category || 'Apparel', prodPrice, prodPrice * 0.6, 50, new Date().toISOString(),
              (err) => {
                if (err) return reject(err);
                resolve();
              }
            );
          });
          ingested = true;
        }
      } catch (e) {
        console.warn('Failed to parse evidence data for ingestion:', e.message);
      }
    }

    // 2. Auto-Create Campaign in Portal if this recommendation recommends a WhatsApp or promotional campaign
    const isCampaignAction = 
      rec.type === 'growth_opportunity' || 
      rec.type === 'trend_promotion' || 
      (rec.description && (rec.description.toLowerCase().includes('whatsapp') || rec.description.toLowerCase().includes('campaign'))) ||
      (rec.title && (rec.title.toLowerCase().includes('growth opportunity') || rec.title.toLowerCase().includes('demand spike')));

    let campaignCreated = false;
    if (isCampaignAction) {
      try {
        const { saveCampaign } = require('../services/campaignService');
        const prodName = rec.title.replace(/^(Growth Opportunity:\s*|Demand Spike:\s*)/i, '');
        const campaignObj = {
          id: uuidv4(),
          title: `WhatsApp Campaign: ${prodName}`,
          occasion: 'Growth Opportunity',
          discount_pct: 10,
          copy_text: `*Exclusive VIP Privilege* 🛍️\nHello {customer_name}! Special WhatsApp preview: Discover our high-demand ${prodName}.\n\nEnjoy an exclusive *Flat 10% OFF* voucher today with code *GROW10*. Limited stock available! ✨`,
          banner_style: 'loyalty',
          audience_tier: 'VIP Regular',
          recipients_count: 45,
          status: 'sent'
        };
        await saveCampaign(campaignObj);
        campaignCreated = true;
        console.log(`✅ Campaign auto-created in portal for approved action: "${campaignObj.title}"`);
      } catch (campErr) {
        console.warn('Failed to auto-create campaign:', campErr.message);
      }
    }

    let actionTriggered = 'none';
    try {
      const n = await notifyMerchant({
        title: `Action approved: ${rec.title}`,
        body: applied ? applied.summary : (rec.description || 'Your StoreSathi action has been executed.')
      });
      const channels = ['whatsapp', 'sms', 'email'].filter(c => n[c] === 'sent');
      actionTriggered = channels.length ? channels.join(' + ') : 'database_only (no channel delivered)';
    } catch (notifyError) {
      console.warn('Notification failed:', notifyError.message);
      actionTriggered = 'database_only (notify_failed)';
    }

    let msg = applied ? `Applied: ${applied.summary}.` : `Action approved & logged.`;
    if (campaignCreated) msg += ` WhatsApp Campaign generated & saved to portal.`;
    if (ingested) msg += ` Product auto-ingested into inventory.`;
    msg += ` Notification via ${actionTriggered}.`;

    res.json({ status: 'ok', message: msg, rec_title: rec.title, campaignCreated, applied });
  } catch (error) {
    console.error('Approve Action Error:', error);
    res.status(500).json({ error: 'Failed to execute action', details: error.message });
  }
});

// GET /api/copilot/history
// Returns chat history for the copilot
router.get('/copilot/history', (req, res) => {
  const storeId = req.query.store_id || req.store_id || 'store_1';
  const stmt = con.prepare('SELECT * FROM chat_messages WHERE store_id = ? ORDER BY created_at ASC');
  stmt.all(storeId, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch history', details: err.message });
    res.json(rows || []);
  });
  stmt.finalize();
});

// GET /api/intelligence/stats
// Provides real-time store metrics for the overview dashboard
router.get('/stats', (req, res) => {
  const storeId = req.query.store_id || req.store_id || 'store_1';
  
  const query = `
    SELECT 
      (SELECT COUNT(*) FROM products WHERE store_id = ?) as totalProducts,
      (SELECT COUNT(*) FROM recommendations WHERE store_id = ?) as totalOpportunities,
      (SELECT COUNT(*) FROM actions) as activeAlerts
  `;

  con.all(query, storeId, storeId, (err, rows) => {
    if (err) {
      console.error('Stats query error:', err);
      return res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
    }
    const row = (rows && rows[0]) ? rows[0] : {};
    res.json({
      status: 'ok',
      data: {
        totalProducts: Number(row.totalProducts) || 0,
        totalOpportunities: Number(row.totalOpportunities) || 0,
        activeAlerts: Number(row.activeAlerts) || 0
      }
    });
  });
});

// POST /api/copilot/chat
// Powers the AI Copilot widget in the portal
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { askCopilotGroq } = require('../services/groq');

router.post('/copilot/chat', async (req, res) => {
  try {
    const storeId = req.query.store_id || req.store_id || 'store_1';
    const { message } = req.body;
    
    if (!message) return res.status(400).json({ error: 'Message is required' });

    // Save user message to DB
    const timestamp = new Date().toISOString();
    con.run('INSERT INTO chat_messages (id, store_id, role, content, source, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), storeId, 'user', message, 'user', timestamp]);

    // Gather Context
    const [products, anomalies] = await Promise.all([
      new Promise((resolve, reject) => con.all('SELECT * FROM products WHERE store_id = ?', storeId, (err, rows) => err ? reject(err) : resolve(rows))),
      new Promise((resolve, reject) => con.all("SELECT * FROM recommendations WHERE store_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 5", storeId, (err, rows) => err ? reject(err) : resolve(rows)))
    ]);
    const storeContext = { storeId, products, anomalies };

    // Function to save assistant reply to DB
    const saveReply = (reply, source) => {
      con.run('INSERT INTO chat_messages (id, store_id, role, content, source, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), storeId, 'assistant', reply, source, new Date().toISOString()]);
    };

    // Try Gemini First
    try {
      if (!process.env.GEMINI_API_KEY) throw new Error('No Gemini Key');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      
      const prompt = `You are the StoreSathi AI Copilot. Use this context to answer the merchant's question directly.
Context:
Products: ${products.map(p => `- ${p.name}: ${p.stock_quantity} in stock (₹${p.price})`).join('\n')}
Recent Alerts: ${anomalies.map(a => `- ${a.title}`).join('\n')}

Question: ${message}`;
      
      const result = await model.generateContent(prompt);
      const reply = result.response.text();
      saveReply(reply, 'gemini');
      return res.json({ status: 'ok', reply, source: 'gemini' });
    } catch (geminiError) {
      console.warn('Gemini failed for Copilot, falling back to Groq Llama-3:', geminiError.message);
      
      // Fallback to Groq
      const reply = await askCopilotGroq(storeContext, message);
      saveReply(reply, 'groq_llama3');
      return res.json({ status: 'ok', reply, source: 'groq_llama3' });
    }

  } catch (error) {
    console.error('Copilot Chat Error:', error);
    res.status(500).json({ error: 'Failed to process chat', details: error.message });
  }
});

module.exports = router;

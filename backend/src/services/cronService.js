const { con } = require('../db');
const { runEngine } = require('../engine/opportunityEngine');
const { notifyMerchant } = require('./notificationService');
const rulesEngine = require('../engine/rulesEngine');
const { notifyUrgentAlerts } = require('./urgentAlertService');

const sendNotification = async (opp) => {
  let draft = {};
  try { draft = JSON.parse(opp.details).draft || {}; } catch (e) {}
  console.log(`[Notification] Alert for ${opp.type} on ${opp.product_name}`);
  return notifyMerchant({
    title: draft.headline || `StoreSathi Alert: ${opp.type.replace('_', ' ')}`,
    body: [draft.reason, draft.action].filter(Boolean).join(' ') || `Check ${opp.product_name} in the StoreSathi portal.`
  });
};

const allRows = (sql, ...params) => new Promise((resolve, reject) => {
  con.all(sql, ...params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
});

const runCronJob = async () => {
  console.log('[CRON] Starting periodic opportunity engine run...');
  const summary = { detected: 0, emailed: 0, skipped: 0 };
  try {
    // 1. Run the engine to detect any new alerts
    const engineResult = await runEngine();
    summary.detected = engineResult.opportunities_created || 0;

    // 1b. Refresh inventory rules for every store and mail any new URGENT alerts
    summary.urgentEmailed = 0;
    const stores = await allRows('SELECT DISTINCT store_id FROM products');
    for (const { store_id } of stores) {
      try {
        await rulesEngine.runRules(store_id);
        const r = await notifyUrgentAlerts(store_id);
        summary.urgentEmailed += r.emailed || 0;
      } catch (e) {
        console.warn(`[CRON] Rules/urgent mail failed for ${store_id}:`, e.message);
      }
    }

    // 2. Find any alerts that haven't been notified yet
    const rows = await allRows('SELECT * FROM opportunities WHERE notified = FALSE');
    if (rows.length === 0) {
      console.log('[CRON] No new alerts to notify.');
      return summary;
    }

    console.log(`[CRON] Found ${rows.length} new alerts. Sending notifications...`);
    for (const opp of rows) {
      const users = await allRows('SELECT email FROM users WHERE store_id = ? LIMIT 1', opp.store_id || 'store_1');
      const userEmail = users[0] ? users[0].email : 'demo@storesathi.com';

      // Only email critical opportunities (stock problems / urgent)
      const isCritical = ['stockout_risk', 'critical_low_stock', 'low_stock'].includes(opp.type) ||
        (opp.details && opp.details.toLowerCase().includes('urgent'));
      if (isCritical) {
        const n = await sendNotification(opp);
        if (n.delivered) summary.emailed++; else summary.failed = (summary.failed || 0) + 1;
      } else {
        console.log(`[CRON] Skipping non-critical alert email for: ${opp.type} on ${opp.product_name}`);
        summary.skipped++;
      }

      // Mark as notified so we don't process it again
      await new Promise((resolve) => con.run('UPDATE opportunities SET notified = TRUE WHERE id = ?', opp.id, () => resolve()));
    }
    console.log('[CRON] Finished processing notifications.', summary);
  } catch (err) {
    console.error('[CRON] Engine run failed', err);
    summary.error = err.message;
  }
  return summary;
};

// Start periodic job (e.g., every 1 hour).
// For the hackathon demo, we also export it to trigger manually via API.
const startPeriodicCron = () => {
  // Runs every hour
  setInterval(runCronJob, 60 * 60 * 1000);
  console.log('StoreSathi automated notification CRON initialized.');
};

module.exports = { startPeriodicCron, runCronJob };

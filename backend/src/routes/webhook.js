const express = require('express');
const router = express.Router();
const { con } = require('../db');
const axios = require('axios');

const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'storesathi_secret';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// ─── Verification endpoint (Meta calls this on setup) ───────────────────────
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook: Verified securely by Meta.');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ─── Incoming Webhook (Button taps) ─────────────────────────────────────────
router.post('/', async (req, res) => {
  // Always acknowledge immediately (Meta requirement)
  res.sendStatus(200);

  try {
    const body = req.body;
    
    // Check if it's a WhatsApp API message event
    if (body.object !== 'whatsapp_business_account') return;
    
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    
    // Check if we received a message
    if (value?.messages && value.messages.length > 0) {
      const message = value.messages[0];
      const senderPhone = message.from; // We need this to reply
      
      // We only care about interactive button replies
      if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
        const buttonId = message.interactive.button_reply.id;
        
        console.log(`Webhook: Received button tap - ${buttonId}`);
        await handleButtonTap(buttonId, senderPhone);
      }
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
  }
});

// ─── Business Logic for Button Taps ──────────────────────────────────────────
async function handleButtonTap(buttonId, senderPhone) {
  // buttonId format: "approve_1234-uuid-5678" or "reject_1234-uuid-5678"
  const [action, ...idParts] = buttonId.split('_');
  const opportunityId = idParts.join('_');

  if (!['approve', 'reject'].includes(action)) return;

  // 1. Fetch the opportunity to check idempotency and current state
  const opp = await new Promise((resolve, reject) => {
    const stmt = con.prepare('SELECT * FROM opportunities WHERE id = ?');
    stmt.all(opportunityId, (err, rows) => {
      if (err) reject(err);
      else resolve(rows[0]);
    });
    stmt.finalize();
  });

  if (!opp) {
    console.log(`Webhook: Opportunity ${opportunityId} not found.`);
    return;
  }

  if (opp.status === 'approved' || opp.status === 'rejected' || opp.status === 'executed') {
    console.log(`Webhook: Action already taken on ${opportunityId} (current status: ${opp.status}). Ignoring.`);
    // Optionally send "Already handled" msg here
    return;
  }

  // 2. Update state in DB
  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  await new Promise((resolve, reject) => {
    const stmt = con.prepare('UPDATE opportunities SET status = ? WHERE id = ?');
    stmt.run(newStatus, opportunityId, (err) => {
      if (err) reject(err);
      else resolve();
    });
    stmt.finalize();
  });

  console.log(`Webhook: Opportunity ${opportunityId} moved to ${newStatus}`);

  // 3. Send confirmation back to merchant
  const confirmationText = newStatus === 'approved' 
    ? `✅ Action Approved! We are executing the update for *${opp.product_name}*.`
    : `❌ Action Rejected for *${opp.product_name}*. We will ignore this suggestion.`;

  await sendTextReply(senderPhone, confirmationText);
}

// Helper to send a simple text reply
async function sendTextReply(toPhone, text) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) return;

  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: toPhone,
        text: { body: text }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Failed to send confirmation reply:', error.response?.data || error.message);
  }
}

module.exports = router;

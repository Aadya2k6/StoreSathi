const axios = require('axios');
const { con } = require('../db');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const RECIPIENT_PHONE = process.env.RECIPIENT_PHONE;

// ─── WhatsApp Outbound Service ───────────────────────────────────────────────

const sendOpportunityAlert = async (opportunity) => {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID || !RECIPIENT_PHONE) {
    throw new Error('Missing WhatsApp environment variables (WHATSAPP_TOKEN, PHONE_NUMBER_ID, RECIPIENT_PHONE)');
  }

  let details = {};
  try {
    details = JSON.parse(opportunity.details);
  } catch (e) {
    throw new Error('Invalid opportunity details format');
  }

  const draft = details.draft;
  if (!draft) {
    throw new Error('Opportunity has no draft. Cannot send empty message.');
  }

  // Construct the interactive message payload with Reply Buttons
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: RECIPIENT_PHONE,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: `*${draft.headline}*\n\n${draft.reason}\n\n*Action:* ${draft.action}`
      },
      footer: {
        text: "StoreSathi Command Center"
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: `approve_${opportunity.id}`,
              title: "✅ Approve"
            }
          },
          {
            type: "reply",
            reply: {
              id: `reject_${opportunity.id}`,
              title: "❌ Reject"
            }
          }
        ]
      }
    }
  };

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const wamid = response.data.messages?.[0]?.id;
    console.log(`WhatsApp: Sent interactive alert for ${opportunity.id} (wamid: ${wamid})`);

    // Update the opportunity state to 'sent_for_approval' and save wamid
    details.wamid = wamid;
    
    await new Promise((resolve, reject) => {
      const stmt = con.prepare('UPDATE opportunities SET status = ?, details = ? WHERE id = ?');
      stmt.run('sent_for_approval', JSON.stringify(details), opportunity.id, (err) => {
        if (err) reject(err);
        else resolve();
      });
      stmt.finalize();
    });

    return { ok: true, wamid };
  } catch (error) {
    console.error('WhatsApp API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Failed to send WhatsApp message');
  }
};

module.exports = { sendOpportunityAlert };

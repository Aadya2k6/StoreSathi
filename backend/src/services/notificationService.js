const axios = require('axios');
const { sendSMS } = require('./sms');
const { sendEmailAlert } = require('./emailService');

// Sends a free-text WhatsApp message to the merchant. Returns { ok, error }.
// NOTE: Meta test numbers only deliver free text inside a 24h window opened by the
// recipient messaging the business number first, and the access token expires every 24h.
const sendWhatsAppText = async (text) => {
  const { WHATSAPP_TOKEN, PHONE_NUMBER_ID, RECIPIENT_PHONE } = process.env;
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID || !RECIPIENT_PHONE) {
    return { ok: false, error: 'WhatsApp env vars missing' };
  }
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: 'whatsapp', recipient_type: 'individual', to: RECIPIENT_PHONE, type: 'text', text: { body: text } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }, timeout: 8000 }
    );
    return { ok: true, id: res.data.messages?.[0]?.id };
  } catch (err) {
    const e = err.response?.data?.error;
    return {
      ok: false,
      error: e?.code === 190 ? 'token expired — regenerate WHATSAPP_TOKEN in Meta dashboard' : (e?.message || err.message)
    };
  }
};

// Tries WhatsApp, SMS (Twilio) and email, and reports what was REALLY delivered per channel.
const notifyMerchant = async ({ title, body, email = true }) => {
  const text = `*${title}*\n${body}`.slice(0, 900);
  const result = {};

  const wa = await sendWhatsAppText(text);
  result.whatsapp = wa.ok ? 'sent' : `failed: ${wa.error}`;

  try {
    const sms = await sendSMS(`${title}: ${body}`.slice(0, 300));
    result.sms = sms.mock ? 'not delivered (Twilio unavailable/mock)' : 'sent';
  } catch (e) {
    result.sms = `failed: ${e.message}`;
  }

  if (email) {
    try {
      const info = await sendEmailAlert({ title, description: body }, true);
      result.email = info ? 'sent' : 'skipped (email not configured)';
    } catch (e) {
      result.email = `failed: ${e.message}`;
    }
  }

  result.delivered = Object.values(result).some(v => v === 'sent');
  console.log('[Notify]', title, JSON.stringify(result));
  return result;
};

module.exports = { notifyMerchant, sendWhatsAppText };

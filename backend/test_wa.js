require('dotenv').config();
const axios = require('axios');

async function test() {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
  const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
  const RECIPIENT_PHONE = process.env.RECIPIENT_PHONE;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: RECIPIENT_PHONE,
    type: "text",
    text: {
      preview_url: true,
      body: 'Test message'
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
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

test();

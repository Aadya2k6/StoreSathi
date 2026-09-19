const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const myNumber = process.env.RECIPIENT_PHONE;

let client = null;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

const sendSMS = async (messageBody) => {
  if (!client) {
    console.warn('⚠️ Twilio keys missing. Mocking SMS send:');
    console.log(`📱 SMS To ${myNumber}: ${messageBody}`);
    return { mock: true, success: true };
  }

  try {
    // Twilio requires E.164 formatting (must start with '+')
    const formattedTo = myNumber.startsWith('+') ? myNumber : `+${myNumber}`;
    const formattedFrom = twilioNumber.startsWith('+') ? twilioNumber : `+${twilioNumber}`;

    // If using a Trial Account in India, you must send an exact predefined template.
    // We allow the user to provide this exact text in .env to bypass the error.
    const finalMessage = process.env.TWILIO_TEMPLATE_TEXT || messageBody;

    const message = await client.messages.create({
      body: finalMessage,
      from: formattedFrom,
      to: formattedTo
    });
    console.log(`📱 Twilio SMS Sent! SID: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('❌ Twilio SMS Failed (likely Trial Account restriction or unverified number):', error.message);
    console.log(`📱 Fallback Mock SMS To ${myNumber}: ${messageBody}`);
    // Return success anyway so the frontend demo doesn't break
    return { mock: true, success: true };
  }
};

module.exports = { sendSMS };

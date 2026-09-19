const nodemailer = require('nodemailer');

// Ensure you configure these in .env (e.g. your free Gmail app password)
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = process.env.EMAIL_TO || EMAIL_USER; 

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

async function sendEmailAlert(alertContent, force = false) {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn('⚠️ EMAIL_USER or EMAIL_PASS not set in .env — skipping Email Notification');
    return;
  }

  // Only notify via email for HIGH, CRITICAL, or URGENT alerts
  let priority = (alertContent.priority || '').toLowerCase();
  if (!priority && alertContent.evidence_data) {
    try {
      const ev = typeof alertContent.evidence_data === 'string' ? JSON.parse(alertContent.evidence_data) : alertContent.evidence_data;
      if (ev && ev.priority) priority = ev.priority.toLowerCase();
    } catch(e) {}
  }

  const isHighPriority = force || 
    priority === 'high' || 
    priority === 'urgent' || 
    priority === 'critical';

  if (!isHighPriority) {
    console.log(`[Email] Skipping email notification for non-high priority alert: "${alertContent.title}" (${priority || 'normal'})`);
    return;
  }

  const mailOptions = {
    from: `"StoreSathi Copilot" <${EMAIL_USER}>`,
    to: EMAIL_TO,
    subject: `StoreSathi Alert: ${alertContent.title}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px; background-color: #f3f4f6; color: #1f2937;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #6d28d9; margin: 0; font-size: 24px;">✨ StoreSathi Action Required</h1>
          </div>
          
          <div style="background-color: #f9fafb; border-left: 4px solid #7c3aed; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
            <h2 style="margin-top: 0; font-size: 18px; color: #111827;">${alertContent.title}</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 0;">
              ${alertContent.description}
            </p>
          </div>
          
          <div style="text-align: center;">
            <a href="http://localhost:5173/actions" style="display: inline-block; background-color: #7c3aed; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 16px;">
              View in Action History Dashboard
            </a>
          </div>
          
          <p style="text-align: center; color: #9ca3af; font-size: 14px; margin-top: 30px;">
            This is an automated reminder from your StoreSathi AI Copilot.
          </p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email notification sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Error sending Email:', error);
    throw error;
  }
}

const escapeHtml = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// One email listing every new URGENT alert for a store, with the concrete action StoreSathi will apply on approval.
// alerts: [{ title, description, action: { summary } | null }]
async function sendUrgentDigest(alerts, storeName = 'your store') {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn('⚠️ EMAIL_USER or EMAIL_PASS not set in .env — skipping urgent alert email');
    return null;
  }
  if (!alerts || alerts.length === 0) return null;

  const items = alerts.map(a => `
    <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:14px 16px;border-radius:6px;margin-bottom:12px;">
      <div style="font-size:16px;font-weight:700;color:#7f1d1d;">${escapeHtml(a.title)}</div>
      <div style="font-size:14px;color:#4b5563;margin-top:6px;line-height:1.5;">${escapeHtml(a.description)}</div>
      ${a.action ? `<div style="font-size:13px;color:#065f46;margin-top:8px;"><strong>On approval:</strong> ${escapeHtml(a.action)}</div>` : ''}
    </div>`).join('');

  const info = await transporter.sendMail({
    from: `"StoreSathi Copilot" <${EMAIL_USER}>`,
    to: EMAIL_TO,
    subject: `🚨 ${alerts.length} urgent alert${alerts.length > 1 ? 's' : ''} for ${storeName} — action needed`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;padding:20px;background:#f3f4f6;">
        <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;">
          <h1 style="margin:0 0 6px;font-size:22px;color:#b91c1c;">🚨 Urgent StoreSathi alerts</h1>
          <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">${alerts.length} urgent item${alerts.length > 1 ? 's need' : ' needs'} your attention for <strong>${escapeHtml(storeName)}</strong>.</p>
          ${items}
          <div style="text-align:center;margin-top:24px;">
            <a href="http://localhost:5173/opportunities" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;">Review &amp; approve in StoreSathi</a>
          </div>
          <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:24px;">Automated alert from your StoreSathi AI Copilot.</p>
        </div>
      </div>`
  });
  console.log('✅ Urgent alert email sent:', info.messageId);
  return info;
}

module.exports = { sendEmailAlert, sendUrgentDigest };

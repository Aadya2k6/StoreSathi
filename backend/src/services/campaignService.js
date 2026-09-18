const { v4: uuidv4 } = require('uuid');
const { con } = require('../db');

// --- Loyalty Engine (Data Access) ---
const getAudienceMetrics = () => new Promise((resolve, reject) => {
  con.all('SELECT * FROM customers', (err, rows) => {
    if (err) return reject(err);
    if (!rows) rows = [];

    const totalCustomers = rows.length;
    const vipRegulars = rows.filter(r => r.loyalty_tier === 'VIP Regular').length;
    const regulars = rows.filter(r => r.loyalty_tier === 'Regular').length;
    const occasional = rows.filter(r => r.loyalty_tier === 'Occasional').length;
    const totalSpent = rows.reduce((sum, r) => sum + r.total_spent, 0);
    const avgTicketSize = totalCustomers > 0 ? (totalSpent / totalCustomers).toFixed(2) : 0;

    resolve({
      total_customers: totalCustomers,
      audience_tiers: {
        'VIP Regular': vipRegulars,
        'Regular': regulars,
        'Occasional': occasional
      },
      avg_ticket_size: avgTicketSize,
      total_tracked_spend: totalSpent
    });
  });
});

const getCustomersByTier = (tierFilter) => new Promise((resolve, reject) => {
  let query = 'SELECT * FROM customers';
  let params = [];

  if (tierFilter && tierFilter !== 'All') {
    if (tierFilter === 'Regular') {
      // Include both VIP and Regular
      query += ` WHERE loyalty_tier IN ('VIP Regular', 'Regular')`;
    } else {
      query += ` WHERE loyalty_tier = ?`;
      params.push(tierFilter);
    }
  }

  const stmt = con.prepare(query);
  stmt.all(...params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows || []);
  });
  stmt.finalize();
});

// --- AI Marketing Copy Generator ---
const generateCampaign = (occasion, discountPct, storeName = 'Your Local Store') => {
  let headline = '';
  let copyText = '';
  let bannerStyle = '';

  const discount = discountPct ? `${discountPct}%` : 'Special';

  switch(occasion?.toLowerCase()) {
    case 'diwali festive dhamaka':
    case 'diwali':
      headline = '🪔 Diwali Festive Dhamaka!';
      copyText = `*${headline}*\n\nHello {customer_name}! 🌟\nCelebrate the festival of lights with ${storeName}. As a token of our appreciation for being a loyal Paytm customer, we are gifting you *Flat ${discount} OFF* on your next purchase!\n\n🛒 Show this message at the counter or use code *DIWALI${discountPct || 10}* online.\n\nWishing you a bright and prosperous Diwali! ✨`;
      bannerStyle = 'diwali';
      break;

    case 'weekend kirana rush':
    case 'weekend':
      headline = '⚡ Weekend Fresh Stock Arrival!';
      copyText = `*${headline}*\n\nHi {customer_name},\nStock up for the weekend! ${storeName} has fresh arrivals across dairy, pulses, and essentials.\n\nEnjoy an exclusive *${discount} OFF* this Saturday & Sunday. 🛍️\n\nTap below to check what's new!`;
      bannerStyle = 'weekend';
      break;

    case 'stale stock clearance':
    case 'clearance':
      headline = '🏷️ Mega Clearance Sale';
      copyText = `*${headline}*\n\nHey {customer_name}! Unbelievable prices at ${storeName} today.\n\nGrab your favorites before they run out with *${discount} OFF* on our clearance section. 🏃‍♂️💨\n\nHurry, offer valid only while stocks last!`;
      bannerStyle = 'clearance';
      break;

    case 'paytm vip loyalty reward':
    case 'loyalty':
    default:
      headline = '🎁 Exclusive VIP Reward for You';
      copyText = `*${headline}*\n\nHi {customer_name}, we noticed you've been shopping with us regularly via Paytm. Thank you for your continued support! ❤️\n\nTo show our gratitude, here is a special *${discount} OFF* voucher just for you.\n\nSee you soon at ${storeName}!`;
      bannerStyle = 'loyalty';
      break;
  }

  return {
    id: uuidv4(),
    title: headline,
    occasion: occasion || 'VIP Reward',
    discount_pct: discountPct || 0,
    copy_text: copyText,
    banner_style: bannerStyle,
  };
};

const saveCampaign = (campaign) => new Promise((resolve, reject) => {
  const stmt = con.prepare(`
    INSERT INTO campaigns (id, title, occasion, discount_pct, copy_text, banner_style, audience_tier, recipients_count, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    campaign.id,
    campaign.title,
    campaign.occasion,
    campaign.discount_pct,
    campaign.copy_text,
    campaign.banner_style,
    campaign.audience_tier,
    campaign.recipients_count,
    campaign.status,
    new Date().toISOString(),
    (err) => {
      if (err) reject(err);
      else resolve();
    }
  );
  stmt.finalize();
});

const getCampaignHistory = () => new Promise((resolve, reject) => {
  con.all('SELECT * FROM campaigns ORDER BY created_at DESC', (err, rows) => {
    if (err) return reject(err);
    resolve(rows || []);
  });
});

module.exports = {
  getAudienceMetrics,
  getCustomersByTier,
  generateCampaign,
  saveCampaign,
  getCampaignHistory
};

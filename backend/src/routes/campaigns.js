const express = require('express');
const router = express.Router();
const { con } = require('../db');
const { getAudienceMetrics, generateCampaign, saveCampaign, getCampaignHistory, getCustomersByTier } = require('../services/campaignService');
const { sendCampaignBroadcast } = require('../services/whatsapp');

// GET /campaigns/audience
router.get('/audience', async (req, res) => {
  try {
    const metrics = await getAudienceMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching audience metrics:', error);
    res.status(500).json({ error: 'Failed to fetch audience metrics' });
  }
});

// POST /campaigns/generate
router.post('/generate', (req, res) => {
  try {
    const { occasion, discount_pct, store_name } = req.body;
    const campaign = generateCampaign(occasion, discount_pct, store_name);
    res.json({ campaign });
  } catch (error) {
    console.error('Error generating campaign:', error);
    res.status(500).json({ error: 'Failed to generate campaign' });
  }
});

// POST /campaigns/broadcast
router.post('/broadcast', async (req, res) => {
  try {
    const { campaign, audience_tier } = req.body;
    if (!campaign || !campaign.id || !campaign.copy_text) {
      return res.status(400).json({ error: 'Invalid campaign payload' });
    }

    // Determine target customers
    const customers = await getCustomersByTier(audience_tier);
    const recipientsCount = customers.length;
    
    // In sandbox, we can only message the registered RECIPIENT_PHONE
    const recipientPhone = process.env.RECIPIENT_PHONE;

    let status = 'sent';
    let wamid = null;
    let message = '';

    if (recipientsCount === 0) {
      status = 'failed';
      message = 'No customers found in the selected tier.';
    } else {
      if (!recipientPhone) {
        status = 'simulated';
        console.warn('RECIPIENT_PHONE not configured. Simulating broadcast.');
        message = `Simulated broadcast to ${recipientsCount} customers.`;
      } else {
        // Send a single real WhatsApp message to the test recipient representing the broadcast
        try {
          const result = await sendCampaignBroadcast(campaign, campaign.copy_text, recipientPhone);
          wamid = result.wamid;
          message = `Broadcasted to 1 sandbox recipient representing ${recipientsCount} customers.`;
        } catch (waError) {
          console.error('Broadcast WhatsApp Error:', waError);
          if (waError.message.includes('Token Expired') || waError.message.includes('Authentication Error')) {
            status = 'simulated';
            message = `Simulated broadcast to ${recipientsCount} customers. (Meta Token Expired)`;
          } else {
            status = 'failed';
            message = `Broadcast failed: ${waError.message}`;
          }
        }
      }
    }

    // Save campaign to DB
    const campaignToSave = {
      ...campaign,
      audience_tier: audience_tier || 'All',
      recipients_count: recipientsCount,
      status: status
    };
    await saveCampaign(campaignToSave);

    res.json({ status: 'ok', message, campaign: campaignToSave, wamid });
  } catch (error) {
    console.error('Error broadcasting campaign:', error);
    res.status(500).json({ error: 'Failed to broadcast campaign' });
  }
});

// GET /campaigns/history
router.get('/history', async (req, res) => {
  try {
    const history = await getCampaignHistory();
    res.json({ count: history.length, data: history });
  } catch (error) {
    console.error('Error fetching campaign history:', error);
    res.status(500).json({ error: 'Failed to fetch campaign history' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { con } = require('../db');
const { getAudienceMetrics, generateCampaign, saveCampaign, getCampaignHistory, getCustomersByTier, ensureDemoCustomers } = require('../services/campaignService');
const { notifyMerchant } = require('../services/notificationService');

const storeOf = (req) => req.query.store_id || req.body?.store_id || req.store_id || 'store_1';

// GET /campaigns/audience
router.get('/audience', async (req, res) => {
  try {
    const storeId = storeOf(req);
    await ensureDemoCustomers(storeId);
    const metrics = await getAudienceMetrics(storeId);
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching audience metrics:', error);
    res.status(500).json({ error: 'Failed to fetch audience metrics' });
  }
});

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { default: Groq } = require('groq-sdk');
const { v4: uuidv4 } = require('uuid');

// POST /campaigns/generate
router.post('/generate', async (req, res) => {
  try {
    const { occasion, discount_pct, store_name } = req.body;
    let aiText = '';

    const prompt = `You are an expert marketer for a local retail store in India named "${store_name || 'StoreSathi Supermart'}".
Write a highly persuasive, urgent WhatsApp/SMS marketing message for the following occasion:
Occasion: ${occasion}
Discount: ${discount_pct}%

Requirements:
- Must be between 30 to 60 words.
- Include emojis.
- End with a strong call to action (e.g. "Visit store today!").
- Do not include hashtags.`;

    try {
      if (!process.env.GEMINI_API_KEY) throw new Error('No Gemini Key');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      const result = await model.generateContent(prompt);
      aiText = result.response.text();
    } catch (geminiError) {
      console.warn('Gemini failed for Campaign Generator, falling back to Groq:', geminiError.message);
      if (!process.env.GROQ_API_KEY) throw new Error('No Groq Key available for fallback');
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'qwen/qwen3.8-27b',
        temperature: 0.7
      });
      aiText = chatCompletion.choices[0]?.message?.content || 'Special Offer! Visit us today to claim your discount.';
    }

    // Still use the hardcoded generateCampaign function to get the structure, but overwrite the copy_text
    const campaign = generateCampaign(occasion, discount_pct, store_name);
    campaign.copy_text = aiText;
    
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
    const storeId = storeOf(req);
    await ensureDemoCustomers(storeId);
    const customers = await getCustomersByTier(audience_tier, storeId);
    const recipientsCount = customers.length;

    let status = 'sent';
    let message = '';

    if (recipientsCount === 0) {
      status = 'failed';
      message = 'No customers found in the selected tier.';
    } else {
      // Sandbox limits real delivery to the merchant's own number; report what was really delivered.
      const r = await notifyMerchant({
        title: campaign.title || `Campaign: ${audience_tier}`,
        body: `Broadcast to ${recipientsCount} customers.\n${campaign.copy_text.replace(/\{customer_name\}/g, 'Customer')}`
      });
      const channels = ['whatsapp', 'sms', 'email'].filter(c => r[c] === 'sent');
      if (channels.length) {
        message = `Broadcast to ${recipientsCount} customers — delivered via ${channels.join(' + ')}.`;
      } else {
        status = 'failed';
        message = `Broadcast failed on every channel. WhatsApp: ${r.whatsapp}; SMS: ${r.sms}; Email: ${r.email}`;
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

    res.json({ status: 'ok', message, campaign: campaignToSave });
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

const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Uses Gemini to analyze scraped page content against the 8 StoreSathi rules
 * and the merchant's own store context, returning actionable recommendations.
 */
async function analyzeWithGemini(scrapedPage, storeContext) {
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not set — skipping AI analysis.');
    return [];
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

  const prompt = `
You are StoreSathi, an intelligent inventory and growth copilot for Indian retail and apparel merchants.
A merchant is browsing a product page with the StoreSathi Chrome extension open.

--- CURRENT PRODUCT VIEWED ON SCREEN ---
Product Name: ${scrapedPage.name}
Detected Price: ${scrapedPage.price > 0 ? '₹' + scrapedPage.price : 'Use catalog price'}
Category: ${scrapedPage.category}
Page URL: ${scrapedPage.pageUrl || 'Unknown'}
Stock Status on Page: ${scrapedPage.stockStatus || 'Not detected'}
Visible Excerpt: ${scrapedPage.pageExcerpt || 'Not available'}

--- MERCHANT'S STORE CONTEXT & INVENTORY ---
${JSON.stringify(storeContext, null, 2)}

--- STRICT INTELLIGENCE RULES (Apply ONLY relevant rules based on data) ---
1. C1 - LOW STOCK ALERT: If merchant stock for this item or category is < 20 units, warn them with exact reorder count.
2. C2 - STOCKOUT RISK: If sales velocity indicates stock will deplete in < 5 days, flag as Urgent.
3. C3 - SLOW MOVING CLEARANCE: If category or product has 0 or low sales, recommend a specific 10-15% promotional discount or combo.
4. C4 - DEMAND SPIKE: If external demand is high, suggest stocking up to capture margin.
5. C5 - GROWTH OPPORTUNITY: Suggest a targeted WhatsApp campaign to regular customers for trending apparel.
6. C6 - WEATHER ALERT: If cold weather or rain is predicted, recommend restocking or promoting outerwear (jackets/coats).
7. C7 - TREND PROMOTION: If this item is trending on Instagram/social media, suggest a flash sale or storefront banner.
8. C8 - FORECASTING: Estimate days until stockout based on quantity and sales velocity.

CRITICAL PRICING RULE:
Always use the realistic item price (e.g. ₹599 to ₹3,499). NEVER confuse store overall revenue or daily sales totals with an individual product price.

OUTPUT FORMAT:
Return ONLY a valid JSON array of 2 to 4 actionable recommendations.
Format:
[
  {
    "type": "restock" | "discount" | "trend_promotion" | "weather_restock",
    "title": "Short title naming the product and specific action (max 60 chars)",
    "description": "Clear actionable reason with specific numbers (e.g. only 6 units left, reorder 30) (max 140 chars)",
    "priority": "Urgent" | "High" | "Medium"
  }
]
Note: Set priority="Urgent" ONLY if stockout is imminent (< 5 days). Otherwise use "High" or "Medium". No markdown, no commentary.
`;

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API timeout after 4s')), 4000)
    );
    const result = await Promise.race([model.generateContent(prompt), timeoutPromise]);
    const text = result.response.text().trim();

    // Parse the JSON from Gemini's response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Gemini did not return valid JSON array:', text.substring(0, 200));
      return [];
    }

    const recs = JSON.parse(jsonMatch[0]);
    // Assign UUIDs since these are live, not from DB
    const { v4: uuidv4 } = require('uuid');
    return recs.map(r => ({
      id: uuidv4(),
      store_id: 'store_1',
      type: r.type || 'trend_promotion',
      title: r.title || 'AI Insight',
      description: r.description || '',
      priority: r.priority || 'High',
      evidence_data: JSON.stringify({ source: 'gemini', page: scrapedPage.pageUrl }),
      status: 'active',
      created_at: new Date().toISOString()
    }));
  } catch (err) {
    console.error('Gemini analysis failed:', err.message);
    return [];
  }
}

module.exports = { analyzeWithGemini };

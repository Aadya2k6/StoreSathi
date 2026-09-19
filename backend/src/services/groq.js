const Groq = require('groq-sdk');

// Add this to your .env:
// GROQ_API_KEY=gsk_your_key_here
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'dummy_key'
});

async function analyzeWithGroqFallback(storeContext, scrapedPage) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY missing from .env');
  }

  const prompt = `
You are StoreSathi, an AI assistant for fashion store merchants in India.
Your goal is to analyze the product page the merchant is currently viewing, and compare it against their store context to generate 1 or 2 highly specific, actionable insights.

--- STORE CONTEXT ---
Store ID: ${storeContext.storeId}
Recent Anomalies: ${JSON.stringify(storeContext.anomalies)}
Available Products in Store DB: ${JSON.stringify(storeContext.products.map(p => ({ name: p.name, stock: p.stock_quantity, price: p.price })))}

--- CURRENTLY VIEWED PAGE ---
Product: ${scrapedPage.name || 'Unknown'}
Price: ${scrapedPage.price || 'Unknown'}
Category: ${scrapedPage.category || 'Apparel'}
Rating: ${scrapedPage.rating || 'N/A'}
Reviews: ${scrapedPage.reviewsSummary || 'N/A'}
Stock Warning: ${scrapedPage.stockStatus || 'None'}

Generate exactly 1 or 2 recommendations. Return ONLY a JSON array, nothing else.
Format: [{"type": "discount", "title": "...", "description": "...", "priority": "High"}]
`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'qwen/qwen3.8-27b',
      temperature: 0.2,
      response_format: { type: 'json_object' } // Enforce JSON
    });

    const content = chatCompletion.choices[0]?.message?.content || '[]';
    // The model might return {"recommendations": [...]} or just [...]
    let parsed = JSON.parse(content);
    if (parsed && !Array.isArray(parsed) && parsed.recommendations) {
      parsed = parsed.recommendations;
    }

    // Add UUIDs
    const { v4: uuidv4 } = require('uuid');
    return parsed.map(r => ({
      id: uuidv4(),
      type: r.type || 'promotion',
      title: r.title || 'AI Insight',
      description: r.description || '',
      priority: r.priority || 'Medium',
      evidence_data: JSON.stringify({ source: 'groq_ai_fallback' })
    }));

  } catch (error) {
    console.error('Groq AI Error:', error);
    throw error;
  }
}

async function askCopilotGroq(storeContext, question) {
  if (!process.env.GROQ_API_KEY) {
    return "Please add GROQ_API_KEY to your backend .env file to enable the AI Copilot.";
  }

  const prompt = `
You are the StoreSathi AI Copilot, assisting a retail merchant.
Use this context to answer their question directly, accurately, and concisely. 
Do not make up numbers. If the data isn't in the context, say so.

--- REAL-TIME DB CONTEXT ---
Products & Stock:
${storeContext.products.map(productLine).join('\n')}

Open alerts (with the recommended action):
${storeContext.anomalies.map(alertLine).join('\n')}

--- MERCHANT QUESTION ---
${question}
`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'qwen/qwen3.8-27b',
      temperature: 0.1
    });

    return chatCompletion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error('Groq Copilot Error:', error);
    return "Sorry, the AI is currently unreachable. Please check your internet connection or API limits.";
  }
}

// Shared by both copilot providers so Gemini and Groq see identical facts.
const productLine = (p) =>
  `- ${p.name} (${p.category || 'Uncategorised'}): ${p.stock_quantity} in stock, ₹${p.price}, ${p.units_14d || 0} sold in the last 14 days`;
const alertLine = (a) => `- [${a.type}] ${a.title}: ${a.description}`;

module.exports = { analyzeWithGroqFallback, askCopilotGroq, productLine, alertLine };

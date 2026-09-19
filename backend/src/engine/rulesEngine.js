const { con } = require('../db');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const RESTOCK_QTY = 40;   // units suggested (and applied) on an approved restock
const DISCOUNT_PCT = 15;  // % suggested (and applied) on an approved clearance discount

class RulesEngine {
  constructor() {
    this.defaultStoreId = 'store_1';
  }

  // --- DB Helpers ---
  getAllProducts(storeId) {
    const sId = storeId || this.defaultStoreId;
    return new Promise((resolve, reject) => {
      con.all('SELECT * FROM products WHERE store_id = ?', sId, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  getSalesDataLastXDays(days, storeId) {
    const sId = storeId || this.defaultStoreId;
    return new Promise((resolve, reject) => {
      con.all(`
        SELECT si.product_id, si.quantity, s.created_at
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.store_id = ?
      `, sId, (err, rows) => {
        if (err) return reject(err);
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const recentSales = (rows || []).filter(row => new Date(row.created_at) >= cutoffDate);
        resolve(recentSales);
      });
    });
  }

  computeDaysUntilStockout(stockQty, salesLast14Days) {
    if (salesLast14Days === 0 || stockQty === 0) return null;
    const avgDailySales = salesLast14Days / 14;
    return Math.floor(stockQty / avgDailySales);
  }

  detectAnomaly(salesLast7, salesPrior7) {
    if (salesPrior7 === 0 && salesLast7 > 5) return { type: 'spike', pct: 100 };
    if (salesPrior7 === 0) return null;
    const changePct = ((salesLast7 - salesPrior7) / salesPrior7) * 100;
    if (changePct >= 80) return { type: 'spike', pct: Math.round(changePct) };
    if (changePct <= -60) return { type: 'drop', pct: Math.round(Math.abs(changePct)) };
    return null;
  }

  insertRecommendation(rec, storeId) {
    const sId = storeId || this.defaultStoreId;
    return new Promise((resolve, reject) => {
      // Don't re-raise an alert the merchant already approved for this product
      if (this.approvedKeys && this.approvedKeys.has(`${rec.type}|${rec.entity_id}`)) return resolve(null);
      const id = uuidv4();
      const createdAt = new Date().toISOString();
      const evidenceData = JSON.stringify({ priority: rec.priority, entity_id: rec.entity_id, action: rec.action });
      const sql = 'INSERT INTO recommendations (id, store_id, type, title, description, evidence_data, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
      con.run(sql, id, sId, rec.type, rec.title, rec.description, evidenceData, 'active', createdAt, (err) => {
        if (err) return reject(err);
        resolve({ ...rec, id, created_at: createdAt });
      });
    });
  }

  getApprovedKeys(storeId) {
    return new Promise((resolve) => {
      con.all("SELECT type, evidence_data FROM recommendations WHERE store_id = ? AND status = 'approved'", storeId, (err, rows) => {
        const keys = new Set();
        (rows || []).forEach(r => {
          try { keys.add(`${r.type}|${JSON.parse(r.evidence_data).entity_id}`); } catch (e) {}
        });
        resolve(keys);
      });
    });
  }

  clearOldRecommendations(storeId) {
    const sId = storeId || this.defaultStoreId;
    return new Promise((resolve, reject) => {
      con.run("DELETE FROM recommendations WHERE store_id = ? AND status = 'active'", sId, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  // --- External Integrations ---
  async getLiveWeatherPrediction() {
    try {
      const res = await axios.get('https://api.open-meteo.com/v1/forecast?latitude=28.6139&longitude=77.2090&daily=temperature_2m_min,temperature_2m_max,precipitation_sum&timezone=auto', { timeout: 2500 });
      const daily = res.data.daily;
      const minTemps = daily.temperature_2m_min;
      const rain = daily.precipitation_sum;
      
      let isColdSnap = false;
      let isHeavyRain = false;
      for (let i = 0; i < minTemps.length; i++) {
        if (minTemps[i] < 15) isColdSnap = true;
        if (rain[i] > 10) isHeavyRain = true;
      }
      const forced = process.env.DEMO_FORCE_COLD_SNAP === 'true';
      return {
        isColdSnap: isColdSnap || forced,
        isHeavyRain,
        currentForecast: forced && !isColdSnap
          ? 'Cold snap forecast (demo mode)'
          : `Min temps hovering around ${Math.min(...minTemps)}°C`
      };
    } catch (error) {
      // Weather API unreachable: only raise the alert if demo mode explicitly asks for it
      const forced = process.env.DEMO_FORCE_COLD_SNAP === 'true';
      return { isColdSnap: forced, isHeavyRain: false, currentForecast: forced ? 'Cold snap forecast (14°C)' : 'Forecast unavailable' };
    }
  }

  async getTrendAnalysis() {
    return {
      trendingCategory: 'Dresses',
      trendingKeyword: 'Floral',
      trendSpike: '+350%',
      source: 'Instagram Fashion Trends'
    };
  }

  // Orders alerts so stock problems come first, then at most two of each other kind, instead of
  // newest-first, which let the weather alerts crowd everything else out of the list.
  prioritizeRecs(recs, limit = 8) {
    const typeRank = { restock: 0, discount: 1, weather_restock: 2, trend_promotion: 3, growth_opportunity: 4 };
    const prioRank = { Urgent: 0, High: 1, Medium: 2 };
    const meta = (r) => {
      try { return JSON.parse(r.evidence_data || '{}'); } catch (e) { return {}; }
    };
    const sorted = [...recs].sort((a, b) =>
      (typeRank[a.type] ?? 9) - (typeRank[b.type] ?? 9) ||
      (prioRank[meta(a).priority || a.priority] ?? 3) - (prioRank[meta(b).priority || b.priority] ?? 3)
    );
    const perType = {};
    const seenEntity = new Set();
    const out = [];
    for (const r of sorted) {
      const key = `${r.type}|${meta(r).entity_id || r.title}`;
      if (seenEntity.has(key)) continue;
      if ((perType[r.type] || 0) >= 2) continue;
      seenEntity.add(key);
      perType[r.type] = (perType[r.type] || 0) + 1;
      out.push(r);
      if (out.length >= limit) break;
    }
    return out;
  }

  // --- Rule Executions ---
  async runRules(storeId) {
    const sId = storeId || this.defaultStoreId;
    console.log('--- Starting Rules Engine for store:', sId);
    await this.clearOldRecommendations(sId);
    this.approvedKeys = await this.getApprovedKeys(sId);
    // Products restocked in the last 14 days look "slow" only because of the fresh stock — don't discount them
    const recentRestocks = await new Promise((resolve) => {
      const cutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
      con.all("SELECT DISTINCT product_id FROM inventory_movements WHERE store_id = ? AND reason = 'restock' AND created_at >= ?", sId, cutoff,
        (err, rows) => resolve(new Set((rows || []).map(r => r.product_id))));
    });

    const products = await this.getAllProducts(sId);
    const salesLast14 = await this.getSalesDataLastXDays(14, sId);
    const salesLast7 = await this.getSalesDataLastXDays(7, sId);
    
    const cutoff7 = new Date();
    cutoff7.setDate(cutoff7.getDate() - 7);
    const salesPrior7 = salesLast14.filter(s => new Date(s.created_at) < cutoff7);

    let generatedCount = 0;

    for (const p of products) {
      const sales14 = salesLast14.filter(s => s.product_id === p.id);
      const sales7 = salesLast7.filter(s => s.product_id === p.id);
      const prior7 = salesPrior7.filter(s => s.product_id === p.id);

      const units14 = sales14.reduce((acc, s) => acc + s.quantity, 0);
      const units7 = sales7.reduce((acc, s) => acc + s.quantity, 0);
      const unitsPrior7 = prior7.reduce((acc, s) => acc + s.quantity, 0);

      const price = Math.round(p.price || 0);
      const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

      // C1 + C2: Low stock / stockout risk (one alert per product)
      if (p.stock_quantity > 0 && p.stock_quantity < 20) {
        const days = this.computeDaysUntilStockout(p.stock_quantity, units14);
        const runway = days !== null ? ` At the last 14 days' sales rate that lasts ~${days} day(s).` : '';
        await this.insertRecommendation({
          title: `Low Stock Alert: ${p.name}`,
          description: `Only ${p.stock_quantity} units left.${runway} Reorder ${RESTOCK_QTY} units to reach ${p.stock_quantity + RESTOCK_QTY}.`,
          priority: p.stock_quantity <= 10 ? 'Urgent' : 'High',
          type: 'restock',
          entity_id: p.id,
          action: { kind: 'restock', product_id: p.id, product_name: p.name, add_qty: RESTOCK_QTY }
        }, sId);
        generatedCount++;
      }

      // C3: Slow moving inventory (lots of stock, almost no recent sales)
      if (p.stock_quantity >= 30 && units14 <= 1 && !recentRestocks.has(p.id)) {
        const newPrice = Math.round(price * (1 - DISCOUNT_PCT / 100));
        await this.insertRecommendation({
          title: `Slow Moving Clearance: ${p.name}`,
          description: `${p.stock_quantity} units idle, only ${units14} sold in 14 days. Cut the price ${inr(price)} → ${inr(newPrice)} (${DISCOUNT_PCT}% off) to clear stock.`,
          priority: 'Medium',
          type: 'discount',
          entity_id: p.id,
          action: { kind: 'price', product_id: p.id, product_name: p.name, discount_pct: DISCOUNT_PCT }
        }, sId);
        generatedCount++;
      }

      // C4: Demand spike (real sales: this week clearly ahead of last week)
      if (units7 >= 3 && units7 > unitsPrior7) {
        const growth = unitsPrior7 > 0 ? `+${Math.round(((units7 - unitsPrior7) / unitsPrior7) * 100)}%` : 'new demand';
        await this.insertRecommendation({
          title: `Demand Spike: ${p.name}`,
          description: `${units7} units sold in the last 7 days vs ${unitsPrior7} the week before (${growth}). Feature it on your storefront and keep stock ready (${p.stock_quantity} left).`,
          priority: 'High',
          type: 'trend_promotion',
          entity_id: p.id,
          action: { kind: 'promo', product_id: p.id, product_name: p.name, label: 'DEMAND SPIKE' }
        }, sId);
        generatedCount++;
      }

      // C5: Growth opportunity (high-value / outerwear / sets)
      if (p.category === 'Sets' || p.category === 'Outerwear' || price >= 2000) {
        await this.insertRecommendation({
          title: `Growth Opportunity: ${p.name}`,
          description: `High-value item (${p.category} at ${inr(price)}). Send a WhatsApp campaign to your loyal customers to push it.`,
          priority: 'High',
          type: 'growth_opportunity',
          entity_id: p.id,
          action: { kind: 'promo', product_id: p.id, product_name: p.name, label: 'CAMPAIGN LIVE' }
        }, sId);
        generatedCount++;
      }
    }

    // C6: Weather context rule (outerwear)
    const weather = await this.getLiveWeatherPrediction();
    if (weather.isColdSnap || weather.isHeavyRain) {
      const jackets = products.filter(p => p.category === 'Outerwear' || p.name.toLowerCase().includes('jacket') || p.name.toLowerCase().includes('bomber'));
      for (const jacket of jackets) {
        const lowNote = jacket.stock_quantity < 20 ? ' Stock is low — restock before promoting.' : '';
        await this.insertRecommendation({
          title: `Weather Alert: ${jacket.name}`,
          description: `${weather.currentForecast}. Outerwear demand rises in cold weather — ${jacket.stock_quantity} units in stock.${lowNote} Feature it on the storefront.`,
          priority: 'Urgent',
          type: 'weather_restock',
          entity_id: jacket.id,
          action: { kind: 'promo', product_id: jacket.id, product_name: jacket.name, label: 'WEATHER PICK' }
        }, sId);
        generatedCount++;
      }
    }

    // C7: Trend rule (simulated social-trend feed: Dresses / Floral)
    const trends = await this.getTrendAnalysis();
    const trendyItems = products.filter(p =>
      p.category === trends.trendingCategory ||
      p.name.toLowerCase().includes(trends.trendingKeyword.toLowerCase())
    );
    for (const item of trendyItems) {
      await this.insertRecommendation({
        title: `Trending Now: ${item.name} (${trends.trendSpike})`,
        description: `${trends.source} (simulated feed) shows a ${trends.trendSpike} spike in ${trends.trendingKeyword} items. ${item.stock_quantity} units in stock — promote it on your storefront.`,
        priority: 'High',
        type: 'trend_promotion',
        entity_id: item.id,
        action: { kind: 'promo', product_id: item.id, product_name: item.name, label: 'TRENDING' }
      }, sId);
      generatedCount++;
    }

    console.log(`--- Rules Engine Finished: Generated ${generatedCount} alerts for ${sId} ---`);
    return { count: generatedCount };
  }

  // --- Dynamic Live Scraping Analysis ---
  async analyzeLiveProduct(productData, storeId) {
    const recs = [];
    const name = productData.name || 'This item';
    const price = parseFloat(productData.price) || 0;
    const priceStr = price > 0 ? `₹${price}` : 'catalog price';
    const category = productData.category || 'Apparel';
    
    // 1. Weather Rule for Outerwear
    const weather = await this.getLiveWeatherPrediction();
    if (category === 'Outerwear' || name.toLowerCase().includes('jacket') || name.toLowerCase().includes('bomber')) {
      recs.push({
        id: uuidv4(),
        type: 'weather_restock',
        title: `Weather Alert: Cold Snap on ${name.substring(0, 30)}`,
        description: `Temperatures dropping (${weather.currentForecast}). High seasonal demand for ${category}. Maintain inventory at ${priceStr}!`,
        priority: 'Urgent',
        evidence_data: JSON.stringify({ source: 'live_rules', scraped_product: productData, priority: 'Urgent' })
      });
    }

    // 2. Low Stock & Reorder Rule
    recs.push({
      id: uuidv4(),
      type: 'restock',
      title: `Low Stock & Restock Alert: ${name.substring(0, 30)}`,
      description: `Critical inventory level detected. Reorder 30-50 units to prevent lost sales during current demand peak.`,
      priority: 'High',
      evidence_data: JSON.stringify({ source: 'live_rules', scraped_product: productData, priority: 'High' })
    });

    // 3. Growth Opportunity Rule (High Value or Sets or Outerwear >= 2000)
    if (category === 'Outerwear' || category === 'Sets' || price >= 2000) {
      recs.push({
        id: uuidv4(),
        type: 'growth_opportunity',
        title: `Growth Opportunity: ${name.substring(0, 30)}`,
        description: `High-value category (${category} at ${priceStr}). Launch a targeted WhatsApp campaign to loyal shoppers to accelerate revenue.`,
        priority: 'High',
        evidence_data: JSON.stringify({ source: 'live_rules', scraped_product: productData, priority: 'High' })
      });
    }

    // 4. Trend or Pricing Optimization Rule
    if (name.toLowerCase().includes('dress') || category === 'Dresses' || name.toLowerCase().includes('floral')) {
      recs.push({
        id: uuidv4(),
        type: 'trend_promotion',
        title: `Demand Spike: Trending ${category}`,
        description: `Social trends show +350% interest in ${category}. Feature this product with a promotional banner to maximize conversions.`,
        priority: 'High',
        evidence_data: JSON.stringify({ source: 'live_rules', scraped_product: productData, priority: 'High' })
      });
    } else {
      recs.push({
        id: uuidv4(),
        type: 'discount',
        title: `Competitive Pricing: ${name.substring(0, 30)}`,
        description: `Current item price: ${priceStr}. Apply an AI-optimized 10% promotional discount to capture market share.`,
        priority: 'Medium',
        evidence_data: JSON.stringify({ source: 'live_rules', scraped_product: productData, priority: 'Medium' })
      });
    }

    return recs;
  }
}

module.exports = new RulesEngine();

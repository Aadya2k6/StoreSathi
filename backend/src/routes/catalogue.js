const express = require('express');
const router = express.Router();
const productRepo = require('../repositories/productRepo');

// GET /api/catalogue
router.get('/', async (req, res) => {
  try {
    const storeId = req.query.store_id || req.body?.store_id || req.store_id || 'store_1';
    const products = await productRepo.getProductsByStore(storeId);
    res.json(products);
  } catch (error) {
    console.error('Error fetching catalogue:', error);
    res.status(500).json({ error: 'Failed to fetch catalogue' });
  }
});

// POST /api/catalogue
router.post('/', async (req, res) => {
  try {
    const storeId = req.store_id;
    const { name, category, price, cost_price, stock_quantity } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const product = await productRepo.createProduct({
      store_id: storeId,
      name,
      category,
      price,
      cost_price: cost_price || 0,
      stock_quantity: stock_quantity || 0
    });
    
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// POST /api/catalogue/bulk-sync
// Dynamically ingests scraped store products directly into the merchant's portal database
router.post('/bulk-sync', async (req, res) => {
  try {
    const storeId = req.body.store_id || req.query.store_id || req.store_id || 'store_1';
    const productsList = req.body.products || [];

    if (!Array.isArray(productsList) || productsList.length === 0) {
      return res.status(400).json({ error: 'No products provided for ingestion' });
    }

    const synced = await productRepo.bulkSyncProducts(storeId, productsList);
    res.json({
      status: 'ok',
      message: `Successfully ingested ${synced.length} live products into StoreSathi portal`,
      count: synced.length,
      data: synced
    });
  } catch (error) {
    console.error('Error bulk syncing catalogue:', error);
    res.status(500).json({ error: 'Failed to ingest products', details: error.message });
  }
});

module.exports = router;

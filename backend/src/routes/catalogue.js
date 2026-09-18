const express = require('express');
const router = express.Router();
const productRepo = require('../repositories/productRepo');

// GET /api/catalogue
router.get('/', async (req, res) => {
  try {
    const storeId = req.store_id;
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

module.exports = router;

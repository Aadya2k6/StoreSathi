const express = require('express');
const router = express.Router();
const billingService = require('../services/billingService');
const saleRepo = require('../repositories/saleRepo');
const PDFDocument = require('pdfkit');

// POST /api/billing/sale
router.post('/sale', async (req, res) => {
  try {
    const storeId = req.store_id;
    const sale = await billingService.createSale(storeId, req.body);
    res.status(201).json(sale);
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(400).json({ error: error.message || 'Failed to create sale' });
  }
});

// GET /api/billing/receipt/:id
router.get('/receipt/:id', async (req, res) => {
  try {
    const storeId = req.store_id;
    const saleId = req.params.id;
    
    const sale = await saleRepo.getSale(storeId, saleId);
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    // Generate PDF Receipt
    const doc = new PDFDocument({ margin: 50 });
    
    // Configure response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${saleId}.pdf`);
    
    // Pipe to response
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('StoreSathi Receipt', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Store ID: ${storeId}`);
    doc.text(`Sale ID: ${saleId}`);
    doc.text(`Date: ${new Date(sale.created_at).toLocaleString()}`);
    doc.text(`Payment Method: ${sale.payment_method || 'Cash'}`);
    doc.moveDown();

    // Table Header
    doc.text('---------------------------------------------------------');
    doc.text('Item ID                          Qty     Price     Total');
    doc.text('---------------------------------------------------------');

    // Items
    sale.items.forEach(item => {
      // In a real app we'd fetch product names here, but we'll just show IDs for simplicity
      const name = item.product_id.substring(0, 8) + '...';
      doc.text(`${name.padEnd(30)} ${item.quantity.toString().padEnd(7)} Rs. ${item.unit_price.toString().padEnd(9)} Rs. ${item.total_price}`);
    });

    doc.text('---------------------------------------------------------');
    doc.moveDown();
    
    // Total
    doc.fontSize(16).text(`Total Amount: Rs. ${sale.total_amount}`, { align: 'right' });
    
    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating receipt:', error);
    // If headers already sent, we can't send JSON. 
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate receipt' });
    }
  }
});

module.exports = router;

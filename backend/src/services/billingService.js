const saleRepo = require('../repositories/saleRepo');
const productRepo = require('../repositories/productRepo');
const inventoryRepo = require('../repositories/inventoryRepo');

class BillingService {
  async createSale(storeId, saleData) {
    const { idempotency_key, payment_method, items } = saleData;

    // 1. Check idempotency key
    if (idempotency_key) {
      const existingSale = await saleRepo.getSaleByIdempotencyKey(storeId, idempotency_key);
      if (existingSale) {
        return await saleRepo.getSale(storeId, existingSale.id); // Return existing sale
      }
    }

    // 2. Validate items and calculate total
    let totalAmount = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await productRepo.getProductById(item.product_id, storeId);
      if (!product) {
        throw new Error(`Product ${item.product_id} not found`);
      }
      if (product.stock_quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.name}`);
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;
      
      processedItems.push({
        product_id: product.id,
        quantity: item.quantity,
        unit_price: product.price,
        total_price: itemTotal
      });
    }

    // 3. Create Sale
    const sale = await saleRepo.createSale({
      store_id: storeId,
      idempotency_key,
      total_amount: totalAmount,
      payment_method
    }, processedItems);

    // 4. Update Inventory and record movements
    for (const item of processedItems) {
      await productRepo.updateStock(item.product_id, storeId, -item.quantity);
      await inventoryRepo.recordMovement({
        store_id: storeId,
        product_id: item.product_id,
        quantity_change: -item.quantity,
        reason: 'sale',
        reference_id: sale.id
      });
    }

    return sale;
  }
}

module.exports = new BillingService();

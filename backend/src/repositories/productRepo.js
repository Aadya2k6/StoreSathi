const { con } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { parsePrice } = require('../services/snapshotService');

class ProductRepo {
  getProductsByStore(storeId) {
    return new Promise((resolve, reject) => {
      con.all('SELECT * FROM products WHERE store_id = ?', storeId, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  getProductById(id, storeId) {
    return new Promise((resolve, reject) => {
      con.all('SELECT * FROM products WHERE id = ? AND store_id = ?', id, storeId, (err, rows) => {
        if (err) return reject(err);
        resolve(rows[0]);
      });
    });
  }

  createProduct(product) {
    return new Promise((resolve, reject) => {
      const id = product.id || uuidv4();
      const createdAt = new Date().toISOString();
      const sql = 'INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
      con.run(sql, id, product.store_id, product.name, product.category, product.price, product.cost_price, product.stock_quantity, createdAt, (err) => {
        if (err) return reject(err);
        resolve({ ...product, id, created_at: createdAt });
      });
    });
  }

  updateStock(id, storeId, stockDelta) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND store_id = ?';
      con.run(sql, stockDelta, id, storeId, function(err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
    });
  }

  async bulkSyncProducts(storeId, productsList) {
    const results = [];
    for (const p of productsList) {
      if (!p.name) continue;
      const cleanName = p.name.trim();
      const existing = await new Promise((resolve) => {
        con.all('SELECT id FROM products WHERE store_id = ? AND LOWER(name) = LOWER(?)', storeId, cleanName, (err, rows) => {
          resolve(rows && rows.length > 0 ? rows[0] : null);
        });
      });

      const price = parsePrice(p.price);
      const stockParsed = parseInt(p.stock_quantity, 10);
      const stock = Number.isNaN(stockParsed) ? 50 : stockParsed; // keep a real 0 instead of forcing 50
      const category = p.category || 'Apparel';
      const costPrice = parsePrice(p.cost_price) || Math.round(price * 0.6);

      if (existing) {
        await new Promise((resolve, reject) => {
          con.run('UPDATE products SET price = ?, stock_quantity = ?, category = ? WHERE id = ?', price, stock, category, existing.id, (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
        results.push({ id: existing.id, name: cleanName, action: 'updated', price, stock_quantity: stock, category });
      } else {
        const id = 'prod_' + uuidv4().substring(0, 8);
        const createdAt = new Date().toISOString();
        await new Promise((resolve, reject) => {
          con.run(
            'INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            id, storeId, cleanName, category, price, costPrice, stock, createdAt,
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        });
        results.push({ id, name: cleanName, action: 'inserted', price, stock_quantity: stock, category });
      }
    }
    return results;
  }
}

module.exports = new ProductRepo();

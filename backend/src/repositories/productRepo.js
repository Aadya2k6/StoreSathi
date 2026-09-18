const { con } = require('../db');
const { v4: uuidv4 } = require('uuid');

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
}

module.exports = new ProductRepo();

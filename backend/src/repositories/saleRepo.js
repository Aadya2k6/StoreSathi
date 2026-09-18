const { con } = require('../db');
const { v4: uuidv4 } = require('uuid');

class SaleRepo {
  getSaleByIdempotencyKey(storeId, key) {
    return new Promise((resolve, reject) => {
      con.all('SELECT * FROM sales WHERE store_id = ? AND idempotency_key = ?', storeId, key, (err, rows) => {
        if (err) return reject(err);
        resolve(rows[0]);
      });
    });
  }

  getSale(storeId, saleId) {
    return new Promise((resolve, reject) => {
      con.all('SELECT * FROM sales WHERE id = ? AND store_id = ?', saleId, storeId, (err, rows) => {
        if (err) return reject(err);
        
        const row = rows[0];
        if (row) {
          con.all('SELECT * FROM sale_items WHERE sale_id = ?', saleId, (err, items) => {
            if (err) return reject(err);
            row.items = items;
            resolve(row);
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  createSale(saleData, items) {
    return new Promise((resolve, reject) => {
      const saleId = saleData.id || uuidv4();
      const createdAt = new Date().toISOString();
      
      const sql = 'INSERT INTO sales (id, store_id, idempotency_key, total_amount, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?)';
      con.run(sql, saleId, saleData.store_id, saleData.idempotency_key, saleData.total_amount, saleData.payment_method, createdAt, (err) => {
        if (err) return reject(err);

        if (items.length === 0) {
          return resolve({ ...saleData, id: saleId, created_at: createdAt, items: [] });
        }

        // Insert items
        const itemSql = 'INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)';
        let completed = 0;
        
        items.forEach(item => {
          const itemId = uuidv4();
          con.run(itemSql, itemId, saleId, item.product_id, item.quantity, item.unit_price, item.total_price, (err) => {
            if (err) {
               console.error('Error inserting sale item', err);
            }
            completed++;
            if (completed === items.length) {
              resolve({ ...saleData, id: saleId, created_at: createdAt, items });
            }
          });
        });
      });
    });
  }
}

module.exports = new SaleRepo();

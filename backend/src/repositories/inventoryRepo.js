const { con } = require('../db');
const { v4: uuidv4 } = require('uuid');

class InventoryRepo {
  recordMovement(movement) {
    return new Promise((resolve, reject) => {
      const id = movement.id || uuidv4();
      const createdAt = new Date().toISOString();
      const sql = 'INSERT INTO inventory_movements (id, store_id, product_id, quantity_change, reason, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)';
      con.run(sql, id, movement.store_id, movement.product_id, movement.quantity_change, movement.reason, movement.reference_id, createdAt, (err) => {
        if (err) return reject(err);
        resolve({ ...movement, id, created_at: createdAt });
      });
    });
  }
}

module.exports = new InventoryRepo();

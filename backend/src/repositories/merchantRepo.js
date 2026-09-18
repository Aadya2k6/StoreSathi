const { con } = require('../db');

class MerchantRepo {
  getMerchant(id) {
    return new Promise((resolve, reject) => {
      con.all('SELECT * FROM merchants WHERE id = ?', id, (err, rows) => {
        if (err) return reject(err);
        resolve(rows[0]);
      });
    });
  }

  getStore(id) {
    return new Promise((resolve, reject) => {
      con.all('SELECT * FROM stores WHERE id = ?', id, (err, rows) => {
        if (err) return reject(err);
        resolve(rows[0]);
      });
    });
  }
}

module.exports = new MerchantRepo();

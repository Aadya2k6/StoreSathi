const duckdb = require('duckdb');
const path = require('path');

// Store DB in the data directory
const dbPath = path.resolve(__dirname, '../../../data/store.db');
const db = new duckdb.Database(dbPath);
const con = db.connect();

const initDB = () => {
  return new Promise((resolve, reject) => {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS snapshots (
        url VARCHAR,
        product_name VARCHAR,
        price DOUBLE,
        currency VARCHAR,
        stock_status VARCHAR,
        reviews_count INTEGER,
        rating DOUBLE,
        platform VARCHAR,
        timestamp VARCHAR
      );
    `;
    con.run(createTableQuery, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
};

module.exports = {
  db,
  con,
  initDB
};

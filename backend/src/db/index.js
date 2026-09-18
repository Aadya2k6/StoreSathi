const duckdb = require('duckdb');
const path = require('path');

// Store DB in the data directory
const dbPath = path.resolve(__dirname, '../../../data/store.db');
const db = new duckdb.Database(dbPath);
const con = db.connect();

const initDB = () => {
  return new Promise((resolve, reject) => {
    const queries = [
      // Stores raw scraped product data from the extension
      `CREATE TABLE IF NOT EXISTS snapshots (
        url VARCHAR,
        product_name VARCHAR,
        price DOUBLE,
        currency VARCHAR,
        stock_status VARCHAR,
        reviews_count INTEGER,
        rating DOUBLE,
        platform VARCHAR,
        timestamp VARCHAR
      )`,
      // Stores detected opportunities and their state machine progression
      `CREATE TABLE IF NOT EXISTS opportunities (
        id VARCHAR PRIMARY KEY,
        type VARCHAR,
        product_name VARCHAR,
        url VARCHAR,
        status VARCHAR,
        tier VARCHAR,
        detected_at VARCHAR,
        details VARCHAR
      )`
    ];

    const runNext = (index) => {
      if (index >= queries.length) return resolve();
      con.run(queries[index], (err) => {
        if (err) return reject(err);
        runNext(index + 1);
      });
    };

    runNext(0);
  });
};

module.exports = {
  db,
  con,
  initDB
};

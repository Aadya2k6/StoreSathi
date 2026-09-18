const duckdb = require('duckdb');
const path = require('path');

// Store DB in the data directory
const dbPath = path.resolve(__dirname, '../../../data/store.db');
const db = new duckdb.Database(dbPath);
const con = db.connect();

const initDB = () => {
  return new Promise((resolve, reject) => {
    const queries = [
      // Create new schema
      `CREATE TABLE IF NOT EXISTS merchants (
        id VARCHAR PRIMARY KEY,
        name VARCHAR,
        created_at VARCHAR
      )`,
      `CREATE TABLE IF NOT EXISTS stores (
        id VARCHAR PRIMARY KEY,
        merchant_id VARCHAR,
        name VARCHAR,
        type VARCHAR, -- Kirana, Restaurant, Salon
        created_at VARCHAR
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY,
        store_id VARCHAR,
        email VARCHAR,
        password_hash VARCHAR,
        role VARCHAR,
        created_at VARCHAR
      )`,
      `CREATE TABLE IF NOT EXISTS products (
        id VARCHAR PRIMARY KEY,
        store_id VARCHAR,
        name VARCHAR,
        category VARCHAR,
        price DOUBLE,
        cost_price DOUBLE,
        stock_quantity INTEGER,
        created_at VARCHAR
      )`,
      `CREATE TABLE IF NOT EXISTS inventory_movements (
        id VARCHAR PRIMARY KEY,
        store_id VARCHAR,
        product_id VARCHAR,
        quantity_change INTEGER,
        reason VARCHAR, -- 'sale', 'restock', 'correction'
        reference_id VARCHAR, -- e.g. sale_id
        created_at VARCHAR
      )`,
      `CREATE TABLE IF NOT EXISTS sales (
        id VARCHAR PRIMARY KEY,
        store_id VARCHAR,
        idempotency_key VARCHAR UNIQUE,
        total_amount DOUBLE,
        payment_method VARCHAR,
        created_at VARCHAR
      )`,
      `CREATE TABLE IF NOT EXISTS sale_items (
        id VARCHAR PRIMARY KEY,
        sale_id VARCHAR,
        product_id VARCHAR,
        quantity INTEGER,
        unit_price DOUBLE,
        total_price DOUBLE
      )`,
      `CREATE TABLE IF NOT EXISTS ocr_documents (
        id VARCHAR PRIMARY KEY,
        store_id VARCHAR,
        status VARCHAR,
        raw_text VARCHAR,
        parsed_json VARCHAR,
        created_at VARCHAR
      )`,
      `CREATE TABLE IF NOT EXISTS recommendations (
        id VARCHAR PRIMARY KEY,
        store_id VARCHAR,
        type VARCHAR,
        title VARCHAR,
        description VARCHAR,
        evidence_data VARCHAR,
        status VARCHAR,
        created_at VARCHAR
      )`,
      `CREATE TABLE IF NOT EXISTS actions (
        id VARCHAR PRIMARY KEY,
        recommendation_id VARCHAR,
        type VARCHAR,
        payload VARCHAR,
        status VARCHAR,
        executed_at VARCHAR
      )`,
      `CREATE TABLE IF NOT EXISTS daily_metrics (
        id VARCHAR PRIMARY KEY,
        store_id VARCHAR,
        date VARCHAR,
        total_sales DOUBLE,
        transaction_count INTEGER,
        updated_at VARCHAR
      )`
    ];

    const runNext = (index) => {
      if (index >= queries.length) return checkAndSeed();
      con.run(queries[index], (err) => {
        if (err) return reject(err);
        runNext(index + 1);
      });
    };

    const checkAndSeed = () => {
      con.all('SELECT count(*) as count FROM merchants', (err, rows) => {
        if (err) return reject(err);
        if (rows[0].count > 0) return resolve(); // Already seeded

        const seedQueries = [
          `INSERT INTO merchants (id, name, created_at) VALUES ('merchant_1', 'StoreSathi Demo Merchant', '${new Date().toISOString()}')`,
          `INSERT INTO stores (id, merchant_id, name, type, created_at) VALUES ('store_1', 'merchant_1', 'StoreSathi Supermart', 'Kirana', '${new Date().toISOString()}')`,
          `INSERT INTO users (id, store_id, email, password_hash, role, created_at) VALUES ('user_1', 'store_1', 'demo@storesathi.com', 'hashed', 'admin', '${new Date().toISOString()}')`,
          `INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES ('prod_1', 'store_1', 'Aashirvaad Atta 5kg', 'Staples', 250.0, 210.0, 50, '${new Date().toISOString()}')`,
          `INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES ('prod_2', 'store_1', 'Tata Salt 1kg', 'Staples', 25.0, 20.0, 100, '${new Date().toISOString()}')`,
          `INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES ('prod_3', 'store_1', 'Amul Butter 500g', 'Dairy', 280.0, 250.0, 20, '${new Date().toISOString()}')`,
          `INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES ('prod_4', 'store_1', 'Maggi 2-Minute Noodles 140g', 'Snacks', 30.0, 25.0, 150, '${new Date().toISOString()}')`,
          `INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES ('prod_5', 'store_1', 'Nykaa Matte Lipstick - Chai', 'Cosmetics', 479.0, 250.0, 45, '${new Date().toISOString()}')`
        ];

        const runSeed = (i) => {
          if (i >= seedQueries.length) return resolve();
          con.run(seedQueries[i], (err) => {
            if (err) return reject(err);
            runSeed(i + 1);
          });
        };
        runSeed(0);
      });
    };

    runNext(0);
  });
};

module.exports = { db, con, initDB };

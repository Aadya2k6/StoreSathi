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
      )`,
      `CREATE TABLE IF NOT EXISTS opportunities (
        id VARCHAR PRIMARY KEY,
        store_id VARCHAR,
        type VARCHAR,
        product_name VARCHAR,
        url VARCHAR,
        status VARCHAR,
        tier VARCHAR,
        detected_at VARCHAR,
        details VARCHAR,
        notified BOOLEAN DEFAULT FALSE
      )`,
      // Page snapshots captured by the extension (own storefront or competitor pages)
      `CREATE TABLE IF NOT EXISTS snapshots (
        id VARCHAR PRIMARY KEY,
        store_id VARCHAR,
        url VARCHAR,
        product_name VARCHAR,
        price DOUBLE,
        currency VARCHAR,
        stock_status VARCHAR,
        rating DOUBLE,
        reviews_count INTEGER,
        captured_at VARCHAR
      )`,
      // Migration: older DBs created `opportunities` without a store_id column
      `ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS store_id VARCHAR`,
      // Remembers which urgent alerts were already emailed so the merchant isn't spammed
      `CREATE TABLE IF NOT EXISTS alert_emails (
        id VARCHAR PRIMARY KEY,
        store_id VARCHAR,
        alert_key VARCHAR,
        sent_at VARCHAR
      )`,
      `CREATE TABLE IF NOT EXISTS campaigns (
        id VARCHAR PRIMARY KEY,
        title VARCHAR,
        occasion VARCHAR,
        discount_pct INTEGER,
        copy_text VARCHAR,
        banner_style VARCHAR,
        audience_tier VARCHAR,
        recipients_count INTEGER,
        status VARCHAR,
        created_at VARCHAR
      )`,
      `CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR PRIMARY KEY,
        store_id VARCHAR,
        name VARCHAR,
        phone VARCHAR,
        loyalty_tier VARCHAR,
        total_spent DOUBLE,
        created_at VARCHAR
      )`,
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR PRIMARY KEY,
        store_id VARCHAR,
        role VARCHAR,
        content VARCHAR,
        source VARCHAR,
        created_at VARCHAR
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
          `INSERT INTO stores (id, merchant_id, name, type, created_at) VALUES ('store_1', 'merchant_1', 'Vogue Threads', 'Clothing', '${new Date().toISOString()}')`,
          `INSERT INTO users (id, store_id, email, password_hash, role, created_at) VALUES ('user_1', 'store_1', 'demo@storesathi.com', 'hashed', 'admin', '${new Date().toISOString()}')`,
          `INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES ('prod_1', 'store_1', 'Classic White T-Shirt', 'Tops', 599.0, 250.0, 50, '${new Date().toISOString()}')`,
          `INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES ('prod_2', 'store_1', 'Denim Jacket - Vintage Blue', 'Outerwear', 1999.0, 800.0, 15, '${new Date().toISOString()}')`,
          `INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES ('prod_3', 'store_1', 'Slim Fit Chinos - Khaki', 'Bottoms', 1299.0, 600.0, 30, '${new Date().toISOString()}')`,
          `INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES ('prod_4', 'store_1', 'Floral Summer Dress', 'Dresses', 1499.0, 700.0, 25, '${new Date().toISOString()}')`,
          `INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES ('prod_5', 'store_1', 'Cotton Polo Shirt - Navy', 'Tops', 899.0, 350.0, 40, '${new Date().toISOString()}')`,
          `INSERT INTO customers (id, store_id, name, phone, loyalty_tier, total_spent, created_at) VALUES ('cust_1', 'store_1', 'Aadya', '1234567890', 'VIP Regular', 15000, '${new Date().toISOString()}')`,
          `INSERT INTO customers (id, store_id, name, phone, loyalty_tier, total_spent, created_at) VALUES ('cust_2', 'store_1', 'Rohan', '9876543210', 'Regular', 4000, '${new Date().toISOString()}')`
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

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
      )`,
      // Stores customer segments and loyalty data based on Paytm transactions
      `CREATE TABLE IF NOT EXISTS customers (
        phone VARCHAR PRIMARY KEY,
        name VARCHAR,
        visits_count INTEGER,
        total_spent DOUBLE,
        last_visit VARCHAR,
        loyalty_tier VARCHAR
      )`,
      // Stores AI generated campaigns and their broadcast state
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
      )`
    ];

    const runNext = (index) => {
      if (index >= queries.length) return seedCustomers();
      con.run(queries[index], (err) => {
        if (err) return reject(err);
        runNext(index + 1);
      });
    };

    const seedCustomers = () => {
      con.all('SELECT count(*) as cnt FROM customers', (err, rows) => {
        if (err) return reject(err);
        if (rows[0].cnt > 0) return resolve(); // Already seeded

        const testPhone = process.env.RECIPIENT_PHONE || '+919876543210';

        const seedQueries = [
          `INSERT INTO customers VALUES ('${testPhone}', 'Test Merchant (You)', 15, 12500, 'Today', 'VIP Regular')`,
          `INSERT INTO customers VALUES ('+919876500001', 'Rahul Sharma', 8, 4850, '2 days ago', 'VIP Regular')`,
          `INSERT INTO customers VALUES ('+919876500002', 'Priya Nair', 12, 6200, 'Yesterday', 'VIP Regular')`,
          `INSERT INTO customers VALUES ('+919876500003', 'Amit Patel', 5, 2100, 'Last week', 'Regular')`,
          `INSERT INTO customers VALUES ('+919876500004', 'Vikram Singh', 2, 850, '3 weeks ago', 'Occasional')`,
          `INSERT INTO customers VALUES ('+919876500005', 'Sneha Gupta', 1, 350, 'Last month', 'Occasional')`,
          `INSERT INTO customers VALUES ('+919876500006', 'Manoj Tiwari', 4, 1700, '5 days ago', 'Regular')`,
          `INSERT INTO customers VALUES ('+919876500007', 'Anita Desai', 9, 5300, 'Today', 'VIP Regular')`,
          `INSERT INTO customers VALUES ('+919876500008', 'Suresh Kumar', 3, 1150, 'Last week', 'Regular')`,
          `INSERT INTO customers VALUES ('+919876500009', 'Deepak Verma', 11, 7100, 'Yesterday', 'VIP Regular')`,
          `INSERT INTO customers VALUES ('+919876500010', 'Neha Kapoor', 6, 2900, '2 days ago', 'Regular')`
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

module.exports = {
  db,
  con,
  initDB
};

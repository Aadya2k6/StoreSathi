const { initDB, con } = require('./src/db');
require('dotenv').config();

console.log('Starting DB Initialization...');

initDB().then(() => {
  console.log('DB Schema Created. Seeding basic demo data...');

  const queries = [
    // Merchants
    `INSERT INTO merchants (id, name, created_at) VALUES ('merchant_1', 'StoreSathi Demo Merchant', '${new Date().toISOString()}')`,
    
    // Stores
    `INSERT INTO stores (id, merchant_id, name, type, created_at) VALUES ('store_1', 'merchant_1', 'StoreSathi Supermart', 'Kirana', '${new Date().toISOString()}')`,
    
    // Users
    `INSERT INTO users (id, store_id, email, password_hash, role, created_at) VALUES ('user_1', 'store_1', 'demo@storesathi.com', 'hashed', 'admin', '${new Date().toISOString()}')`,
    
    // Demo Products (Kirana)
    `INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES ('prod_1', 'store_1', 'Aashirvaad Atta 5kg', 'Staples', 250.0, 210.0, 50, '${new Date().toISOString()}')`,
    `INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES ('prod_2', 'store_1', 'Tata Salt 1kg', 'Staples', 25.0, 20.0, 100, '${new Date().toISOString()}')`,
    `INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES ('prod_3', 'store_1', 'Amul Butter 500g', 'Dairy', 280.0, 250.0, 20, '${new Date().toISOString()}')`,
    `INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES ('prod_4', 'store_1', 'Maggi 2-Minute Noodles 140g', 'Snacks', 30.0, 25.0, 150, '${new Date().toISOString()}')`,
    `INSERT INTO products (id, store_id, name, category, price, cost_price, stock_quantity, created_at) VALUES ('prod_5', 'store_1', 'Nykaa Matte Lipstick - Chai', 'Cosmetics', 479.0, 250.0, 45, '${new Date().toISOString()}')`
  ];

  const runSeed = (i) => {
    if (i >= queries.length) {
      console.log('Seeding complete! Exit process manually or press Ctrl+C if hanging.');
      process.exit(0);
      return;
    }
    con.run(queries[i], (err) => {
      if (err) {
        console.error('Error seeding data at query', i, err);
        process.exit(1);
      }
      runSeed(i + 1);
    });
  };

  runSeed(0);
}).catch(err => {
  console.error('Error initializing DB:', err);
  process.exit(1);
});

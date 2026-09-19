const { con } = require('./src/db');
require('dotenv').config();

console.log('Force wiping database to apply clothing store demo data...');

const queries = [
  'DELETE FROM merchants',
  'DELETE FROM stores',
  'DELETE FROM users',
  'DELETE FROM products',
  'DELETE FROM inventory_movements',
  'DELETE FROM sales',
  'DELETE FROM sale_items',
  'DELETE FROM recommendations',
  'DELETE FROM actions',
  'DELETE FROM daily_metrics'
];

const runNext = (index) => {
  if (index >= queries.length) {
    console.log('Wipe complete. Restart the backend to automatically re-seed with clothing store data.');
    process.exit(0);
  }
  con.run(queries[index], (err) => {
    if (err) console.error('Error wiping table', err);
    runNext(index + 1);
  });
};

runNext(0);

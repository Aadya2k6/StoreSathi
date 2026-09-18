require('dotenv').config();
const { initDB } = require('./src/db');
initDB().then(() => {
  console.log('DB initialized and seeded successfully.');
  process.exit(0);
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});

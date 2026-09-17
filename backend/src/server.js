const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { initDB, con } = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize DB on startup
initDB().then(() => {
  console.log('DuckDB initialized successfully');
}).catch(err => {
  console.error('Failed to initialize DuckDB:', err);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/snapshots', (req, res) => {
  con.all('SELECT * FROM snapshots', (err, result) => {
    if (err) {
      console.error('Failed to fetch snapshots:', err);
      return res.status(500).json({ error: 'Failed to fetch snapshots' });
    }
    res.json({ count: result.length, data: result });
  });
});

app.post('/ingest', (req, res) => {
  const { url, product_name, price, currency, stock_status, reviews_count, rating, platform, timestamp } = req.body;

  // Basic validation
  if (!url || !product_name || price === undefined) {
    return res.status(400).json({ error: 'Missing required fields: url, product_name, price' });
  }

  const stmt = con.prepare(`
    INSERT INTO snapshots (url, product_name, price, currency, stock_status, reviews_count, rating, platform, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    url, 
    product_name, 
    price, 
    currency || 'USD', 
    stock_status || 'unknown', 
    reviews_count || 0, 
    rating || 0, 
    platform || 'generic', 
    timestamp || new Date().toISOString(),
    (err) => {
      if (err) {
        console.error('Failed to insert snapshot:', err);
        return res.status(500).json({ error: 'Database insertion failed' });
      }
      res.status(201).json({ status: 'ok', message: 'Snapshot ingested successfully' });
    }
  );
  stmt.finalize();
});

app.listen(port, () => {
  console.log(`Backend Orchestration API running on port ${port}`);
});

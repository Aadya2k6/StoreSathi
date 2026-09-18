const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { initDB, con } = require('./db');
const opportunitiesRouter = require('./routes/opportunities');
const webhookRouter = require('./routes/webhook');
const campaignsRouter = require('./routes/campaigns');
const catalogueRouter = require('./routes/catalogue');
const billingRouter = require('./routes/billing');
const authMiddleware = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(authMiddleware);

// Initialize DB on startup
initDB().then(() => {
  console.log('DuckDB initialized successfully');
}).catch(err => {
  console.error('Failed to initialize DuckDB:', err);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routers
app.use('/api/catalogue', catalogueRouter);
app.use('/api/billing', billingRouter);

app.listen(port, () => {
  console.log(`Backend Orchestration API running on port ${port}`);
});

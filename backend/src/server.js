const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { initDB, con } = require('./db');
const opportunitiesRouter = require('./routes/opportunities');
const webhookRouter = require('./routes/webhook');
const campaignsRouter = require('./routes/campaigns');
const catalogueRouter = require('./routes/catalogue');
const billingRouter = require('./routes/billing');
const intelligenceRouter = require('./routes/intelligence');
const authRouter = require('./routes/auth');
const { startPeriodicCron, runCronJob } = require('./services/cronService');
const authMiddleware = require('./middleware/auth');

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

// WhatsApp webhook — called by Meta (no auth header), so it is mounted outside /api
app.use('/webhook', webhookRouter);

// Use auth middleware for API routes
app.use('/api', authMiddleware);

// Mount routers
app.use('/api/catalogue', catalogueRouter);
app.use('/api/billing', billingRouter);
app.use('/api/intelligence', intelligenceRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/opportunities', opportunitiesRouter);
app.use('/api/auth', authRouter);

// Demo endpoint to manually trigger the CRON and send Notifications
app.post('/api/trigger-cron', async (req, res) => {
  const summary = await runCronJob();
  res.json({ status: 'ok', message: 'Cron job finished.', summary });
});

app.listen(port, () => {
  console.log(`Backend Orchestration API running on port ${port}`);
  startPeriodicCron(); // Initialize automated background notifications
});

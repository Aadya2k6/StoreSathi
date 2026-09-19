const express = require('express');
const router = express.Router();
const { con } = require('../db');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  // For demo: Accept plain text 'demo123' etc., or check against seeded 'hashed'
  // Let's just do a simple DB check
  const stmt = con.prepare("SELECT id, store_id, email, role FROM users WHERE email = ? AND (password_hash = ? OR password_hash = 'hashed')");
  stmt.all(email, password, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (rows && rows.length > 0) {
      const user = rows[0];
      return res.json({ ok: true, user });
    } else {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});

const { v4: uuidv4 } = require('uuid');

// POST /api/auth/signup
router.post('/signup', (req, res) => {
  const { email, password, store_name } = req.body;
  if (!email || !password || !store_name) {
    return res.status(400).json({ error: 'Email, password, and store name are required' });
  }

  const storeId = `store_${Date.now()}`;
  const merchantId = `merchant_${Date.now()}`;
  const userId = uuidv4();
  const timestamp = new Date().toISOString();

  // Insert into merchants
  const stmt1 = con.prepare('INSERT INTO merchants (id, name, created_at) VALUES (?, ?, ?)');
  stmt1.run(merchantId, store_name, timestamp, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to create merchant' });

    const stmt2 = con.prepare('INSERT INTO stores (id, merchant_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)');
    stmt2.run(storeId, merchantId, store_name, 'Retail', timestamp, (err) => {
      if (err) return res.status(500).json({ error: 'Failed to create store' });

      const stmt3 = con.prepare('INSERT INTO users (id, store_id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)');
      stmt3.run(userId, storeId, email, password, 'admin', timestamp, (err) => {
        if (err) return res.status(500).json({ error: 'Failed to create user' });

        const user = { id: userId, store_id: storeId, email, role: 'admin', store_name };
        res.json({ ok: true, user });
      });
    });
  });
});

module.exports = router;

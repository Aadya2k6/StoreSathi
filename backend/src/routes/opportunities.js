const express = require('express');
const router = express.Router();
const { con } = require('../db');
const { runEngine, VALID_STATES } = require('../engine/opportunityEngine');

// POST /opportunities/run — trigger the opportunity detection engine
router.post('/run', async (req, res) => {
  try {
    const result = await runEngine();
    res.json(result);
  } catch (err) {
    console.error('Opportunity engine error:', err);
    res.status(500).json({ error: 'Engine failed', details: err.message });
  }
});

// GET /opportunities — fetch all opportunities (with optional filters)
// Query params: ?status=detected&type=underpriced&url=...
router.get('/', (req, res) => {
  const { status, type, url } = req.query;
  let query = 'SELECT * FROM opportunities';
  const params = [];
  const conditions = [];

  if (status) { conditions.push('status = ?'); params.push(status); }
  if (type)   { conditions.push('type = ?');   params.push(type);   }
  if (url)    { conditions.push('url = ?');    params.push(url);    }
  
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY detected_at DESC';

  const stmt = con.prepare(query);
  stmt.all(...params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch opportunities', details: err.message });

    // Parse the JSON details field before sending response
    const parsed = rows.map(r => ({
      ...r,
      details: (() => { try { return JSON.parse(r.details); } catch (_) { return {}; } })()
    }));

    res.json({ count: parsed.length, data: parsed });
  });
  stmt.finalize();
});

// GET /opportunities/:id — fetch a single opportunity by ID
router.get('/:id', (req, res) => {
  const stmt = con.prepare('SELECT * FROM opportunities WHERE id = ?');
  stmt.all(req.params.id, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch opportunity' });
    if (rows.length === 0) return res.status(404).json({ error: 'Opportunity not found' });
    const r = rows[0];
    res.json({ ...r, details: (() => { try { return JSON.parse(r.details); } catch (_) { return {}; } })() });
  });
  stmt.finalize();
});

// PATCH /opportunities/:id/status — advance the state machine
router.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Missing required field: status' });
  }

  if (!VALID_STATES.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${VALID_STATES.join(', ')}`
    });
  }

  const stmt = con.prepare('UPDATE opportunities SET status = ? WHERE id = ?');
  stmt.run(status, id, function (err) {
    if (err) return res.status(500).json({ error: 'Failed to update status', details: err.message });
    res.json({ ok: true, id, new_status: status });
  });
  stmt.finalize();
});

module.exports = router;

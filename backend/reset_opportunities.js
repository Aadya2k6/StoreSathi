const duckdb = require('duckdb');
const path = require('path');
const db = new duckdb.Database(path.resolve(__dirname, '../data/store.db'));
const con = db.connect();

// Reset any records stuck in sent_for_approval back to drafted so they can be re-sent
con.run("UPDATE opportunities SET status = 'drafted' WHERE status = 'sent_for_approval'", (err) => {
  if (err) {
    console.log('Error:', err.message);
  } else {
    console.log('Done — reset sent_for_approval → drafted');
  }
  db.close();
});

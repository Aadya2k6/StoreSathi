const duckdb = require('duckdb');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/store.db');
const db = new duckdb.Database(dbPath);
const con = db.connect();

console.log("Checking DuckDB for ingested snapshots...\n");

con.all('SELECT * FROM snapshots', (err, res) => {
  if (err) {
    console.error("Error querying DuckDB:", err);
  } else if (res.length === 0) {
    console.log("No snapshots found in the database yet. Try visiting a product page with the extension enabled.");
  } else {
    console.log(`Found ${res.length} snapshot(s):\n`);
    console.log(JSON.stringify(res, null, 2));
  }
});

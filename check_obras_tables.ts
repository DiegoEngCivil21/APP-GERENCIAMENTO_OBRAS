import Database from 'better-sqlite3';

try {
  const db = new Database('./obras.db');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tables:", tables);
} catch (e) {
  console.log("Error querying sqlite_master:", e.message);
}

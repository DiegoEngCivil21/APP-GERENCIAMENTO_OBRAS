import Database from 'better-sqlite3';
try {
  const db = new Database('./test.db');
  console.log("test.db integrity:", db.pragma('integrity_check'));
  console.log("Tables:", db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
} catch(e) { console.error(e.message); }

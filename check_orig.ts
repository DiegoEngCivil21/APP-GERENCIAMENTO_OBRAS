import Database from 'better-sqlite3';
try {
  const db = new Database('./database.sqlite');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tables in database.sqlite:", tables);
} catch(e) { console.error(e); }

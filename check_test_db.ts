
import Database from "better-sqlite3";
try {
  const db = new Database("test.db");
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log(`DB test.db is OK. Tables:`, tables.map((t: any) => t.name).length);
  db.close();
} catch (err: any) {
  console.log(`DB test.db is CORRUPT or missing:`, err.message);
}

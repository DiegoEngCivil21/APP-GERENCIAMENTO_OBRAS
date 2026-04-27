
import Database from "better-sqlite3";
import path from "path";

const dbs = ["obras.db", "obras.db.bak2", "obras.db.bak3"];

for (const dbName of dbs) {
  try {
    const db = new Database(dbName);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`DB ${dbName} is OK. Tables:`, tables.map((t: any) => t.name).length);
    db.close();
  } catch (err: any) {
    console.log(`DB ${dbName} is CORRUPT:`, err.message);
  }
}

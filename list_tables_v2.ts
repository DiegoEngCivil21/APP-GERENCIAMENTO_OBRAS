import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "obras.db");

try {
  const db = new Database(dbPath);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tables in database:", tables.map(t => (t as any).name).join(", "));
  db.close();
} catch (error) {
  console.error("Error listing tables:", error);
}

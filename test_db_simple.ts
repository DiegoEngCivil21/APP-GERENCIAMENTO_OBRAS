import Database from "better-sqlite3";
const db = new Database("obras.db");
try {
  db.exec("SELECT 1");
  console.log("DB OK");
} catch (e) {
  console.error("DB Error", e);
}

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "obras.db");
console.log("Checking database at:", dbPath);

try {
  const db = new Database(dbPath);
  const result = db.pragma("integrity_check");
  console.log("Integrity check result:", result);
  db.close();
} catch (error) {
  console.error("Database error during integrity check:", error);
}

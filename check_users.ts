import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "obras.db");
const db = new Database(dbPath);

try {
  const users = db.prepare("SELECT email, role FROM v2_users").all();
  console.log("Users in database:", users);
  db.close();
} catch (error) {
  console.error("Error listing users:", error);
}

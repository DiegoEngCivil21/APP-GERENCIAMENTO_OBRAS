import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "obras.db");
const db = new Database(dbPath);

try {
    db.exec("CREATE TABLE IF NOT EXISTS test_write (id INTEGER PRIMARY KEY)");
    db.exec("INSERT INTO test_write DEFAULT VALUES");
    console.log("Successfully wrote to database");
} catch (e) {
    console.error("Failed to write to database:", e);
}

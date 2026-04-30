import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "obras.db");
const db = new Database(dbPath);

console.log(db.prepare("PRAGMA table_info(v2_medicoes)").all());
db.close();

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(process.cwd(), "obras.db");

let _db: Database.Database | null = null;

export function initDb() {
  if (!_db) {
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
  }
}

// Proxy object to access _db
export const db = new Proxy({} as Database.Database, {
  get(target, prop, receiver) {
    if (!_db) {
      initDb();
    }
    return Reflect.get(_db!, prop, receiver);
  }
});

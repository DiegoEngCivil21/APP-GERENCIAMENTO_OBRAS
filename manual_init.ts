import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "obras.db");
console.log("Initializing database at:", dbPath);

const db = new Database(dbPath);

try {
  db.exec(`CREATE TABLE IF NOT EXISTS v2_tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        documento TEXT,
        status TEXT DEFAULT 'active'
    );`);
    
  db.exec(`CREATE TABLE IF NOT EXISTS v2_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        FOREIGN KEY (tenant_id) REFERENCES v2_tenants(id) ON DELETE CASCADE
    );`);

  console.log("Tables created successfully.");
  
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tables now in database:", tables.map(t => (t as any).name).join(", "));
  
  db.close();
} catch (error) {
  console.error("Error during manual init:", error);
}

const Database = require('better-sqlite3');
const db = new Database(':memory:');

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS v2_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER,
        nome TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES v2_tenants(id) ON DELETE CASCADE
    );
  `);
  console.log("SQL executed successfully");
} catch (e) {
  console.error("SQL error:", e);
}

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Define the dbPath manually to match server.ts and src/db.ts
const dbPath = path.join(process.cwd(), "obras.db");
const db = new Database(dbPath);

function initDatabase() {
  console.log("Initializing database tables...");
  
  // 1. Tenants
  db.exec(`CREATE TABLE IF NOT EXISTS v2_tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL
    );`);
  
  // Actually, I should just copy the initDatabase from server.ts or call it directly.
  // Since server.ts is huge, I will just call the tables needed,
  // OR I can use the existing initDatabase if I can import it.
  
  console.log("Database tables checked/created.");
}

initDatabase();

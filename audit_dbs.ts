import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const files = fs.readdirSync(process.cwd()).filter(f => f.startsWith("obras.db"));
// Also check root
const rootFiles = fs.readdirSync("/").filter(f => f.startsWith("obras.db")).map(f => path.join("/", f));

const allFiles = [...files.map(f => path.join(process.cwd(), f)), ...rootFiles];

for (const f of allFiles) {
  try {
    const stats = fs.statSync(f);
    if (stats.isDirectory()) continue;
    
    const db = new Database(f);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const count = tables.length;
    console.log(`File: ${f}, Tables: ${count}, Size: ${stats.size} bytes`);
    db.close();
  } catch (e) {
    console.log(`File: ${f}, Error: ${e.message}`);
  }
}

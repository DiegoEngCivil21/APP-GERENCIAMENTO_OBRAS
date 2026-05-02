import Database from 'better-sqlite3';
const db = new Database('obras.db');
const etapas = db.prepare("SELECT * FROM v2_etapas LIMIT 10").all();
console.table(etapas);

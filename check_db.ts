import Database from 'better-sqlite3';
const db = new Database('obras.db');
console.log(db.prepare("SELECT tipo, count(*) FROM v2_itens GROUP BY tipo;").all());

import Database from 'better-sqlite3';
const db = new Database('obras.db');

try {
  const table = db.prepare("PRAGMA table_info(v2_orcamento_itens)").all();
  console.log("Table info for v2_orcamento_itens:", table);
} catch (e) {
  console.error(e);
}

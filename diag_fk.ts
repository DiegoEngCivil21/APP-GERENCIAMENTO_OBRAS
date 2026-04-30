import Database from 'better-sqlite3';
const db = new Database('obras.db');

try {
  const fks = db.prepare("PRAGMA foreign_key_list(v2_medicao_itens)").all();
  console.log("Foreign keys for v2_medicao_itens:", fks);
} catch (e) {
  console.error(e);
}

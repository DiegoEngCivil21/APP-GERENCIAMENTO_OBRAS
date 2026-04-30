import Database from 'better-sqlite3';
const db = new Database('obras.db');

try {
  const items = db.prepare("SELECT id, item_id, etapa_id FROM v2_orcamento_itens").all();
  console.log("Orcamento itens:", items);
} catch (e) {
  console.error(e);
}

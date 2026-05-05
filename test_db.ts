import Database from "better-sqlite3";
const db = new Database("obras.db");
console.log(db.prepare('SELECT composicao_id, item_id, quantidade, estado, data_referencia FROM v2_composicao_itens LIMIT 10').all());

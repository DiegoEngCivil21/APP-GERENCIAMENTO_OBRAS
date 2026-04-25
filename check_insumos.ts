import Database from 'better-sqlite3';
const db = new Database('obras.db');
const insumos = db.prepare("SELECT * FROM v2_itens WHERE tipo='insumo' AND categoria='Composição' LIMIT 5").all();
console.log("Insumos that are actually composições:", insumos);

const allInsumos = db.prepare("SELECT count(*) as count FROM v2_itens WHERE tipo='insumo'").get();
console.log("Total insumos:", allInsumos);

const allComposicoes = db.prepare("SELECT count(*) as count FROM v2_itens WHERE tipo='composicao'").get();
console.log("Total composições:", allComposicoes);

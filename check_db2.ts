import Database from 'better-sqlite3';
const db = new Database('obras.db');
console.log(db.prepare("SELECT categoria, count(*) FROM v2_itens WHERE tipo='insumo' GROUP BY categoria;").all());
console.log(db.prepare("SELECT * FROM v2_itens WHERE tipo='insumo' LIMIT 5;").all());

const Database = require('better-sqlite3');
const db = new Database('obras.db');
const res = db.prepare("SELECT * FROM v2_itens WHERE tipo='insumo' AND (nome LIKE '%COMPOSIÇÃO%' OR nome LIKE '%COMPOSICAO%') LIMIT 5;").all();
console.log(res);

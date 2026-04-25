import Database from "better-sqlite3";
const db = new Database("obras.db");
const precos = db.prepare("SELECT * FROM v2_precos LIMIT 10").all();
console.log(JSON.stringify(precos, null, 2));
const itens = db.prepare("SELECT * FROM v2_itens LIMIT 10").all();
console.log(JSON.stringify(itens, null, 2));

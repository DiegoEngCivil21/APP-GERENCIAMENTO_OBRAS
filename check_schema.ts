import Database from "better-sqlite3";
const db = new Database("obras.db");
console.log(db.prepare("PRAGMA table_info(v2_itens)").all());
console.log(db.prepare("PRAGMA index_list(v2_itens)").all());

import Database from "better-sqlite3";
const db = new Database("obras.db");
const dates = db.prepare("SELECT DISTINCT data_referencia FROM v2_precos ORDER BY data_referencia DESC").all();
console.log(JSON.stringify(dates, null, 2));

import Database from 'better-sqlite3';
const db = new Database('/app/applet/database.sqlite');
console.log("Obras:");
console.log(db.prepare("SELECT * FROM v2_obras LIMIT 1").all());
console.log("Etapas:");
console.log(db.prepare("SELECT * FROM v2_etapas LIMIT 5").all());
console.log("Atividades:");
console.log(db.prepare("SELECT id, item_numero, nome, progresso, etapa_id FROM v2_atividades ORDER BY item_numero").all());

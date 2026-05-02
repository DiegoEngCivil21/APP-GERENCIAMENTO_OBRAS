import Database from 'better-sqlite3';
const db = new Database('obras.db');
const atvs = db.prepare("SELECT * FROM v2_atividades").all();
console.table(atvs.map(a => ({ id: a.id, obra_id: a.obra_id, nome: a.nome, item_numero: a.item_numero, start: a.data_inicio_prevista, end: a.data_fim_prevista })));

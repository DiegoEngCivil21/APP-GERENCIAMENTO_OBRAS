import { db } from './src/db';
const rows = db.prepare("SELECT id, nome FROM v2_atividades LIMIT 5").all();
console.log(rows);

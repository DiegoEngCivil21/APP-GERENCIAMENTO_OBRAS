import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "obras.db");
const db = new Database(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables in obras.db:", tables.map((t: any) => t.name));

const tablesToCount = ['v2_obras', 'v2_itens', 'v2_orcamento_itens', 'v2_precos', 'v2_etapas', 'v2_atividades', 'v2_medicoes', 'v2_diario_obra'];
for (const table of tablesToCount) {
  const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
  console.log(`Count in ${table}: ${count.count}`);
}

const obras = db.prepare("SELECT * FROM v2_obras").all();
console.log("Obras in v2_obras:", JSON.stringify(obras, null, 2));

const atividades = db.prepare("SELECT * FROM v2_atividades").all();
console.log("Atividades in v2_atividades:", JSON.stringify(atividades, null, 2));

import { db } from "./src/db";
try {
    const tableInfo = db.prepare("PRAGMA table_info(v2_users)").all();
    console.log("Colunas da tabela v2_users:", tableInfo);
} catch (e) {
    console.error("Erro ao inspecionar tabela:", e);
}

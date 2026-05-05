import { db } from "./src/db";
const info = db.prepare("PRAGMA table_info(v2_etapas)").all();
const indexInfo = db.prepare("PRAGMA index_list(v2_etapas)").all();
console.log("Table info:", info);
console.log("Index list:", indexInfo);
for (const idx of indexInfo as any[]) {
    const idxDetails = db.prepare(`PRAGMA index_info(${idx.name})`).all();
    console.log(`Index details for ${idx.name}:`, idxDetails);
}

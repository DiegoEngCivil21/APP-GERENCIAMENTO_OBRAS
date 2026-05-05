import { db } from "./src/db";
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='v2_composicao_itens'").get() as any;
console.log(schema?.sql);

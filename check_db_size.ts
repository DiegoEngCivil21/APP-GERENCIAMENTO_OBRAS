import fs from "fs";
import path from "path";

const dbPath = path.join(process.cwd(), "obras.db");
const stats = fs.statSync(dbPath);
console.log("Database file size:", stats.size, "bytes");

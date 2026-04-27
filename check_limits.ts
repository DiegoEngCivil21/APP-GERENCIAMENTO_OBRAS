
import { db } from "./src/db";
const settings = db.prepare("SELECT * FROM v2_settings WHERE key = 'plan_limits'").get() as any;
console.log("Plan Limits Value:", settings?.value);

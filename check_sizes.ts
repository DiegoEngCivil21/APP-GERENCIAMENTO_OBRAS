
import fs from "fs";
const files = ["obras.db", "obras.db.bak2", "obras.db.bak3", "database.sqlite"];
files.forEach(f => {
  if (fs.existsSync(f)) {
    const stat = fs.statSync(f);
    console.log(`${f}: ${stat.size} bytes`);
  } else {
    console.log(`${f}: missing`);
  }
});

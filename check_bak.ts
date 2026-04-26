import fs from 'fs';

const files = ['obras.db', 'obras.db.bak2', 'obras.db.bak3', 'obras.db.corrupt', 'obras.db.new'];
for (const file of files) {
  try {
    const stats = fs.statSync(`./${file}`);
    console.log(`${file}: ${stats.size} bytes, modified: ${stats.mtime}`);
  } catch(e) {
    console.log(`${file}: not found`);
  }
}

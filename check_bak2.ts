import Database from 'better-sqlite3';

const files = ['obras.db.bak2', 'obras.db.new', 'obras.db.corrupt'];

for (const f of files) {
  try {
    const db = new Database(`./${f}`);
    const res = db.pragma('integrity_check');
    console.log(`Integrity of ${f}:`, res);
  } catch(e) {
    console.log(`Failed to open ${f}:`, e.message);
  }
}

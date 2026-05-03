import Database from 'better-sqlite3';

const db = new Database('obras.db');
try {
  db.exec('ALTER TABLE v2_obras ADD COLUMN descricao TEXT;');
  console.log("Column added successfully.");
} catch (e: any) {
  if (e.message.includes('duplicate column name')) {
    console.log("Column already exists.");
  } else {
    console.error(e);
  }
}

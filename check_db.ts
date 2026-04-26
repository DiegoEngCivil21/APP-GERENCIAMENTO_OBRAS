import Database from 'better-sqlite3';

try {
  const db = new Database('./obras.db');
  
  const result = db.pragma('integrity_check');
  console.log('Integrity check result:', result);
  
  const foreignKeyCheck = db.pragma('foreign_key_check');
  console.log('Foreign key check result:', foreignKeyCheck);
  
  console.log('Database connection successful.');
} catch (e) {
  console.error('Error opening database:', e);
}

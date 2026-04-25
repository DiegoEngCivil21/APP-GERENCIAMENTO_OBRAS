import Database from 'better-sqlite3';
const db = new Database('obras.db');
console.log(db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all());

import fs from 'fs';
const buf = fs.readFileSync('./obras.db');
console.log(buf.slice(0, 32).toString('utf-8'));

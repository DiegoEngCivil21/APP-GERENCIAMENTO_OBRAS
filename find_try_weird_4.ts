import fs from 'fs';

const lines = fs.readFileSync('server.ts', 'utf8').split('\n');
console.log("Line 150:", lines[149]);
console.log("Line 151:", lines[150]);
console.log("Line 152:", lines[151]);
console.log("Line 153:", lines[152]);
console.log("Line 154:", lines[153]);

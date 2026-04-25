import fs from 'fs';

const content = fs.readFileSync('server.ts', 'utf-8');
const lines = content.split('\n');
const line152 = lines[151]; // 0-indexed
const line151 = lines[150];
const line150 = lines[149];

console.log(`Line 150: ${line150}`);
console.log(`Line 151: ${line151}`);
console.log(`Line 152: ${line152}`);

for (let i = 0; i < line152.length; i++) {
    console.log(`Char ${i}: ${line152[i]} (${line152.charCodeAt(i)})`);
}

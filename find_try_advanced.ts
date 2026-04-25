import fs from 'fs';

const content = fs.readFileSync('server.ts', 'utf-8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toLowerCase().includes('try') && !line.trim().startsWith('try') && !line.includes('//')) {
        console.log(`Line ${i + 1}: ${line}`);
    }
}

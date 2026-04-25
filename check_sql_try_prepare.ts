import fs from 'fs';

const content = fs.readFileSync('server.ts', 'utf-8');
const regex = /db\.prepare\(`([\s\S]*?)`\)/g;
let match;

while ((match = regex.exec(content)) !== null) {
    const sql = match[1];
    if (sql.toLowerCase().includes('try')) {
        console.log(`Found "try" inside db.prepare backticks!`);
        const index = match.index;
        const lineNum = content.substring(0, index).split('\n').length;
        console.log(`Line number: ${lineNum}`);
    }
}

const regex2 = /db\.prepare\("([\s\S]*?)"\)/g;
while ((match = regex2.exec(content)) !== null) {
    const sql = match[1];
    if (sql.toLowerCase().includes('try')) {
        console.log(`Found "try" inside db.prepare double quotes!`);
        const index = match.index;
        const lineNum = content.substring(0, index).split('\n').length;
        console.log(`Line number: ${lineNum}`);
    }
}

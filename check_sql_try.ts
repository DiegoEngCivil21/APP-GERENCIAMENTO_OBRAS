import fs from 'fs';

const content = fs.readFileSync('server.ts', 'utf8');
const execPattern = /db\.exec\(`([\s\S]*?)`\)/g;
let match;
while ((match = execPattern.exec(content)) !== null) {
    const sql = match[1];
    if (sql.toLowerCase().includes('try')) {
        console.log("FOUND TRY IN QUERY:", sql);
    }
}
const prepPattern = /db\.prepare\(`([\s\S]*?)`\)/g;
while ((match = prepPattern.exec(content)) !== null) {
    const sql = match[1];
    if (sql.toLowerCase().includes('try')) {
        console.log("FOUND TRY IN PREPARE QUERY:", sql);
    }
}

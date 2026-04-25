import fs from 'fs';

const content = fs.readFileSync('server.ts', 'utf8');

const regex = /db\.(exec|prepare)\(["']([\s\S]*?)["']\)/g;
let match;
while ((match = regex.exec(content)) !== null) {
    const sql = match[2];
    if (sql.toLowerCase().includes('try')) {
        console.log("FOUND TRY IN SINGLE QUOTE QUERY:", sql);
    }
}

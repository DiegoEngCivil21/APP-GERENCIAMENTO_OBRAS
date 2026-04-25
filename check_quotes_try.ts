import fs from 'fs';

const content = fs.readFileSync('server.ts', 'utf-8');
const regex = /"([^"]*?)"/g;
let match;

while ((match = regex.exec(content)) !== null) {
    const str = match[1];
    if (str.toLowerCase().includes('try')) {
        console.log(`Found "try" inside double quotes!`);
        const index = match.index;
        const lineNum = content.substring(0, index).split('\n').length;
        console.log(`Line number: ${lineNum}`);
        console.log(`Content: ${str}`);
    }
}

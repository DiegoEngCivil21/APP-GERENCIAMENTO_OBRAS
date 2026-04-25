import fs from 'fs';

const content = fs.readFileSync('server.ts', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('db.exec') && !line.includes(');')) {
       let j = i;
       let closed = false;
       while (j < i + 50 && j < lines.length) {
           if (lines[j].includes(');')) {
               closed = true;
               break;
           }
           if (lines[j].includes('try {')) {
               console.log("Found try inside open db.exec!", "Line", i);
           }
           j++;
       }
    }
}

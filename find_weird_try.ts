import fs from 'fs';

const content = fs.readFileSync('server.ts', 'utf8');

const iter = content.matchAll(/db\.exec\([`'"]([\s\S]*?)[`'"]\)/g);
for (const match of iter) {
    if (match[1].toLowerCase().includes('try') && !match[1].toLowerCase().includes('country') && !match[1].toLowerCase().includes('entry') && !match[1].toLowerCase().includes('registry')) {
        console.log("SQL executing:", match[1]);
    }
}

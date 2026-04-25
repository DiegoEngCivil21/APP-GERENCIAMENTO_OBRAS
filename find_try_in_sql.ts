import fs from 'fs';

const content = fs.readFileSync('server.ts', 'utf8');

// match all `try` occurrences in the file and print 30 chars before and after
const iter = content.matchAll(/try/gi);
for (const match of iter) {
    if (match.index) {
        const snippet = content.substring(Math.max(0, match.index - 30), Math.min(content.length, match.index + 30));
        if (snippet.includes('db.exec') || snippet.includes('db.prepare') || snippet.includes('CREATE') || snippet.includes('INSERT') || snippet.includes('SELECT')) {
            console.log("Snippet:", snippet.replace(/\n/g, '\\n'));
        }
    }
}

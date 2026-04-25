import fs from 'fs';

function checkBraces() {
    const content = fs.readFileSync('server.ts', 'utf-8');
    let depth = 0;
    
    // Very naive, remove comments and strings first maybe?
    // Let's rely on typescript parser
}

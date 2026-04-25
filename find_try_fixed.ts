import fs from 'fs';

const content = fs.readFileSync('server.ts', 'utf8');

const start = content.indexOf('function initDatabase()');
const end = content.indexOf('function createIndices()', start);

const block = content.substring(start, end);

if (block.toLowerCase().includes('try')) {
    console.log("Found try in initDatabase block at index", block.toLowerCase().indexOf('try'));
    console.log(block.substring(block.toLowerCase().indexOf('try') - 50, block.toLowerCase().indexOf('try') + 50));
} else {
    console.log("No try found in initDatabase!");
}

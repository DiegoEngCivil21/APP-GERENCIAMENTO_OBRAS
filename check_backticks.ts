import fs from 'fs';
const content = fs.readFileSync('server.ts', 'utf-8');
const backticks = (content.match(/`/g) || []).length;
console.log(`Total backticks: ${backticks}`);
if (backticks % 2 !== 0) {
    console.log("Unmatched backticks found!");
} else {
    console.log("Backticks are balanced.");
}

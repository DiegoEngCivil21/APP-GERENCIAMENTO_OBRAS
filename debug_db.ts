import { db } from './src/db.ts';

// We cannot directly access dbPath because it is not exported, 
// but we can try to get it if we inspect the behavior.
// Instead, let's look at the db object itself if possible, but db is a Proxy.

// Let's just create a new db instance to see where it *might* be pointing to
import Database from 'better-sqlite3';
import path from 'path';

// Re-simulate the logic in db.ts
const __filename = import.meta.url; // Different in ESM but similar
// Actually, let's just use path.resolve()
console.log("Current working directory:", process.cwd());
console.log("Database file path would be:", path.join(process.cwd(), "obras.db"));

// Let's see if we can instantiate it and check the name
try {
    const d = new Database(path.join(process.cwd(), "obras.db"));
    console.log("Database opened:", d.name);
} catch (e) {
    console.error("Error opening:", e);
}

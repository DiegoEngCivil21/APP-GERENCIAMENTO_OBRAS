import { db } from './src/db.ts';
import fs from 'fs';
import path from 'path';

// Let's print some info to verify db is initialized
console.log("DB initialized:", db !== null);

// If I run this and it creates the file, maybe the app will see it
console.log("DB path:", db.name);

import { db } from './src/db';
try {
    db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY)");
    console.log("Success!");
} catch (e) {
    console.error(e);
}

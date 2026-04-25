import { db } from "./src/db";

try {
    const users = db.prepare("SELECT email FROM v2_users").all();
    if (users.length === 0) {
        console.log("Nenhum usuário encontrado no sistema.");
    } else {
        console.log("Usuários cadastrados:");
        users.forEach((u: any) => console.log(`- ${u.email}`));
    }
} catch (e) {
    console.error("Erro ao acessar usuários:", e);
}

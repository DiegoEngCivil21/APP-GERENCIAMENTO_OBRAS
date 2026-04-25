import { db } from "./src/db";
import bcrypt from "bcryptjs";

const email = "admin@gestao.com";
const newPassword = "123456";

try {
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const stmt = db.prepare("UPDATE v2_users SET password = ? WHERE email = ?");
    const info = stmt.run(hashedPassword, email);
    
    if (info.changes > 0) {
        console.log(`Senha do usuário ${email} foi redefinida para '123456'.`);
    } else {
        console.log(`Usuário ${email} não encontrado.`);
    }
} catch (e) {
    console.error("Erro ao redefinir senha:", e);
}

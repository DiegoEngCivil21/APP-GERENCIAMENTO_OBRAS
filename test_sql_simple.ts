import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(':memory:');

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        documento TEXT, -- CNPJ
        plano TEXT DEFAULT 'Básico', -- Básico, Pro, Enterprise
        limite_usuarios INTEGER DEFAULT 5,
        assinatura_texto TEXT,
        rodape_texto TEXT,
        logo_url TEXT,
        config_json TEXT, -- Configurações gerais em JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("v2_tenants created");

  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_signatures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        role TEXT,
        image_data TEXT, -- Base64 or URL
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES v2_tenants(id) ON DELETE CASCADE
    );
  `);
  console.log("v2_signatures created");
} catch (e) {
  console.error(e);
}

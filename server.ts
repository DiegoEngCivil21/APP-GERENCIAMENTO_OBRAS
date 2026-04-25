import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { differenceInDays, addDays, parseISO, format } from 'date-fns';
import { getCompositionTree, getFlatCompositionItems, checkCompositionIntegrity, getPrecosEmLote } from "./src/services/compositionService";
import { calculateCriticalPath } from "./src/services/cpmService";
import { db, initDb } from "./src/db";

// MOTOR DE CÁLCULO DINÂMICO
const calcularDatas = (atividade: any, predecessores: any[]) => {
  let inicio = atividade.data_inicio_prevista ? parseISO(atividade.data_inicio_prevista) : new Date();
  
  // Se tem predecessores, o início é o fim máximo deles + lag
  if (predecessores && predecessores.length > 0) {
    const fimMaxPredecessores = Math.max(...predecessores.map(p => parseISO(p.data_fim_prevista).getTime()));
    inicio = new Date(fimMaxPredecessores);
  }

  const duracao = atividade.duracao_dias || 1;
  const fim = addDays(inicio, duracao);

  return {
    data_inicio_prevista: format(inicio, 'yyyy-MM-dd'),
    data_fim_prevista: format(fim, 'yyyy-MM-dd')
  };
};

console.log("Server starting...");

function truncateToTwo(num: number): number {
  return Math.floor(num * 100 + 0.0000001) / 100.0;
}

// Helper to normalize date format from MM/YYYY to YYYY-MM-DD
function normalizeDate(dateStr: any): string {
  if (!dateStr || dateStr === 'Todos' || dateStr === '') {
    return '2029-12-31';
  }
  const str = String(dateStr);
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
  if (str.match(/^\d{4}-\d{2}$/)) {
    const [y, m] = str.split('-');
    try {
      const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
      return `${y}-${m.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } catch (e) {
      return `${str}-01`;
    }
  }
  if (str.match(/^\d{2}\/\d{4}$/)) {
    const [m, y] = str.split('/');
    try {
      const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
      return `${y}-${m.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } catch (e) {
      return `${y}-${m.padStart(2, '0')}-01`;
    }
  }
  return str;
}

function inferCategory(descricao: string, currentCategory: string = 'Material'): string {
  const desc = (descricao || '').toUpperCase();
  
  if (desc.includes('EXAME') || desc.includes('IPI') || desc.includes('ENCARGO') || desc.includes('SEGURO') || desc.includes('TAXA') || desc.includes('CURSO') || desc.includes('TREINAMENTO') || desc.includes('ALIMENTAÇÃO') || desc.includes('TRANSPORTE') || desc.includes('EPI')) {
    return 'Encargos';
  }
  
  if (desc.includes('PEDREIRO') || desc.includes('SERVENTE') || desc.includes('CARPINTEIRO') || desc.includes('PINTOR') || desc.includes('ELETRICISTA') || desc.includes('ENCANADOR') || desc.includes('MESTRE') || desc.includes('AUXILIAR') || desc.includes('OPERADOR') || desc.includes('ARMADOR') || desc.includes('MONTADOR')) {
    return 'Mão de Obra';
  }
  
  if (desc.includes('CAMINHAO') || desc.includes('BETONEIRA') || desc.includes('TRATOR') || desc.includes('ESCAVADEIRA') || desc.includes('COMPACTADOR') || desc.includes('FURADEIRA') || desc.includes('SERRA') || desc.includes('MAQUINA') || desc.includes('EQUIPAMENTO') || desc.includes('VEICULO')) {
    return 'Equipamento';
  }

  return currentCategory || 'Material';
}

function getNextProprioCode(): string {
  try {
    const lastItem = db.prepare(`
      SELECT codigo 
      FROM v2_itens 
      WHERE base = 'PRÓPRIO' AND codigo LIKE 'P-%' 
      ORDER BY CAST(SUBSTR(codigo, 3) AS INTEGER) DESC 
      LIMIT 1
    `).get() as { codigo: string } | undefined;

    if (!lastItem) return 'P-0001';
    
    const parts = lastItem.codigo.split('-');
    if (parts.length < 2) return 'P-0001';
    
    const lastNum = parseInt(parts[1], 10);
    if (isNaN(lastNum)) return 'P-0001';
    
    return `P-${String(lastNum + 1).padStart(4, '0')}`;
  } catch (e) {
    console.error("Error generating next code:", e);
    return `P-${Date.now()}`;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "obras.db");

function initDatabase() {
  const dbExists = fs.existsSync(dbPath);

  // Initialize Database Tables (Always run to ensure all tables exist)
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user', -- admin_master, admin_pj, orcamentista
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES v2_tenants(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER,
        base TEXT DEFAULT 'SINAPI',
        codigo TEXT,
        nome TEXT NOT NULL,
        unidade TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('insumo', 'composicao')),
        categoria TEXT DEFAULT 'Material',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (base, codigo, tenant_id),
        FOREIGN KEY (tenant_id) REFERENCES v2_tenants(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_precos (
        item_id INTEGER NOT NULL,
        estado TEXT NOT NULL,
        tipo_desoneracao TEXT NOT NULL,
        data_referencia DATE NOT NULL,
        preco_unitario REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (item_id, estado, tipo_desoneracao, data_referencia),
        FOREIGN KEY (item_id) REFERENCES v2_itens(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_composicao_itens (
        composicao_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        quantidade REAL NOT NULL,
        perda REAL DEFAULT 0,
        estado TEXT DEFAULT 'DF',
        data_referencia DATE DEFAULT '2026-04-01',
        PRIMARY KEY (composicao_id, item_id, estado, data_referencia),
        FOREIGN KEY (composicao_id) REFERENCES v2_itens(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES v2_itens(id) ON DELETE RESTRICT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_obras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER,
        nome TEXT NOT NULL,
        cliente TEXT,
        status TEXT DEFAULT 'Em Planejamento',
        endereco TEXT,
        data_inicio DATE,
        data_inicio_real DATE,
        data_fim_prevista DATE,
        uf TEXT,
        localizacao TEXT,
        bdi REAL DEFAULT 0,
        desonerado INTEGER DEFAULT 1,
        data_referencia TEXT DEFAULT '2025-10',
        bancos_ativos TEXT DEFAULT '["sinapi"]',
        custos_reais TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES v2_tenants(id) ON DELETE CASCADE
    );
  `);


  // Migration for existing databases
  try {
    db.exec("ALTER TABLE v2_users ADD COLUMN tenant_id INTEGER REFERENCES v2_tenants(id) ON DELETE CASCADE;");
    console.log("✅ Coluna 'tenant_id' adicionada à tabela 'v2_users'.");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE v2_obras ADD COLUMN tenant_id INTEGER REFERENCES v2_tenants(id) ON DELETE CASCADE;");
    console.log("✅ Coluna 'tenant_id' adicionada à tabela 'v2_obras'.");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE v2_itens ADD COLUMN tenant_id INTEGER REFERENCES v2_tenants(id) ON DELETE CASCADE;");
    console.log("✅ Coluna 'tenant_id' adicionada à tabela 'v2_itens'.");
  } catch (e) {}

  try {
    db.exec(`
      ALTER TABLE v2_itens ADD COLUMN categoria TEXT DEFAULT 'Material';
    `);
  } catch (e) {}
  try {
    db.exec(`
      ALTER TABLE v2_obras ADD COLUMN desonerado INTEGER DEFAULT 1;
    `);
  } catch (e) {}
  try {
    db.exec(`
      ALTER TABLE v2_obras ADD COLUMN data_referencia TEXT DEFAULT '2025-10';
    `);
  } catch (e) {}
  try {
    db.exec(`
      ALTER TABLE v2_obras ADD COLUMN bancos_ativos TEXT DEFAULT '["sinapi"]';
    `);
  } catch (e) {}


  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_etapas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        obra_id INTEGER NOT NULL,
        etapa_pai_id INTEGER,
        codigo TEXT,
        nome TEXT NOT NULL,
        descricao TEXT,
        ordem INTEGER NOT NULL DEFAULT 0,
        nivel INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (obra_id) REFERENCES v2_obras(id) ON DELETE CASCADE,
        FOREIGN KEY (etapa_pai_id) REFERENCES v2_etapas(id) ON DELETE CASCADE,
        UNIQUE (obra_id, codigo),
        UNIQUE (obra_id, etapa_pai_id, nome)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_orcamento_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        etapa_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        item_numero TEXT,
        quantidade REAL NOT NULL,
        custo_unitario_aplicado REAL,
        ordem INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (etapa_id) REFERENCES v2_etapas(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES v2_itens(id) ON DELETE RESTRICT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_atividades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        obra_id INTEGER NOT NULL,
        orcamento_item_id INTEGER,
        item_numero TEXT,
        predecessor_id INTEGER,
        lag_dias INTEGER DEFAULT 0,
        nome TEXT NOT NULL,
        descricao TEXT,
        data_inicio_prevista DATE,
        data_fim_prevista DATE,
        data_inicio_base DATE,
        data_fim_base DATE,
        duracao_dias INTEGER,
        progresso INTEGER DEFAULT 0,
        recurso TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (obra_id) REFERENCES v2_obras(id) ON DELETE CASCADE,
        FOREIGN KEY (orcamento_item_id) REFERENCES v2_orcamento_itens(id) ON DELETE SET NULL,
        FOREIGN KEY (predecessor_id) REFERENCES v2_atividades(id) ON DELETE SET NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_atividade_dependencias (
        atividade_id INTEGER NOT NULL,
        depende_de_id INTEGER NOT NULL,
        tipo TEXT DEFAULT 'termina_inicia',
        PRIMARY KEY (atividade_id, depende_de_id),
        FOREIGN KEY (atividade_id) REFERENCES v2_atividades(id) ON DELETE CASCADE,
        FOREIGN KEY (depende_de_id) REFERENCES v2_atividades(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_diario_obra (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        obra_id INTEGER NOT NULL,
        data DATE NOT NULL,
        texto TEXT,
        usuario_responsavel TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (obra_id) REFERENCES v2_obras(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_diario_fotos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        diario_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        descricao TEXT,
        FOREIGN KEY (diario_id) REFERENCES v2_diario_obra(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_medicoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        obra_id INTEGER NOT NULL,
        periodo_inicio DATE NOT NULL,
        periodo_fim DATE NOT NULL,
        data_medicao DATE NOT NULL,
        observacoes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (obra_id) REFERENCES v2_obras(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS v2_medicao_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medicao_id INTEGER NOT NULL,
        orcamento_item_id INTEGER NOT NULL,
        quantidade_medida REAL NOT NULL,
        observacao TEXT,
        FOREIGN KEY (medicao_id) REFERENCES v2_medicoes(id) ON DELETE CASCADE,
        FOREIGN KEY (orcamento_item_id) REFERENCES v2_orcamento_itens(id) ON DELETE RESTRICT,
        UNIQUE (medicao_id, orcamento_item_id)
    );
  `);

  // Migration for existing tables
  try {
    const tableInfo = db.prepare("PRAGMA table_info(v2_orcamento_itens)").all() as any[];
    const hasItemNumero = tableInfo.some(col => col.name === 'item_numero');
    if (!hasItemNumero) {
      db.prepare("ALTER TABLE v2_orcamento_itens ADD COLUMN item_numero TEXT").run();
    }
  } catch (e) {
    console.error("Migration error for v2_orcamento_itens:", e);
  }

  // Migration for v2_atividades: add predecessor_id and duracao_dias if they don't exist
  try {
    const columns = db.prepare("PRAGMA table_info(v2_atividades)").all() as any[];
    if (columns.length > 0) {
      const hasPredecessor = columns.some(c => c.name === 'predecessor_id');
      const hasDuracao = columns.some(c => c.name === 'duracao_dias');
      const hasItemNumero = columns.some(c => c.name === 'item_numero');
      
      if (!hasPredecessor) {
        db.exec("ALTER TABLE v2_atividades ADD COLUMN predecessor_id INTEGER REFERENCES v2_atividades(id) ON DELETE SET NULL");
        console.log("✅ Coluna predecessor_id adicionada a v2_atividades");
      }
      if (!hasDuracao) {
        db.exec("ALTER TABLE v2_atividades ADD COLUMN duracao_dias INTEGER");
        console.log("✅ Coluna duracao_dias adicionada a v2_atividades");
      }
      if (!hasItemNumero) {
        db.exec("ALTER TABLE v2_atividades ADD COLUMN item_numero TEXT");
        console.log("✅ Coluna item_numero adicionada a v2_atividades");
      }
      const hasRecurso = columns.some(c => c.name === 'recurso');
      if (!hasRecurso) {
        db.exec("ALTER TABLE v2_atividades ADD COLUMN recurso TEXT");
        console.log("✅ Coluna recurso adicionada a v2_atividades");
      }
      const hasPredecessoresTexto = columns.some(c => c.name === 'predecessores_texto');
      if (!hasPredecessoresTexto) {
        db.exec("ALTER TABLE v2_atividades ADD COLUMN predecessores_texto TEXT");
        console.log("✅ Coluna predecessores_texto adicionada a v2_atividades");
      }
      const hasDataInicioReal = columns.some(c => c.name === 'data_inicio_real');
      if (!hasDataInicioReal) {
        db.exec("ALTER TABLE v2_atividades ADD COLUMN data_inicio_real DATE");
        console.log("✅ Coluna data_inicio_real adicionada a v2_atividades");
      }
      const hasDataFimReal = columns.some(c => c.name === 'data_fim_real');
      if (!hasDataFimReal) {
        db.exec("ALTER TABLE v2_atividades ADD COLUMN data_fim_real DATE");
        console.log("✅ Coluna data_fim_real adicionada a v2_atividades");
      }
      const hasIsMarco = columns.some(c => c.name === 'is_marco');
      if (!hasIsMarco) {
        db.exec("ALTER TABLE v2_atividades ADD COLUMN is_marco BOOLEAN DEFAULT 0");
        console.log("✅ Coluna is_marco adicionada a v2_atividades");
      }
      const hasDataInicioBase = columns.some(c => c.name === 'data_inicio_base');
      if (!hasDataInicioBase) {
        db.exec("ALTER TABLE v2_atividades ADD COLUMN data_inicio_base DATE");
        console.log("✅ Coluna data_inicio_base adicionada a v2_atividades");
      }
      const hasDataFimBase = columns.some(c => c.name === 'data_fim_base');
      if (!hasDataFimBase) {
        db.exec("ALTER TABLE v2_atividades ADD COLUMN data_fim_base DATE");
        console.log("✅ Coluna data_fim_base adicionada a v2_atividades");
      }
      const columnsUpdated = db.prepare("PRAGMA table_info(v2_atividades)").all() as any[];
      const hasProdutividade = columnsUpdated.some(c => c.name === 'produtividade');
      if (!hasProdutividade) {
        db.exec("ALTER TABLE v2_atividades ADD COLUMN produtividade REAL DEFAULT 1");
        console.log("✅ Coluna produtividade adicionada a v2_atividades");
      }
      const hasQuantidadeEquipe = columnsUpdated.some(c => c.name === 'quantidade_equipe');
      if (!hasQuantidadeEquipe) {
        db.exec("ALTER TABLE v2_atividades ADD COLUMN quantidade_equipe REAL DEFAULT 1");
        console.log("✅ Coluna quantidade_equipe adicionada a v2_atividades");
      }
    }
  } catch (err) {
    console.error("Error migrating v2_atividades:", err);
  }

  // Create Indices after all tables are created
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_v2_itens_base_codigo ON v2_itens(base, codigo);
    CREATE INDEX IF NOT EXISTS idx_v2_itens_codigo ON v2_itens(codigo);
    CREATE INDEX IF NOT EXISTS idx_v2_itens_tipo ON v2_itens(tipo);
    CREATE INDEX IF NOT EXISTS idx_v2_precos_lookup ON v2_precos(item_id, estado, tipo_desoneracao, data_referencia DESC);
    CREATE INDEX IF NOT EXISTS idx_v2_composicao_itens_comp ON v2_composicao_itens(composicao_id, estado, data_referencia);
    CREATE INDEX IF NOT EXISTS idx_v2_composicao_itens_item ON v2_composicao_itens(item_id);
    CREATE INDEX IF NOT EXISTS idx_v2_orcamento_itens_etapa ON v2_orcamento_itens(etapa_id);
    CREATE INDEX IF NOT EXISTS idx_v2_etapas_obra ON v2_etapas(obra_id);
    CREATE INDEX IF NOT EXISTS idx_v2_atividades_obra ON v2_atividades(obra_id);
    CREATE INDEX IF NOT EXISTS idx_v2_medicoes_obra ON v2_medicoes(obra_id);
    CREATE INDEX IF NOT EXISTS idx_v2_diario_obra ON v2_diario_obra(obra_id);
  `);

  if (dbExists) {
    console.log(`✅ Conectado ao banco de dados existente: ${dbPath}`);
    // Migration: Ensure bdi column exists in v2_obras
    try {
      db.prepare("ALTER TABLE v2_obras ADD COLUMN bdi REAL DEFAULT 0").run();
      console.log("✅ Coluna 'bdi' adicionada à tabela 'v2_obras'.");
    } catch (e) {
      // Column likely already exists
    }
    try {
      db.prepare("ALTER TABLE v2_obras ADD COLUMN bdi_incidencia TEXT DEFAULT 'unitario'").run();
      console.log("✅ Coluna 'bdi_incidencia' adicionada à tabela 'v2_obras'.");
    } catch (e) {
      // Column likely already exists
    }
    try {
      db.prepare("ALTER TABLE v2_obras ADD COLUMN bdi_tipo TEXT DEFAULT 'unico'").run();
      console.log("✅ Coluna 'bdi_tipo' adicionada à tabela 'v2_obras'.");
    } catch (e) {
      // Column likely already exists
    }
    try {
      db.prepare("ALTER TABLE v2_obras ADD COLUMN descricao TEXT").run();
      console.log("✅ Coluna 'descricao' adicionada à tabela 'v2_obras'.");
    } catch (e) {
      // Column likely already exists
    }
    try {
      db.prepare("ALTER TABLE v2_obras ADD COLUMN data_inicio_real DATE").run();
      console.log("✅ Coluna 'data_inicio_real' adicionada à tabela 'v2_obras'.");
    } catch (e) {
      // Column likely already exists
    }
    try {
      db.prepare("ALTER TABLE v2_obras ADD COLUMN configuracao_cronograma TEXT DEFAULT '{\"workingDays\":[1,2,3,4,5],\"holidays\":[],\"recessPeriods\":[]}'").run();
      console.log("✅ Coluna 'configuracao_cronograma' adicionada à tabela 'v2_obras'.");
    } catch (e) {
      // Column likely already exists
    }
  } else {
    console.log(`⚠️ Criando novo banco de dados: ${dbPath}`);
  }

  // Migration for v2_itens to add 'base' and 'categoria' columns if they don't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(v2_itens)").all() as any[];
    if (tableInfo.length > 0) {
      const hasBase = tableInfo.some(col => col.name === 'base');
      if (!hasBase) {
        console.log("Adding 'base' column to v2_itens...");
        db.prepare("ALTER TABLE v2_itens ADD COLUMN base TEXT DEFAULT 'SINAPI'").run();
      }
      const hasCategoria = tableInfo.some(col => col.name === 'categoria');
      if (!hasCategoria) {
        console.log("Adding 'categoria' column to v2_itens...");
        db.prepare("ALTER TABLE v2_itens ADD COLUMN categoria TEXT DEFAULT 'Material'").run();
      }
      const hasUpdatedAt = tableInfo.some(col => col.name === 'updated_at');
      if (!hasUpdatedAt) {
        console.log("Adding 'updated_at' column to v2_itens...");
        db.prepare("ALTER TABLE v2_itens ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP").run();
      }
    }
  } catch (e) {
    console.error("Error migrating v2_itens:", e);
  }

  // Migration: Add etapa_id to v2_atividades
  try {
    const columns = db.prepare("PRAGMA table_info(v2_atividades)").all() as any[];
    if (columns.length > 0) {
      const hasEtapaId = columns.some(c => c.name === 'etapa_id');
      if (!hasEtapaId) {
        db.exec("ALTER TABLE v2_atividades ADD COLUMN etapa_id INTEGER REFERENCES v2_etapas(id) ON DELETE SET NULL");
        console.log("✅ Coluna etapa_id adicionada a v2_atividades");
      }
    }
  } catch (err) {
    console.error("Error migrating v2_atividades:", err);
  }

  // Migration: Add updated_at to v2_etapas
  try {
    const columns = db.prepare("PRAGMA table_info(v2_etapas)").all() as any[];
    if (columns.length > 0) {
      const hasUpdatedAt = columns.some(c => c.name === 'updated_at');
      if (!hasUpdatedAt) {
        db.exec("ALTER TABLE v2_etapas ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
        console.log("✅ Coluna updated_at adicionada a v2_etapas");
      }
    }
  } catch (err) {
    console.error("Error migrating v2_etapas:", err);
  }

  // Migration: Add lag_dias to v2_atividade_dependencias
  try {
    const columns = db.prepare("PRAGMA table_info(v2_atividade_dependencias)").all() as any[];
    if (columns.length > 0) {
      const hasLag = columns.some(c => c.name === 'lag_dias');
      if (!hasLag) {
        db.exec("ALTER TABLE v2_atividade_dependencias ADD COLUMN lag_dias INTEGER DEFAULT 0");
        console.log("✅ Coluna lag_dias adicionada a v2_atividade_dependencias");
      }
    }
  } catch (err) {
    console.error("Error migrating v2_atividade_dependencias:", err);
  }

  // Migration: Add updated_at to v2_orcamento_itens
  try {
    const columns = db.prepare("PRAGMA table_info(v2_orcamento_itens)").all() as any[];
    if (columns.length > 0) {
      const hasUpdatedAt = columns.some(c => c.name === 'updated_at');
      if (!hasUpdatedAt) {
        db.exec("ALTER TABLE v2_orcamento_itens ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
        console.log("✅ Coluna updated_at adicionada a v2_orcamento_itens");
      }
    }
  } catch (err) {
    console.error("Error migrating v2_orcamento_itens:", err);
  }

  // Migration: Add columns to composicao_insumo if they don't exist
  try {
    const columns = db.prepare("PRAGMA table_info(composicao_insumo)").all() as any[];
    if (columns.length > 0) {
      const hasSubcomp = columns.some(c => c.name === 'id_subcomposicao');
      const hasTipo = columns.some(c => c.name === 'tipo_item');
      
      if (!hasSubcomp) {
        db.exec("ALTER TABLE composicao_insumo ADD COLUMN id_subcomposicao INTEGER REFERENCES composicoes(id_composicao)");
        console.log("✅ Coluna id_subcomposicao adicionada a composicao_insumo");
      }
      if (!hasTipo) {
        db.exec("ALTER TABLE composicao_insumo ADD COLUMN tipo_item TEXT DEFAULT 'INSUMO'");
        console.log("✅ Coluna tipo_item adicionada a composicao_insumo");
      }
    }
  } catch (err) {
    // Table might not exist
  }

  // Migration: Ensure orcamentos table has all required columns
  try {
    const orcamentosTableInfo = db.prepare("PRAGMA table_info(orcamentos)").all() as { name: string }[];
    if (orcamentosTableInfo.length > 0) {
      const orcamentosColumns = orcamentosTableInfo.map(c => c.name);

      const requiredOrcamentosColumns = [
        { name: 'item', type: 'TEXT' },
        { name: 'tipo', type: 'TEXT' },
        { name: 'item_tipo', type: 'TEXT' },
        { name: 'descricao', type: 'TEXT' },
        { name: 'base', type: 'TEXT' },
        { name: 'codigo', type: 'TEXT' },
        { name: 'unidade', type: 'TEXT' },
        { name: 'valor_bdi', type: 'DECIMAL(10,2)' }
      ];

      for (const col of requiredOrcamentosColumns) {
        if (!orcamentosColumns.includes(col.name)) {
          db.exec(`ALTER TABLE orcamentos ADD COLUMN ${col.name} ${col.type};`);
        }
      }
    }
  } catch (e) {}

  // Migration for obras table: add uf column
  try {
    const obrasTableInfo = db.prepare("PRAGMA table_info(obras)").all() as { name: string }[];
    if (obrasTableInfo.length > 0) {
      const obrasColumnNames = obrasTableInfo.map(c => c.name);
      if (!obrasColumnNames.includes('uf')) {
        db.exec("ALTER TABLE obras ADD COLUMN uf TEXT;");
      }
      if (!obrasColumnNames.includes('localizacao')) {
        db.exec("ALTER TABLE obras ADD COLUMN localizacao TEXT;");
      }
    }
  } catch (e) {}

  // Migration for insumos_cadastro: add UNIQUE(base, codigo)
  try {
    const insumosCadastroInfo = db.prepare("PRAGMA index_list(insumos_cadastro)").all() as any[];
    if (insumosCadastroInfo.length > 0) {
      const hasUniqueInsumo = insumosCadastroInfo.some(idx => idx.unique === 1 && idx.origin === 'u');
      if (!hasUniqueInsumo) {
        db.exec(`
          CREATE TABLE insumos_cadastro_new (
            id_insumo INTEGER PRIMARY KEY AUTOINCREMENT,
            base TEXT NOT NULL,
            codigo TEXT NOT NULL,
            descricao TEXT NOT NULL,
            unidade TEXT NOT NULL,
            tipo TEXT NOT NULL,
            UNIQUE(base, codigo)
          );
          INSERT OR IGNORE INTO insumos_cadastro_new SELECT * FROM insumos_cadastro;
          DROP TABLE insumos_cadastro;
          ALTER TABLE insumos_cadastro_new RENAME TO insumos_cadastro;
        `);
      }
    }
  } catch (e) {}

  // Migration for insumos_precos: add UNIQUE(id_insumo, estado, tipo_desoneracao, data_referencia)
  try {
    const insumosPrecosInfo = db.prepare("PRAGMA index_list(insumos_precos)").all() as any[];
    if (insumosPrecosInfo.length > 0) {
      const hasUniquePreco = insumosPrecosInfo.some(idx => idx.unique === 1 && idx.origin === 'u');
      if (!hasUniquePreco) {
        db.exec(`
          CREATE TABLE insumos_precos_new (
            id_preco INTEGER PRIMARY KEY AUTOINCREMENT,
            id_insumo INTEGER NOT NULL,
            estado TEXT NOT NULL,
            tipo_desoneracao TEXT NOT NULL,
            data_referencia DATE NOT NULL,
            preco_unitario DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (id_insumo) REFERENCES insumos_cadastro(id_insumo),
            UNIQUE(id_insumo, estado, tipo_desoneracao, data_referencia)
          );
          INSERT OR IGNORE INTO insumos_precos_new SELECT * FROM insumos_precos;
          DROP TABLE insumos_precos;
          ALTER TABLE insumos_precos_new RENAME TO insumos_precos;
        `);
      }
    }
  } catch (e) {}

  // Check if composicoes needs migration
  try {
    const tableInfo = db.prepare("PRAGMA table_info(composicoes)").all() as any[];
    if (tableInfo.length > 0) {
      const hasBase = tableInfo.some(col => col.name === 'base');
      
      if (!hasBase) {
        console.log("Migrating composicoes table...");
        db.transaction(() => {
          // Create new table
          db.prepare(`
            CREATE TABLE composicoes_new (
              id_composicao INTEGER PRIMARY KEY AUTOINCREMENT,
              base TEXT DEFAULT 'SINAPI',
              codigo_composicao TEXT NOT NULL,
              descricao TEXT NOT NULL,
              unidade TEXT NOT NULL,
              tipo TEXT DEFAULT 'Composição',
              UNIQUE(base, codigo_composicao)
            )
          `).run();
          
          // Copy data
          db.prepare(`
            INSERT OR IGNORE INTO composicoes_new (id_composicao, codigo_composicao, descricao, unidade)
            SELECT id_composicao, codigo_composicao, descricao, unidade FROM composicoes
          `).run();
          
          // Drop old and rename new
          db.prepare("DROP TABLE composicoes").run();
          db.prepare("ALTER TABLE composicoes_new RENAME TO composicoes").run();
          
          // Create precos table
          db.prepare(`
            CREATE TABLE IF NOT EXISTS composicoes_precos (
              id_preco INTEGER PRIMARY KEY AUTOINCREMENT,
              id_composicao INTEGER NOT NULL,
              estado TEXT NOT NULL,
              tipo_desoneracao TEXT NOT NULL,
              data_referencia DATE NOT NULL,
              preco_unitario DECIMAL(10,2) NOT NULL,
              FOREIGN KEY (id_composicao) REFERENCES composicoes(id_composicao),
              UNIQUE(id_composicao, estado, tipo_desoneracao, data_referencia)
            )
          `).run();
        })();
        console.log("Migration complete.");
      }
    }
  } catch (e) {}

  // Migration for v2_orcamento_itens: add progresso column
  try {
    const orcamentoItensTableInfo = db.prepare("PRAGMA table_info(v2_orcamento_itens)").all() as { name: string }[];
    if (orcamentoItensTableInfo.length > 0) {
      const orcamentoItensColumnNames = orcamentoItensTableInfo.map(c => c.name);
      if (!orcamentoItensColumnNames.includes('progresso')) {
        db.exec("ALTER TABLE v2_orcamento_itens ADD COLUMN progresso REAL DEFAULT 0;");
      }
    }
  } catch (e) {}

  // Migration for v2_etapas: add progresso column
  try {
    const etapasTableInfo = db.prepare("PRAGMA table_info(v2_etapas)").all() as { name: string }[];
    if (etapasTableInfo.length > 0) {
      const etapasColumnNames = etapasTableInfo.map(c => c.name);
      if (!etapasColumnNames.includes('progresso')) {
        db.exec("ALTER TABLE v2_etapas ADD COLUMN progresso REAL DEFAULT 0;");
      }
    }
  } catch (e) {}

  createIndices();
}

// Indices for performance
function createIndices() {
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_insumos_precos_lookup ON insumos_precos (id_insumo, estado, tipo_desoneracao, data_referencia);
      CREATE INDEX IF NOT EXISTS idx_composicao_insumo_comp ON composicao_insumo (id_composicao);
      CREATE INDEX IF NOT EXISTS idx_orcamento_itens_orc ON orcamento_itens (id_orcamento);
    `);
  } catch (e) {}
}

// Database initialization complete

// Database initialization complete

async function startServer() {
  console.log("🚀 Iniciando servidor...");
  
  const parseNumber = (val: any) => {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'number') return val;
    
    let str = String(val).trim();
    if (str === '') return null;
    
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // Brazilian format: 1.234,56
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      // US format: 1,234.56
      str = str.replace(/,/g, '');
    } else if (lastComma !== -1) {
      // Only comma: 1,50
      str = str.replace(',', '.');
    }
    
    // Remove anything else that's not a digit, dot or minus
    str = str.replace(/[^\d.-]/g, '');
    
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  };

  try {
    initDb();
    console.log("initDb completed.");
    initDatabase();
    console.log("initDatabase completed.");
    
    // One-time fix for categories
    try {
      db.exec("UPDATE v2_itens SET categoria = 'Encargos' WHERE (UPPER(nome) LIKE '%EXAME%' OR UPPER(nome) LIKE '%IPI%' OR UPPER(nome) LIKE '%ENCARGO%' OR UPPER(nome) LIKE '%SEGURO%' OR UPPER(nome) LIKE '%TAXA%' OR UPPER(nome) LIKE '%CURSO%' OR UPPER(nome) LIKE '%TREINAMENTO%') AND categoria = 'Material'");
      db.exec("UPDATE v2_itens SET categoria = 'Mão de Obra' WHERE (UPPER(nome) LIKE '%PEDREIRO%' OR UPPER(nome) LIKE '%SERVENTE%' OR UPPER(nome) LIKE '%CARPINTEIRO%' OR UPPER(nome) LIKE '%PINTOR%' OR UPPER(nome) LIKE '%ELETRICISTA%' OR UPPER(nome) LIKE '%ENCANADOR%' OR UPPER(nome) LIKE '%MESTRE%' OR UPPER(nome) LIKE '%AUXILIAR%') AND categoria = 'Material'");
      db.exec("UPDATE v2_itens SET categoria = 'Equipamento' WHERE (UPPER(nome) LIKE '%CAMINHAO%' OR UPPER(nome) LIKE '%BETONEIRA%' OR UPPER(nome) LIKE '%TRATOR%' OR UPPER(nome) LIKE '%ESCAVADEIRA%' OR UPPER(nome) LIKE '%COMPACTADOR%') AND categoria = 'Material'");
      console.log("✅ Categorias de itens existentes atualizadas.");
    } catch (e) {
      console.error("Erro ao atualizar categorias existentes:", e);
    }

    console.log("📦 Banco de dados inicializado.");
  } catch (err) {
    console.error("❌ Erro ao inicializar banco de dados:", err);
    throw err;
  }

  const app = express();
  const PORT = 3000;

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    // Schedule database upload after any write operation
    // if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    //   res.on('finish', () => {
    //     if (res.statusCode >= 200 && res.statusCode < 400) {
    //       scheduleDatabaseUpload();
    //     }
    //   });
    // }
    
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  const JWT_SECRET = process.env.JWT_SECRET || "default_secret_key";

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    let token = req.cookies.token;
    
    // Fallback to Authorization header
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) return res.status(401).json({ message: "Não autorizado." });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      
      // Ensure tenant_id is present
      if (req.user.tenant_id === undefined || req.user.tenant_id === null) {
        // Try to find the user in DB to see if they have a tenant_id now
        const user = db.prepare("SELECT tenant_id FROM v2_users WHERE id = ?").get(req.user.id) as any;
        if (user && user.tenant_id) {
          req.user.tenant_id = user.tenant_id;
        } else {
          return res.status(401).json({ message: "Sessão inválida (Tenant não encontrado)." });
        }
      }
      
      next();
    } catch (error) {
      res.status(401).json({ message: "Token inválido." });
    }
  };

  // Auth Routes
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = db.prepare("SELECT * FROM v2_users WHERE email = ?").get(email) as any;
      if (!user) return res.status(400).json({ message: "Credenciais inválidas." });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: "Credenciais inválidas." });

      // Ensure user has a tenant_id
      if (!user.tenant_id) {
        const firstTenant = db.prepare("SELECT id FROM v2_tenants LIMIT 1").get() as { id: number };
        if (firstTenant) {
          db.prepare("UPDATE v2_users SET tenant_id = ? WHERE id = ?").run(firstTenant.id, user.id);
          user.tenant_id = firstTenant.id;
        }
      }

      const token = jwt.sign({ 
        id: user.id, 
        email: user.email, 
        role: user.role,
        tenant_id: user.tenant_id 
      }, JWT_SECRET, { expiresIn: "1d" });
      
      res.cookie("token", token, { 
        httpOnly: true, 
        secure: true, // Always true for modern browsers in iframes
        sameSite: "none", // Required for cross-site iframes
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      });
      res.json({ 
        user: { id: user.id, nome: user.nome, email: user.email, role: user.role, tenant_id: user.tenant_id },
        token: token // Return token for localStorage fallback
      });
    } catch (error: any) {
      res.status(500).json({ message: "Erro no login.", error: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ message: "Logout realizado com sucesso." });
  });

  app.get("/api/auth/me", authenticate, (req: any, res) => {
    res.json({ user: req.user });
  });

  // Tenant & User Management Routes
  app.get("/api/settings/tenant", authenticate, (req: any, res) => {
    try {
      const tenant = db.prepare("SELECT * FROM v2_tenants WHERE id = ?").get(req.user.tenant_id);
      res.json(tenant);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar dados da empresa.", error: error.message });
    }
  });

  app.put("/api/settings/tenant", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin_master' && req.user.role !== 'admin_pj') {
      return res.status(403).json({ message: "Apenas administradores podem alterar dados da empresa." });
    }
    const { nome, documento, assinatura_texto, rodape_texto, logo_url } = req.body;
    try {
      db.prepare(`
        UPDATE v2_tenants 
        SET nome = ?, documento = ?, assinatura_texto = ?, rodape_texto = ?, logo_url = ? 
        WHERE id = ?
      `).run(nome, documento, assinatura_texto, rodape_texto, logo_url, req.user.tenant_id);
      res.json({ message: "Dados da empresa atualizados com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao atualizar dados da empresa.", error: error.message });
    }
  });

  app.get("/api/settings/users", authenticate, (req: any, res) => {
    try {
      const users = db.prepare("SELECT id, nome, email, role, created_at FROM v2_users WHERE tenant_id = ?").all(req.user.tenant_id);
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar usuários.", error: error.message });
    }
  });

  app.post("/api/settings/users", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin_master' && req.user.role !== 'admin_pj') {
      return res.status(403).json({ message: "Apenas administradores podem criar novos usuários." });
    }
    const { nome, email, password, role } = req.body;
    try {
      // Check limits
      const tenant = db.prepare("SELECT limite_usuarios FROM v2_tenants WHERE id = ?").get(req.user.tenant_id) as any;
      const userCount = db.prepare("SELECT COUNT(*) as count FROM v2_users WHERE tenant_id = ?").get(req.user.tenant_id) as { count: number };
      
      if (userCount.count >= tenant.limite_usuarios) {
        return res.status(400).json({ message: `Limite de usuários atingido (${tenant.limite_usuarios}). Faça upgrade do seu plano.` });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      db.prepare("INSERT INTO v2_users (tenant_id, nome, email, password, role) VALUES (?, ?, ?, ?, ?)").run(req.user.tenant_id, nome, email, hashedPassword, role || 'orcamentista');
      res.json({ message: "Usuário criado com sucesso." });
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ message: "Este e-mail já está em uso." });
      }
      res.status(500).json({ message: "Erro ao criar usuário.", error: error.message });
    }
  });

  app.delete("/api/settings/users/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin_master' && req.user.role !== 'admin_pj') {
      return res.status(403).json({ message: "Apenas administradores podem excluir usuários." });
    }
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ message: "Você não pode excluir seu próprio usuário." });
    }
    try {
      db.prepare("DELETE FROM v2_users WHERE id = ? AND tenant_id = ?").run(req.params.id, req.user.tenant_id);
      res.json({ message: "Usuário excluído com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao excluir usuário.", error: error.message });
    }
  });

  // --- Workflow Endpoints ---
  app.get("/api/settings/workflows", authenticate, (req: any, res) => {
    try {
      const workflows = db.prepare("SELECT * FROM v2_workflows WHERE tenant_id = ?").all(req.user.tenant_id);
      res.json(workflows);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar workflows.", error: error.message });
    }
  });

  app.post("/api/settings/workflows", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin_master' && req.user.role !== 'admin_pj') {
      return res.status(403).json({ message: "Acesso negado." });
    }
    const { nome, tipo, regra_json } = req.body;
    try {
      db.prepare("INSERT INTO v2_workflows (tenant_id, nome, tipo, regra_json) VALUES (?, ?, ?, ?)").run(req.user.tenant_id, nome, tipo, JSON.stringify(regra_json));
      res.json({ message: "Workflow criado com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao criar workflow.", error: error.message });
    }
  });

  app.put("/api/settings/workflows/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin_master' && req.user.role !== 'admin_pj') {
      return res.status(403).json({ message: "Acesso negado." });
    }
    const { nome, regra_json, ativo } = req.body;
    try {
      db.prepare("UPDATE v2_workflows SET nome = ?, regra_json = ?, ativo = ? WHERE id = ? AND tenant_id = ?")
        .run(nome, JSON.stringify(regra_json), ativo ? 1 : 0, req.params.id, req.user.tenant_id);
      res.json({ message: "Workflow atualizado." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao atualizar workflow.", error: error.message });
    }
  });

  // --- Document Template Endpoints ---
  app.get("/api/settings/templates", authenticate, (req: any, res) => {
    try {
      const templates = db.prepare("SELECT * FROM v2_document_templates WHERE tenant_id = ?").all(req.user.tenant_id);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar templates.", error: error.message });
    }
  });

  app.post("/api/settings/templates", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin_master' && req.user.role !== 'admin_pj') {
      return res.status(403).json({ message: "Acesso negado." });
    }
    const { nome, tipo, conteudo_html, config_json } = req.body;
    try {
      db.prepare("INSERT INTO v2_document_templates (tenant_id, nome, tipo, conteudo_html, config_json) VALUES (?, ?, ?, ?, ?)")
        .run(req.user.tenant_id, nome, tipo, conteudo_html, JSON.stringify(config_json));
      res.json({ message: "Template criado." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao criar template.", error: error.message });
    }
  });

  // Seed default user if none exists
  try {
    const tenantCount = db.prepare("SELECT COUNT(*) as count FROM v2_tenants").get() as { count: number };
    let defaultTenantId = 1;
    if (tenantCount.count === 0) {
      const result = db.prepare("INSERT INTO v2_tenants (nome, documento, plano, limite_usuarios) VALUES (?, ?, ?, ?)").run("Diego Engenharia", "00.000.000/0001-00", "Enterprise", 100);
      defaultTenantId = Number(result.lastInsertRowid);
      console.log("✅ Tenant padrão criado.");
    } else {
      const firstTenant = db.prepare("SELECT id FROM v2_tenants LIMIT 1").get() as { id: number };
      defaultTenantId = firstTenant.id;
    }

    const userCount = db.prepare("SELECT COUNT(*) as count FROM v2_users").get() as { count: number };
    if (userCount.count === 0) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      db.prepare("INSERT INTO v2_users (tenant_id, nome, email, password, role) VALUES (?, ?, ?, ?, ?)").run(defaultTenantId, "Administrador", "admin@gestao.com", hashedPassword, "admin_master");
      console.log("✅ Usuário administrador padrão criado: admin@gestao.com / admin123");
    }

    // Migration: Ensure all existing data has a tenant_id
    try {
      db.exec("ALTER TABLE v2_tenants ADD COLUMN assinatura_texto TEXT;");
    } catch (e) {}
    try {
      db.exec("ALTER TABLE v2_tenants ADD COLUMN rodape_texto TEXT;");
    } catch (e) {}
    try {
      db.exec("ALTER TABLE v2_tenants ADD COLUMN logo_url TEXT;");
    } catch (e) {}

    try {
      db.exec("ALTER TABLE v2_tenants ADD COLUMN config_json TEXT;");
    } catch (e) {}
    
    // Create tables if they don't exist (redundant but safe for migrations)
    db.exec(`
      CREATE TABLE IF NOT EXISTS v2_workflows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id INTEGER NOT NULL,
          nome TEXT NOT NULL,
          tipo TEXT NOT NULL,
          regra_json TEXT NOT NULL,
          ativo INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tenant_id) REFERENCES v2_tenants(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS v2_document_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id INTEGER NOT NULL,
          nome TEXT NOT NULL,
          tipo TEXT NOT NULL,
          conteudo_html TEXT,
          config_json TEXT,
          is_default INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tenant_id) REFERENCES v2_tenants(id) ON DELETE CASCADE
      );
    `);

    db.prepare("UPDATE v2_users SET tenant_id = ? WHERE tenant_id IS NULL").run(defaultTenantId);
    db.prepare("UPDATE v2_obras SET tenant_id = ? WHERE tenant_id IS NULL").run(defaultTenantId);
    db.prepare("UPDATE v2_itens SET tenant_id = ? WHERE tenant_id IS NULL").run(defaultTenantId);
    
  } catch (e) {
    console.error("Erro ao criar usuário padrão:", e);
  }

  // API Routes
  app.get("/api/debug/schema", (req, res) => {
    try {
      const schema = db.prepare("PRAGMA table_info(v2_precos)").all();
      const indexes = db.prepare("PRAGMA index_list(v2_precos)").all();
      res.json({ schema, indexes });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar schema.", error: error.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/database/reset", (req, res) => {
    try {
      db.transaction(() => {
        // Clear V2 tables
        db.prepare("DELETE FROM v2_medicao_itens").run();
        db.prepare("DELETE FROM v2_medicoes").run();
        db.prepare("DELETE FROM v2_diario_fotos").run();
        db.prepare("DELETE FROM v2_diario_obra").run();
        db.prepare("DELETE FROM v2_atividade_dependencias").run();
        db.prepare("DELETE FROM v2_atividades").run();
        db.prepare("DELETE FROM v2_orcamento_itens").run();
        db.prepare("DELETE FROM v2_etapas").run();
        db.prepare("DELETE FROM v2_obras").run();
        db.prepare("DELETE FROM v2_composicao_itens").run();
        db.prepare("DELETE FROM v2_precos").run();
        db.prepare("DELETE FROM v2_itens").run();

        // Clear Legacy tables
        db.prepare("DELETE FROM medicoes").run();
        db.prepare("DELETE FROM diarios").run();
        db.prepare("DELETE FROM cronogramas").run();
        db.prepare("DELETE FROM orcamento_itens").run();
        db.prepare("DELETE FROM orcamento").run();
        db.prepare("DELETE FROM orcamentos").run();
        db.prepare("DELETE FROM composicao_insumo").run();
        db.prepare("DELETE FROM composicoes_precos").run();
        db.prepare("DELETE FROM composicoes").run();
        db.prepare("DELETE FROM insumos_precos").run();
        db.prepare("DELETE FROM insumos_cadastro").run();
        db.prepare("DELETE FROM obras").run();
      })();
      res.json({ message: "Banco de dados limpo com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao limpar banco de dados.", error: error.message });
    }
  });

  app.get("/api/database/reset-now", (req, res) => {
    try {
      db.transaction(() => {
        // Clear V2 tables
        db.prepare("DELETE FROM v2_medicao_itens").run();
        db.prepare("DELETE FROM v2_medicoes").run();
        db.prepare("DELETE FROM v2_diario_fotos").run();
        db.prepare("DELETE FROM v2_diario_obra").run();
        db.prepare("DELETE FROM v2_atividade_dependencias").run();
        db.prepare("DELETE FROM v2_atividades").run();
        db.prepare("DELETE FROM v2_orcamento_itens").run();
        db.prepare("DELETE FROM v2_etapas").run();
        db.prepare("DELETE FROM v2_obras").run();
        db.prepare("DELETE FROM v2_composicao_itens").run();
        db.prepare("DELETE FROM v2_precos").run();
        db.prepare("DELETE FROM v2_itens").run();

        // Clear Legacy tables
        db.prepare("DELETE FROM medicoes").run();
        db.prepare("DELETE FROM diarios").run();
        db.prepare("DELETE FROM cronogramas").run();
        db.prepare("DELETE FROM orcamento_itens").run();
        db.prepare("DELETE FROM orcamento").run();
        db.prepare("DELETE FROM orcamentos").run();
        db.prepare("DELETE FROM composicao_insumo").run();
        db.prepare("DELETE FROM composicoes_precos").run();
        db.prepare("DELETE FROM composicoes").run();
        db.prepare("DELETE FROM insumos_precos").run();
        db.prepare("DELETE FROM insumos_cadastro").run();
        db.prepare("DELETE FROM obras").run();
      })();
      res.send("Banco de dados limpo com sucesso.");
    } catch (error: any) {
      res.status(500).send("Erro ao limpar banco de dados: " + error.message);
    }
  });

  app.get("/api/dashboard", authenticate, (req: any, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const totalObras = db.prepare("SELECT COUNT(*) as count FROM v2_obras WHERE tenant_id = ?").get(tenantId) as { count: number };
      const totalInsumos = db.prepare("SELECT COUNT(*) as count FROM v2_itens WHERE tipo = 'insumo' AND tenant_id = ?").get(tenantId) as { count: number };
      const obrasRecentes = db.prepare("SELECT * FROM v2_obras WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5").all(tenantId);
      
      const totalOrcadoResult = db.prepare(`
        SELECT SUM(oi.custo_unitario_aplicado * oi.quantidade * (1 + COALESCE(o.bdi, 0) / 100.0)) as total 
        FROM v2_orcamento_itens oi
        JOIN v2_etapas e ON oi.etapa_id = e.id
        JOIN v2_obras o ON e.obra_id = o.id
        WHERE o.tenant_id = ?
      `).get(tenantId) as { total: number | null };
      const totalOrcado = totalOrcadoResult.total || 0;
      
      const totalMedidoResult = db.prepare(`
        SELECT SUM(mi.quantidade_medida * oi.custo_unitario_aplicado * (1 + COALESCE(o.bdi, 0) / 100.0)) as total 
        FROM v2_medicao_itens mi
        JOIN v2_orcamento_itens oi ON mi.orcamento_item_id = oi.id
        JOIN v2_etapas e ON oi.etapa_id = e.id
        JOIN v2_obras o ON e.obra_id = o.id
        WHERE o.tenant_id = ?
      `).get(tenantId) as { total: number | null };
      const totalMedido = totalMedidoResult.total || 0;

      const progressoMedioResult = db.prepare(`
        SELECT AVG(a.progresso) as avg 
        FROM v2_atividades a
        JOIN v2_obras o ON a.obra_id = o.id
        WHERE o.tenant_id = ?
      `).get(tenantId) as { avg: number | null };
      const progressoMedio = Math.round(progressoMedioResult.avg || 0);

      const cronogramasAtivos = db.prepare(`
        SELECT a.*, o.nome as obra_nome 
        FROM v2_atividades a 
        JOIN v2_obras o ON a.obra_id = o.id 
        WHERE a.progresso < 100 AND o.tenant_id = ?
        ORDER BY a.data_fim_prevista ASC 
        LIMIT 5
      `).all(tenantId);

      const ultimasMedicoes = db.prepare(`
        SELECT m.*, o.nome as obra_nome 
        FROM v2_medicoes m 
        JOIN v2_obras o ON m.obra_id = o.id 
        WHERE o.tenant_id = ?
        ORDER BY m.data_medicao DESC 
        LIMIT 5
      `).all(tenantId);

      const ultimosDiarios = db.prepare(`
        SELECT d.*, o.nome as obra_nome 
        FROM v2_diario_obra d 
        JOIN v2_obras o ON d.obra_id = o.id 
        WHERE o.tenant_id = ?
        ORDER BY d.data DESC 
        LIMIT 5
      `).all(tenantId);

      res.json({
        metrics: {
          totalObras: totalObras.count,
          totalInsumos: totalInsumos.count,
          totalOrcado: totalOrcado,
          totalMedido: totalMedido,
          progressoMedio: progressoMedio,
          obrasAndamento: (db.prepare("SELECT COUNT(*) as count FROM v2_obras WHERE status = 'Em andamento' AND tenant_id = ?").get(tenantId) as any).count
        },
        obrasRecentes,
        cronogramasAtivos,
        ultimasMedicoes,
        ultimosDiarios
      });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao carregar dashboard", error: error.message });
    }
  });

  app.get("/api/databases", (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT DISTINCT UPPER(i.base) as base, p.data_referencia 
        FROM v2_itens i
        JOIN v2_precos p ON i.id = p.item_id
        WHERE i.base NOT IN ('Base', 'Base do Item')
        ORDER BY i.base, p.data_referencia DESC
      `).all() as { base: string, data_referencia: string }[];
      
      const dbMap = new Map<string, string[]>();
      rows.forEach(row => {
        const base = row.base.toLowerCase();
        if (!dbMap.has(base)) {
          dbMap.set(base, []);
        }
        dbMap.get(base)!.push(row.data_referencia);
      });

      const databases = Array.from(dbMap.entries()).map(([id, dates]) => {
        const latestDate = dates[0];
        const date = new Date(latestDate);
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const year = date.getUTCFullYear();
        return {
          id,
          name: `${id.toUpperCase()} - ${month}/${year}`,
          active: false,
          available_dates: dates,
          data_referencia: latestDate
        };
      });
      
      res.json(databases);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar bancos de dados.", error: error.message });
    }
  });

  app.get("/api/obras", authenticate, (req: any, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const obras = db.prepare(`
        SELECT o.*, 
          CASE 
            WHEN o.bdi_incidencia = 'final' THEN SUM(oi.custo_unitario_aplicado * oi.quantidade) * (1 + COALESCE(o.bdi, 0) / 100.0)
            ELSE SUM(oi.custo_unitario_aplicado * oi.quantidade * (1 + COALESCE(o.bdi, 0) / 100.0))
          END as valor_total_real
        FROM v2_obras o
        LEFT JOIN v2_etapas e ON o.id = e.obra_id
        LEFT JOIN v2_orcamento_itens oi ON e.id = oi.etapa_id
        WHERE o.tenant_id = ?
        GROUP BY o.id
      `).all(tenantId);
      res.json(obras.map(o => ({...o, valor_total: o.valor_total_real !== null ? o.valor_total_real : o.valor_total})));
    } catch (error: any) {
      console.error("Error fetching obras:", error);
      res.status(500).json({ message: "Erro ao buscar obras.", error: error.message });
    }
  });

  app.post("/api/obras", authenticate, (req: any, res) => {
    console.log('Creating obra with body:', req.body);
    const tenantId = req.user.tenant_id;
    const { nome, cliente, descricao, status, endereco, data_inicio, data_fim_prevista, uf, localizacao, bdi, bdi_incidencia, bdi_tipo, desonerado, data_referencia, bancos_ativos } = req.body;
    try {
      // Find latest SINAPI date for default
      let defaultDataRef = '2024-01-01';
      const latestSinapi = db.prepare(`
        SELECT MAX(p.data_referencia) as data_referencia 
        FROM v2_itens i
        JOIN v2_precos p ON i.id = p.item_id
        WHERE LOWER(i.base) = 'sinapi'
      `).get() as { data_referencia: string | null };
      
      if (latestSinapi && latestSinapi.data_referencia) {
        const date = new Date(latestSinapi.data_referencia);
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const year = date.getUTCFullYear();
        defaultDataRef = `${year}-${month}`;
      }

      const stmt = db.prepare(`
        INSERT INTO v2_obras (tenant_id, nome, cliente, descricao, status, endereco, data_inicio, data_fim_prevista, uf, localizacao, bdi, bdi_incidencia, bdi_tipo, desonerado, data_referencia, bancos_ativos, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        tenantId,
        nome, 
        cliente, 
        descricao || '',
        status, 
        endereco, 
        data_inicio, 
        data_fim_prevista, 
        uf, 
        localizacao, 
        bdi || 0, 
        bdi_incidencia || 'unitario', 
        bdi_tipo || 'unico', 
        desonerado !== undefined ? desonerado : 1, 
        data_referencia || defaultDataRef, 
        bancos_ativos || '["sinapi"]',
        new Date().toISOString()
      );
      res.json({ id: result.lastInsertRowid, message: "Obra criada com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao criar obra.", error: error.message });
    }
  });

  app.get("/api/obras/:id", authenticate, (req: any, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const obra = db.prepare(`
        SELECT o.*, SUM(oi.custo_unitario_aplicado * oi.quantidade * (1 + COALESCE(o.bdi, 0) / 100.0)) as valor_total_real
        FROM v2_obras o
        LEFT JOIN v2_etapas e ON o.id = e.obra_id
        LEFT JOIN v2_orcamento_itens oi ON e.id = oi.etapa_id
        WHERE o.id = ? AND o.tenant_id = ?
        GROUP BY o.id
      `).get(req.params.id, tenantId) as any;
      
      if (!obra) {
        return res.status(404).json({ message: "Obra não encontrada." });
      }
      res.json({...obra, valor_total: obra.valor_total_real !== null ? obra.valor_total_real : obra.valor_total});
    } catch (error: any) {
      console.error("Error fetching obra:", error);
      res.status(500).json({ message: "Erro ao buscar obra.", error: error.message });
    }
  });

  app.put("/api/obras/:id", authenticate, (req: any, res) => {
    console.log('Updating obra with body:', req.body);
    const body = req.body;
    const tenantId = req.user.tenant_id;
    try {
      const currentObra = db.prepare("SELECT * FROM v2_obras WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantId) as any;
      if (!currentObra) {
        return res.status(404).json({ message: "Obra não encontrada ou acesso negado." });
      }

      const columns = db.prepare("PRAGMA table_info(v2_obras)").all() as any[];
      const validColumns = columns.map(c => c.name).filter(c => c !== 'id' && c !== 'created_at');
      
      const updates: string[] = [];
      const params: any[] = [];

      // Explicitly handle fields
      const fieldsToUpdate = ['nome', 'cliente', 'descricao', 'status', 'endereco', 'data_inicio', 'data_inicio_real', 'data_fim_prevista', 'uf', 'localizacao', 'bdi', 'bdi_incidencia', 'bdi_tipo', 'desonerado', 'data_referencia', 'bancos_ativos', 'custos_reais'];
      
      for (const col of fieldsToUpdate) {
        if (body[col] !== undefined) {
          updates.push(`${col} = ?`);
          params.push(body[col]);
        }
      }

      if (columns.some(c => c.name === 'updated_at')) {
        updates.push("updated_at = ?");
        params.push(new Date().toISOString());
      }

      if (updates.length === 0) {
        return res.json({ message: "Nenhuma alteração detectada." });
      }

      db.transaction(() => {
        const query = `UPDATE v2_obras SET ${updates.join(', ')} WHERE id = ?`;
        db.prepare(query).run(...params, req.params.id);

        // If desonerado, uf, or data_referencia changed, we need to update composition prices in the budget
        const newDesonerado = body.desonerado !== undefined ? (body.desonerado ? 1 : 0) : currentObra.desonerado;
        const newUf = body.uf !== undefined ? body.uf : currentObra.uf;
        const newDataRef = body.data_referencia !== undefined ? body.data_referencia : currentObra.data_referencia;

        const newBancosAtivos = body.bancos_ativos !== undefined ? body.bancos_ativos : currentObra.bancos_ativos;

        if (
          (body.desonerado !== undefined && newDesonerado !== currentObra.desonerado) ||
          (body.uf !== undefined && newUf !== currentObra.uf) ||
          (body.data_referencia !== undefined && newDataRef !== currentObra.data_referencia) ||
          (body.bancos_ativos !== undefined && newBancosAtivos !== currentObra.bancos_ativos)
        ) {
          const estado = newUf || 'DF';
          const dataRef = newDataRef || '2026-04-01';
          const tipoDesoneracao = newDesonerado ? 'Desonerado' : 'Não Desonerado';
          
          let bancosAtivos: any[] = [];
          if (newBancosAtivos) {
            try {
              const parsed = JSON.parse(newBancosAtivos);
              if (Array.isArray(parsed)) {
                 bancosAtivos = parsed.map(b => typeof b === 'string' ? { id: b } : b);
              }
            } catch (e) {
              console.error("Error parsing bancos_ativos:", e);
            }
          }

          const compositionItems = db.prepare(`
              SELECT oi.id, oi.item_id 
              FROM v2_orcamento_itens oi
              JOIN v2_itens i ON oi.item_id = i.id
              WHERE oi.etapa_id IN (SELECT id FROM v2_etapas WHERE obra_id = ?)
              AND i.tipo = 'composicao'
          `).all(req.params.id) as any[];

          const updateStmt = db.prepare(`
              UPDATE v2_orcamento_itens
              SET custo_unitario_aplicado = ?
              WHERE id = ?
          `);
          
          for (const item of compositionItems) {
              const tree = getCompositionTree(item.item_id, estado, dataRef, tipoDesoneracao, bancosAtivos);
              if (tree.valor_total > 0) {
                  updateStmt.run(tree.valor_total, item.id);
              }
          }
        }
      })();

      res.json({ message: "Obra atualizada com sucesso." });
    } catch (error: any) {
      console.error("Error updating obra:", error);
      res.status(500).json({ message: "Erro ao atualizar obra.", error: error.message });
    }
  });

  app.delete("/api/obras/:id", authenticate, (req: any, res) => {
    try {
      const tenantId = req.user.tenant_id;
      db.prepare("DELETE FROM v2_obras WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantId);
      res.json({ message: "Obra excluída com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao excluir obra.", error: error.message });
    }
  });

  // POST /api/obras/:id/orcamento/import
  app.post("/api/obras/:id/orcamento/import", authenticate, (req: any, res) => {
    try {
      const { items } = req.body;
      const obraId = req.params.id;
      const tenantId = req.user.tenant_id;

      // Verify ownership
      const obra = db.prepare("SELECT id FROM v2_obras WHERE id = ? AND tenant_id = ?").get(obraId, tenantId);
      if (!obra) return res.status(403).json({ message: "Acesso negado." });

      if (!Array.isArray(items)) {
        return res.status(400).json({ message: "Formato inválido. 'items' deve ser um array." });
      }

      // Start transaction
      const transaction = db.transaction(() => {
        // Clear existing budget items and etapas for this obra
        const getEtapas = db.prepare("SELECT id FROM v2_etapas WHERE obra_id = ?");
        const etapas = getEtapas.all(obraId) as any[];
        
        const deleteOrcamentoItens = db.prepare("DELETE FROM v2_orcamento_itens WHERE etapa_id = ?");
        for (const etapa of etapas) {
          deleteOrcamentoItens.run(etapa.id);
        }
        
        db.prepare("DELETE FROM v2_etapas WHERE obra_id = ?").run(obraId);

        const insertEtapa = db.prepare(`
          INSERT INTO v2_etapas (obra_id, nome, codigo, ordem) 
          VALUES (?, ?, ?, ?)
        `);

        const insertOrcamentoItem = db.prepare(`
          INSERT INTO v2_orcamento_itens (etapa_id, item_id, item_numero, quantidade, custo_unitario_aplicado, ordem) 
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        // Helper to find item id by base and codigo
        const findItem = db.prepare("SELECT id FROM v2_itens WHERE base = ? AND codigo = ? AND (tenant_id = ? OR tenant_id IS NULL)");

        let currentEtapaId = null;
        let etapaOrdem = 1;
        let itemOrdem = 1;

        for (const row of items) {
          if (row.tipo === 'etapa') {
            const result = insertEtapa.run(obraId, row.descricao, row.item, etapaOrdem++);
            currentEtapaId = result.lastInsertRowid;
            itemOrdem = 1; // Reset item order for new etapa
          } else {
            if (!currentEtapaId) {
              // Create a default etapa if none exists
              const result = insertEtapa.run(obraId, 'Etapa Padrão', '1', etapaOrdem++);
              currentEtapaId = result.lastInsertRowid;
            }

            // Find item in DB
            let itemId = null;
            if (row.base && row.codigo) {
              const item = findItem.get(row.base, row.codigo, tenantId) as any;
              if (item) {
                itemId = item.id;
              }
            }

            // If item not found, we could create a temporary one or skip. 
            // For now, let's assume we require the item to exist, or we create a dummy one.
            if (!itemId) {
               // Create a dummy item if not found (PRÓPRIA)
               const insertDummyItem = db.prepare(`
                 INSERT INTO v2_itens (base, codigo, nome, unidade, tipo, categoria)
                 VALUES (?, ?, ?, ?, ?, ?)
               `);
               const categoria = inferCategory(row.descricao || '', row.categoria || 'Material');
               const dummyResult = insertDummyItem.run(row.base || 'PRÓPRIA', row.codigo || `TEMP-${Date.now()}`, row.descricao || 'Item não encontrado', row.unidade || 'UN', 'insumo', categoria);
               itemId = dummyResult.lastInsertRowid;
            }

            insertOrcamentoItem.run(
              currentEtapaId,
              itemId,
              row.item,
              row.quantidade || 0,
              row.valor_unitario || 0,
              itemOrdem++
            );
          }
        }
      });

      transaction();
      res.json({ message: "Orçamento importado com sucesso." });
    } catch (error) {
      console.error("Erro ao importar orçamento:", error);
      res.status(500).json({ message: "Erro ao importar orçamento", error: error.message });
    }
  });

  app.get("/api/obras/:id/orcamento", (req, res) => {
    try {
      const { desonerado, estado, data_referencia, bancos_ativos } = req.query;
      const isDesonerado = desonerado === 'true';
      const tipoDesoneracao = isDesonerado ? 'Desonerado' : 'Não Desonerado';
      const estadoFilter = estado || 'DF';
      const dataRefFilter = data_referencia || '2026-04-01';

      const obra = db.prepare("SELECT bdi, bdi_incidencia, bancos_ativos FROM v2_obras WHERE id = ?").get(req.params.id) as any;
      const bdi = obra ? (obra.bdi ?? 0) : 0;
      const bdiIncidencia = obra?.bdi_incidencia || 'unitario';
      
      let bancosAtivos: any[] = [];
      if (bancos_ativos) {
        try {
          const parsed = JSON.parse(bancos_ativos as string);
          if (Array.isArray(parsed)) {
             bancosAtivos = parsed.map(b => typeof b === 'string' ? { id: b } : b);
          }
        } catch (e) {
          console.error("Error parsing bancos_ativos from query:", e);
        }
      } else if (obra?.bancos_ativos) {
        try {
          const parsed = JSON.parse(obra.bancos_ativos);
          if (Array.isArray(parsed)) {
             bancosAtivos = parsed.map(b => typeof b === 'string' ? { id: b } : b);
          }
        } catch (e) {
          console.error("Error parsing bancos_ativos from db:", e);
        }
      }

      // First, get all etapas for this obra
      const allEtapas = db.prepare(`
        SELECT id, nome, codigo, ordem, etapa_pai_id, 'etapa' as tipo
        FROM v2_etapas 
        WHERE obra_id = ?
      `).all(req.params.id) as any[];

      // Sort etapas numerically by code
      const sortCodes = (a: string, b: string) => {
        const aParts = (a || '').split('.').map(p => parseInt(p, 10) || 0);
        const bParts = (b || '').split('.').map(p => parseInt(p, 10) || 0);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aP = aParts[i] || 0;
          const bP = bParts[i] || 0;
          if (aP !== bP) return aP - bP;
        }
        return 0;
      };

      allEtapas.sort((a, b) => sortCodes(a.codigo, b.codigo));

      // Build dynamic base conditions for dates
      const baseConditions: string[] = [];
      const baseParams: any[] = [];
      
      for (const banco of bancosAtivos) {
        if (banco.id && banco.data_referencia) {
          baseConditions.push(`(i2.base = ? AND p2.data_referencia <= ?)`);
          baseParams.push(banco.id.toUpperCase(), normalizeDate(banco.data_referencia));
        }
      }
      
      let baseConditionSql = '';
      if (baseConditions.length > 0) {
        const bases = bancosAtivos.map(b => b.id.toUpperCase());
        const placeholders = bases.map(() => '?').join(',');
        baseConditionSql = `AND (
          ${baseConditions.join(' OR ')}
          OR i2.base = 'PRÓPRIO'
          OR (i2.base NOT IN (${placeholders}) AND p2.data_referencia <= ?)
        )`;
        baseParams.push(...bases, dataRefFilter);
      } else {
        baseConditionSql = `AND (p2.data_referencia <= ? OR i2.base = 'PRÓPRIO')`;
        baseParams.push(dataRefFilter);
      }

      // Then, get all items for these etapas
      const items = db.prepare(`
        WITH LatestPrices AS (
          SELECT 
            item_id,
            preco_unitario
          FROM (
            SELECT 
              p2.item_id,
              p2.preco_unitario,
              ROW_NUMBER() OVER (
                PARTITION BY p2.item_id 
                ORDER BY 
                  CASE WHEN p2.estado = ? THEN 0 
                       WHEN p2.estado = 'PRÓPRIO' THEN 1 
                       ELSE 2 END, 
                  p2.data_referencia DESC
              ) as rn
            FROM v2_precos p2
            JOIN v2_itens i2 ON p2.item_id = i2.id
            WHERE (p2.estado IN (?, 'PRÓPRIO') OR i2.base = 'PRÓPRIO')
              AND p2.tipo_desoneracao = ?
              ${baseConditionSql}
          )
          WHERE rn = 1
        )
        SELECT 
          oi.id, oi.etapa_id, oi.item_id, oi.item_numero, oi.quantidade, oi.custo_unitario_aplicado, oi.ordem, oi.progresso,
          i.base, i.codigo, i.nome as descricao, i.unidade, i.tipo as item_tipo, i.categoria,
          lp.preco_unitario as preco_dinamico
        FROM v2_orcamento_itens oi
        JOIN v2_itens i ON oi.item_id = i.id
        JOIN v2_etapas e ON oi.etapa_id = e.id
        LEFT JOIN LatestPrices lp ON i.id = lp.item_id
        WHERE e.obra_id = ?
      `).all(estadoFilter, estadoFilter, tipoDesoneracao, ...baseParams, req.params.id) as any[];

      // Sort items numerically by item_numero
      items.sort((a, b) => sortCodes(a.item_numero, b.item_numero));

      // Combine them into a flat list for the frontend
      const result: any[] = [];
      
      // Map stages for easy lookup
      const etapaMap = new Map(allEtapas.map(e => [e.id, e]));

      // Add stages to result
      for (const etapa of allEtapas) {
        result.push({
          ...etapa,
          id: `etapa-${etapa.id}`,
          item: etapa.codigo || '',
          descricao: etapa.nome,
          total: 0 // Will be calculated later
        });
      }

      // Process and add items to result
      for (const it of items) {
        const etapa = etapaMap.get(it.etapa_id);
        
        // Use dynamic price if available, fallback to applied cost
        let valor_unitario = it.preco_dinamico ?? it.custo_unitario_aplicado ?? 0;
        
        // If it's a composition, calculate it dynamically
        if (it.item_tipo === 'composicao') {
          const tree = getCompositionTree(it.item_id, estadoFilter, dataRefFilter, tipoDesoneracao, bancosAtivos);
          valor_unitario = tree.valor_total > 0 ? tree.valor_total : valor_unitario;
        } else if (valor_unitario === 0 && it.preco_dinamico) {
          valor_unitario = it.preco_dinamico;
        }

        // Update the database if the dynamically calculated value differs from the stored value
        if (valor_unitario !== it.custo_unitario_aplicado) {
          try {
            db.prepare("UPDATE v2_orcamento_itens SET custo_unitario_aplicado = ? WHERE id = ?").run(valor_unitario, it.id);
          } catch (e) {
            console.error("Failed to update custo_unitario_aplicado cache:", e);
          }
        }

        const valor_bdi = valor_unitario * (1 + bdi / 100);
        const total = bdiIncidencia === 'unitario' ? it.quantidade * valor_bdi : it.quantidade * valor_unitario;
        
        result.push({
          ...it,
          valor_unitario,
          id: `item-${it.id}`,
          tipo: it.item_tipo,
          categoria: it.categoria,
          item: it.item_numero || '',
          etapa_nome: etapa ? etapa.nome : '',
          valor_bdi,
          total
        });
      }

      // Sort the entire result set by item code
      result.sort((a, b) => sortCodes(a.item, b.item));

      // Second pass: calculate hierarchical totals for etapas
      for (const item of result) {
        if (item.tipo === 'etapa' || item.id.startsWith('etapa-')) {
          const searchPrefix = item.item.replace(/\.0$/, '.');
          let hierarchicalTotal = 0;
          for (const other of result) {
            if (other.id.startsWith('item-') && other.item.startsWith(searchPrefix)) {
              hierarchicalTotal += other.total || 0;
            }
          }
          item.total = hierarchicalTotal;
        }
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching orcamento:", error);
      res.status(500).json({ message: "Erro ao buscar orçamento.", error: error.message });
    }
  });

  app.post("/api/obras/:id/orcamento", (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Items must be an array." });
    }

    try {
      const createdIds: string[] = [];
      const obra = db.prepare("SELECT uf, data_referencia, desonerado, bancos_ativos FROM v2_obras WHERE id = ?").get(req.params.id) as any;
      const estado = obra?.uf || 'DF';
      const dataRef = obra?.data_referencia || '2026-04-01';
      const tipoDesoneracao = obra?.desonerado ? 'Desonerado' : 'Não Desonerado';
      
      let bancosAtivos: any[] = [];
      if (obra?.bancos_ativos) {
        try {
          const parsed = JSON.parse(obra.bancos_ativos);
          if (Array.isArray(parsed)) {
             bancosAtivos = parsed.map(b => typeof b === 'string' ? { id: b } : b);
          }
        } catch (e) {
          console.error("Error parsing bancos_ativos:", e);
        }
      }

      db.transaction(() => {
        for (const it of items) {
          if (it.tipo === 'etapa') {
            let finalOrdem = it.ordem;
            let etapaPaiId = it.etapa_pai_id;
            if (typeof etapaPaiId === 'string' && etapaPaiId.startsWith('etapa-')) {
              etapaPaiId = parseInt(etapaPaiId.replace('etapa-', ''), 10);
            }

            if (finalOrdem === undefined || finalOrdem === null) {
              const maxOrdemRow = db.prepare("SELECT MAX(ordem) as max_ordem FROM v2_etapas WHERE obra_id = ? AND (etapa_pai_id = ? OR (etapa_pai_id IS NULL AND ? IS NULL))").get(req.params.id, etapaPaiId, etapaPaiId) as any;
              finalOrdem = (maxOrdemRow?.max_ordem || 0) + 1;
            }

            // Check for unique constraint conflict (obra_id, codigo)
            // If the code already exists, clear it temporarily to avoid constraint violation
            if (it.item) {
              db.prepare("UPDATE v2_etapas SET codigo = NULL WHERE obra_id = ? AND codigo = ?").run(req.params.id, it.item);
            }

            const result = db.prepare(`
              INSERT INTO v2_etapas (obra_id, codigo, nome, ordem, etapa_pai_id)
              VALUES (?, ?, ?, ?, ?)
            `).run(req.params.id, it.item, it.descricao, finalOrdem, etapaPaiId);
            createdIds.push(`etapa-${result.lastInsertRowid}`);
          } else {
            // Find the correct etapa_id based on the 'item' code if provided
            let foundEtapaId = it.etapa_id;
            if (typeof foundEtapaId === 'string' && foundEtapaId.startsWith('etapa-')) {
              foundEtapaId = parseInt(foundEtapaId.replace('etapa-', ''), 10);
            }
            
            if (it.item && !foundEtapaId) {
              const parts = it.item.split('.');
              // Try to find the most specific etapa by checking prefixes from longest to shortest
              // e.g. for 1.1.1, check 1.1.0, then 1.0
              for (let i = parts.length - 1; i >= 1; i--) {
                const prefix = parts.slice(0, i).join('.') + '.0';
                const matchingEtapa = db.prepare("SELECT id FROM v2_etapas WHERE obra_id = ? AND codigo = ?").get(req.params.id, prefix) as any;
                if (matchingEtapa) {
                  foundEtapaId = matchingEtapa.id;
                  break;
                }
              }
              
              // Fallback to the first part if still not found
              if (!foundEtapaId) {
                const prefix = parts[0] + '.0';
                const matchingEtapa = db.prepare("SELECT id FROM v2_etapas WHERE obra_id = ? AND (codigo = ? OR codigo = ?)").get(req.params.id, prefix, parts[0]) as any;
                if (matchingEtapa) foundEtapaId = matchingEtapa.id;
              }
            }

            if (!foundEtapaId) {
              // Try to find the last etapa for this obra
              const lastEtapa = db.prepare("SELECT id FROM v2_etapas WHERE obra_id = ? ORDER BY id DESC LIMIT 1").get(req.params.id) as any;
              if (lastEtapa) {
                foundEtapaId = lastEtapa.id;
              } else {
                // Create a default etapa if none exists
                const result = db.prepare("INSERT INTO v2_etapas (obra_id, nome, codigo) VALUES (?, 'Etapa Inicial', '1')").run(req.params.id);
                foundEtapaId = result.lastInsertRowid;
              }
            }

            let valor_unitario = parseNumber(it.valor_unitario || it.preco_unitario || it.custo_unitario_aplicado) || 0;
            
            // If it's a composition and value is 0, calculate it
            if (valor_unitario === 0 && it.tipo === 'composicao') {
              const tree = getCompositionTree(it.item_id, estado, dataRef, tipoDesoneracao, bancosAtivos);
              valor_unitario = tree.valor_total || 0;
            }

            console.log("Inserting orcamento item:", { foundEtapaId, item_id: it.item_id, item_numero: it.item, quantidade: it.quantidade, valor_unitario });

            const result = db.prepare(`
              INSERT INTO v2_orcamento_itens (etapa_id, item_id, item_numero, quantidade, custo_unitario_aplicado) 
              VALUES (?, ?, ?, ?, ?)
            `).run(foundEtapaId, it.item_id, it.item, parseNumber(it.quantidade) || 0, valor_unitario);
            createdIds.push(`item-${result.lastInsertRowid}`);
          }
        }
      })();

      res.json({ message: "Orçamento salvo com sucesso.", ids: createdIds });
    } catch (error: any) {
      console.error("Error saving orcamento:", error);
      console.error("Items payload:", JSON.stringify(items, null, 2));
      res.status(500).json({ message: "Erro ao salvar orçamento.", error: error.message });
    }
  });

  app.put("/api/obras/:id/orcamento/:itemId", (req, res) => {
    const { tipo, item, descricao, codigo, quantidade, valor_unitario, preco_unitario, etapa_id, item_id } = req.body;
    try {
      const rawId = req.params.itemId.replace(/^(etapa-|item-)/, '');
      const itemId = parseInt(rawId, 10);

      const finalPrecoUnitario = parseNumber(valor_unitario !== undefined ? valor_unitario : preco_unitario);
      const finalQuantidade = parseNumber(quantidade);
      
      let parsedEtapaId = etapa_id;
      if (typeof parsedEtapaId === 'string' && parsedEtapaId.startsWith('etapa-')) {
        parsedEtapaId = parseInt(parsedEtapaId.replace('etapa-', ''), 10);
      }

      if (tipo !== 'etapa' && item) {
        const prefixMatch = item.match(/^(\d+)\./);
        const prefix = prefixMatch ? prefixMatch[1] : item.split('.')[0];
        
        if (prefix) {
          // Find the obra_id for this item to search for the correct etapa
          const currentItem = db.prepare(`
            SELECT e.obra_id 
            FROM v2_orcamento_itens oi 
            JOIN v2_etapas e ON oi.etapa_id = e.id 
            WHERE oi.id = ?
          `).get(itemId) as any;

          if (currentItem && currentItem.obra_id) {
            // Check if the current parsedEtapaId already has the correct prefix
            let currentEtapaIsCorrect = false;
            if (parsedEtapaId) {
              const currentEtapa = db.prepare("SELECT codigo FROM v2_etapas WHERE id = ?").get(parsedEtapaId) as any;
              if (currentEtapa && (currentEtapa.codigo === prefix || currentEtapa.codigo === `${prefix}.0`)) {
                currentEtapaIsCorrect = true;
              }
            }

            if (!currentEtapaIsCorrect) {
              const matchingEtapa = db.prepare("SELECT id FROM v2_etapas WHERE obra_id = ? AND (codigo = ? OR codigo = ?)").get(currentItem.obra_id, prefix, `${prefix}.0`) as any;
              if (matchingEtapa) {
                parsedEtapaId = matchingEtapa.id;
              } else {
                // Create a new etapa if it doesn't exist
                const newEtapa = db.prepare("INSERT INTO v2_etapas (obra_id, nome, codigo) VALUES (?, ?, ?)").run(currentItem.obra_id, `Nova Etapa ${prefix}`, `${prefix}.0`);
                parsedEtapaId = newEtapa.lastInsertRowid;
              }
            }
          }
        }
      }

      if (tipo === 'etapa') {
        const etapaCols = db.prepare("PRAGMA table_info(v2_etapas)").all() as any[];
        const hasEtapaUpdatedAt = etapaCols.some(c => c.name === 'updated_at');
        
        // Check for unique constraint conflict (obra_id, codigo)
        // If the new code already exists for another etapa in the same obra, clear it temporarily
        const currentEtapa = db.prepare("SELECT obra_id FROM v2_etapas WHERE id = ?").get(itemId) as any;
        if (currentEtapa) {
          db.prepare("UPDATE v2_etapas SET codigo = NULL WHERE obra_id = ? AND codigo = ? AND id != ?").run(currentEtapa.obra_id, item, itemId);
        }

        if (hasEtapaUpdatedAt) {
          db.prepare(`
            UPDATE v2_etapas 
            SET codigo = ?, nome = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(item, descricao, itemId);
        } else {
          db.prepare(`
            UPDATE v2_etapas 
            SET codigo = ?, nome = ?
            WHERE id = ?
          `).run(item, descricao, itemId);
        }
      } else {
        const itemCols = db.prepare("PRAGMA table_info(v2_orcamento_itens)").all() as any[];
        const hasItemUpdatedAt = itemCols.some(c => c.name === 'updated_at');

        // If we have a new item_id (from dropdown selection), use it.
        // Otherwise, we might need to find the item_id by code if it was changed manually (though usually it's via dropdown)
        let finalItemId = item_id;
        if (!finalItemId && codigo) {
          const itemRow = db.prepare("SELECT id FROM v2_itens WHERE codigo = ? LIMIT 1").get(codigo) as any;
          if (itemRow) finalItemId = itemRow.id;
        }

        if (finalItemId) {
          console.log("Updating orcamento item with finalItemId:", { itemId, item, finalQuantidade, finalPrecoUnitario, parsedEtapaId, finalItemId });
          if (hasItemUpdatedAt) {
            db.prepare(`
              UPDATE v2_orcamento_itens 
              SET item_numero = ?, quantidade = ?, custo_unitario_aplicado = ?, etapa_id = ?, item_id = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(item, finalQuantidade || 0, finalPrecoUnitario || 0, parsedEtapaId, finalItemId, itemId);
          } else {
            db.prepare(`
              UPDATE v2_orcamento_itens 
              SET item_numero = ?, quantidade = ?, custo_unitario_aplicado = ?, etapa_id = ?, item_id = ?
              WHERE id = ?
            `).run(item, finalQuantidade || 0, finalPrecoUnitario || 0, parsedEtapaId, finalItemId, itemId);
          }
        } else {
          console.log("Updating orcamento item without finalItemId:", { itemId, item, finalQuantidade, finalPrecoUnitario, parsedEtapaId });
          if (hasItemUpdatedAt) {
            db.prepare(`
              UPDATE v2_orcamento_itens 
              SET item_numero = ?, quantidade = ?, custo_unitario_aplicado = ?, etapa_id = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(item, finalQuantidade || 0, finalPrecoUnitario || 0, parsedEtapaId, itemId);
          } else {
            db.prepare(`
              UPDATE v2_orcamento_itens 
              SET item_numero = ?, quantidade = ?, custo_unitario_aplicado = ?, etapa_id = ?
              WHERE id = ?
            `).run(item, finalQuantidade || 0, finalPrecoUnitario || 0, parsedEtapaId, itemId);
          }
        }
      }
      res.json({ message: "Item atualizado com sucesso." });
    } catch (error: any) {
      console.error("Error updating budget item:", error);
      console.error("Request body:", JSON.stringify(req.body, null, 2));
      res.status(500).json({ message: "Erro ao atualizar item.", error: error.message });
    }
  });

  app.delete("/api/obras/:id/orcamento/:itemId", (req, res) => {
    const { tipo } = req.query;
    try {
      const rawId = req.params.itemId.replace(/^(etapa-|item-)/, '');
      const itemId = parseInt(rawId, 10);
      if (tipo === 'etapa') {
        db.prepare("DELETE FROM v2_etapas WHERE id = ?").run(itemId);
      } else {
        db.prepare("DELETE FROM v2_medicao_itens WHERE orcamento_item_id = ?").run(itemId);
        db.prepare("DELETE FROM v2_orcamento_itens WHERE id = ?").run(itemId);
      }
      res.json({ message: "Item removido com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao remover item.", error: error.message });
    }
  });

  app.post("/api/obras/:id/orcamento/resequence", (req, res) => {
    try {
      const obraId = req.params.id;
      
      db.transaction(() => {
        // Fetch all stages and items first
        const allEtapas = db.prepare("SELECT * FROM v2_etapas WHERE obra_id = ?").all(obraId) as any[];
        const allItems = db.prepare(`
          SELECT oi.* FROM v2_orcamento_itens oi 
          JOIN v2_etapas e ON oi.etapa_id = e.id 
          WHERE e.obra_id = ?
        `).all(obraId) as any[];

        const etapaMap = new Map<string, number>();
        allEtapas.forEach(e => {
          if (e.codigo) etapaMap.set(e.codigo, e.id);
        });

        // 1. Auto-parenting: Update hierarchy based on codes
        for (const etapa of allEtapas) {
          if (!etapa.codigo) continue;
          const parts = etapa.codigo.split('.');
          if (parts.length >= 2) {
            // e.g. 3.1.0 -> parent 3.0
            // e.g. 3.2.1.0 -> parent 3.2.0
            const parentParts = parts.slice(0, -2);
            if (parentParts.length > 0) {
              const parentCodeBase = parentParts.join('.');
              const parentId = etapaMap.get(parentCodeBase + '.0') || etapaMap.get(parentCodeBase);
              if (parentId && parentId !== etapa.id) {
                db.prepare("UPDATE v2_etapas SET etapa_pai_id = ? WHERE id = ?").run(parentId, etapa.id);
                etapa.etapa_pai_id = parentId; // Update in memory too
              }
            } else if (parts.length === 2 && parts[1] === '0') {
              db.prepare("UPDATE v2_etapas SET etapa_pai_id = NULL WHERE id = ?").run(etapa.id);
              etapa.etapa_pai_id = null;
            }
          }
        }

        for (const item of allItems) {
          if (!item.item_numero) continue;
          const parts = item.item_numero.split('.');
          if (parts.length >= 2) {
            // e.g. 3.2.1 -> stage 3.2.0 or 3.2
            const stageCodeBase = parts.slice(0, -1).join('.');
            const stageId = etapaMap.get(stageCodeBase + '.0') || etapaMap.get(stageCodeBase);
            if (stageId) {
              db.prepare("UPDATE v2_orcamento_itens SET etapa_id = ? WHERE id = ?").run(stageId, item.id);
              item.etapa_id = stageId;
            }
          }
        }

        // Clear all codes in DB to avoid unique constraint violations during resequence updates
        // db.prepare("UPDATE v2_etapas SET codigo = NULL WHERE obra_id = ?").run(obraId);
        
        // Group by parent using the updated hierarchy
        const etapasByParent: Record<number | string, any[]> = {};
        for (const e of allEtapas) {
          const parentId = e.etapa_pai_id || 'root';
          if (!etapasByParent[parentId]) etapasByParent[parentId] = [];
          etapasByParent[parentId].push(e);
        }

        const assignCodes = (parentId: number | string, prefix: string) => {
          const children = etapasByParent[parentId] || [];
          // Sort children by their current code or order
          children.sort((a, b) => {
             const aCode = a.codigo;
             const bCode = b.codigo;
             
             // Items without codes go to the end
             if (!aCode && !bCode) return a.id - b.id;
             if (!aCode) return 1;
             if (!bCode) return -1;

             // Try to compare numerically if possible
             const aParts = aCode.split('.').map((p: string) => parseInt(p, 10));
             const bParts = bCode.split('.').map((p: string) => parseInt(p, 10));
             
             for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
               const aP = isNaN(aParts[i]) ? 0 : aParts[i];
               const bP = isNaN(bParts[i]) ? 0 : bParts[i];
               if (aP !== bP) return aP - bP;
             }
             
             return a.id - b.id;
          });

          children.forEach((etapa, idx) => {
            // Check if we need to force renumbering
            const expectedCode = parentId === 'root' ? `${idx + 1}.0` : `${prefix}.${idx + 1}.0`;
            const newCode = (etapa.codigo && etapa.codigo.split('.').length > 1) ? etapa.codigo : expectedCode;
            
            // Update database (only if changed or missing)
            if (etapa.codigo !== newCode || etapa.ordem !== idx) {
                db.prepare("UPDATE v2_etapas SET codigo = ?, ordem = ? WHERE id = ?").run(newCode, idx, etapa.id);
                etapa.codigo = newCode;
            }
            
            // Recurse to sub-etapas
            assignCodes(etapa.id, newCode.replace(/\.0$/, ''));
            
            // Also update items under this etapa
            const items = allItems.filter(it => it.etapa_id === etapa.id);
            // Sort items by their current item_numero or order
            items.sort((a, b) => {
              const aCode = a.item_numero;
              const bCode = b.item_numero;

              if (!aCode && !bCode) return a.id - b.id;
              if (!aCode) return 1;
              if (!bCode) return -1;

              const aParts = aCode.split('.').map((p: string) => parseInt(p, 10));
              const bParts = bCode.split('.').map((p: string) => parseInt(p, 10));
              for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                const aP = isNaN(aParts[i]) ? 0 : aParts[i];
                const bP = isNaN(bParts[i]) ? 0 : bParts[i];
                if (aP !== bP) return aP - bP;
              }
              return a.id - b.id;
            });

            items.forEach((item, itemIdx) => {
               // Similar logic for items
               const expectedItemCode = `${newCode.replace(/\.0$/, '')}.${itemIdx + 1}`;
               const itemCode = (item.item_numero) ? item.item_numero : expectedItemCode;
                 
               if (item.item_numero !== itemCode || item.ordem !== itemIdx) {
                    db.prepare("UPDATE v2_orcamento_itens SET item_numero = ?, ordem = ? WHERE id = ?").run(itemCode, itemIdx, item.id);
               }
               
               // Also update any activities linked to this budget item
               db.prepare("UPDATE v2_atividades SET item_numero = ? WHERE orcamento_item_id = ?").run(itemCode, item.id);
            });
          });
        };

        assignCodes('root', '');
      })();

      res.json({ message: "Orçamento re-sequenciado com sucesso." });
    } catch (error: any) {
      console.error("Error in resequence:", error);
      res.status(500).json({ message: "Erro ao re-sequenciar orçamento.", error: error.message });
    }
  });

  app.post("/api/obras/:id/cronograma/resequence", (req, res) => {
    try {
      const obraId = req.params.id;
      db.transaction(() => {
        // 0. Clear all codes in DB to avoid unique constraint violations during resequence updates
        // db.prepare("UPDATE v2_etapas SET codigo = NULL WHERE obra_id = ?").run(obraId);

        // 1. Resequence stages first
        // const stages = db.prepare("SELECT id, codigo, ordem FROM v2_etapas WHERE obra_id = ? ORDER BY ordem ASC, id ASC").all(obraId) as any[];
        // stages.forEach((s, idx) => {
        //   const newStageCode = `${idx + 1}.0`;
        //   db.prepare("UPDATE v2_etapas SET codigo = ? WHERE id = ?").run(newStageCode, s.id);
        // });

        // 2. Fetch updated stages to get their new codes
        const updatedEtapas = db.prepare("SELECT id, codigo FROM v2_etapas WHERE obra_id = ?").all(obraId) as any[];
        const etapaMap = new Map(updatedEtapas.map(e => [e.id, e.codigo]));

        // 3. Fetch all activities
        const atividades = db.prepare("SELECT * FROM v2_atividades WHERE obra_id = ?").all(obraId) as any[];
        
        // Group activities by stage
        const atvByEtapa: Record<number | string, any[]> = {};
        atividades.forEach(a => {
          const eId = a.etapa_id || 'none';
          if (!atvByEtapa[eId]) atvByEtapa[eId] = [];
          atvByEtapa[eId].push(a);
        });

        // 4. Sort and assign item_numero for activities within each stage
        Object.keys(atvByEtapa).forEach(eId => {
          const stageCode = etapaMap.get(Number(eId)) || '';
          const baseCode = stageCode.endsWith('.0') ? stageCode.slice(0, -2) : stageCode;
          
          const stageAtvs = atvByEtapa[eId];
          stageAtvs.sort((a, b) => {
            const aCode = a.item_numero;
            const bCode = b.item_numero;
            
            if (!aCode && !bCode) return a.id - b.id;
            if (!aCode) return 1;
            if (!bCode) return -1;

            const aParts = aCode.split('.').map(p => parseInt(p, 10) || 0);
            const bParts = bCode.split('.').map(p => parseInt(p, 10) || 0);
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
              const aP = isNaN(aParts[i]) ? 0 : aParts[i];
              const bP = isNaN(bParts[i]) ? 0 : bParts[i];
              if (aP !== bP) return aP - bP;
            }
            
            return a.id - b.id;
          });

          stageAtvs.forEach((atv, idx) => {
            const newCode = baseCode ? `${baseCode}.${idx + 1}` : `${idx + 1}`;
            if (atv.item_numero !== newCode) {
              db.prepare("UPDATE v2_atividades SET item_numero = ? WHERE id = ?").run(newCode, atv.id);
            }
          });
        });
        recalculateCronograma(obraId);
      })();
      res.json({ message: "Cronograma re-sequenciado com sucesso." });
    } catch (error: any) {
      console.error("Error in cronograma resequence:", error);
      res.status(500).json({ message: "Erro ao re-sequenciar cronograma.", error: error.message });
    }
  });
  app.post("/api/itens", (req, res) => {
    const { nome, tipo, unidade, base, codigo, valor_unitario, categoria, estado } = req.body;
    try {
      const parsedValorUnitario = parseNumber(valor_unitario);
      const inferredCategoria = inferCategory(nome || '', categoria || 'Material');
      const finalBase = base || 'PRÓPRIO';
      let finalCodigo = codigo;
      
      if (!finalCodigo && finalBase === 'PRÓPRIO') {
        finalCodigo = getNextProprioCode();
      } else if (!finalCodigo) {
        finalCodigo = `P-${Date.now()}`;
      }

      const result = db.prepare(`
        INSERT INTO v2_itens (nome, tipo, unidade, base, codigo, categoria, created_at)
        VALUES (?, 'insumo', ?, ?, ?, ?, ?)
      `).run(nome, unidade, finalBase, finalCodigo, inferredCategoria, new Date().toISOString());
      
      const itemId = result.lastInsertRowid;
      
      if (parsedValorUnitario !== null) {
        // Use a very old date for 'PRÓPRIO' items to ensure they match any budget reference date
        const priceDate = finalBase === 'PRÓPRIO' ? '2000-01-01' : new Date().toISOString().split('T')[0];
        const finalEstado = estado || 'PRÓPRIO';
        
        // Insert for 'Desonerado'
        db.prepare(`
          INSERT INTO v2_precos (item_id, estado, tipo_desoneracao, data_referencia, preco_unitario)
          VALUES (?, ?, ?, ?, ?)
        `).run(itemId, finalEstado, 'Desonerado', priceDate, parsedValorUnitario);
        
        // Insert for 'Não Desonerado'
        db.prepare(`
          INSERT INTO v2_precos (item_id, estado, tipo_desoneracao, data_referencia, preco_unitario)
          VALUES (?, ?, ?, ?, ?)
        `).run(itemId, finalEstado, 'Não Desonerado', priceDate, parsedValorUnitario);
      }
      
      res.json({ id: itemId, codigo: finalCodigo, message: "Item criado com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao criar item.", error: error.message });
    }
  });

  app.post("/api/obras/:id/cronograma/baseline", (req, res) => {
    try {
      db.prepare(`
        UPDATE v2_atividades 
        SET data_inicio_base = data_inicio_prevista, 
            data_fim_base = data_fim_prevista,
            updated_at = CURRENT_TIMESTAMP 
        WHERE obra_id = ?
      `).run(req.params.id);
      res.json({ message: "Linha de base gerada com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao criar linha de base.", error: error.message });
    }
  });

  app.post("/api/obras/:id/cronograma/baseline/clear", (req, res) => {
    try {
      db.prepare(`
        UPDATE v2_atividades 
        SET data_inicio_base = NULL, 
            data_fim_base = NULL,
            updated_at = CURRENT_TIMESTAMP 
        WHERE obra_id = ?
      `).run(req.params.id);
      res.json({ message: "Linha de base removida com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao remover linha de base.", error: error.message });
    }
  });

  app.get("/api/obras/:id/cronograma", (req, res) => {
    try {
      const cronograma = db.prepare("SELECT * FROM v2_atividades WHERE obra_id = ?").all(req.params.id) as any[];
      
      // Fetch dependencies for all activities in this obra with full details
      const dependencias = db.prepare(`
        SELECT d.atividade_id, d.depende_de_id, d.tipo, d.lag_dias
        FROM v2_atividade_dependencias d
        JOIN v2_atividades a ON d.atividade_id = a.id
        WHERE a.obra_id = ?
      `).all(req.params.id) as any[];

      // Map dependencies to activities
      const depsMap: Record<number, number[]> = {};
      const fullDepsMap: Record<number, any[]> = {};

      dependencias.forEach(dep => {
        if (!depsMap[dep.atividade_id]) {
          depsMap[dep.atividade_id] = [];
          fullDepsMap[dep.atividade_id] = [];
        }
        depsMap[dep.atividade_id].push(dep.depende_de_id);
        
        let normalizedType = dep.tipo || 'FS';
        if (normalizedType === 'termina_inicia') normalizedType = 'FS';
        else if (normalizedType === 'inicia_inicia') normalizedType = 'SS';
        else if (normalizedType === 'termina_termina') normalizedType = 'FF';
        else if (normalizedType === 'inicia_termina') normalizedType = 'SF';

        fullDepsMap[dep.atividade_id].push({
          id: dep.depende_de_id,
          type: normalizedType,
          lag: dep.lag_dias || 0
        });
      });

      cronograma.forEach(atv => {
        atv.predecessor_ids = depsMap[atv.id] || (atv.predecessor_id ? [atv.predecessor_id] : []);
        atv.predecessors = fullDepsMap[atv.id] || (atv.predecessor_id ? [{ id: atv.predecessor_id, type: 'FS', lag: atv.lag_dias || 0 }] : []);
      });
      
      // Sort activities numerically by item_numero
      const sortCodes = (a: string, b: string) => {
        const aParts = (a || '').split('.').map(p => parseInt(p, 10) || 0);
        const bParts = (b || '').split('.').map(p => parseInt(p, 10) || 0);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aP = aParts[i] || 0;
          const bP = bParts[i] || 0;
          if (aP !== bP) return aP - bP;
        }
        return 0;
      };

      cronograma.sort((a, b) => sortCodes(a.item_numero, b.item_numero));
      res.json(cronograma);
    } catch (error: any) {
      console.error("Error fetching cronograma:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/obras/:id/caminho-critico", (req, res) => {
    try {
      const criticalPathAtividades = calculateCriticalPath(db, req.params.id);
      res.json(criticalPathAtividades);
    } catch (error: any) {
      console.error("Error fetching critical path:", error);
      res.status(500).json({ error: error.message });
    }
  });

  function recalculateCronograma(obraId: number | string) {
    const obra = db.prepare("SELECT data_inicio_real, configuracao_cronograma FROM v2_obras WHERE id = ?").get(obraId) as any;
    const config = obra?.configuracao_cronograma ? JSON.parse(obra.configuracao_cronograma) : {
      workingDays: [1, 2, 3, 4, 5],
      holidays: [],
      recessPeriods: [],
      rainDays: []
    };

    const obraStartReal = obra?.data_inicio_real;

    const isWorkingDay = (date: Date) => {
      const day = date.getDay();
      if (!config.workingDays || config.workingDays.length === 0) return true; // Safety: if no working days defined, assume all are working days
      if (!config.workingDays.includes(day)) return false;
      
      const dateStr = date.toISOString().split('T')[0];
      if (config.holidays && config.holidays.includes(dateStr)) return false;
      if (config.rainDays && config.rainDays.includes(dateStr)) return false;
      
      if (config.recessPeriods) {
        for (const period of config.recessPeriods) {
          if (period.start && period.end) {
            const start = new Date(period.start + 'T00:00:00');
            const end = new Date(period.end + 'T00:00:00');
            if (date >= start && date <= end) return false;
          }
        }
      }
      return true;
    };

    const offsetWorkingDays = (startDate: Date, offset: number) => {
      let result = new Date(startDate);
      
      let safety = 0;
      if (offset >= 0) {
        while (!isWorkingDay(result) && safety < 365) {
          result.setDate(result.getDate() + 1);
          safety++;
        }
      } else {
        while (!isWorkingDay(result) && safety < 365) {
          result.setDate(result.getDate() - 1);
          safety++;
        }
      }

      if (offset === 0) return result;
      
      const step = offset > 0 ? 1 : -1;
      let remaining = Math.abs(offset);
      safety = 0;
      
      while (remaining > 0 && safety < 1000) {
        result.setDate(result.getDate() + step);
        if (isWorkingDay(result)) {
          remaining--;
        }
        safety++;
      }
      return result;
    };

    const addWorkingDays = (startDate: Date, days: number) => {
      let result = new Date(startDate);
      if (days < 0) return offsetWorkingDays(startDate, days);
      
      let safety = 0;
      while (!isWorkingDay(result) && safety < 365) {
        result.setDate(result.getDate() + 1);
        safety++;
      }
      
      let addedDays = 1;
      safety = 0;
      while (addedDays < days && safety < 1000) {
        result.setDate(result.getDate() + 1);
        if (isWorkingDay(result)) {
          addedDays++;
        }
        safety++;
      }
      return result;
    };

    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const atividades = db.prepare("SELECT * FROM v2_atividades WHERE obra_id = ?").all(obraId) as any[];
    const dependencias = db.prepare(`
      SELECT d.* FROM v2_atividade_dependencias d
      JOIN v2_atividades a ON d.atividade_id = a.id
      WHERE a.obra_id = ?
    `).all(obraId) as any[];
    
    const atvMap = new Map();
    atividades.forEach(a => atvMap.set(a.id, a));

    const dependents = new Map();
    const predecessors = new Map();

    // Initialize maps
    atividades.forEach(a => {
      dependents.set(a.id, []);
      predecessors.set(a.id, []);
    });

    // Fill maps from v2_atividade_dependencias
    dependencias.forEach(d => {
      if (atvMap.has(d.atividade_id) && atvMap.has(d.depende_de_id)) {
        if (!dependents.has(d.depende_de_id)) dependents.set(d.depende_de_id, []);
        dependents.get(d.depende_de_id).push(d.atividade_id);
        
        if (!predecessors.has(d.atividade_id)) predecessors.set(d.atividade_id, []);
        predecessors.get(d.atividade_id).push({ id: d.depende_de_id, tipo: d.tipo || 'FS', lag: d.lag_dias || 0 });
      }
    });

    // Also consider legacy predecessor_id
    atividades.forEach(a => {
      if (a.predecessor_id && atvMap.has(a.predecessor_id)) {
        if (!dependents.get(a.predecessor_id).includes(a.id)) {
          dependents.get(a.predecessor_id).push(a.id);
        }
        if (!predecessors.get(a.id).some((p: any) => p.id === a.predecessor_id)) {
          predecessors.get(a.id).push({ id: a.predecessor_id, tipo: 'FS', lag: 0 });
        }
      }
    });

    // Topological sort or simple BFS for dependencies
    const queue = atividades.filter(a => (predecessors.get(a.id) || []).length === 0).map(a => a.id);
    const visited = new Set();

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentAtv = atvMap.get(currentId);
      const preds = predecessors.get(currentId) || [];

      let newStart: Date | null = null;

      if (currentAtv.data_inicio_real) {
        newStart = new Date(currentAtv.data_inicio_real + 'T00:00:00');
      } else if (preds.length > 0) {
        let maxStartDate: Date | null = null;
        
        preds.forEach((pred: { id: number; tipo: string; lag: number }) => {
          const pAtv = atvMap.get(pred.id);
          const pStartStr = pAtv.data_inicio_real || pAtv.data_inicio_prevista;
          const pEndStr = pAtv.data_fim_real || pAtv.data_fim_prevista;
          
          if (!pStartStr || !pEndStr) return;
          
          const pStart = new Date(pStartStr + 'T00:00:00');
          const pEnd = new Date(pEndStr + 'T00:00:00');
          
          let potentialStart: Date | null = null;

          if (pred.tipo === 'FS') {
            const nextDay = new Date(pEnd);
            nextDay.setDate(nextDay.getDate() + 1);
            potentialStart = offsetWorkingDays(nextDay, pred.lag);
          } else if (pred.tipo === 'SS') {
            potentialStart = offsetWorkingDays(pStart, pred.lag);
          } else if (pred.tipo === 'FF') {
            // FF: Predecessor finish sets successor finish
            // Finish = End(pred) + lag
            const pFinish = offsetWorkingDays(pEnd, pred.lag);
            const duration = parseInt(currentAtv.duracao_dias || 1);
            // newStart = PFinish - Duration (but as offset, meaning going backwards by duration-1)
            potentialStart = offsetWorkingDays(pFinish, -(duration - 1));
          } else if (pred.tipo === 'SF') {
            // SF: Predecessor start sets successor finish
            // Finish = Start(pred) + lag
            const pFinish = offsetWorkingDays(pStart, pred.lag);
            const duration = parseInt(currentAtv.duracao_dias || 1);
            // Start = Finish - duration
            potentialStart = offsetWorkingDays(pFinish, -(duration - 1));
          }

          if (potentialStart && (!maxStartDate || potentialStart > maxStartDate)) {
            maxStartDate = potentialStart;
          }
        });
        
        newStart = maxStartDate;
      } else {
        // Root task - prioritize project start date if it exists
        let initialStart = obraStartReal || currentAtv.data_inicio_prevista;

        if (initialStart) {
          newStart = new Date(initialStart + 'T00:00:00');
        }
      }

      if (newStart) {
        const duracao = (currentAtv.duracao_dias !== null && currentAtv.duracao_dias !== undefined) ? currentAtv.duracao_dias : 1;
        
        const offset = Math.max(0, duracao - 1);
        const newEnd = duracao === 0 ? newStart : offsetWorkingDays(newStart, offset);
        const newStartStr = newStart.toISOString().split('T')[0];
        const newEndStr = newEnd.toISOString().split('T')[0];

        if (newStartStr !== currentAtv.data_inicio_prevista || newEndStr !== currentAtv.data_fim_prevista) {
          db.prepare("UPDATE v2_atividades SET data_inicio_prevista = ?, data_fim_prevista = ? WHERE id = ?").run(newStartStr, newEndStr, currentId);
          currentAtv.data_inicio_prevista = newStartStr;
          currentAtv.data_fim_prevista = newEndStr;
          
          // Add dependents to queue to propagate changes
          const nextAtvs = dependents.get(currentId) || [];
          nextAtvs.forEach((nextId: number) => {
            if (!visited.has(nextId)) {
              queue.push(nextId);
            }
          });
        }
      }

      const deps = dependents.get(currentId) || [];
      deps.forEach((dId: number) => {
        if (!visited.has(dId)) queue.push(dId);
      });
    }
  }

  app.post("/api/obras/:id/cronograma", (req, res) => {
    const { nome, descricao, data_inicio_prevista, data_fim_prevista, duracao_dias, predecessor_ids, predecessors, orcamento_item_id, item_numero, etapa_id, recurso, predecessores_texto, progresso, data_inicio_real, data_fim_real, is_marco, data_inicio_base, data_fim_base, produtividade, quantidade_equipe } = req.body;
    try {
      db.transaction(() => {
        const stmt = db.prepare("INSERT INTO v2_atividades (obra_id, nome, descricao, data_inicio_prevista, data_fim_prevista, duracao_dias, predecessor_id, orcamento_item_id, item_numero, etapa_id, recurso, predecessores_texto, progresso, data_inicio_real, data_fim_real, is_marco, data_inicio_base, data_fim_base, produtividade, quantidade_equipe) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        const info = stmt.run(req.params.id, nome, descricao, data_inicio_prevista, data_fim_prevista, (duracao_dias !== undefined && duracao_dias !== "") ? duracao_dias : null, predecessor_ids?.[0] || null, orcamento_item_id || null, item_numero || null, etapa_id || null, recurso || null, predecessores_texto || null, (progresso !== undefined && progresso !== "") ? progresso : null, data_inicio_real || null, data_fim_real || null, is_marco ? 1 : 0, data_inicio_base || null, data_fim_base || null, produtividade || 1, quantidade_equipe || 1);
        const atividadeId = info.lastInsertRowid;

        // Suporta tanto o formato antigo (predecessor_ids: number[]) quanto o novo (predecessors: {id, type, lag})
        let depInputs = predecessors || (Array.isArray(predecessor_ids) ? predecessor_ids.map(id => ({ id, type: 'FS', lag: 0 })) : []);
        
        if (Array.isArray(depInputs)) {
          const depStmt = db.prepare("INSERT INTO v2_atividade_dependencias (atividade_id, depende_de_id, tipo, lag_dias) VALUES (?, ?, ?, ?)");
          depInputs.forEach((p: any) => {
            depStmt.run(atividadeId, p.id, p.type || 'FS', p.lag || 0);
          });
        }
        recalculateCronograma(req.params.id);
      })();

      res.json({ message: "Atividade criada com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao criar atividade.", error: error.message });
    }
  });

  app.put("/api/obras/:id/cronograma/:atividadeId", (req, res) => {
    const { nome, descricao, data_inicio_prevista, data_fim_prevista, duracao_dias, predecessor_ids, predecessors, orcamento_item_id, item_numero, etapa_id, recurso, predecessores_texto, progresso, data_inicio_real, data_fim_real, is_marco, data_inicio_base, data_fim_base, produtividade, quantidade_equipe } = req.body;
    try {
      db.transaction(() => {
        const stmt = db.prepare("UPDATE v2_atividades SET nome = ?, descricao = ?, data_inicio_prevista = ?, data_fim_prevista = ?, duracao_dias = ?, predecessor_id = ?, orcamento_item_id = ?, item_numero = ?, etapa_id = ?, recurso = ?, predecessores_texto = ?, progresso = ?, data_inicio_real = ?, data_fim_real = ?, is_marco = ?, data_inicio_base = ?, data_fim_base = ?, produtividade = ?, quantidade_equipe = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND obra_id = ?");

        // Lógica de cálculo bidirecional
        let finalDuracao = duracao_dias;
        if (produtividade && quantidade_equipe) {
             const budgetItem = db.prepare("SELECT quantidade FROM v2_orcamento_itens WHERE id = ?").get(orcamento_item_id || -1) as any;
             if (budgetItem && budgetItem.quantidade > 0) {
                 finalDuracao = Math.ceil(budgetItem.quantidade / (produtividade * quantidade_equipe));
             }
        }

        stmt.run(nome, descricao || '', data_inicio_prevista, data_fim_prevista, finalDuracao, predecessor_ids?.[0] || null, orcamento_item_id || null, item_numero || null, etapa_id || null, recurso || null, predecessores_texto || null, (progresso !== undefined && progresso !== "") ? progresso : null, data_inicio_real || null, data_fim_real || null, is_marco ? 1 : 0, data_inicio_base || null, data_fim_base || null, produtividade || 1, quantidade_equipe || 1, req.params.atividadeId, req.params.id);

        db.prepare("DELETE FROM v2_atividade_dependencias WHERE atividade_id = ?").run(req.params.atividadeId);
        
        // Suporta tanto o formato antigo (predecessor_ids: number[]) quanto o novo (predecessors: {id, type, lag})
        let depInputs = predecessors || (Array.isArray(predecessor_ids) ? predecessor_ids.map(id => ({ id, type: 'FS', lag: 0 })) : []);
        
        if (Array.isArray(depInputs)) {
          const depStmt = db.prepare("INSERT INTO v2_atividade_dependencias (atividade_id, depende_de_id, tipo, lag_dias) VALUES (?, ?, ?, ?)");
          depInputs.forEach((p: any) => {
            depStmt.run(req.params.atividadeId, p.id, p.type || 'FS', p.lag || 0);
          });
        }
        recalculateCronograma(req.params.id);
      })();

      const updatedAtividade = db.prepare("SELECT * FROM v2_atividades WHERE id = ?").get(req.params.atividadeId);
      res.json({ message: "Atividade atualizada com sucesso.", atividade: updatedAtividade });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao atualizar atividade.", error: error.message });
    }
  });

  app.delete("/api/obras/:id/cronograma/:atividadeId", (req, res) => {
    try {
      db.transaction(() => {
        db.prepare("DELETE FROM v2_atividade_dependencias WHERE atividade_id = ? OR depende_de_id = ?").run(req.params.atividadeId, req.params.atividadeId);
        const stmt = db.prepare("DELETE FROM v2_atividades WHERE id = ? AND obra_id = ?");
        stmt.run(req.params.atividadeId, req.params.id);
        recalculateCronograma(req.params.id);
      })();
      
      res.json({ message: "Atividade excluída com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao excluir atividade.", error: error.message });
    }
  });

  app.get("/api/obras/:id/cronograma-config", (req, res) => {
    try {
      const obra = db.prepare("SELECT configuracao_cronograma FROM v2_obras WHERE id = ?").get(req.params.id) as any;
      if (!obra) return res.status(404).json({ message: "Obra não encontrada." });
      
      const config = obra.configuracao_cronograma ? JSON.parse(obra.configuracao_cronograma) : {
        workingDays: [1, 2, 3, 4, 5],
        holidays: [],
        recessPeriods: []
      };
      
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar configuração do cronograma.", error: error.message });
    }
  });

  app.post("/api/obras/:id/cronograma-config", (req, res) => {
    try {
      const { workingDays, holidays, recessPeriods } = req.body;
      const config = JSON.stringify({ workingDays, holidays, recessPeriods });
      
      db.prepare("UPDATE v2_obras SET configuracao_cronograma = ? WHERE id = ?").run(config, req.params.id);
      res.json({ message: "Configuração do cronograma atualizada com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao atualizar configuração do cronograma.", error: error.message });
    }
  });

  app.get("/api/obras/:id/atividades", (req, res) => {
    try {
      const atividades = db.prepare(`
        SELECT a.*, e.nome as etapa_nome, e.ordem as etapa_ordem, i.ordem as item_ordem
        FROM v2_atividades a 
        LEFT JOIN v2_etapas e ON a.etapa_id = e.id
        LEFT JOIN v2_orcamento_itens i ON a.orcamento_item_id = i.id 
        WHERE a.obra_id = ? 
        ORDER BY e.ordem, i.ordem, a.data_inicio_prevista ASC
      `).all(req.params.id);
      res.json(atividades);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar atividades.", error: error.message });
    }
  });

  app.get("/api/obras/:id/medicoes", (req, res) => {
    try {
      const medicoes = db.prepare(`
        SELECT 
          m.*, 
          (SELECT SUM(mi.quantidade_medida * oi.custo_unitario_aplicado * (1 + COALESCE(o.bdi, 0) / 100.0)) 
           FROM v2_medicao_itens mi 
           JOIN v2_orcamento_itens oi ON mi.orcamento_item_id = oi.id 
           JOIN v2_etapas e ON oi.etapa_id = e.id
           JOIN v2_obras o ON e.obra_id = o.id
           WHERE mi.medicao_id = m.id) as total_valor
        FROM v2_medicoes m 
        WHERE m.obra_id = ? 
        ORDER BY m.data_medicao DESC
      `).all(req.params.id);
      res.json(medicoes);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar medições.", error: error.message });
    }
  });

  app.get("/api/obras/:id/diario", (req, res) => {
    const diarios = db.prepare("SELECT * FROM v2_diario_obra WHERE obra_id = ? ORDER BY data DESC").all(req.params.id);
    res.json(diarios);
  });

  app.post("/api/obras/:id/diario", (req, res) => {
    const { data, texto, usuario_responsavel } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO v2_diario_obra (obra_id, data, texto, usuario_responsavel) VALUES (?, ?, ?, ?)");
      const info = stmt.run(req.params.id, data, texto, usuario_responsavel);
      res.json({ id: info.lastInsertRowid, message: "Diário registrado com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao registrar diário.", error: error.message });
    }
  });

  app.get("/api/obras/:id/medicao", (req, res) => {
    const medicoes = db.prepare("SELECT * FROM v2_medicoes WHERE obra_id = ? ORDER BY data_medicao DESC").all(req.params.id);
    res.json(medicoes);
  });

  app.post("/api/obras/:id/medicao", (req, res) => {
    const { periodo_inicio, periodo_fim, data_medicao, observacoes, itens } = req.body;
    try {
      db.transaction(() => {
        const stmt = db.prepare("INSERT INTO v2_medicoes (obra_id, periodo_inicio, periodo_fim, data_medicao, observacoes) VALUES (?, ?, ?, ?, ?)");
        const info = stmt.run(req.params.id, periodo_inicio, periodo_fim, data_medicao, observacoes);
        const medicaoId = info.lastInsertRowid;

        if (Array.isArray(itens)) {
          const itemStmt = db.prepare("INSERT INTO v2_medicao_itens (medicao_id, orcamento_item_id, quantidade_medida, observacao) VALUES (?, ?, ?, ?)");
          const updateOrcamentoStmt = db.prepare("UPDATE v2_orcamento_itens SET progresso = (SELECT SUM(quantidade_medida) FROM v2_medicao_itens WHERE orcamento_item_id = ?) / quantidade * 100 WHERE id = ?");
          const updateAtividadeStmt = db.prepare("UPDATE v2_atividades SET progresso = (SELECT progresso FROM v2_orcamento_itens WHERE id = ?) WHERE orcamento_item_id = ?");

          itens.forEach((it: any) => {
            itemStmt.run(medicaoId, it.orcamento_item_id, it.quantidade_medida, it.observacao || null);
            updateOrcamentoStmt.run(it.orcamento_item_id, it.orcamento_item_id);
            updateAtividadeStmt.run(it.orcamento_item_id, it.orcamento_item_id);
          });

          // Update stage progress
          const updateEtapaStmt = db.prepare(`
            UPDATE v2_etapas 
            SET progresso = (
              SELECT AVG(progresso) 
              FROM v2_orcamento_itens 
              WHERE etapa_id = v2_etapas.id
            )
            WHERE obra_id = ?
          `);
          updateEtapaStmt.run(req.params.id);
        }
      })();
      res.json({ message: "Medição registrada com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao registrar medição.", error: error.message });
    }
  });

  app.get("/api/obras/:id/medicao-itens-flat", (req, res) => {
    try {
      const items = db.prepare(`
        SELECT 
          mi.*, 
          m.periodo_inicio, 
          m.periodo_fim, 
          m.data_medicao,
          oi.etapa_id,
          oi.custo_unitario_aplicado,
          o.bdi
        FROM v2_medicao_itens mi
        JOIN v2_medicoes m ON mi.medicao_id = m.id
        JOIN v2_orcamento_itens oi ON mi.orcamento_item_id = oi.id
        JOIN v2_etapas e ON oi.etapa_id = e.id
        JOIN v2_obras o ON e.obra_id = o.id
        WHERE m.obra_id = ?
      `).all(req.params.id);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar itens de medição.", error: error.message });
    }
  });

  app.get("/api/obras/:id/medicao/:medicaoId", (req, res) => {
    try {
      const medicao = db.prepare("SELECT * FROM v2_medicoes WHERE id = ? AND obra_id = ?").get(req.params.medicaoId, req.params.id);
      if (!medicao) return res.status(404).json({ message: "Medição não encontrada." });

      const itens = db.prepare(`
        SELECT 
          mi.*, 
          oi.descricao, 
          oi.quantidade as quantidade_total, 
          oi.unidade,
          oi.custo_unitario_aplicado
        FROM v2_medicao_itens mi
        JOIN v2_orcamento_itens oi ON mi.orcamento_item_id = oi.id
        WHERE mi.medicao_id = ?
      `).all(req.params.medicaoId);

      res.json({ ...medicao, itens });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar detalhes da medição.", error: error.message });
    }
  });

  app.get("/api/obras/:id/curva-abc", (req, res) => {
    try {
      const obra = db.prepare("SELECT bdi, bdi_incidencia, uf, data_referencia, desonerado FROM v2_obras WHERE id = ?").get(req.params.id) as any;
      if (!obra) return res.status(404).json({ message: "Obra não encontrada" });
      
      const bdi = obra.bdi ?? 0;
      const bdiIncidencia = obra.bdi_incidencia || 'unitario';
      const estado = obra.uf || 'DF';
      const dataRef = obra.data_referencia || '2026-04-01';
      const isDesonerado = req.query.desonerado === 'true' || obra.desonerado === 1;
      
      let parsedBancosAtivos = [];
      try {
        parsedBancosAtivos = JSON.parse(obra.bancos_ativos || '[]');
      } catch (e) {
        console.error("Failed to parse bancos_ativos in curva-abc:", e);
      }

      const items = db.prepare(`
        SELECT 
          oi.item_id,
          i.tipo,
          oi.quantidade,
          oi.custo_unitario_aplicado as valor_unitario
        FROM v2_orcamento_itens oi
        JOIN v2_itens i ON oi.item_id = i.id
        JOIN v2_etapas e ON oi.etapa_id = e.id
        WHERE e.obra_id = ?
      `).all(req.params.id) as { item_id: number, tipo: string, quantidade: number, valor_unitario: number }[];

      if (items.length === 0) return res.json([]);

      // Expand all items into a flat list of insumos
      const insumosAchatados = new Map<number, { descricao: string, quantidade: number, valor_unitario: number }>();

      for (const item of items) {
        if (item.tipo === 'insumo') {
          const info = db.prepare("SELECT nome FROM v2_itens WHERE id = ?").get(item.item_id) as { nome: string };
          const existing = insumosAchatados.get(item.item_id) || { descricao: info.nome, quantidade: 0, valor_unitario: item.valor_unitario };
          existing.quantidade += item.quantidade;
          insumosAchatados.set(item.item_id, existing);
        } else {
          // Expand composition
          const subItems = getFlatCompositionItems(item.item_id, estado, dataRef, isDesonerado ? 'Desonerado' : 'Não Desonerado', parsedBancosAtivos);
          for (const sub of subItems) {
            const existing = insumosAchatados.get(sub.item_id) || { descricao: sub.descricao, quantidade: 0, valor_unitario: sub.preco_unitario };
            existing.quantidade += sub.quantidade * item.quantidade;
            insumosAchatados.set(sub.item_id, existing);
          }
        }
      }

      // Convert map to array and calculate totals
      const orcamento = Array.from(insumosAchatados.values()).map(it => ({
        descricao: it.descricao,
        total: bdiIncidencia === 'unitario' ? it.quantidade * (it.valor_unitario * (1 + bdi / 100)) : it.quantidade * it.valor_unitario
      })).sort((a, b) => b.total - a.total);

      const totalGeral = orcamento.reduce((acc, curr) => acc + (curr.total || 0), 0);
      if (totalGeral === 0) return res.json([]);

      let acumulado = 0;
      
      const abc = orcamento.map(item => {
        acumulado += (item.total || 0);
        const percentual = (item.total / totalGeral) * 100;
        const percentualAcumulado = (acumulado / totalGeral) * 100;
        
        let classe = 'C';
        if (percentualAcumulado <= 80) classe = 'A';
        else if (percentualAcumulado <= 95) classe = 'B';

        return {
          ...item,
          percentual,
          percentualAcumulado,
          classe
        };
      });

      res.json(abc);
    } catch (error: any) {
      console.error("Error calculating ABC:", error);
      res.status(500).json({ message: "Erro ao calcular curva ABC.", error: error.message });
    }
  });

  app.get("/api/search", (req, res) => {
    const { q, type, estado, data_referencia } = req.query;
    if (!q) return res.json([]);

    const estadoFilter = estado || 'DF';
    const dataRefFilter = data_referencia || '2024-01-01';

    try {
      const itemType = type === 'insumo' ? 'insumo' : 'composicao';
      const results = db.prepare(`
        SELECT 
          ic.id as ${itemType === 'insumo' ? 'id_insumo' : 'id_composicao'}, 
          ic.codigo${itemType === 'composicao' ? ' as codigo_composicao' : ''}, 
          ic.nome as descricao, 
          ic.unidade, 
          ic.base,
          ic.categoria as tipo,
          MAX(CASE WHEN ip.tipo_desoneracao = 'Desonerado' THEN ip.preco_unitario END) as valor_desonerado,
          MAX(CASE WHEN ip.tipo_desoneracao = 'Não Desonerado' THEN ip.preco_unitario END) as valor_nao_desonerado,
          ip.estado, 
          ip.data_referencia
        FROM v2_itens ic
        LEFT JOIN v2_precos ip ON ic.id = ip.item_id AND ip.estado = ? AND ip.data_referencia <= ?
        WHERE ic.tipo = ? AND (ic.nome LIKE ? OR ic.codigo LIKE ?)
        GROUP BY ic.id
      `).all(estadoFilter, dataRefFilter, itemType, `%${q}%`, `%${q}%`) as any[];
      
      // If it's a composition and prices are missing, calculate them
      if (itemType === 'composicao') {
        for (const res of results) {
          if (!res.valor_desonerado) {
            const tree = getCompositionTree(res.id_composicao, estadoFilter, dataRefFilter, 'Desonerado');
            res.valor_desonerado = tree.valor_total || 0;
          }
          if (!res.valor_nao_desonerado) {
            const tree = getCompositionTree(res.id_composicao, estadoFilter, dataRefFilter, 'Não Desonerado');
            res.valor_nao_desonerado = tree.valor_total || 0;
          }
        }
      }
      
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: "Erro na busca.", error: error.message });
    }
  });

  app.get("/api/insumos", (req, res) => {
    const { search, codigo, descricao, estado, data_referencia, base, bases, tipo } = req.query;
    const params: any[] = [];
    
    const originalEstado = (estado as string) || 'Todos';
    const targetEstado = originalEstado !== 'Todos' ? originalEstado : 'DF';
    const targetData = normalizeDate(data_referencia as string) || '2026-04-01';
    const formattedDate = targetData;

    let query = `
      SELECT 
        ic.id as id_insumo, 
        ic.base,
        ic.codigo,
        ic.nome as descricao,
        ic.unidade,
        ic.categoria as tipo,
        (
          SELECT COALESCE(
            (SELECT preco_unitario FROM v2_precos p
             WHERE p.item_id = ic.id 
             AND p.tipo_desoneracao = 'Desonerado'
             AND (p.estado = ? OR p.estado = 'PRÓPRIO' OR ic.base = 'PRÓPRIO' OR ? = 'Todos')
             AND (p.data_referencia <= ? OR ic.base = 'PRÓPRIO')
             ORDER BY 
               CASE WHEN p.estado = ? THEN 0 
                    WHEN p.estado = 'PRÓPRIO' THEN 1 
                    ELSE 2 END, 
               p.data_referencia DESC
             LIMIT 1),
            (SELECT preco_unitario FROM v2_precos p
             WHERE p.item_id = ic.id 
             AND p.tipo_desoneracao = 'Não Desonerado'
             AND (p.estado = ? OR p.estado = 'PRÓPRIO' OR ic.base = 'PRÓPRIO' OR ? = 'Todos')
             AND (p.data_referencia <= ? OR ic.base = 'PRÓPRIO')
             ORDER BY 
               CASE WHEN p.estado = ? THEN 0 
                    WHEN p.estado = 'PRÓPRIO' THEN 1 
                    ELSE 2 END, 
               p.data_referencia DESC
             LIMIT 1)
          )
        ) as valor_desonerado,
        (
          SELECT COALESCE(
            (SELECT preco_unitario FROM v2_precos p
             WHERE p.item_id = ic.id 
             AND p.tipo_desoneracao = 'Não Desonerado'
             AND (p.estado = ? OR p.estado = 'PRÓPRIO' OR ic.base = 'PRÓPRIO' OR ? = 'Todos')
             AND (p.data_referencia <= ? OR ic.base = 'PRÓPRIO')
             ORDER BY 
               CASE WHEN p.estado = ? THEN 0 
                    WHEN p.estado = 'PRÓPRIO' THEN 1 
                    ELSE 2 END, 
               p.data_referencia DESC
             LIMIT 1),
            (SELECT preco_unitario FROM v2_precos p
             WHERE p.item_id = ic.id 
             AND p.tipo_desoneracao = 'Desonerado'
             AND (p.estado = ? OR p.estado = 'PRÓPRIO' OR ic.base = 'PRÓPRIO' OR ? = 'Todos')
             AND (p.data_referencia <= ? OR ic.base = 'PRÓPRIO')
             ORDER BY 
               CASE WHEN p.estado = ? THEN 0 
                    WHEN p.estado = 'PRÓPRIO' THEN 1 
                    ELSE 2 END, 
               p.data_referencia DESC
             LIMIT 1)
          )
        ) as valor_nao_desonerado,
        ? as estado,
        (
          SELECT MAX(data_referencia) FROM v2_precos p
          WHERE p.item_id = ic.id 
          AND (p.estado = ? OR p.estado = 'PRÓPRIO' OR ic.base = 'PRÓPRIO' OR ? = 'Todos')
          AND (p.data_referencia <= ? OR ic.base = 'PRÓPRIO')
        ) as data_referencia
      FROM v2_itens ic
      WHERE ic.tipo = 'insumo'
    `;
    
    params.push(
      targetEstado, originalEstado, formattedDate, targetEstado, // for valor_desonerado (Desonerado)
      targetEstado, originalEstado, formattedDate, targetEstado, // for valor_desonerado (Não Desonerado fallback)
      targetEstado, originalEstado, formattedDate, targetEstado, // for valor_nao_desonerado (Não Desonerado)
      targetEstado, originalEstado, formattedDate, targetEstado, // for valor_nao_desonerado (Desonerado fallback)
      targetEstado, // for estado column
      targetEstado, originalEstado, formattedDate // for data_referencia column
    );
    
    if (base && base !== 'Todos') {
      query += ` AND ic.base = ?`;
      params.push(base);
    } else if (bases) {
      const baseList = (bases as string).split(',');
      if (baseList.length > 0) {
        query += ` AND ic.base IN (${baseList.map(() => '?').join(',')})`;
        params.push(...baseList);
      }
    }
    if (tipo && tipo !== 'Todos') {
      query += ` AND ic.categoria = ?`;
      params.push(tipo);
    }
    if (search) {
      query += ` AND (ic.nome LIKE ? OR ic.codigo LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (codigo) {
      query += ` AND ic.codigo LIKE ?`;
      params.push(`%${codigo}%`);
    }
    if (descricao) {
      query += ` AND ic.nome LIKE ?`;
      params.push(`%${descricao}%`);
    }
    
    query += ` ORDER BY ic.nome LIMIT 100`;
    
    try {
      const insumos = db.prepare(query).all(...params);
      res.json(insumos);
    } catch (error: any) {
      console.error("Error fetching insumos:", error);
      res.status(500).json({ message: "Erro ao buscar insumos.", error: error.message });
    }
  });

  app.post("/api/insumos", (req, res) => {
    const { base, codigo, descricao, unidade, tipo, estado, data_referencia, valor_desonerado, valor_nao_desonerado } = req.body;
    try {
      const transaction = db.transaction(() => {
        const inferredCategoria = inferCategory(descricao || '', tipo || 'Material');
        const finalBase = base || 'PRÓPRIO';
        let finalCodigo = codigo;

        if (!finalCodigo && finalBase === 'PRÓPRIO') {
          finalCodigo = getNextProprioCode();
        }

        const resCadastro = db.prepare(`
          INSERT INTO v2_itens (base, codigo, nome, unidade, tipo, categoria)
          VALUES (?, ?, ?, ?, 'insumo', ?)
        `).run(finalBase, finalCodigo, descricao, unidade, inferredCategoria);
        
        const insumoId = resCadastro.lastInsertRowid;
        
        // Use a very old date for 'PRÓPRIO' items to ensure they match any budget reference date
        const priceDate = data_referencia || (finalBase === 'PRÓPRIO' ? '2000-01-01' : '2026-04-01');

        if (valor_desonerado !== undefined) {
          db.prepare(`
            INSERT INTO v2_precos (item_id, estado, tipo_desoneracao, data_referencia, preco_unitario)
            VALUES (?, ?, ?, ?, ?)
          `).run(insumoId, estado || 'DF', 'Desonerado', priceDate, valor_desonerado || 0);
        }
        
        if (valor_nao_desonerado !== undefined) {
          db.prepare(`
            INSERT INTO v2_precos (item_id, estado, tipo_desoneracao, data_referencia, preco_unitario)
            VALUES (?, ?, ?, ?, ?)
          `).run(insumoId, estado || 'DF', 'Não Desonerado', priceDate, valor_nao_desonerado || 0);
        }
        
        return { id: insumoId, codigo: finalCodigo };
      });
      
      const result = transaction();
      res.json({ ...result, message: "Insumo criado com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao criar insumo.", error: error.message });
    }
  });

  app.put("/api/insumos/:id", (req, res) => {
    const { id } = req.params;
    const { base, codigo, descricao, unidade, tipo, estado, data_referencia, valor_desonerado, valor_nao_desonerado } = req.body;
    try {
      const transaction = db.transaction(() => {
        db.prepare(`
          UPDATE v2_itens 
          SET base = ?, codigo = ?, nome = ?, unidade = ?, categoria = ?
          WHERE id = ? AND tipo = 'insumo'
        `).run(base || 'SINAPI', codigo, descricao, unidade, tipo || 'Material', id);
        
        // Update or insert price for Desonerado
        if (valor_desonerado !== undefined) {
          db.prepare(`
            INSERT INTO v2_precos (item_id, estado, tipo_desoneracao, data_referencia, preco_unitario) 
            VALUES (?, ?, 'Desonerado', ?, ?) 
            ON CONFLICT(item_id, estado, tipo_desoneracao, data_referencia) 
            DO UPDATE SET preco_unitario = excluded.preco_unitario
          `).run(id, estado, data_referencia, valor_desonerado);
          
          // Propagate to orcamentos (assuming Desonerado as default for simplicity if not specified)
          db.prepare(`
            UPDATE orcamentos 
            SET preco_unitario = ?, total = quantidade * ?
            WHERE item_id = ? AND item_tipo = 'insumo'
          `).run(valor_desonerado, valor_desonerado, id);

          db.prepare(`
            UPDATE v2_orcamento_itens 
            SET custo_unitario_aplicado = ?
            WHERE item_id = ?
          `).run(valor_desonerado, id);
        }
        
        // Update or insert price for Não Desonerado
        if (valor_nao_desonerado !== undefined) {
          db.prepare(`
            INSERT INTO v2_precos (item_id, estado, tipo_desoneracao, data_referencia, preco_unitario) 
            VALUES (?, ?, 'Não Desonerado', ?, ?) 
            ON CONFLICT(item_id, estado, tipo_desoneracao, data_referencia) 
            DO UPDATE SET preco_unitario = excluded.preco_unitario
          `).run(id, estado, data_referencia, valor_nao_desonerado);
        }

        // Recalculate affected compositions
        triggerCascadeRecalculation(parseInt(id, 10), estado || 'DF', data_referencia || new Date().toISOString().split('T')[0]);
      });
      transaction();
      res.json({ message: "Insumo atualizado com sucesso. Composições recalculadas." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao atualizar insumo.", error: error.message });
    }
  });

  app.delete("/api/insumos/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const transaction = db.transaction((idToDelete) => {
        // Check if legacy orcamentos table exists
        const orcamentosExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orcamentos'").get();
        
        db.prepare("DELETE FROM v2_medicao_itens WHERE orcamento_item_id IN (SELECT id FROM v2_orcamento_itens WHERE item_id = ?)").run(idToDelete);
        db.prepare("DELETE FROM v2_precos WHERE item_id = ?").run(idToDelete);
        db.prepare("DELETE FROM v2_composicao_itens WHERE item_id = ?").run(idToDelete);
        db.prepare("DELETE FROM v2_orcamento_itens WHERE item_id = ?").run(idToDelete);
        
        if (orcamentosExists) {
          db.prepare("DELETE FROM orcamentos WHERE item_id = ? AND item_tipo = 'insumo'").run(idToDelete);
        }
        
        db.prepare("DELETE FROM v2_itens WHERE id = ? AND tipo = 'insumo'").run(idToDelete);
      });
      transaction(id);
      res.json({ message: "Insumo excluído com sucesso." });
    } catch (error: any) {
      console.error("Delete insumo error:", error);
      res.status(500).json({ message: "Erro ao excluir insumo.", error: error.message });
    }
  });

  app.post("/api/insumos/bulk-delete", (req, res) => {
    const { ids } = req.body;
    try {
      if (!Array.isArray(ids)) {
        return res.status(400).json({ message: "Lista de IDs inválida." });
      }
      const parsedIds = ids.map((id: any) => parseInt(id, 10));
      
      const transaction = db.transaction((items) => {
        // Check if legacy orcamentos table exists
        const orcamentosExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orcamentos'").get();
        
        const delMedicaoItens = db.prepare("DELETE FROM v2_medicao_itens WHERE orcamento_item_id IN (SELECT id FROM v2_orcamento_itens WHERE item_id = ?)");
        const delPrecos = db.prepare("DELETE FROM v2_precos WHERE item_id = ?");
        const delCompItens = db.prepare("DELETE FROM v2_composicao_itens WHERE item_id = ?");
        const delOrcItens = db.prepare("DELETE FROM v2_orcamento_itens WHERE item_id = ?");
        const delItens = db.prepare("DELETE FROM v2_itens WHERE id = ? AND tipo = 'insumo'");
        
        let delOrcamentosStmt;
        if (orcamentosExists) {
          delOrcamentosStmt = db.prepare("DELETE FROM orcamentos WHERE item_id = ? AND item_tipo = 'insumo'");
        }
        
        for (const id of items) {
          delMedicaoItens.run(id);
          delPrecos.run(id);
          delCompItens.run(id);
          delOrcItens.run(id);
          if (delOrcamentosStmt) {
            delOrcamentosStmt.run(id);
          }
          delItens.run(id);
        }
      });
      transaction(parsedIds);
      res.json({ message: "Insumos excluídos com sucesso." });
    } catch (error: any) {
      console.error("Bulk delete error:", error);
      res.status(500).json({ message: "Erro ao excluir insumos.", error: error.message });
    }
  });

  app.post("/api/insumos/import", (req, res) => {
    const data = req.body;
    console.log(`Recebido request para /api/insumos/import com ${data ? data.length : 0} itens.`);
    
    if (!data || !Array.isArray(data)) {
      console.error("Dados inválidos recebidos na importação.");
      return res.status(400).json({ message: "Dados inválidos." });
    }
    
    const findInsumo = db.prepare("SELECT id FROM v2_itens WHERE TRIM(UPPER(base)) = ? AND TRIM(UPPER(codigo)) = ? AND tipo = 'insumo'");
    const insertCadastro = db.prepare(`
      INSERT INTO v2_itens (base, codigo, nome, unidade, tipo, categoria)
      VALUES (?, ?, ?, ?, 'insumo', ?)
    `);
    const insertPreco = db.prepare(`
      INSERT INTO v2_precos (item_id, estado, tipo_desoneracao, data_referencia, preco_unitario)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(item_id, estado, tipo_desoneracao, data_referencia) DO UPDATE SET
      preco_unitario = excluded.preco_unitario
    `);

    const transaction = db.transaction((items) => {
      for (const item of items) {
        const base = (item.banco || item.base || 'SINAPI').trim().toUpperCase();
        const codigo = (item.codigo || '').trim().toUpperCase();
        const descricao = item.descricao || '';
        const unidade = item.unidade || 'UN';
        const estado = (item.uf || item.estado || 'DF').trim().toUpperCase();
        
        const normalizeDate = (dateStr: string) => {
          if (!dateStr) return '2024-01-01';
          const trimmedDate = dateStr.trim();
          
          // MM/YYYY
          if (trimmedDate.match(/^\d{1,2}\/\d{4}$/)) {
            const [month, year] = trimmedDate.split('/');
            return `${year}-${month.padStart(2, '0')}-01`;
          }
          
          // DD/MM/YYYY
          if (trimmedDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            const [day, month, year] = trimmedDate.split('/');
            return `${year}-${month.padStart(2, '0')}-01`;
          }
          
          // YYYY-MM-DD
          if (trimmedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = trimmedDate.split('-');
            return `${year}-${month}-01`;
          }
          
          return '2024-01-01';
        };

        const data_referencia = normalizeDate(item.data_referencia);
        const categoria = inferCategory(descricao, item.tipo || 'Material');
        
        const valor_desonerado = parseNumber(item.valor_desonerado !== undefined ? item.valor_desonerado : item.preco_unitario);
        const valor_nao_desonerado = parseNumber(item.valor_nao_desonerado);

        if (codigo && descricao) {
          let id_insumo;
          const existing = findInsumo.get(base, codigo) as { id: number } | undefined;
          
          if (existing) {
            id_insumo = existing.id;
            // Update description/unit/categoria if changed
            db.prepare("UPDATE v2_itens SET nome = ?, unidade = ?, categoria = ? WHERE id = ?")
              .run(descricao, unidade, categoria, id_insumo);
          } else {
            const res = insertCadastro.run(base, codigo, descricao, unidade, categoria);
            id_insumo = res.lastInsertRowid;
          }
          
          console.log(`Inserindo/Atualizando insumo: ${codigo} (${base}) - ID: ${id_insumo}, Estado: ${estado}, Ref: ${data_referencia}`);

          if (valor_desonerado !== null) {
            console.log(`Upserting price: item_id=${id_insumo}, estado=${estado}, desoneracao='Desonerado', data=${data_referencia}, valor=${valor_desonerado}`);
            insertPreco.run(id_insumo, estado, 'Desonerado', data_referencia, valor_desonerado);
          }
          if (valor_nao_desonerado !== null) {
            console.log(`Upserting price: item_id=${id_insumo}, estado=${estado}, desoneracao='Não Desonerado', data=${data_referencia}, valor=${valor_nao_desonerado}`);
            insertPreco.run(id_insumo, estado, 'Não Desonerado', data_referencia, valor_nao_desonerado);
          }
        } else {
          console.warn(`Insumo ignorado por falta de código ou descrição: ${codigo} - ${descricao}`);
        }
      }
    });

    try {
      console.log(`Iniciando importação de ${data.length} itens.`);
      transaction(data);
      console.log("Importação concluída com sucesso.");
      res.json({ message: "Importação concluída com sucesso." });
    } catch (error: any) {
      console.error("Erro ao importar dados:", error);
      res.status(500).json({ message: "Erro ao importar dados.", error: error.message });
    }
  });

  // GET /api/composicoes
  app.get("/api/composicoes", (req, res) => {
    const { id, search, codigo, descricao, estado, base, bases, tipo } = req.query;
    const data_referencia_raw = req.query.data_referencia as string;
    const data_referencia = normalizeDate(data_referencia_raw) || '2026-04-01';
    const formattedDate = data_referencia;
    
    const originalEstado = (estado as string) || 'Todos';
    const targetEstado = originalEstado !== 'Todos' ? originalEstado : 'DF';

    const params: any[] = [];

    let query = `
      SELECT 
        c.id as id_composicao,
        c.base,
        c.codigo as codigo_composicao,
        c.nome as descricao,
        c.unidade,
        c.categoria as tipo,
        (
          SELECT COALESCE(
            (SELECT preco_unitario FROM v2_precos p
             WHERE p.item_id = c.id 
             AND p.tipo_desoneracao = 'Desonerado'
             AND (p.estado = ? OR p.estado = 'PRÓPRIO' OR c.base = 'PRÓPRIO' OR ? = 'Todos')
             AND (p.data_referencia <= ? OR c.base = 'PRÓPRIO')
             ORDER BY 
               CASE WHEN p.estado = ? THEN 0 
                    WHEN p.estado = 'PRÓPRIO' THEN 1 
                    ELSE 2 END, 
               p.data_referencia DESC
             LIMIT 1),
            (SELECT preco_unitario FROM v2_precos p
             WHERE p.item_id = c.id 
             AND p.tipo_desoneracao = 'Não Desonerado'
             AND (p.estado = ? OR p.estado = 'PRÓPRIO' OR c.base = 'PRÓPRIO' OR ? = 'Todos')
             AND (p.data_referencia <= ? OR c.base = 'PRÓPRIO')
             ORDER BY 
               CASE WHEN p.estado = ? THEN 0 
                    WHEN p.estado = 'PRÓPRIO' THEN 1 
                    ELSE 2 END, 
               p.data_referencia DESC
             LIMIT 1)
          )
        ) as valor_desonerado,
        (
          SELECT COALESCE(
            (SELECT preco_unitario FROM v2_precos p
             WHERE p.item_id = c.id 
             AND p.tipo_desoneracao = 'Não Desonerado'
             AND (p.estado = ? OR p.estado = 'PRÓPRIO' OR c.base = 'PRÓPRIO' OR ? = 'Todos')
             AND (p.data_referencia <= ? OR c.base = 'PRÓPRIO')
             ORDER BY 
               CASE WHEN p.estado = ? THEN 0 
                    WHEN p.estado = 'PRÓPRIO' THEN 1 
                    ELSE 2 END, 
               p.data_referencia DESC
             LIMIT 1),
            (SELECT preco_unitario FROM v2_precos p
             WHERE p.item_id = c.id 
             AND p.tipo_desoneracao = 'Desonerado'
             AND (p.estado = ? OR p.estado = 'PRÓPRIO' OR c.base = 'PRÓPRIO' OR ? = 'Todos')
             AND (p.data_referencia <= ? OR c.base = 'PRÓPRIO')
             ORDER BY 
               CASE WHEN p.estado = ? THEN 0 
                    WHEN p.estado = 'PRÓPRIO' THEN 1 
                    ELSE 2 END, 
               p.data_referencia DESC
             LIMIT 1)
          )
        ) as valor_nao_desonerado,
        ? as estado,
        (
          SELECT MAX(data_referencia) FROM v2_precos p
          WHERE p.item_id = c.id 
          AND (p.estado = ? OR p.estado = 'PRÓPRIO' OR c.base = 'PRÓPRIO' OR ? = 'Todos')
          AND (p.data_referencia <= ? OR c.base = 'PRÓPRIO')
        ) as data_referencia
      FROM v2_itens c
      WHERE c.tipo = 'composicao'
    `;

    params.push(
      targetEstado, originalEstado, formattedDate, targetEstado, // for valor_desonerado (Desonerado)
      targetEstado, originalEstado, formattedDate, targetEstado, // for valor_desonerado (Não Desonerado fallback)
      targetEstado, originalEstado, formattedDate, targetEstado, // for valor_nao_desonerado (Não Desonerado)
      targetEstado, originalEstado, formattedDate, targetEstado, // for valor_nao_desonerado (Desonerado fallback)
      targetEstado, // for estado column
      targetEstado, originalEstado, formattedDate // for data_referencia column
    );

    if (id) {
      query += " AND c.id = ?";
      params.push(id as string);
    }

    if (base && base !== 'Todos') {
      query += " AND c.base = ?";
      params.push(base as string);
    } else if (bases) {
      const baseList = (bases as string).split(',');
      if (baseList.length > 0) {
        query += ` AND c.base IN (${baseList.map(() => '?').join(',')})`;
        params.push(...baseList);
      }
    }

    if (search) {
      query += " AND (c.nome LIKE ? OR c.codigo LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (codigo) {
      query += " AND c.codigo LIKE ?";
      params.push(`%${codigo}%`);
    }

    if (descricao) {
      query += " AND c.nome LIKE ?";
      params.push(`%${descricao}%`);
    }

    if (tipo && tipo !== 'Todos') {
      query += " AND c.categoria = ?";
      params.push(tipo as string);
    }

    query += " ORDER BY c.nome LIMIT 100";

    try {
      const composicoes = db.prepare(query).all(...params) as any[];
      
      // Calculate missing prices - Limit to first 20 items to avoid timeouts
      let calculatedCount = 0;
      for (const comp of composicoes) {
        if (calculatedCount >= 20) break;
        
        const compEstado = comp.estado || targetEstado;
        const compData = comp.data_referencia || data_referencia;
        
        if (!comp.valor_desonerado || comp.valor_desonerado === 0) {
          try {
            const tree = getCompositionTree(comp.id_composicao, compEstado, compData, 'Desonerado');
            comp.valor_desonerado = tree.valor_total || 0;
            calculatedCount++;
          } catch (e) {
            console.error(`Error calculating desonerado price for ${comp.id_composicao}:`, e);
          }
        }
        if (!comp.valor_nao_desonerado || comp.valor_nao_desonerado === 0) {
          try {
            const tree = getCompositionTree(comp.id_composicao, compEstado, compData, 'Não Desonerado');
            comp.valor_nao_desonerado = tree.valor_total || 0;
            calculatedCount++;
          } catch (e) {
            console.error(`Error calculating nao_desonerado price for ${comp.id_composicao}:`, e);
          }
        }
      }
      
      res.json(composicoes);
    } catch (error: any) {
      console.error("Error fetching composicoes:", error);
      res.status(500).json({ message: "Erro ao buscar composições.", error: error.message });
    }
  });

  app.get("/api/composicoes/estados", (req, res) => {
    const { base, data_referencia, tipo } = req.query;
    try {
      let query = `
        SELECT DISTINCT p.estado 
        FROM v2_precos p
        JOIN v2_itens i ON p.item_id = i.id
        WHERE p.estado IS NOT NULL AND i.tipo = 'composicao'
      `;
      const params = [];
      if (base && base !== 'Todos') {
        query += ` AND i.base = ?`;
        params.push(base);
      }
      if (data_referencia && data_referencia !== 'Todos') {
        query += ` AND p.data_referencia = ?`;
        params.push(data_referencia);
      }
      if (tipo && tipo !== 'Todos') {
        query += ` AND i.categoria = ?`;
        params.push(tipo);
      }
      query += ` ORDER BY p.estado`;
      
      const estados = db.prepare(query).all(...params);
      res.json(estados.map((e: any) => e.estado));
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar estados.", error: error.message });
    }
  });

  app.get("/api/composicoes/datas", (req, res) => {
    console.log("GET /api/composicoes/datas called with query:", req.query);
    const { base, estado, tipo } = req.query;
    try {
      let query = `
        SELECT DISTINCT data_referencia 
        FROM (
          SELECT data_referencia FROM v2_precos p JOIN v2_itens i ON p.item_id = i.id WHERE p.data_referencia IS NOT NULL AND i.tipo = 'composicao'
          UNION
          SELECT data_referencia FROM v2_composicao_itens
        )
        WHERE data_referencia IS NOT NULL
      `;
      const params = [];
      // Note: The original query had filters for base, estado, tipo. 
      // This new query structure makes it harder to apply those filters directly.
      // For now, I will keep the original structure but expand the source tables.
      
      // Let's stick to the original structure but union the sources.
      query = `
        SELECT DISTINCT data_referencia FROM (
          SELECT p.data_referencia, i.base, p.estado, i.categoria
          FROM v2_precos p
          JOIN v2_itens i ON p.item_id = i.id
          WHERE p.data_referencia IS NOT NULL
          UNION
          SELECT ci.data_referencia, i.base, ci.estado, i.categoria
          FROM v2_composicao_itens ci
          JOIN v2_itens i ON ci.composicao_id = i.id
        ) WHERE data_referencia IS NOT NULL
      `;
      
      if (base && base !== 'Todos') {
        query += ` AND base = ?`;
        params.push(base);
      }
      if (estado && estado !== 'Todos') {
        query += ` AND estado = ?`;
        params.push(estado);
      }
      if (tipo && tipo !== 'Todos') {
        query += ` AND categoria = ?`;
        params.push(tipo);
      }
      query += ` ORDER BY data_referencia DESC`;
      
      const datas = db.prepare(query).all(...params);
      res.json(datas.map((d: any) => d.data_referencia));
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar datas.", error: error.message });
    }
  });

  app.get("/api/debug/duplicates", (req, res) => {
    try {
      const duplicates = db.prepare(`
        SELECT item_id, estado, tipo_desoneracao, data_referencia, COUNT(*) as count
        FROM v2_precos
        GROUP BY item_id, estado, tipo_desoneracao, data_referencia
        HAVING count > 1
      `).all();
      res.json(duplicates);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar duplicatas.", error: error.message });
    }
  });

  app.get("/api/debug/duplicate-itens", (req, res) => {
    try {
      const duplicates = db.prepare(`
        SELECT base, codigo, COUNT(*) as count
        FROM v2_itens
        GROUP BY base, codigo
        HAVING count > 1
      `).all();
      res.json(duplicates);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar itens duplicados.", error: error.message });
    }
  });

  app.get("/api/debug/duplicate-itens-ids", (req, res) => {
    try {
      const duplicates = db.prepare(`
        SELECT base, codigo, GROUP_CONCAT(id) as ids, COUNT(*) as count
        FROM v2_itens
        GROUP BY base, codigo
        HAVING count > 1
      `).all();
      res.json(duplicates);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar itens duplicados.", error: error.message });
    }
  });

  // Insumos Filters
  app.get("/api/insumos/estados", (req, res) => {
    const { base, data_referencia, tipo } = req.query;
    try {
      let query = `
        SELECT DISTINCT p.estado 
        FROM v2_precos p
        JOIN v2_itens i ON p.item_id = i.id
        WHERE p.estado IS NOT NULL AND i.tipo = 'insumo'
      `;
      const params = [];
      if (base && base !== 'Todos') {
        query += ` AND i.base = ?`;
        params.push(base);
      }
      if (data_referencia && data_referencia !== 'Todos') {
        query += ` AND p.data_referencia = ?`;
        params.push(data_referencia);
      }
      if (tipo && tipo !== 'Todos') {
        query += ` AND i.categoria = ?`;
        params.push(tipo);
      }
      query += ` ORDER BY p.estado`;
      
      const estados = db.prepare(query).all(...params);
      res.json(estados.map((e: any) => e.estado));
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar estados.", error: error.message });
    }
  });

  app.get("/api/insumos/datas", (req, res) => {
    const { base, estado, tipo } = req.query;
    try {
      let query = `
        SELECT DISTINCT p.data_referencia 
        FROM v2_precos p
        JOIN v2_itens i ON p.item_id = i.id
        WHERE p.data_referencia IS NOT NULL AND i.tipo = 'insumo'
      `;
      const params = [];
      if (base && base !== 'Todos') {
        query += ` AND i.base = ?`;
        params.push(base);
      }
      if (estado && estado !== 'Todos') {
        query += ` AND p.estado = ?`;
        params.push(estado);
      }
      if (tipo && tipo !== 'Todos') {
        query += ` AND i.categoria = ?`;
        params.push(tipo);
      }
      query += ` ORDER BY p.data_referencia DESC`;
      
      const datas = db.prepare(query).all(...params);
      res.json(datas.map((d: any) => d.data_referencia));
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar datas.", error: error.message });
    }
  });

  app.get("/api/insumos/bancos", (req, res) => {
    const { estado, data_referencia, tipo } = req.query;
    try {
      let query = `
        SELECT DISTINCT i.base 
        FROM v2_itens i
        LEFT JOIN v2_precos p ON i.id = p.item_id
        WHERE i.tipo = 'insumo' AND i.base IS NOT NULL
      `;
      const params = [];
      if (estado && estado !== 'Todos') {
        query += ` AND p.estado = ?`;
        params.push(estado);
      }
      if (data_referencia && data_referencia !== 'Todos') {
        query += ` AND p.data_referencia = ?`;
        params.push(data_referencia);
      }
      if (tipo && tipo !== 'Todos') {
        query += ` AND i.categoria = ?`;
        params.push(tipo);
      }
      query += ` ORDER BY i.base`;
      
      const bancos = db.prepare(query).all(...params);
      res.json(bancos.map((b: any) => b.base));
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar bancos.", error: error.message });
    }
  });

  app.get("/api/insumos/tipos", (req, res) => {
    const { base } = req.query;
    try {
      let query = `
        SELECT DISTINCT i.categoria 
        FROM v2_itens i
        WHERE i.tipo = 'insumo' AND i.categoria IS NOT NULL
      `;
      const params = [];
      
      if (base && base !== 'Todos') {
        query += ` AND i.base = ?`;
        params.push(base);
      }
      query += ` ORDER BY i.categoria`;
      
      const tipos = db.prepare(query).all(...params);
      res.json(tipos.map((t: any) => t.categoria));
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar tipos.", error: error.message });
    }
  });

  // Composicoes Filters (missing ones)
  app.get("/api/composicoes/bancos", (req, res) => {
    const { estado, data_referencia, tipo } = req.query;
    try {
      let query = `
        SELECT DISTINCT i.base 
        FROM v2_itens i
        LEFT JOIN v2_precos p ON i.id = p.item_id
        WHERE i.tipo = 'composicao' AND i.base IS NOT NULL
      `;
      const params = [];
      if (estado && estado !== 'Todos') {
        query += ` AND p.estado = ?`;
        params.push(estado);
      }
      if (data_referencia && data_referencia !== 'Todos') {
        query += ` AND p.data_referencia = ?`;
        params.push(data_referencia);
      }
      if (tipo && tipo !== 'Todos') {
        query += ` AND i.categoria = ?`;
        params.push(tipo);
      }
      query += ` ORDER BY i.base`;
      
      const bancos = db.prepare(query).all(...params);
      res.json(bancos.map((b: any) => b.base));
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar bancos.", error: error.message });
    }
  });

  app.get("/api/composicoes/tipos", (req, res) => {
    const { base } = req.query;
    try {
      let query = `
        SELECT DISTINCT i.categoria 
        FROM v2_itens i
        WHERE i.tipo = 'composicao' AND i.categoria IS NOT NULL
      `;
      const params = [];
      
      if (base && base !== 'Todos') {
        query += ` AND i.base = ?`;
        params.push(base);
      }
      query += ` ORDER BY i.categoria`;
      
      const tipos = db.prepare(query).all(...params);
      res.json(tipos.map((t: any) => t.categoria));
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar tipos.", error: error.message });
    }
  });

  app.post("/api/composicoes", (req, res) => {
    const { codigo_composicao, descricao, unidade, base = 'PRÓPRIA', tipo = '' } = req.body;
    try {
      const existing = db.prepare("SELECT id FROM v2_itens WHERE codigo = ? AND base = ? AND tipo = 'composicao'").get(codigo_composicao, base);
      if (existing) {
        return res.status(400).json({ message: "Composição com este código já existe nesta base." });
      }
      const result = db.prepare("INSERT INTO v2_itens (base, codigo, nome, unidade, tipo, categoria) VALUES (?, ?, ?, ?, 'composicao', ?)").run(
        base, codigo_composicao, descricao, unidade, tipo
      );
      res.json({ id: result.lastInsertRowid, message: "Composição criada com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao criar composição.", error: error.message });
    }
  });

  app.put("/api/composicoes/:id", (req, res) => {
    const { codigo_composicao, descricao, unidade, base = 'PRÓPRIA', tipo = '' } = req.body;
    try {
      db.prepare("UPDATE v2_itens SET base = ?, codigo = ?, nome = ?, unidade = ?, categoria = ? WHERE id = ? AND tipo = 'composicao'").run(
        base, codigo_composicao, descricao, unidade, tipo, req.params.id
      );
      res.json({ message: "Composição atualizada com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao atualizar composição.", error: error.message });
    }
  });

  app.delete("/api/composicoes/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const transaction = db.transaction((idToDelete) => {
        // Check if legacy orcamentos table exists
        const orcamentosExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orcamentos'").get();
        
        db.prepare("DELETE FROM v2_medicao_itens WHERE orcamento_item_id IN (SELECT id FROM v2_orcamento_itens WHERE item_id = ?)").run(idToDelete);
        db.prepare("DELETE FROM v2_composicao_itens WHERE composicao_id = ? OR item_id = ?").run(idToDelete, idToDelete);
        db.prepare("DELETE FROM v2_precos WHERE item_id = ?").run(idToDelete);
        db.prepare("DELETE FROM v2_orcamento_itens WHERE item_id = ?").run(idToDelete);
        
        if (orcamentosExists) {
          db.prepare("DELETE FROM orcamentos WHERE item_id = ? AND item_tipo = 'composicao'").run(idToDelete);
        }
        
        const result = db.prepare("DELETE FROM v2_itens WHERE id = ? AND tipo = 'composicao'").run(idToDelete);
        console.log(`Deleted composition ${idToDelete}: ${result.changes} rows affected`);
      });
      transaction(id);
      res.json({ message: "Composição excluída com sucesso." });
    } catch (error: any) {
      console.error("Error deleting composition:", error);
      res.status(500).json({ message: "Erro ao excluir composição.", error: error.message });
    }
  });

  app.post("/api/composicoes/bulk", (req, res) => {
    try {
      const { composicoes, estado: importEstado = 'DF' } = req.body;
      if (!Array.isArray(composicoes)) {
        return res.status(400).json({ message: "Formato inválido." });
      }

      const insertComp = db.prepare("INSERT INTO v2_itens (base, codigo, nome, unidade, tipo, categoria) VALUES (?, ?, ?, ?, 'composicao', ?)");
      const updateComp = db.prepare("UPDATE v2_itens SET nome = ?, unidade = ?, categoria = ? WHERE TRIM(UPPER(base)) = ? AND TRIM(UPPER(codigo)) = ? AND tipo = 'composicao'");
      const checkComp = db.prepare("SELECT id FROM v2_itens WHERE TRIM(UPPER(base)) = ? AND TRIM(UPPER(codigo)) = ? AND tipo = 'composicao'");
      
      const upsertPreco = db.prepare(`
        INSERT INTO v2_precos (item_id, estado, tipo_desoneracao, data_referencia, preco_unitario) 
        VALUES (?, ?, ?, ?, ?) 
        ON CONFLICT(item_id, estado, tipo_desoneracao, data_referencia) 
        DO UPDATE SET preco_unitario = excluded.preco_unitario
      `);

      const transaction = db.transaction((comps) => {
        for (const comp of comps) {
          const { base, codigo_composicao: raw_codigo, descricao, unidade, tipo, data_referencia, valor_nao_desonerado, valor_desonerado, estado } = comp;
          if (!raw_codigo || !descricao) continue;
          
          const compBase = (base || 'SINAPI').trim().toUpperCase();
          const codigo_composicao = (raw_codigo || '').trim().toUpperCase();
          const itemEstado = (estado || importEstado).trim().toUpperCase();
          
          const normalizeDate = (dateStr: string) => {
            if (!dateStr) return '2024-01-01';
            const trimmedDate = dateStr.trim();
            
            // MM/YYYY
            if (trimmedDate.match(/^\d{1,2}\/\d{4}$/)) {
              const [month, year] = trimmedDate.split('/');
              return `${year}-${month.padStart(2, '0')}-01`;
            }
            
            // DD/MM/YYYY
            if (trimmedDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
              const [day, month, year] = trimmedDate.split('/');
              return `${year}-${month.padStart(2, '0')}-01`;
            }
            
            // YYYY-MM-DD
            if (trimmedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
              const [year, month, day] = trimmedDate.split('-');
              return `${year}-${month}-01`;
            }
            
            return '2024-01-01';
          };

          const normalized_data_referencia = normalizeDate(data_referencia);

          let id_composicao;
          const existingComp = checkComp.get(compBase, codigo_composicao) as any;
          console.log(`Checking composition: ${compBase}, ${codigo_composicao}. Found:`, existingComp);
          
          if (existingComp) {
            id_composicao = existingComp.id;
            updateComp.run(descricao, unidade || 'UN', tipo, compBase, codigo_composicao);
          } else {
            console.log(`Inserting new composition: ${compBase}, ${codigo_composicao}`);
            const res = insertComp.run(compBase, codigo_composicao, descricao, unidade || 'UN', tipo);
            id_composicao = res.lastInsertRowid;
          }

          if (normalized_data_referencia) {
            const valNaoDes = parseNumber(valor_nao_desonerado);
            if (valNaoDes !== null) {
              console.log(`Upserting price: item_id=${id_composicao}, estado=${itemEstado}, desoneracao='Não Desonerado', data=${normalized_data_referencia}, valor=${valNaoDes}`);
              upsertPreco.run(id_composicao, itemEstado, 'Não Desonerado', normalized_data_referencia, valNaoDes);
            }
            
            const valDes = parseNumber(valor_desonerado);
            if (valDes !== null) {
              console.log(`Upserting price: item_id=${id_composicao}, estado=${itemEstado}, desoneracao='Desonerado', data=${normalized_data_referencia}, valor=${valDes}`);
              upsertPreco.run(id_composicao, itemEstado, 'Desonerado', normalized_data_referencia, valDes);
            }
          }
        }
      });

      transaction(composicoes);
      res.json({ message: "Composições importadas com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao importar composições.", error: error.message });
    }
  });

  // Função recursiva para calcular o custo total de uma composição
  function calcularCustoTotal(compId: string, estado: string, dataRef: string, visited = new Set()): { valor_nao_desonerado: number, valor_desonerado: number } {
    if (visited.has(compId)) return { valor_nao_desonerado: 0, valor_desonerado: 0 };
    visited.add(compId);

    const subitens = db.prepare(`
      SELECT ci.item_id, ci.quantidade, i.tipo, 
             pn.valor as valor_nao_desonerado, pd.valor as valor_desonerado
      FROM v2_composicao_itens ci
      JOIN v2_itens i ON ci.item_id = i.id
      LEFT JOIN v2_precos pn ON ci.item_id = pn.item_id AND ci.estado = pn.estado AND ci.data_referencia = pn.data_referencia AND pn.tipo_desoneracao = 'Não Desonerado'
      LEFT JOIN v2_precos pd ON ci.item_id = pd.item_id AND ci.estado = pd.estado AND ci.data_referencia = pd.data_referencia AND pd.tipo_desoneracao = 'Desonerado'
      WHERE ci.composicao_id = ? AND ci.estado = ? AND ci.data_referencia = ?
    `).all(compId, estado, dataRef);

    let totalNaoDesonerado = 0;
    let totalDesonerado = 0;

    for (const item of subitens) {
      if (item.tipo === 'composicao') {
        const subTotal = calcularCustoTotal(item.item_id, estado, dataRef, visited);
        totalNaoDesonerado += subTotal.valor_nao_desonerado * item.quantidade;
        totalDesonerado += subTotal.valor_desonerado * item.quantidade;
      } else {
        totalNaoDesonerado += (item.valor_nao_desonerado || 0) * item.quantidade;
        totalDesonerado += (item.valor_desonerado || 0) * item.quantidade;
      }
    }

    return { valor_nao_desonerado: totalNaoDesonerado, valor_desonerado: totalDesonerado };
  }

  app.get("/api/composicoes/:id/analitica", (req, res) => {
    const { estado = 'DF', data_referencia = '2026-04-01' } = req.query as any;
    try {
      const total = calcularCustoTotal(req.params.id, estado, data_referencia);
      res.json(total);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao calcular composição analítica", error: error.message });
    }
  });

  app.post("/api/composicoes/validate-import", (req, res) => {
    try {
      const { items, estado: importEstado = 'DF' } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ message: "Formato inválido." });
      }

      const findCompWithBase = db.prepare("SELECT id FROM v2_itens WHERE codigo = ? AND base = ? AND tipo = 'composicao'");
      const findItemWithBase = db.prepare("SELECT id FROM v2_itens WHERE codigo = ? AND base = ?");

      const missingItems: { codigo: string, tipo: string, base: string, descricao: string }[] = [];
      const seenMissing = new Set<string>();

      for (const item of items) {
        const { base, codigo_composicao, codigo_insumo } = item;
        if (!codigo_composicao || !codigo_insumo) continue;

        const itemBase = base || 'SINAPI';

        let comp = findCompWithBase.get(String(codigo_composicao), String(itemBase)) as any;
        let insumo = findItemWithBase.get(String(codigo_insumo), String(itemBase)) as any;

        if (!comp) {
          const key = `comp-${codigo_composicao}-${itemBase}`;
          if (!seenMissing.has(key)) {
            missingItems.push({ codigo: String(codigo_composicao), tipo: 'Composição', base: itemBase, descricao: 'Composição pai não encontrada' });
            seenMissing.add(key);
          }
        }
        if (!insumo) {
          const key = `insumo-${codigo_insumo}-${itemBase}`;
          if (!seenMissing.has(key)) {
            missingItems.push({ codigo: String(codigo_insumo), tipo: 'Item/Insumo', base: itemBase, descricao: 'Item/Insumo não encontrado' });
            seenMissing.add(key);
          }
        }
      }

      res.json({ missingItems });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao validar importação", error: error.message });
    }
  });

  app.post("/api/composicoes/items/bulk", (req, res) => {
    try {
      const { items, estado: importEstado = 'DF' } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ message: "Formato inválido." });
      }

      const findCompWithBase = db.prepare("SELECT id FROM v2_itens WHERE codigo = ? AND base = ? AND tipo = 'composicao'");
      const findInsumoWithBase = db.prepare("SELECT id FROM v2_itens WHERE codigo = ? AND base = ?");
      const insertItem = db.prepare(`
        INSERT INTO v2_composicao_itens (composicao_id, item_id, quantidade, estado, data_referencia) 
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(composicao_id, item_id, estado, data_referencia) 
        DO UPDATE SET quantidade = excluded.quantidade
      `);
      const deleteExisting = db.prepare("DELETE FROM v2_composicao_itens WHERE composicao_id = ? AND estado = ? AND data_referencia = ?");

      const missingItems: { codigo: string, tipo: string, base: string, descricao: string }[] = [];

      const transaction = db.transaction((itemList) => {
        const processedComps = new Set();

        for (const item of itemList) {
          const { base, codigo_composicao, codigo_insumo, coeficiente, estado, data_referencia } = item;
          if (!codigo_composicao || !codigo_insumo || coeficiente === undefined) continue;

          const itemBase = base || 'SINAPI';
          const itemEstado = estado || importEstado;
          const itemDataRef = data_referencia || '2026-04-01';

          let comp = findCompWithBase.get(String(codigo_composicao), String(itemBase)) as any;
          let insumo = findInsumoWithBase.get(String(codigo_insumo), String(itemBase)) as any;

          if (!comp) {
            const msg = `[Import Bulk] Composição não encontrada: ${codigo_composicao} (Base: ${itemBase})`;
            console.log(msg);
            missingItems.push({ codigo: String(codigo_composicao), tipo: 'Composição', base: itemBase, descricao: msg });
          }
          if (!insumo) {
            const msg = `[Import Bulk] Item/Insumo não encontrado: ${codigo_insumo} (Base: ${itemBase})`;
            console.log(msg);
            missingItems.push({ codigo: String(codigo_insumo), tipo: 'Item/Insumo', base: itemBase, descricao: msg });
          }

          if (comp && insumo) {
            const compKey = `${comp.id}|${itemEstado}|${itemDataRef}`;
            if (!processedComps.has(compKey)) {
              deleteExisting.run(comp.id, itemEstado, itemDataRef);
              processedComps.add(compKey);
            }
            insertItem.run(comp.id, insumo.id, parseNumber(coeficiente), itemEstado, itemDataRef);
          }
        }
      });

      transaction(items);
      res.json({ 
        message: missingItems.length > 0 ? "Importação concluída com alguns alertas." : "Itens das composições importados com sucesso.",
        missingItems: missingItems
      });
    } catch (error: any) {
      console.error("Error bulk importing composition items:", error);
      res.status(500).json({ message: "Erro ao importar itens.", error: error.message });
    }
  });

  app.post("/api/composicoes/bulk-delete", (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ message: "Lista de IDs inválida." });
      }

      const parsedIds = ids.map(id => parseInt(id, 10));

      const transaction = db.transaction((idsToDelete) => {
        // Check if legacy orcamentos table exists
        const orcamentosExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orcamentos'").get();
        
        const deleteMedicaoItens = db.prepare("DELETE FROM v2_medicao_itens WHERE orcamento_item_id IN (SELECT id FROM v2_orcamento_itens WHERE item_id = ?)");
        const deleteCompInsumo = db.prepare("DELETE FROM v2_composicao_itens WHERE composicao_id = ? OR item_id = ?");
        const deleteOrcamentoItens = db.prepare("DELETE FROM v2_orcamento_itens WHERE item_id = ?");
        const deleteComposicaoPrecos = db.prepare("DELETE FROM v2_precos WHERE item_id = ?");
        const deleteComposicao = db.prepare("DELETE FROM v2_itens WHERE id = ? AND tipo = 'composicao'");
        
        let deleteOrcamentosStmt;
        if (orcamentosExists) {
          deleteOrcamentosStmt = db.prepare("DELETE FROM orcamentos WHERE item_id = ? AND item_tipo = 'composicao'");
        }

        for (const id of idsToDelete) {
          deleteMedicaoItens.run(id);
          deleteCompInsumo.run(id, id);
          deleteOrcamentoItens.run(id);
          deleteComposicaoPrecos.run(id);
          if (deleteOrcamentosStmt) {
            deleteOrcamentosStmt.run(id);
          }
          deleteComposicao.run(id);
        }
      });

      transaction(parsedIds);
      res.json({ message: "Composições excluídas com sucesso." });
    } catch (error: any) {
      console.error("Error bulk deleting compositions:", error);
      res.status(500).json({ message: "Erro ao excluir composições.", error: error.message });
    }
  });

  app.post("/api/composicoes/unified/bulk", (req, res) => {
    try {
      const { data, estado } = req.body;
      if (!Array.isArray(data)) {
        return res.status(400).json({ message: "Formato inválido." });
      }

      const findComp = db.prepare("SELECT id FROM v2_itens WHERE codigo = ? AND base = ? AND tipo = 'composicao'");
      const insertComp = db.prepare("INSERT INTO v2_itens (base, codigo, nome, unidade, tipo, categoria) VALUES (?, ?, ?, ?, 'composicao', ?)");
      const updateComp = db.prepare("UPDATE v2_itens SET nome = ?, unidade = ?, categoria = ? WHERE id = ?");
      
      const findItemAny = db.prepare("SELECT id, tipo FROM v2_itens WHERE (codigo = ? OR codigo = ?) AND base = ?");
      
      const insertItem = db.prepare(`
        INSERT INTO v2_composicao_itens (composicao_id, item_id, quantidade, estado, data_referencia) 
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(composicao_id, item_id, estado, data_referencia) 
        DO UPDATE SET quantidade = excluded.quantidade
      `);
      const deleteItems = db.prepare("DELETE FROM v2_composicao_itens WHERE composicao_id = ? AND estado = ? AND data_referencia = ?");

      const errors: string[] = [];
      const importEstado = estado || 'DF';
      const affectedCompIds = new Set<number>();
      const dataRefs = new Set<string>();

      const missingItems: { codigo: string, tipo: string, base: string, descricao: string }[] = [];

      db.transaction((rows) => {
        // 1. Group by composition
        const comps = new Map<string, any>();
        let defaultDataRef = '2024-01-01';

        for (const row of rows) {
          if (!row.codigo_composicao) continue;
          const compBase = row.base || 'SINAPI';
          const compKey = `${compBase}|${row.codigo_composicao}`;
          
          if (row.data_referencia) {
            defaultDataRef = row.data_referencia;
            dataRefs.add(row.data_referencia);
          }

          if (!comps.has(compKey)) {
            comps.set(compKey, {
              codigo: row.codigo_composicao,
              descricao: row.descricao,
              unidade: row.unidade,
              tipo: row.tipo || '',
              base: compBase,
              items: [],
              data_referencia: row.data_referencia || defaultDataRef
            });
          }
          if (row.codigo_item) {
            const categoria = inferCategory(row.descricao_item || '', row.tipo_item || 'Material');
            comps.get(compKey).items.push({
              codigo: row.codigo_item,
              base_item: row.base_item || compBase,
              tipo: String(row.tipo_item || '').toUpperCase().includes('COMP') ? 'COMPOSICAO' : 'INSUMO',
              categoria: categoria,
              coeficiente: parseNumber(row.coeficiente) || 0,
              descricao_item: row.descricao_item
            });
          }
        }

        // 2. Phase 1: Upsert all compositions in the batch
        for (const [key, compData] of comps) {
          let id_composicao;
          const existing = findComp.get(compData.codigo, compData.base) as any;
          
          if (existing) {
            id_composicao = existing.id;
            updateComp.run(compData.descricao || 'Sem descrição', compData.unidade || 'UN', compData.tipo, id_composicao);
          } else {
            const result = insertComp.run(compData.base, compData.codigo, compData.descricao || 'Sem descrição', compData.unidade || 'UN', compData.tipo);
            id_composicao = result.lastInsertRowid;
          }
          compData.id_composicao = id_composicao;
          affectedCompIds.add(id_composicao);
        }

        // 3. Phase 2: Replace items for all compositions
        for (const [key, compData] of comps) {
          const id_composicao = compData.id_composicao;
          deleteItems.run(id_composicao, importEstado, compData.data_referencia);
          
          for (const item of compData.items) {
            let id_item = null;
            let actualTipo = item.tipo; // 'INSUMO' or 'COMPOSICAO' from Excel

            // Try to find the item in the database first, regardless of type.
            let existingItem = findItemAny.get(item.codigo, item.codigo + '.0', item.base_item) as any;

            if (existingItem) {
               id_item = existingItem.id;
               actualTipo = existingItem.tipo.toUpperCase(); // Update type to what's actually in DB
               
               // Update category if it was 'Material' but can be inferred better
               if (existingItem.categoria === 'Material' || !existingItem.categoria) {
                 const newCat = inferCategory(item.descricao_item || '', existingItem.categoria);
                 if (newCat !== existingItem.categoria) {
                   db.prepare("UPDATE v2_itens SET categoria = ? WHERE id = ?").run(newCat, id_item);
                 }
               }
            } else {
               // Item doesn't exist at all. Create a dummy one based on Excel's hint.
               if (item.tipo === 'INSUMO') {
                 missingItems.push({ codigo: item.codigo, tipo: 'Insumo', base: item.base_item, descricao: item.descricao_item || 'Insumo não cadastrado' });
                 const res = db.prepare(`
                   INSERT INTO v2_itens (base, codigo, nome, unidade, tipo, categoria)
                   VALUES (?, ?, ?, ?, 'insumo', ?)
                 `).run(item.base_item, item.codigo, item.descricao_item || 'Insumo não cadastrado', 'UN', item.categoria || 'Material');
                 id_item = res.lastInsertRowid;
               } else {
                 missingItems.push({ codigo: item.codigo, tipo: 'Composição', base: item.base_item, descricao: item.descricao_item || 'Composição não cadastrada' });
                 const res = db.prepare(`
                   INSERT INTO v2_itens (base, codigo, nome, unidade, tipo, categoria)
                   VALUES (?, ?, ?, ?, 'composicao', ?)
                 `).run(item.base_item, item.codigo, item.descricao_item || 'Composição não cadastrada', 'UN', item.categoria || '');
                 id_item = res.lastInsertRowid;
                 affectedCompIds.add(id_item as number);
               }
            }

            if (id_item) {
              insertItem.run(id_composicao, id_item, item.coeficiente, importEstado, compData.data_referencia);
            }
          }
        }
      })(data);

      // 4. Phase 3: Recalculate prices for all affected compositions
      db.transaction(() => {
        const memo = new Map<string, number>();
        for (const id_composicao of affectedCompIds) {
          for (const dataRef of dataRefs) {
            calculateCompositionPriceRecursive(id_composicao, importEstado, 'Desonerado', dataRef, new Set(), memo);
            calculateCompositionPriceRecursive(id_composicao, importEstado, 'Não Desonerado', dataRef, new Set(), memo);
          }
        }
      })();

      res.json({ 
        message: errors.length > 0 ? "Importação concluída com alguns alertas." : "Importação unificada concluída com sucesso.",
        errors: errors,
        missingItems: missingItems
      });
    } catch (error: any) {
      console.error('Unified import error:', error);
      res.status(500).json({ message: "Erro ao importar dados.", error: error.message });
    }
  });

// =====================================================
// ENDPOINTS CORRIGIDOS - COMPOSIÇÕES
// =====================================================

// GET /api/composicoes/:id/arvore - Retorna árvore hierárquica completa
app.get("/api/composicoes/:id/arvore", (req, res) => {
  const { estado = 'DF', data_referencia } = req.query;
  
  if (!data_referencia) {
    return res.status(400).json({ message: "Data de referência é obrigatória" });
  }
  
  try {
    const arvore = getCompositionTree(
      parseInt(req.params.id),
      estado,
      data_referencia
    );
    
    res.json(arvore);
  } catch (error) {
    console.error("Erro ao buscar árvore:", error);
    res.status(500).json({ message: "Erro ao buscar árvore da composição", error: error.message });
  }
});

// GET /api/composicoes/:id/insumos - Retorna todos os insumos básicos (achatado)
app.get("/api/composicoes/:id/insumos", (req, res) => {
  const { estado = 'DF', data_referencia, agrupar = 'false', desonerado = 'false', bancos_ativos } = req.query;
  console.log(`GET /api/composicoes/${req.params.id}/insumos - estado: ${estado}, data_referencia: ${data_referencia}, desonerado: ${desonerado}`);
  
  if (!data_referencia) {
    console.error("Missing data_referencia");
    return res.status(400).json({ message: "Data de referência é obrigatória" });
  }

  let parsedBancosAtivos = [];
  if (bancos_ativos) {
    try {
      parsedBancosAtivos = JSON.parse(bancos_ativos as string);
    } catch (e) {
      console.error("Error parsing bancos_ativos in /api/composicoes/:id/insumos:", e);
    }
  }
  
  try {
    const insumos = getFlatCompositionItems(
      parseInt(req.params.id),
      estado as string,
      data_referencia as string,
      desonerado === 'true' ? 'Desonerado' : 'Não Desonerado',
      parsedBancosAtivos
    );
    
    if (agrupar === 'true') {
      // Agrupa insumos iguais
      const agrupados = {};
      for (const insumo of insumos) {
        const key = `${insumo.item_id}|${insumo.codigo}`;
        if (!agrupados[key]) {
          agrupados[key] = {
            ...insumo,
            quantidade: 0,
            valor_total: 0,
            origens: []
          };
        }
        agrupados[key].quantidade += insumo.quantidade;
        agrupados[key].valor_total += insumo.valor_total;
        agrupados[key].origens.push({
          composicao_id: insumo.composicao_pai_id,
          composicao_nome: insumo.composicao_pai_nome,
          quantidade: insumo.quantidade_original
        });
      }
      res.json(Object.values(agrupados));
    } else {
      res.json(insumos);
    }
  } catch (error) {
    console.error("Erro ao buscar insumos:", error);
    res.status(500).json({ message: "Erro ao buscar insumos da composição", error: error.message });
  }
});

// GET /api/composicoes/:id/check - Verifica integridade
app.get("/api/composicoes/:id/check", (req, res) => {
  const { estado = 'DF', data_referencia } = req.query;
  
  if (!data_referencia) {
    return res.status(400).json({ message: "Data de referência é obrigatória" });
  }
  
  try {
    const integridade = checkCompositionIntegrity(
      parseInt(req.params.id),
      estado,
      data_referencia
    );
    
    res.json(integridade);
  } catch (error) {
    console.error("Erro ao verificar integridade:", error);
    res.status(500).json({ message: "Erro ao verificar integridade", error: error.message });
  }
});

// GET /api/composicoes/:id/subitens - Versão melhorada (compatível com frontend existente)
app.get("/api/composicoes/:id/subitens", (req, res) => {
  let { estado = 'DF', data_referencia, profundidade = '1' } = req.query;
  const normalizedDataRef = normalizeDate(data_referencia);
  
  console.log('DEBUG: subitens request - id:', req.params.id, 'estado:', estado, 'data_referencia:', data_referencia, 'normalized:', normalizedDataRef);
  
  if (estado === 'Todos') estado = 'DF';
  
  try {
    if (profundidade === 'completa') {
      // Retorna todos os níveis
      const arvore = getCompositionTree(parseInt(req.params.id), estado, normalizedDataRef);
      
      // Achata para o formato esperado pelo frontend
      const achatar = (node, nivel = 0, prefixo = '') => {
        let result = [];
        for (const item of node.items || []) {
          result.push({
            ...item,
            nivel,
            caminho: prefixo ? `${prefixo} > ${item.nome}` : item.nome,
            e_subcomposicao: item.tipo === 'composicao'
          });
          
          if (item.filhos && item.filhos.length > 0) {
            result = [...result, ...achatar({ items: item.filhos }, nivel + 1, `${prefixo} ${item.nome}`)];
          }
        }
        return result;
      };
      
      const itensAchatados = achatar(arvore);
      res.json(itensAchatados);
    } else {
      // Versão corrigida: busca a estrutura da composição e os preços separadamente para garantir datas corretas
      const tree = getCompositionTree(parseInt(req.params.id), estado as string, normalizedDataRef);
      
      // O frontend espera um formato específico (id_comp_insumo, consumo_unitario, etc.)
      const itemsFormatados = (tree.items || []).map(item => ({
        id_comp_insumo: item.item_id,
        id_composicao: parseInt(req.params.id),
        item_id: item.item_id,
        consumo_unitario: item.quantidade,
        descricao: item.nome,
        unidade: item.unidade,
        base: item.base,
        codigo: item.codigo,
        tipo: item.tipo,
        categoria: item.categoria,
        valor_desonerado: item.valor_unitario_desonerado || item.valor_unitario,
        valor_nao_desonerado: item.valor_unitario_nao_desonerado || item.valor_unitario,
        e_subcomposicao: item.tipo === 'composicao',
        valor_total: item.valor_total
      }));

      // Se o getCompositionTree não retornou os dois valores, precisamos garantir que temos ambos para a tabela
      const itemIds = itemsFormatados.map(it => it.item_id);
      const precosDeson = getPrecosEmLote(itemIds, estado, normalizedDataRef, 'Desonerado');
      const precosNaoDeson = getPrecosEmLote(itemIds, estado, normalizedDataRef, 'Não Desonerado');

      const finalItems = itemsFormatados.map(it => ({
        ...it,
        valor_desonerado: precosDeson.get(it.item_id) || 0,
        valor_nao_desonerado: precosNaoDeson.get(it.item_id) || 0,
        valor_total: (precosDeson.get(it.item_id) || 0) * it.consumo_unitario
      }));

      res.json(finalItems);
    }
  } catch (error: any) {
    console.error("Erro ao buscar subitens:", error);
    res.status(500).json({ message: "Erro ao buscar subitens", error: error.message });
  }
});

// POST /api/composicoes/:id/subitens - Versão corrigida
app.post("/api/composicoes/:id/subitens", (req, res) => {
  const { item_id, consumo_unitario, estado = 'DF', data_referencia = '2026-04-01' } = req.body;
  
  if (!item_id || !consumo_unitario) {
    return res.status(400).json({ message: "item_id e consumo_unitario são obrigatórios" });
  }
  
  try {
    // Verifica se a composição existe e é PRÓPRIA
    const comp = db.prepare("SELECT base FROM v2_itens WHERE id = ? AND tipo = 'composicao'").get(req.params.id);
    if (!comp) {
      return res.status(404).json({ message: "Composição não encontrada" });
    }
    
    if (comp.base !== 'PRÓPRIA') {
      return res.status(403).json({ message: "Apenas composições de base 'PRÓPRIA' podem ser editadas" });
    }
    
    // Verifica se o item existe
    const item = db.prepare("SELECT id, tipo FROM v2_itens WHERE id = ?").get(item_id);
    if (!item) {
      return res.status(404).json({ message: "Item não encontrado" });
    }
    
    // Verifica se não está criando loop (composição não pode conter a si mesma)
    if (item.tipo === 'composicao' && item.id == req.params.id) {
      return res.status(400).json({ message: "Composição não pode conter a si mesma" });
    }
    
    // Verifica profundidade máxima para evitar loops complexos
    if (item.tipo === 'composicao') {
      const verificarLoop = (compId, itemId, visited = new Set()) => {
        if (visited.has(compId)) return true;
        visited.add(compId);
        
        const filhos = db.prepare(`
          SELECT item_id FROM v2_composicao_itens 
          WHERE composicao_id = ? AND estado = ? AND data_referencia = ?
        `).all(compId, estado, data_referencia);
        
        for (const filho of filhos) {
          if (filho.item_id == itemId) return true;
          
          const tipoFilho = db.prepare("SELECT tipo FROM v2_itens WHERE id = ?").get(filho.item_id);
          if (tipoFilho?.tipo === 'composicao') {
            if (verificarLoop(filho.item_id, itemId, visited)) return true;
          }
        }
        return false;
      };
      
      if (verificarLoop(item.id, req.params.id)) {
        return res.status(400).json({ message: "Esta operação criaria um loop na composição" });
      }
    }
    
    // Insere ou atualiza
    db.prepare(`
      INSERT INTO v2_composicao_itens (composicao_id, item_id, quantidade, estado, data_referencia) 
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(composicao_id, item_id, estado, data_referencia) 
      DO UPDATE SET quantidade = excluded.quantidade
    `).run(
      req.params.id, 
      item_id, 
      parseNumber(consumo_unitario), 
      estado, 
      data_referencia
    );
    
    // Recalcula preços em cascata
    triggerCascadeRecalculation(parseInt(req.params.id, 10), estado, data_referencia);
    
    res.json({ 
      message: "Item adicionado/atualizado com sucesso",
      composicao_id: req.params.id,
      item_id: item_id
    });
  } catch (error) {
    console.error("Erro ao adicionar item:", error);
    res.status(500).json({ message: "Erro ao adicionar item", error: error.message });
  }
});

// DELETE /api/composicoes/:id/subitens/:itemId - Versão corrigida
app.delete("/api/composicoes/:id/subitens/:itemId", (req, res) => {
  const { estado = 'DF', data_referencia = '2026-04-01' } = req.body;
  
  try {
    // Verifica se a composição existe e é PRÓPRIA
    const comp = db.prepare("SELECT base FROM v2_itens WHERE id = ? AND tipo = 'composicao'").get(req.params.id);
    if (!comp) {
      return res.status(404).json({ message: "Composição não encontrada" });
    }
    
    if (comp.base !== 'PRÓPRIA') {
      return res.status(403).json({ message: "Apenas composições de base 'PRÓPRIA' podem ser editadas" });
    }
    
    const result = db.prepare(`
      DELETE FROM v2_composicao_itens 
      WHERE composicao_id = ? AND item_id = ? AND estado = ? AND data_referencia = ?
    `).run(req.params.id, req.params.itemId, estado, data_referencia);
    
    if (result.changes === 0) {
      return res.status(404).json({ message: "Item não encontrado na composição" });
    }
    
    // Recalcula preços em cascata
    triggerCascadeRecalculation(parseInt(req.params.id, 10), estado, data_referencia);
    
    res.json({ message: "Item removido com sucesso" });
  } catch (error) {
    console.error("Erro ao remover item:", error);
    res.status(500).json({ message: "Erro ao remover item", error: error.message });
  }
});


  app.put("/api/composicoes/:id/subitens/:itemId", (req, res) => {
    const { consumo_unitario, estado, data_referencia } = req.body;
    try {
      const comp = db.prepare("SELECT base FROM v2_itens WHERE id = ?").get(req.params.id) as { base: string } | undefined;
      if (!comp || comp.base !== 'PRÓPRIA') {
        return res.status(403).json({ message: "Apenas composições de base 'PRÓPRIA' podem ser editadas." });
      }

      const itemId = parseInt(req.params.itemId, 10);
      const composicaoId = parseInt(req.params.id, 10);
      db.prepare("UPDATE v2_composicao_itens SET quantidade = ? WHERE composicao_id = ? AND item_id = ? AND estado = ? AND data_referencia = ?").run(
        parseNumber(consumo_unitario), composicaoId, itemId, estado || 'DF', data_referencia || '2026-04-01'
      );
      
      if (estado && data_referencia) {
        triggerCascadeRecalculation(parseInt(req.params.id, 10), estado, data_referencia);
      }
      
      res.json({ message: "Quantidade atualizada com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao atualizar quantidade.", error: error.message });
    }
  });

  // Helper to calculate composition price recursively
  function calculateCompositionPriceRecursive(
    id_composicao: number, 
    estado: string, 
    tipo_desoneracao: string, 
    data_referencia: string, 
    visited = new Set<number>(),
    memo = new Map<string, number>()
  ): number {
    const memoKey = `${id_composicao}|${estado}|${tipo_desoneracao}|${data_referencia}`;
    if (memo.has(memoKey)) return memo.get(memoKey)!;
    
    if (visited.has(id_composicao)) return 0; // Prevent infinite loops
    visited.add(id_composicao);

    const items = db.prepare(`
      SELECT item_id, quantidade 
      FROM v2_composicao_itens 
      WHERE composicao_id = ? AND estado = ? AND data_referencia = ?
    `).all(id_composicao, estado, data_referencia) as { item_id: number, quantidade: number }[];
    
    // Fallback: if no items found for this specific state/date, try to find the most recent one for this state
    let finalItems = items;
    if (finalItems.length === 0) {
      const recentDate = db.prepare(`
        SELECT data_referencia 
        FROM v2_composicao_itens 
        WHERE composicao_id = ? AND estado = ? AND data_referencia <= ?
        ORDER BY data_referencia DESC LIMIT 1
      `).get(id_composicao, estado, data_referencia) as { data_referencia: string } | undefined;
      
      if (recentDate) {
        finalItems = db.prepare(`
          SELECT item_id, quantidade 
          FROM v2_composicao_itens 
          WHERE composicao_id = ? AND estado = ? AND data_referencia = ?
        `).all(id_composicao, estado, recentDate.data_referencia) as { item_id: number, quantidade: number }[];
      } else {
        // Fallback to any state/date if nothing found (e.g. national composition)
        const anyDate = db.prepare(`
          SELECT estado, data_referencia 
          FROM v2_composicao_itens 
          WHERE composicao_id = ?
          ORDER BY data_referencia DESC LIMIT 1
        `).get(id_composicao) as { estado: string, data_referencia: string } | undefined;
        
        if (anyDate) {
          finalItems = db.prepare(`
            SELECT item_id, quantidade 
            FROM v2_composicao_itens 
            WHERE composicao_id = ? AND estado = ? AND data_referencia = ?
          `).all(id_composicao, anyDate.estado, anyDate.data_referencia) as { item_id: number, quantidade: number }[];
        }
      }
    }

    let total = 0;
    for (const item of finalItems) {
      let priceUnit = 0;
      
      const itemInfo = db.prepare("SELECT id, tipo, codigo, base FROM v2_itens WHERE id = ?").get(item.item_id) as { id: number, tipo: string, codigo: string, base: string } | undefined;
      
      if (itemInfo) {
        if (itemInfo.tipo === 'insumo') {
          const price = db.prepare(`
            SELECT preco_unitario 
            FROM v2_precos 
            WHERE item_id = ? AND estado = ? AND tipo_desoneracao = ? AND data_referencia <= ?
            ORDER BY data_referencia DESC 
            LIMIT 1
          `).get(item.item_id, estado, tipo_desoneracao, data_referencia) as { preco_unitario: number } | undefined;
          
          if (price) {
            priceUnit = truncateToTwo(price.preco_unitario);
          }
        } else if (itemInfo.tipo === 'composicao') {
          priceUnit = calculateCompositionPriceRecursive(item.item_id, estado, tipo_desoneracao, data_referencia, new Set(visited), memo);
        }
      }
      
      total += truncateToTwo((item.quantidade || 0) * priceUnit);
    }
    
    total = truncateToTwo(total);
    
    db.prepare(`
      INSERT INTO v2_precos (item_id, estado, tipo_desoneracao, data_referencia, preco_unitario) 
      VALUES (?, ?, ?, ?, ?) 
      ON CONFLICT(item_id, estado, tipo_desoneracao, data_referencia) 
      DO UPDATE SET preco_unitario = excluded.preco_unitario
    `).run(id_composicao, estado, tipo_desoneracao, data_referencia, total);

    memo.set(memoKey, total);
    return total;
  };

  function triggerCascadeRecalculation(startItemId: number, estado: string, data_referencia: string) {
    const affectedComps = new Set<number>();
    
    const itemInfo = db.prepare("SELECT tipo FROM v2_itens WHERE id = ?").get(startItemId) as { tipo: string } | undefined;
    if (itemInfo && itemInfo.tipo === 'composicao') {
      affectedComps.add(startItemId);
    }
    
    function findParents(id: number) {
      const parents = db.prepare("SELECT composicao_id FROM v2_composicao_itens WHERE item_id = ?").all(id) as { composicao_id: number }[];
      for (const parent of parents) {
        if (!affectedComps.has(parent.composicao_id)) {
          affectedComps.add(parent.composicao_id);
          findParents(parent.composicao_id);
        }
      }
    }
    
    findParents(startItemId);
    
    if (affectedComps.size > 0) {
      const memo = new Map<string, number>();
      for (const compId of affectedComps) {
        const newPriceDeson = calculateCompositionPriceRecursive(compId, estado, 'Desonerado', data_referencia, new Set(), memo);
        calculateCompositionPriceRecursive(compId, estado, 'Não Desonerado', data_referencia, new Set(), memo);
        
        if (newPriceDeson > 0) {
          db.prepare(`
            INSERT INTO v2_precos (item_id, estado, tipo_desoneracao, data_referencia, preco_unitario)
            VALUES (?, ?, 'Desonerado', ?, ?)
            ON CONFLICT(item_id, estado, tipo_desoneracao, data_referencia)
            DO UPDATE SET preco_unitario = excluded.preco_unitario
          `).run(compId, estado, data_referencia, newPriceDeson);
        }
        
        const newPriceNaoDeson = calculateCompositionPriceRecursive(compId, estado, 'Não Desonerado', data_referencia, new Set(), memo);
        if (newPriceNaoDeson > 0) {
          db.prepare(`
            INSERT INTO v2_precos (item_id, estado, tipo_desoneracao, data_referencia, preco_unitario)
            VALUES (?, ?, 'Não Desonerado', ?, ?)
            ON CONFLICT(item_id, estado, tipo_desoneracao, data_referencia)
            DO UPDATE SET preco_unitario = excluded.preco_unitario
          `).run(compId, estado, data_referencia, newPriceNaoDeson);
        }

        // Update budget items for this composition
        db.prepare(`
          UPDATE v2_orcamento_itens 
          SET custo_unitario_aplicado = ?
          WHERE item_id = ?
        `).run(newPriceDeson, compId);
      }
    }
  }

  app.post("/api/composicoes/recalculate-all", (req, res) => {
    try {
      const start = Date.now();
      
      const combinations = db.prepare(`
        SELECT DISTINCT estado, data_referencia 
        FROM v2_composicao_itens
      `).all() as { estado: string, data_referencia: string }[];

      for (const { estado, data_referencia } of combinations) {
        // 1. Get all insumo prices (only for the latest date for each item/type)
        const insumoPrecos = db.prepare(`
          SELECT p.item_id, p.tipo_desoneracao, p.preco_unitario
          FROM v2_precos p
          INNER JOIN (
            SELECT item_id, tipo_desoneracao, MAX(data_referencia) as max_date
            FROM v2_precos
            WHERE estado = ? AND data_referencia <= ?
            GROUP BY item_id, tipo_desoneracao
          ) md ON p.item_id = md.item_id AND p.tipo_desoneracao = md.tipo_desoneracao AND p.data_referencia = md.max_date
          WHERE p.estado = ?
        `).all(estado, data_referencia, estado) as { item_id: number, tipo_desoneracao: string, preco_unitario: number }[];

        const precoMap = new Map<string, number>();
        for (const p of insumoPrecos) {
          precoMap.set(`${p.item_id}|${p.tipo_desoneracao}`, p.preco_unitario);
        }

        // 2. Get all composition items (only for the latest date for each composition)
        const compItems = db.prepare(`
          SELECT ci.composicao_id, ci.item_id, ci.quantidade
          FROM v2_composicao_itens ci
          INNER JOIN (
            SELECT composicao_id, MAX(data_referencia) as max_date
            FROM v2_composicao_itens
            WHERE estado = ? AND data_referencia <= ?
            GROUP BY composicao_id
          ) md ON ci.composicao_id = md.composicao_id AND ci.data_referencia = md.max_date
          WHERE ci.estado = ?
        `).all(estado, data_referencia, estado) as { composicao_id: number, item_id: number, quantidade: number }[];

        const compMap = new Map<number, { item_id: number, quantidade: number }[]>();
        for (const item of compItems) {
          if (!compMap.has(item.composicao_id)) {
            compMap.set(item.composicao_id, []);
          }
          compMap.get(item.composicao_id)!.push(item);
        }

        // 3. Get all item types
        const itemTypes = db.prepare("SELECT id, tipo FROM v2_itens").all() as { id: number, tipo: string }[];
        const typeMap = new Map<number, string>();
        for (const item of itemTypes) {
          typeMap.set(item.id, item.tipo);
        }

        // 4. Calculate prices recursively with memoization
        const memo = new Map<string, number>();

        function calc(id: number, tipo_deson: string, visited = new Set<number>()): number {
          const memoKey = `${id}|${tipo_deson}`;
          if (memo.has(memoKey)) return memo.get(memoKey)!;
          
          if (visited.has(id)) return 0;
          visited.add(id);
          
          const items = compMap.get(id);
          if (!items) {
            memo.set(memoKey, 0);
            return 0;
          }
          
          let total = 0;
          for (const item of items) {
            const tipo = typeMap.get(item.item_id);
            let priceUnit = 0;
            if (tipo === 'insumo') {
              priceUnit = precoMap.get(`${item.item_id}|${tipo_deson}`) || 0;
            } else if (tipo === 'composicao') {
              priceUnit = calc(item.item_id, tipo_deson, new Set(visited));
            }
            total += truncateToTwo(item.quantidade * priceUnit);
          }
          
          total = truncateToTwo(total);
          memo.set(memoKey, total);
          return total;
        }

        const composicoes = db.prepare("SELECT id FROM v2_itens WHERE tipo = 'composicao'").all() as { id: number }[];

        const updatePreco = db.prepare(`
          INSERT INTO v2_precos (item_id, estado, tipo_desoneracao, data_referencia, preco_unitario)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(item_id, estado, tipo_desoneracao, data_referencia)
          DO UPDATE SET preco_unitario = excluded.preco_unitario
        `);

        db.transaction(() => {
          for (const comp of composicoes) {
            const deson = calc(comp.id, 'Desonerado');
            const naoDeson = calc(comp.id, 'Não Desonerado');
            if (deson > 0) updatePreco.run(comp.id, estado, 'Desonerado', data_referencia, deson);
            if (naoDeson > 0) updatePreco.run(comp.id, estado, 'Não Desonerado', data_referencia, naoDeson);
          }
        })();
      }

      const end = Date.now();
      console.log(`Recalculated all compositions in ${end - start}ms`);
      res.json({ message: "Todas as composições foram recalculadas com sucesso." });
    } catch (error: any) {
      console.error("Error recalculating all compositions:", error);
      res.status(500).json({ message: "Erro ao recalcular composições.", error: error.message });
    }
  });

  app.post("/api/composicoes/recalculate-zeros", (req, res) => {
    let { estado = 'DF', data_referencia } = req.body;
    if (estado === 'Todos') estado = 'DF';
    if (!data_referencia) return res.status(400).json({ message: "Data de referência é obrigatória." });

    try {
      const types = ['Desonerado', 'Não Desonerado'];
      const memo = new Map<string, number>();
      
      db.transaction(() => {
        for (const tipo of types) {
          const composicoesZeradas = db.prepare(`
            SELECT id FROM v2_itens 
            WHERE tipo = 'composicao' 
            AND id NOT IN (
                SELECT item_id FROM v2_precos 
                WHERE estado = ? AND tipo_desoneracao = ? AND data_referencia = ? AND preco_unitario > 0
            )
          `).all(estado, tipo, data_referencia) as { id: number }[];
          
          for (const comp of composicoesZeradas) {
            calculateCompositionPriceRecursive(comp.id, estado, tipo, data_referencia, new Set(), memo);
          }
        }
      })();

      res.json({ message: "Composições com preços zerados foram recalculadas com sucesso." });
    } catch (error: any) {
      console.error("Error recalculating zero compositions:", error);
      res.status(500).json({ message: "Erro ao recalcular composições zeradas.", error: error.message });
    }
  });

  app.post("/api/composicoes/:id/recalculate", (req, res) => {
    const { estado = 'DF', data_referencia } = req.body;
    const normalizedDataRef = normalizeDate(data_referencia);
    try {
      triggerCascadeRecalculation(parseInt(req.params.id, 10), estado, normalizedDataRef);
      res.json({ message: "Preços recalculados e salvos com sucesso." });
    } catch (error: any) {
      console.error("Error recalculating composition:", error);
      res.status(500).json({ message: "Erro ao recalcular preços.", error: error.message });
    }
  });

  app.post("/api/admin/clear-database", (req, res) => {
    const { target } = req.body || {};
    try {
      db.transaction(() => {
        const orcamentosExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orcamentos'").get();

        if (!target || target === 'all' || target === 'composicoes') {
          db.prepare("DELETE FROM v2_medicao_itens WHERE orcamento_item_id IN (SELECT id FROM v2_orcamento_itens WHERE item_id IN (SELECT id FROM v2_itens WHERE tipo = 'composicao'))").run();
          db.prepare("DELETE FROM v2_orcamento_itens WHERE item_id IN (SELECT id FROM v2_itens WHERE tipo = 'composicao')").run();
          
          if (orcamentosExists) {
            db.prepare("DELETE FROM orcamentos WHERE item_tipo = 'composicao'").run();
          }
          
          db.prepare("DELETE FROM v2_composicao_itens").run();
          db.prepare("DELETE FROM v2_precos WHERE item_id IN (SELECT id FROM v2_itens WHERE tipo = 'composicao')").run();
          db.prepare("DELETE FROM v2_itens WHERE tipo = 'composicao'").run();
          
          // Legacy tables
          db.prepare("DELETE FROM orcamento_itens WHERE item_tipo = 'composicao'").run();
          db.prepare("DELETE FROM composicao_insumo").run();
          db.prepare("DELETE FROM composicoes_precos").run();
          db.prepare("DELETE FROM composicoes").run();
        }
        
        if (!target || target === 'all' || target === 'insumos') {
          db.prepare("DELETE FROM v2_medicao_itens WHERE orcamento_item_id IN (SELECT id FROM v2_orcamento_itens WHERE item_id IN (SELECT id FROM v2_itens WHERE tipo = 'insumo'))").run();
          db.prepare("DELETE FROM v2_orcamento_itens WHERE item_id IN (SELECT id FROM v2_itens WHERE tipo = 'insumo')").run();
          
          if (orcamentosExists) {
            db.prepare("DELETE FROM orcamentos WHERE item_tipo = 'insumo'").run();
          }
          
          db.prepare("DELETE FROM v2_precos WHERE item_id IN (SELECT id FROM v2_itens WHERE tipo = 'insumo')").run();
          db.prepare("DELETE FROM v2_itens WHERE tipo = 'insumo'").run();
          
          // Legacy tables
          db.prepare("DELETE FROM orcamento_itens WHERE item_tipo = 'insumo'").run();
          db.prepare("DELETE FROM insumos_precos").run();
          db.prepare("DELETE FROM insumos_cadastro").run();
        }

        if (!target || target === 'all') {
          db.prepare("DELETE FROM v2_medicao_itens").run();
          db.prepare("DELETE FROM v2_medicoes").run();
          db.prepare("DELETE FROM v2_orcamento_itens").run();
          db.prepare("DELETE FROM orcamento_itens").run();
          
          if (orcamentosExists) {
            db.prepare("DELETE FROM orcamentos").run();
          }
          
          db.prepare("DELETE FROM orcamento").run();
        }
      })();
      res.json({ message: target === 'composicoes' ? "Banco de composições limpo." : (target === 'insumos' ? "Banco de insumos limpo." : "Todo o banco de dados foi limpo.") });
    } catch (error: any) {
      console.error("Error clearing database:", error);
      res.status(500).json({ message: "Erro ao limpar banco de dados.", error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Catch-all route for SPA in development
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  console.log("Starting server on port", PORT);
  // Signatures
  app.get("/api/settings/signatures", authenticate, (req: any, res) => {
    const signatures = db.prepare("SELECT * FROM v2_signatures WHERE tenant_id = ?").all(req.user.tenant_id);
    res.json(signatures);
  });

  app.post("/api/settings/signatures", authenticate, (req: any, res) => {
    const { name, role, image_data, is_default } = req.body;
    if (is_default) {
      db.prepare("UPDATE v2_signatures SET is_default = 0 WHERE tenant_id = ?").run(req.user.tenant_id);
    }
    const result = db.prepare("INSERT INTO v2_signatures (tenant_id, name, role, image_data, is_default) VALUES (?, ?, ?, ?, ?)")
      .run(req.user.tenant_id, name, role, image_data, is_default ? 1 : 0);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/settings/signatures/:id", authenticate, (req: any, res) => {
    db.prepare("DELETE FROM v2_signatures WHERE id = ? AND tenant_id = ?").run(req.params.id, req.user.tenant_id);
    res.json({ success: true });
  });

  // Branding (Logo & Colors)
  app.put("/api/settings/branding", authenticate, (req: any, res) => {
    const { logo_url, primary_color, secondary_color } = req.body;
    const tenant = db.prepare("SELECT config_json FROM v2_tenants WHERE id = ?").get(req.user.tenant_id) as any;
    let config = {};
    try { config = JSON.parse(tenant.config_json || "{}"); } catch (e) {}
    
    const newConfig = { ...config, branding: { logo_url, primary_color, secondary_color } };
    
    db.prepare("UPDATE v2_tenants SET logo_url = ?, config_json = ? WHERE id = ?")
      .run(logo_url, JSON.stringify(newConfig), req.user.tenant_id);
    
    res.json({ success: true });
  });

  // Budget Settings
  app.put("/api/settings/budget", authenticate, (req: any, res) => {
    const { default_bdi, rounding_rules, currency_symbol } = req.body;
    const tenant = db.prepare("SELECT config_json FROM v2_tenants WHERE id = ?").get(req.user.tenant_id) as any;
    let config = {};
    try { config = JSON.parse(tenant.config_json || "{}"); } catch (e) {}
    
    const newConfig = { ...config, budget: { default_bdi, rounding_rules, currency_symbol } };
    
    db.prepare("UPDATE v2_tenants SET config_json = ? WHERE id = ?")
      .run(JSON.stringify(newConfig), req.user.tenant_id);
    
    res.json({ success: true });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

import Database from 'better-sqlite3';
const db = new Database('obras.db');

const search = 'a';
const estado: string = 'DF';
const data_referencia: string = '2024-01-01';

const params: any[] = [];
let query = `
  SELECT 
    ic.id as id_insumo, 
    ic.base,
    ic.codigo,
    ic.nome as descricao,
    ic.unidade,
    ic.categoria as tipo,
    MAX(CASE WHEN ip.tipo_desoneracao = 'Desonerado' THEN ip.preco_unitario END) as valor_desonerado,
    MAX(CASE WHEN ip.tipo_desoneracao = 'Não Desonerado' THEN ip.preco_unitario END) as valor_nao_desonerado,
    MAX(ip.estado) as estado, 
    MAX(ip.data_referencia) as data_referencia
  FROM v2_itens ic
  LEFT JOIN v2_precos ip ON ic.id = ip.item_id
`;

let joinConditions = [];
if (estado && estado !== 'Todos') {
  joinConditions.push(`ip.estado = ?`);
  params.push(estado);
}
if (data_referencia && data_referencia !== 'Todos') {
  joinConditions.push(`ip.data_referencia = ?`);
  params.push(data_referencia);
}

if (joinConditions.length > 0) {
  query += ` AND ${joinConditions.join(' AND ')}`;
}

query += ` WHERE ic.tipo = 'insumo'`;

if (search) {
  query += ` AND (ic.codigo LIKE ? OR ic.nome LIKE ?)`;
  params.push(`%${search}%`, `%${search}%`);
}

query += ` GROUP BY ic.id, ic.base, ic.codigo, ic.nome, ic.unidade, ic.categoria`;
query += ` LIMIT 5`;

console.log(query);
console.log(params);
const results = db.prepare(query).all(...params);
console.log(results);

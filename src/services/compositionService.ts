import { db } from "../db";
import { truncateToTwo, calculateItemTotal, normalizeDate } from "../utils";

// Helper to fetch prices in batch with chunking
export function getPrecosEmLote(itemIds, estado, dataReferencia, tipoDesoneracao = 'Não Desonerado', bancosAtivos: any[] = []) {
  if (itemIds.length === 0) return new Map();

  const CHUNK_SIZE = 500;
  const allResultados = [];
  
  // Build dynamic base conditions for dates
  const baseConditions: string[] = [];
  const baseParams: any[] = [];
  
  const normalizedDataRef = normalizeDate(dataReferencia);
  
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
    baseParams.push(...bases, normalizedDataRef);
  } else {
    baseConditionSql = `AND (p2.data_referencia <= ? OR i2.base = 'PRÓPRIO')`;
    baseParams.push(normalizedDataRef);
  }
  
  for (let i = 0; i < itemIds.length; i += CHUNK_SIZE) {
    const chunk = itemIds.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => '?').join(',');
    
    const query = `
      SELECT item_id, preco_unitario 
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
        WHERE p2.item_id IN (${placeholders})
          AND (p2.estado IN (?, 'PRÓPRIO') OR i2.base = 'PRÓPRIO')
          AND p2.tipo_desoneracao = ?
          ${baseConditionSql}
      )
      WHERE rn = 1
    `;
    
    const resultados = db.prepare(query).all(estado, ...chunk, estado, tipoDesoneracao, ...baseParams);
    allResultados.push(...resultados);
  }
  
  return new Map(allResultados.map(r => [r.item_id, r.preco_unitario]));
}

// Helper to collect all item IDs recursively with fallback
function coletarTodosIdsRecursivamente(composicaoId, estado, dataReferencia, visited = new Set(), bancosAtivos: any[] = []) {
  if (visited.has(composicaoId)) return visited;
  visited.add(composicaoId);
  
  const composicao = db.prepare("SELECT base FROM v2_itens WHERE id = ?").get(composicaoId) as any;
  const base = composicao?.base?.toLowerCase();
  const normalizedDataRef = normalizeDate(dataReferencia);
  const bancoAtivo = bancosAtivos.find(b => b.id.toLowerCase() === base);
  const dataRefBanco = normalizeDate(bancoAtivo?.data_referencia || normalizedDataRef);
  
  let items = db.prepare(`
    SELECT ci.item_id, i.tipo
    FROM v2_composicao_itens ci
    JOIN v2_itens i ON ci.item_id = i.id
    WHERE ci.composicao_id = ?
      AND ci.estado = ?
      AND ci.data_referencia = (
        SELECT MAX(data_referencia)
        FROM v2_composicao_itens
        WHERE composicao_id = ? AND estado = ? AND data_referencia <= ?
      )
  `).all(composicaoId, estado, composicaoId, estado, dataRefBanco) as { item_id: number, tipo: string }[];
  
  // Fallback logic if no date <= dataRefBanco exists
  if (items.length === 0) {
    const anyDate = db.prepare(`
      SELECT estado, data_referencia 
      FROM v2_composicao_itens 
      WHERE composicao_id = ?
      ORDER BY data_referencia DESC LIMIT 1
    `).get(composicaoId) as { estado: string, data_referencia: string } | undefined;
    
    if (anyDate) {
      items = db.prepare(`
        SELECT ci.item_id, i.tipo
        FROM v2_composicao_itens ci
        JOIN v2_itens i ON ci.item_id = i.id
        WHERE ci.composicao_id = ? AND ci.estado = ? AND ci.data_referencia = ?
      `).all(composicaoId, anyDate.estado, anyDate.data_referencia) as { item_id: number, tipo: string }[];
    }
  }
  
  for (const item of items) {
    if (!visited.has(item.item_id)) {
      if (item.tipo === 'composicao') {
        coletarTodosIdsRecursivamente(item.item_id, estado, dataReferencia, visited, bancosAtivos);
      } else {
        visited.add(item.item_id);
      }
    }
  }
  return visited;
}

export function getCompositionTree(composicaoId, estado, dataReferencia, tipoDesoneracao = 'Não Desonerado', bancosAtivos: any[] = []) {
  const allIds = coletarTodosIdsRecursivamente(composicaoId, estado, dataReferencia, new Set(), bancosAtivos);
  const precos = getPrecosEmLote(Array.from(allIds), estado, dataReferencia, tipoDesoneracao, bancosAtivos);
  
  function buildTree(id, nivel = 0, visited = new Set()) {
    if (visited.has(id)) return { id, erro: 'Loop detectado', nivel, items: [] };
    visited.add(id);
    
    const composicao = db.prepare("SELECT * FROM v2_itens WHERE id = ?").get(id) as any;
    if (!composicao) return { id, erro: 'Composição não encontrada', nivel, items: [] };
    
    const base = composicao?.base?.toLowerCase();
    const bancoAtivo = bancosAtivos.find(b => b.id.toLowerCase() === base);
    const dataRefBanco = bancoAtivo?.data_referencia || dataReferencia;
    
    let items = db.prepare(`
      SELECT ci.*, i.nome, i.codigo, i.unidade, i.tipo, i.categoria
      FROM v2_composicao_itens ci
      JOIN v2_itens i ON ci.item_id = i.id
      WHERE ci.composicao_id = ?
        AND ci.estado = ?
        AND ci.data_referencia = (
          SELECT MAX(data_referencia)
          FROM v2_composicao_itens
          WHERE composicao_id = ? AND estado = ? AND data_referencia <= ?
        )
    `).all(id, estado, id, estado, dataRefBanco) as any[];

    // Fallback logic for buildTree
    if (items.length === 0) {
      const anyDate = db.prepare(`
        SELECT estado, data_referencia 
        FROM v2_composicao_itens 
        WHERE composicao_id = ?
        ORDER BY data_referencia DESC LIMIT 1
      `).get(id) as { estado: string, data_referencia: string } | undefined;
      
      if (anyDate) {
        items = db.prepare(`
          SELECT ci.*, i.nome, i.codigo, i.unidade, i.tipo, i.categoria
          FROM v2_composicao_itens ci
          JOIN v2_itens i ON ci.item_id = i.id
          WHERE ci.composicao_id = ? AND ci.estado = ? AND ci.data_referencia = ?
        `).all(id, anyDate.estado, anyDate.data_referencia) as any[];
      }
    }
    
    const itemsProcessados = items.map(item => {
      let valorUnitario = truncateToTwo(precos.get(item.item_id) || 0);
      
      let filhos = [];
      if (item.tipo === 'composicao') {
        const tree = buildTree(item.item_id, nivel + 1, new Set(visited));
        filhos = tree.items || [];
        valorUnitario = tree.valor_total || 0;
      }
      
      const valorTotal = calculateItemTotal(valorUnitario, item.quantidade);
      
      return {
        ...item,
        nivel: nivel + 1,
        valor_unitario: valorUnitario,
        valor_total: valorTotal,
        filhos
      };
    });
    
    return {
      ...composicao,
      nivel,
      items: itemsProcessados,
      valor_total: itemsProcessados.reduce((acc, item) => acc + (item.valor_total || 0), 0)
    };
  }
  
  return buildTree(composicaoId);
}

export function getFlatCompositionItems(composicaoId, estado, dataReferencia, tipoDesoneracao = 'Não Desonerado', bancosAtivos: any[] = []) {
  console.log(`getFlatCompositionItems called for ${composicaoId}, ${estado}, ${dataReferencia}, ${tipoDesoneracao}`);
  const allIds = coletarTodosIdsRecursivamente(composicaoId, estado, dataReferencia, new Set(), bancosAtivos);
  const precos = getPrecosEmLote(Array.from(allIds), estado, dataReferencia, tipoDesoneracao, bancosAtivos);
  
  function flatten(id, quantidadePai = 1, visited = new Set()) {
    if (visited.has(id)) return [];
    visited.add(id);
    
    const composicao = db.prepare("SELECT base FROM v2_itens WHERE id = ?").get(id) as any;
    const base = composicao?.base?.toLowerCase();
    const bancoAtivo = bancosAtivos.find(b => b.id.toLowerCase() === base);
    const dataRefBanco = bancoAtivo?.data_referencia || dataReferencia;
    
    let items = db.prepare(`
      SELECT ci.*, i.nome, i.codigo, i.unidade, i.tipo, i.categoria
      FROM v2_composicao_itens ci
      JOIN v2_itens i ON ci.item_id = i.id
      WHERE ci.composicao_id = ?
        AND ci.estado = ?
        AND ci.data_referencia = (
          SELECT MAX(data_referencia)
          FROM v2_composicao_itens
          WHERE composicao_id = ? AND estado = ? AND data_referencia <= ?
        )
    `).all(id, estado, id, estado, dataRefBanco) as any[];
    
    // Fallback logic for flatten
    if (items.length === 0) {
      const anyDate = db.prepare(`
        SELECT estado, data_referencia 
        FROM v2_composicao_itens 
        WHERE composicao_id = ?
        ORDER BY data_referencia DESC LIMIT 1
      `).get(id) as { estado: string, data_referencia: string } | undefined;
      
      if (anyDate) {
        items = db.prepare(`
          SELECT ci.*, i.nome, i.codigo, i.unidade, i.tipo, i.categoria
          FROM v2_composicao_itens ci
          JOIN v2_itens i ON ci.item_id = i.id
          WHERE ci.composicao_id = ? AND ci.estado = ? AND ci.data_referencia = ?
        `).all(id, anyDate.estado, anyDate.data_referencia) as any[];
      }
    }
    
    let result = [];
    for (const item of items) {
      const quantidadeTotal = item.quantidade * quantidadePai;
      if (item.tipo === 'composicao') {
        result = [...result, ...flatten(item.item_id, quantidadeTotal, new Set(visited))];
      } else {
        const precoUnitario = truncateToTwo(precos.has(item.item_id) ? precos.get(item.item_id) : 0);
        result.push({
          item_id: item.item_id,
          codigo: item.codigo,
          descricao: item.nome,
          unidade: item.unidade,
          tipo: item.tipo,
          categoria: item.categoria,
          quantidade: quantidadeTotal,
          preco_unitario: precoUnitario,
          valor_total: calculateItemTotal(precoUnitario, quantidadeTotal)
        });
      }
    }
    return result;
  }
  
  return flatten(composicaoId);
}

export function checkCompositionIntegrity(composicaoId, estado, dataReferencia, tipoDesoneracao = 'Não Desonerado', visited = new Set(), bancosAtivos: any[] = []) {
  const result = {
    composicao_id: composicaoId,
    valida: true,
    problemas: [],
    itens: [],
    composicao: null
  };
  
  if (visited.has(composicaoId)) {
    result.valida = false;
    result.problemas.push("Loop detectado na composição");
    return result;
  }
  visited.add(composicaoId);
  
  const comp = db.prepare("SELECT * FROM v2_itens WHERE id = ?").get(composicaoId) as any;
  if (!comp) {
    result.valida = false;
    result.problemas.push("Composição não encontrada");
    return result;
  }
  
  result.composicao = comp;
  
  const base = comp?.base?.toLowerCase();
  const bancoAtivo = bancosAtivos.find(b => b.id.toLowerCase() === base);
  const dataRefBanco = bancoAtivo?.data_referencia || dataReferencia;
  
  const items = db.prepare(`
    SELECT ci.*, i.tipo, i.nome, i.codigo
    FROM v2_composicao_itens ci
    JOIN v2_itens i ON ci.item_id = i.id
    WHERE ci.composicao_id = ? AND ci.estado = ? AND ci.data_referencia = ?
  `).all(composicaoId, estado, dataRefBanco) as any[];
  
  for (const item of items) {
    const itemInfo: {
      item_id: any;
      nome: any;
      codigo: any;
      tipo: any;
      quantidade: any;
      problema: string | null;
      subproblemas: string[] | null;
    } = {
      item_id: item.item_id,
      nome: item.nome,
      codigo: item.codigo,
      tipo: item.tipo,
      quantidade: item.quantidade,
      problema: null,
      subproblemas: null
    };
    
    if (!item.item_id) {
      itemInfo.problema = "Item ID inválido";
      result.valida = false;
    }
    
    if (item.tipo === 'insumo') {
      const preco = db.prepare(`
        SELECT 1 FROM v2_precos ip
        JOIN v2_itens i ON ip.item_id = i.id
        WHERE ip.item_id = ? 
          AND ip.estado = ? 
          AND ip.data_referencia <= ?
          AND ip.tipo_desoneracao = ?
        LIMIT 1
      `).get(item.item_id, estado, dataRefBanco, tipoDesoneracao);
      
      if (!preco) {
        itemInfo.problema = "Insumo sem preço cadastrado";
        result.valida = false;
      }
    }
    
    if (item.tipo === 'composicao') {
      const subIntegridade = checkCompositionIntegrity(item.item_id, estado, dataReferencia, tipoDesoneracao, new Set(visited), bancosAtivos);
      if (!subIntegridade.valida) {
        itemInfo.problema = "Subcomposição com problemas";
        itemInfo.subproblemas = subIntegridade.problemas;
        result.valida = false;
      }
    }
    
    result.itens.push(itemInfo);
  }
  
  if (items.length === 0) {
    result.problemas.push("Composição não possui itens");
    result.valida = false;
  }
  
  return result;
}

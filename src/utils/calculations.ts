import { OrcamentoItem } from '../types/index';
import { calculateItemTotal, truncateToTwo } from '../utils';

export const recalculateTotals = (data: OrcamentoItem[], bdiConfig: { porcentagem: number }) => {
  if (!data || !Array.isArray(data)) return [];
  const bdiFactor = 1 + (bdiConfig.porcentagem / 100);

  // First pass: calculate individual item totals and identify etapas
  const processed = data.map(row => {
    if (row.tipo !== 'etapa') {
      const qty = parseFloat(row.quantidade as any) || 0;
      const unit = parseFloat(row.valor_unitario as any) || 0;
      
      // Valor com BDI = valor unitario x BDI
      const valor_com_bdi = unit * bdiFactor;
      
      // Total = quantidade x valor com BDI
      const total = qty * valor_com_bdi;
      
      return { 
        ...row, 
        valor_bdi: valor_com_bdi,
        total 
      };
    }
    return { ...row, total: 0 }; // Initialize etapa total to 0
  });

  // Second pass: accumulate totals for each etapa based on hierarchy
  const result = [...processed];
  for (let i = 0; i < result.length; i++) {
    if (result[i].tipo === 'etapa') {
      const etapa = result[i];
      const etapaPrefix = (etapa.item || '').toString() + '.';
      let etapaTotal = 0;
      
      // Sum all non-etapa items that belong to this etapa or its sub-etapas
      for (let j = 0; j < result.length; j++) {
        if (result[j].tipo !== 'etapa') {
          const itemStr = (result[j].item || '').toString();
          if (itemStr.startsWith(etapaPrefix)) {
            etapaTotal += result[j].total || 0;
          }
        }
      }
      
      result[i] = { ...etapa, total: etapaTotal };
    }
  }

  return result;
};

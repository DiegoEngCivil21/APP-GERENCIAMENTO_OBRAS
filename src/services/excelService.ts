import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface ExcelReportData {
  title: string;
  obraName: string;
  cliente: string;
  bancos: string;
  bdi: number;
  desconto: number;
  encargos: string;
  columns: { 
    header: string; 
    key?: string; 
    width: number; 
    type?: 'currency' | 'number' | 'percentage' | 'text';
    subgroup?: string[];
    keys?: string[];
    colspan?: number;
  }[];
  rows: any[];
  summary: {
    totalSemBdi: number;
    totalBdi: number;
    totalDesconto: number;
    totalGeral: number;
  };
  config?: {
    cabecalhoCentral?: string;
    cabecalhoEsquerdo?: string;
    cabecalhoDireito?: string;
    rodapeCentral?: string;
    rodapeEsquerdo?: string;
    rodapeDireito?: string;
    assinatura1?: string;
    assinatura2?: string;
    corFundoEtapa?: string;
    corLetraEtapa?: string;
    negritoEtapa?: boolean;
    corFundoComposicao?: string;
    corLetraComposicao?: string;
    negritoComposicao?: boolean;
    corFundoInsumo?: string;
    corLetraInsumo?: string;
    negritoInsumo?: boolean;
    retirarColunaPeso?: boolean;
    retirarInfoBDI?: boolean;
    bloquearEdicao?: boolean;
    relatoriosComFormulas?: boolean;
    logoImagem?: string;
  };
}

export const generateExcelReport = async (data: ExcelReportData) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Orçamento');
  worksheet.properties.defaultRowHeight = 20;
  
  // --- CONFIGURAÇÃO DE IMPRESSÃO E VISUALIZAÇÃO ---
  worksheet.views = [{ 
    showGridLines: false,
    view: 'pageBreakPreview', // Abre com visão de quebra de página
    zoomScale: 85
  } as any];

  worksheet.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape', // Página deitada
    fitToPage: true,
    fitToWidth: 1, // Garante que caiba todas as colunas em 1 página de largura
    scale: 85, // Reduz a escala para caber melhor e não estourar a página
    margins: {
      left: 0.5, right: 0.5,
      top: 0.5, bottom: 0.5,
      header: 0.2, footer: 0.2
    },
    printTitlesRow: '7:8' // Repete o cabeçalho da tabela em todas as páginas
  };

  const leftHeader = data.config?.cabecalhoEsquerdo ? `&L&10${data.config.cabecalhoEsquerdo}` : '';
  const centerHeader = data.config?.cabecalhoCentral ? `&C&10${data.config.cabecalhoCentral}` : '';
  const rightHeader = data.config?.cabecalhoDireito ? `&R&10${data.config.cabecalhoDireito}` : '';
  
  const leftFooter = data.config?.rodapeEsquerdo ? `&L&10${data.config.rodapeEsquerdo}` : '';
  const centerFooter = data.config?.rodapeCentral ? `&C&10${data.config.rodapeCentral}` : '&C&"Arial,Italic"&8Engineering Pro - &P de &N';
  const rightFooter = data.config?.rodapeDireito ? `&R&10${data.config.rodapeDireito}` : '';

  worksheet.headerFooter = {
    oddHeader: `${leftHeader}${centerHeader}${rightHeader}`,
    oddFooter: `${leftFooter}${centerFooter}${rightFooter}`
  };

  // --- CONFIGURAÇÃO DE ESTILOS ---
  const colors = {
    headerBg: 'FFFFFFFF',
    tableHeaderBg: 'FFFFFFFF',
    border: 'FF000000',
    zebraStage: 'FFF1F5F9', // Para Etapas
    zebraItem: 'FFE2EFDA',  // Verde claro para Itens (como no print)
    text: 'FF000000'
  };

  // 1. CABEÇALHO DETALHADO (Conforme Print)
  // Espaço para Logo
  worksheet.mergeCells('A1:B4');
  
  if (data.config?.logoImagem) {
    try {
      const base64Data = data.config.logoImagem;
      const isJpeg = base64Data.includes('image/jpeg') || base64Data.includes('image/jpg');
      const extensionToUse = isJpeg ? 'jpeg' : 'png';
      const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      
      const imageId = workbook.addImage({
        base64: base64Content,
        extension: extensionToUse,
      });
      
      // We assign it to the merged cells range, adding a bit of margin
      worksheet.addImage(imageId, {
        tl: { col: 0, row: 0 } as any,
        br: { col: 2, row: 4 } as any,
        editAs: 'oneCell'
      });
    } catch (e) {
      console.warn("Failed to add image to excel", e);
      const logoCell = worksheet.getCell('A1');
      logoCell.value = 'LOGO';
      logoCell.alignment = { vertical: 'middle', horizontal: 'center' };
      logoCell.font = { bold: true, size: 12, color: { argb: 'FF94a3b8' } };
    }
  } else {
    const logoCell = worksheet.getCell('A1');
    logoCell.value = 'LOGO';
    logoCell.alignment = { vertical: 'middle', horizontal: 'center' };
    logoCell.font = { bold: true, size: 12, color: { argb: 'FF94a3b8' } };
  }
  // Sem bordas no logo conforme solicitado

  // Estilo padrão para células do cabeçalho
  const headerInfoStyle: Partial<ExcelJS.Style> = {
    alignment: { wrapText: true, vertical: 'top', horizontal: 'left' }
  };

  const totalPhysicalCols = data.columns.reduce((acc, col) => acc + (col.subgroup ? col.subgroup.length : (col.colspan || 1)), 0);
  // Guarantee at least 7 columns for the header blocks to avoid overlapping
  const numCols = Math.max(8, totalPhysicalCols); 
  const lastColLetter = worksheet.getColumn(numCols).letter;

  // Distribute columns starting from column 3 (since A and B are for Logo)
  let currentStart = 3;
  let remainingColsForHeader = Math.max(5, numCols - 2); // At least 5 spaces for 5 blocks
  
  // Distribute the remaining columns proportionally but leave room for the last 3 items
  let obraSpan = Math.max(1, Math.floor(remainingColsForHeader * 0.35));
  let bancoSpan = Math.max(1, Math.floor(remainingColsForHeader * 0.35));
  // Guarantee at least 3 cols left for BDI, Desconto, Encargos
  if (obraSpan + bancoSpan + 3 > remainingColsForHeader) {
    bancoSpan = Math.max(1, Math.floor((remainingColsForHeader - 3) / 2));
    obraSpan = remainingColsForHeader - 3 - bancoSpan;
  }
  
  let colObraEnd = Math.min(numCols, currentStart + Math.max(1, obraSpan) - 1);
  currentStart = colObraEnd + 1;
  
  let colBancosEnd = Math.min(numCols, currentStart + Math.max(1, bancoSpan) - 1);
  currentStart = colBancosEnd + 1;
  
  let bdiSpan = 1;
  let colBdiEnd = Math.min(numCols, currentStart + bdiSpan - 1);
  currentStart = colBdiEnd + 1;
  
  let descSpan = 1;
  let colDescontoEnd = Math.min(numCols, currentStart + descSpan - 1);
  currentStart = colDescontoEnd + 1;
  
  let colEncargosEnd = numCols;

  // Helper function to create separated headers
  const createSplitHeader = (
    title: string, 
    value: string, 
    startIdx: number, 
    endIdx: number, 
    isDark: boolean = false
  ) => {
    // Avoid invalid column ranges
    if (startIdx > numCols) return;
    
    const sCol = worksheet.getColumn(Math.min(numCols, Math.max(1, startIdx))).letter;
    const eCol = worksheet.getColumn(Math.min(numCols, Math.max(1, endIdx))).letter;
    
    // Configurações de cores baseadas no padrão da UI da API
    const bgColorTitle = isDark ? 'FF003366' : 'FFF1F5F9'; // dark blue or slate-100
    const fgColorTitle = isDark ? 'FFFFFFFF' : 'FF64748B'; // white or slate-500
    const bgColorValue = isDark ? 'FF003366' : 'FFFFFFFF'; // dark blue or white
    const fgColorValue = isDark ? 'FFFFFFFF' : title === 'B.D.I.' ? 'FF003366' : 'FF0F172A'; // specific colors
    const borderColor = 'FFCBD5E1'; // slate-300

    // Row 1: Title
    if (sCol !== eCol) worksheet.mergeCells(`${sCol}1:${eCol}1`);
    const titleCell = worksheet.getCell(`${sCol}1`);
    titleCell.value = title.toUpperCase();
    titleCell.font = { bold: true, size: 9, color: { argb: fgColorTitle } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColorTitle } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    
    // Removed Borders as requested
    /*
    for (let i = Math.max(1, startIdx); i <= Math.min(numCols, endIdx); i++) {
        const cell = worksheet.getCell(`${worksheet.getColumn(i).letter}1`);
        cell.border = {
          top: { style: 'thin', color: { argb: borderColor } },
          left: { style: 'thin', color: { argb: borderColor } },
          bottom: { style: 'thin', color: { argb: borderColor } },
          right: { style: 'thin', color: { argb: borderColor } }
        };
    }
    */

    // Row 2-4: Value
    worksheet.mergeCells(`${sCol}2:${eCol}4`);
    const valCell = worksheet.getCell(`${sCol}2`);
    valCell.value = value;
    valCell.font = { bold: isDark || title === 'B.D.I.', size: 10, color: { argb: fgColorValue } };
    valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColorValue } };
    valCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left', indent: 1 };
    
    // Removed Borders as requested
    /*
    for (let r = 2; r <= 4; r++) {
      for (let i = Math.max(1, startIdx); i <= Math.min(numCols, endIdx); i++) {
          const cell = worksheet.getCell(`${worksheet.getColumn(i).letter}${r}`);
          cell.border = {
            top: { style: 'thin', color: { argb: borderColor } },
            left: { style: 'thin', color: { argb: borderColor } },
            bottom: { style: 'thin', color: { argb: borderColor } },
            right: { style: 'thin', color: { argb: borderColor } }
          };
      }
    }
    */
  };

  // Informações da Obra
  createSplitHeader('Obra', data.obraName, 3, colObraEnd);

  // Bancos
  createSplitHeader('Bancos', data.bancos, colObraEnd + 1, colBancosEnd);

  // BDI
  createSplitHeader('B.D.I.', `${data.bdi.toLocaleString('pt-BR')}%`, colBancosEnd + 1, colBdiEnd);

  // Desconto
  createSplitHeader('Desconto', `${data.desconto.toLocaleString('pt-BR')}%`, colBdiEnd + 1, colDescontoEnd);

  // Encargos
  createSplitHeader('Encargos Sociais', data.encargos, colDescontoEnd + 1, colEncargosEnd);
  
  const formattedTotal = `R$ ${data.summary.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Adjust Row 2, 3, 4 height based on the number of non-empty lines in banks
  const numBankLines = Math.max(data.bancos.split('\n').filter(l => l.trim()).length || 1, data.encargos.split('\n').filter(l => l.trim()).length || 1);
  const rowHeight = Math.max(15, (12 * numBankLines) / 3);
  worksheet.getRow(2).height = rowHeight;
  worksheet.getRow(3).height = rowHeight;
  worksheet.getRow(4).height = rowHeight;
  worksheet.getRow(1).height = 20;

  // Título Centralizado
  worksheet.mergeCells(`A5:${lastColLetter}5`);
  const mainTitle = worksheet.getCell('A5');
  mainTitle.value = data.title;
  mainTitle.font = { bold: true, size: 12 };
  mainTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  // Bordas externas aplicadas globalmente no final


  // 2. TABELA DE DADOS (CABEÇALHO DUPLO)
  const headerRow1 = worksheet.getRow(6);
  const headerRow2 = worksheet.getRow(7);
  headerRow1.height = 25;
  headerRow2.height = 25;

  const headerStyle = {
    font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF003366' } },
    alignment: { vertical: 'middle' as const, horizontal: 'center' as const, wrapText: true },
    border: {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    }
  };

  // Mapeamento das colunas para mesclagem
  let currentHeaderCol = 1;

  data.columns.forEach((col) => {
    const startColLetter = worksheet.getColumn(currentHeaderCol).letter;
    const cell1 = headerRow1.getCell(currentHeaderCol);
    const span = col.colspan || 1;
    
    if (col.subgroup && col.keys) {
        // Grupo de colunas
      cell1.value = col.header;
      cell1.style = headerStyle;
      
      const endHeaderCol = currentHeaderCol + col.subgroup.length - 1;
      const endColLetter = worksheet.getColumn(endHeaderCol).letter;
      
      if (startColLetter !== endColLetter) {
        worksheet.mergeCells(`${startColLetter}6:${endColLetter}6`);
      }
      
      col.subgroup.forEach((subHeader, sIdx) => {
        const subCell = headerRow2.getCell(currentHeaderCol + sIdx);
        subCell.value = subHeader;
        subCell.style = headerStyle;
      });
      
      currentHeaderCol += col.subgroup.length;
    } else {
      // Coluna normal: Mescla vertical (ou horizontal tbm se colspan > 1)
      cell1.value = col.header;
      cell1.style = headerStyle;
      const endColLetter = worksheet.getColumn(currentHeaderCol + span - 1).letter;
      
      if (span > 1) {
        worksheet.mergeCells(`${startColLetter}6:${endColLetter}7`);
      } else {
        worksheet.mergeCells(`${startColLetter}6:${startColLetter}7`);
      }
      
      for (let i = 0; i < span; i++) {
        const cell2 = headerRow2.getCell(currentHeaderCol + i);
        cell2.style = headerStyle;
      }
      
      currentHeaderCol += span;
    }
  });

  // Renderização das Linhas
  data.rows.forEach((rowData) => {
    const rowValues: any[] = [];
    data.columns.forEach(col => {
      const span = col.colspan || 1;
      if (col.keys) {
        col.keys.forEach(k => rowValues.push(rowData[k]));
      } else if (col.key) {
        rowValues.push(rowData[col.key]);
        for (let i = 1; i < span; i++) rowValues.push(null);
      } else {
        rowValues.push(null);
        for (let i = 1; i < span; i++) rowValues.push(null);
      }
    });

    const row = worksheet.addRow(rowValues);
    const rowOffset = row.number;
    
    // Merge cell columns with colspan > 1
    let cIdx = 1;
    data.columns.forEach(col => {
      if (col.subgroup) {
        cIdx += col.subgroup.length;
      } else {
        const span = col.colspan || 1;
        if (span > 1) {
          const startColLetter = worksheet.getColumn(cIdx).letter;
          const endColLetter = worksheet.getColumn(cIdx + span - 1).letter;
          worksheet.mergeCells(`${startColLetter}${rowOffset}:${endColLetter}${rowOffset}`);
        }
        cIdx += span;
      }
    });
    
    const isEtapa = rowData.tipo_item === 'etapa' || rowData.isEtapa;

    // Expand formatting to all physical cells
    let physicalColIdx = 0;
    const physicalColDefs: any[] = [];
    data.columns.forEach(col => {
      if (col.subgroup) {
        col.subgroup.forEach(() => physicalColDefs.push(col));
      } else {
        const span = col.colspan || 1;
        for (let i = 0; i < span; i++) physicalColDefs.push(col);
      }
    });

    // Colors and Formatting based on config
    const itemCategory = rowData.itemCategory || (isEtapa ? 'etapa' : 'insumo');
    
    let fillColor = isEtapa ? 'FFFFFFFF' : 'FFF1F5F9'; // default
    let fontColor = 'FF000000'; // default black
    let isBold = isEtapa; // default

    // Convert Hex to ARGB
    const hexToArgb = (hex?: string) => {
      if (!hex) return 'FF000000';
      const clean = hex.replace('#', '');
      return clean.length === 6 ? `FF${clean}`.toUpperCase() : clean.toUpperCase();
    };

    if (data.config) {
      if (itemCategory === 'etapa') {
        fillColor = hexToArgb(data.config.corFundoEtapa) || fillColor;
        fontColor = hexToArgb(data.config.corLetraEtapa) || fontColor;
        isBold = data.config.negritoEtapa !== undefined ? data.config.negritoEtapa : isBold;
      } else if (itemCategory === 'composicao') {
        fillColor = hexToArgb(data.config.corFundoComposicao) || fillColor;
        fontColor = hexToArgb(data.config.corLetraComposicao) || fontColor;
        isBold = data.config.negritoComposicao !== undefined ? data.config.negritoComposicao : isBold;
      } else {
        fillColor = hexToArgb(data.config.corFundoInsumo) || fillColor;
        fontColor = hexToArgb(data.config.corLetraInsumo) || fontColor;
        isBold = data.config.negritoInsumo !== undefined ? data.config.negritoInsumo : isBold;
      }
    }

    row.eachCell((cell, colNumber) => {
        const colDef = physicalColDefs[colNumber - 1];
        if (!colDef) return;
        cell.font = { size: 9, bold: isBold, color: { argb: fontColor } };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        // Alinhamento com Wrap Text para evitar texto escondido
        if (colDef.type === 'currency' || colDef.type === 'number' || colDef.type === 'percentage') {
          cell.alignment = { horizontal: 'right', vertical: 'bottom' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        }

        // Formatação Numérica e Fórmulas
        if (typeof cell.value === 'number') {
          if (colDef.type === 'currency') cell.numFmt = '#,##0.00';
          if (colDef.type === 'percentage') cell.numFmt = '0.00"%"';
          if (colDef.type === 'number') cell.numFmt = '#,##0.00';
          
          if (data.config?.relatoriosComFormulas) {
             // For formulas support: If this was a total row we could set cell.value = {formula: '...'}.
             // But simulating simple formulas by placing the value as result.
             cell.value = { result: cell.value as number, formula: '' } as any; 
             // Without extensive formula mappings, we keep values for now. 
             // Complete formulas requires mapping excel cells (A1:A5)
             cell.value = rowData[colDef.key];
          }
        }

        // Estilo de Fundo
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      });
    });

    // 3. RESUMO FINAL (Total sem BDI, Total BDI, Total Geral)
    if (data.summary) {
      worksheet.addRow([]);
      
      // Encontra a coluna para alinhar os valores (prioriza 'peso' ou a última coluna)
      let pesoPhysicalIdx = -1;
      let totalGeralPhysicalIdx = -1;
      let pIdx = 1;
      
      data.columns.forEach(col => {
        if (col.subgroup && col.keys) {
          col.keys.forEach(k => {
            if (k === 'total_total' || k === 'total_geral') totalGeralPhysicalIdx = pIdx;
            pIdx++;
          });
        } else {
          if (col.key === 'peso') pesoPhysicalIdx = pIdx;
          if (col.key === 'total_geral') totalGeralPhysicalIdx = pIdx;
          pIdx += (col.colspan || 1);
        }
      });
      
      // Se 'total_geral' existir, usamos ela para alinhar os valores em reais (R$). Senão, tenta a última coluna.
      let valCol = totalPhysicalCols; 
      if (totalGeralPhysicalIdx !== -1) {
        valCol = totalGeralPhysicalIdx;
      } else if (pesoPhysicalIdx !== -1) {
        valCol = pesoPhysicalIdx;
      }
      
      const labelCol = Math.max(1, valCol - 2);
      
      const addSummaryRow = (label: string, value: number) => {
        const row = worksheet.addRow([]);
        const rowNum = row.number;
        
        const startLabelCol = worksheet.getColumn(labelCol).letter;
        const endLabelCol = worksheet.getColumn(Math.max(1, valCol - 1)).letter;
        if (startLabelCol !== endLabelCol) {
          worksheet.mergeCells(`${startLabelCol}${rowNum}:${endLabelCol}${rowNum}`);
        }
        
        const labelCell = row.getCell(labelCol);
        labelCell.value = label;
        labelCell.font = { bold: true, size: 10 };
        labelCell.alignment = { horizontal: 'right', vertical: 'bottom' };
        
        const valCell = row.getCell(valCol);
        valCell.value = value;
        valCell.font = { bold: true, size: 10 };
        valCell.numFmt = '#,##0.00';
        valCell.alignment = { horizontal: 'right', vertical: 'bottom' };
        
        // Garante que a coluna do valor tenha largura suficiente para o total
        if ((worksheet.getColumn(valCol).width || 0) < 18) {
          worksheet.getColumn(valCol).width = 18;
        }
      };

      if (!data.config?.retirarInfoBDI) {
        addSummaryRow('Total sem BDI', data.summary.totalSemBdi);
        addSummaryRow('Total do BDI', data.summary.totalBdi);
      }

      if (data.summary.totalDesconto > 0) {
        addSummaryRow('Subtotal', data.summary.totalSemBdi + data.summary.totalBdi);
        addSummaryRow(`Desconto (${(data.desconto || 0).toFixed(2)}%)`, -data.summary.totalDesconto);
      }
      
      addSummaryRow('Total Geral', data.summary.totalGeral);
    }

  // 4. ASSINATURA
  const signRow = worksheet.rowCount + 4;
  
  const assinatura1 = data.config?.assinatura1 || 'Assinatura do Responsável';
  const assinatura2 = data.config?.assinatura2 || '';

  if (assinatura2.trim() !== '') {
    // Duas assinaturas (Lado a Lado)
    // Assinatura 1
    const startCol1 = worksheet.getColumn(Math.max(1, Math.floor(totalPhysicalCols * 0.1))).letter;
    const endCol1 = worksheet.getColumn(Math.max(2, Math.floor(totalPhysicalCols * 0.4))).letter;
    worksheet.mergeCells(`${startCol1}${signRow}:${endCol1}${signRow}`);
    const borderCell1 = worksheet.getCell(`${startCol1}${signRow}`);
    borderCell1.border = { top: { style: 'medium' } };
    worksheet.mergeCells(`${startCol1}${signRow + 1}:${endCol1}${signRow + 1}`);
    const cellSign1 = worksheet.getCell(`${startCol1}${signRow + 1}`);
    cellSign1.value = assinatura1;
    cellSign1.alignment = { horizontal: 'center', wrapText: true, vertical: 'top' };
    worksheet.getRow(signRow + 1).height = 40;

    // Assinatura 2
    const startCol2 = worksheet.getColumn(Math.min(totalPhysicalCols, Math.max(Math.floor(totalPhysicalCols / 2) + 1, Math.floor(totalPhysicalCols * 0.6)))).letter;
    const endCol2 = worksheet.getColumn(Math.min(totalPhysicalCols, Math.max(Math.floor(totalPhysicalCols / 2) + 2, Math.floor(totalPhysicalCols * 0.8)))).letter;
    worksheet.mergeCells(`${startCol2}${signRow}:${endCol2}${signRow}`);
    const borderCell2 = worksheet.getCell(`${startCol2}${signRow}`);
    borderCell2.border = { top: { style: 'medium' } };
    worksheet.mergeCells(`${startCol2}${signRow + 1}:${endCol2}${signRow + 1}`);
    const cellSign2 = worksheet.getCell(`${startCol2}${signRow + 1}`);
    cellSign2.value = assinatura2;
    cellSign2.alignment = { horizontal: 'center', wrapText: true, vertical: 'top' };
  } else {
    // Uma assinatura apenas (Centralizada)
    const midCol = Math.max(2, Math.floor(totalPhysicalCols / 2));
    const startCol = worksheet.getColumn(Math.max(1, midCol - 1)).letter;
    const endCol = worksheet.getColumn(Math.min(totalPhysicalCols, midCol + 1)).letter;
    
    worksheet.mergeCells(`${startCol}${signRow}:${endCol}${signRow}`);
    const borderCell = worksheet.getCell(`${startCol}${signRow}`);
    borderCell.border = { top: { style: 'medium' } };
    worksheet.mergeCells(`${startCol}${signRow + 1}:${endCol}${signRow + 1}`);
    const cellSign = worksheet.getCell(`${startCol}${signRow + 1}`);
    cellSign.value = assinatura1;
    cellSign.alignment = { horizontal: 'center', wrapText: true, vertical: 'top' };
    worksheet.getRow(signRow + 1).height = 40;
  }

  // Ajuste de largura das colunas (Valores refinados com base na necessidade operacional)
  const widthMap: { [key: string]: number } = {
    'item': 8,
    'codigo': 14,
    'banco': 12,
    'descricao': 60,
    'tipo_servico': 20,
    'unidade': 8,
    'quantidade': 12,
    'valor_unit_sem_bdi': 16,
    'valor_unit_com_bdi': 16,
    'mo_total': 16,
    'mo_percent': 10,
    'total_geral': 20,
    'peso': 15
  };

  let currentWidthCol = 1;
  data.columns.forEach((col) => {
    if (col.subgroup && col.keys) {
      col.subgroup.forEach((sub, sIdx) => {
        let width = col.width || widthMap[col.keys![sIdx]] || 12;
        if (col.type === 'currency' || col.keys![sIdx].includes('total') || col.keys![sIdx].includes('valor')) {
          width = Math.max(width, 14);
        }
        worksheet.getColumn(currentWidthCol).width = width;
        currentWidthCol++;
      });
    } else {
      const span = col.colspan || 1;
      let totalWidth = col.width || widthMap[col.key!] || 12;
      if (col.type === 'currency' || col.key === 'total_geral' || col.key === 'valor_unit_com_bdi') {
        totalWidth = Math.max(totalWidth, 18);
      }
      
      // Distribute width evenly among spanned columns
      const widthPerCol = totalWidth / span;
      for (let i = 0; i < span; i++) {
        worksheet.getColumn(currentWidthCol + i).width = widthPerCol;
      }
      currentWidthCol += span;
    }
  });

  // Bloqueando o Excel (travado) - Senha padrao
  if (data.config?.bloquearEdicao !== false) {
    await worksheet.protect('9a64b3330b', {
      selectLockedCells: true,
      selectUnlockedCells: true,
    });
  }

  // Download do Arquivo
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${data.title.replace(/\s+/g, '_')}.xlsx`);
};

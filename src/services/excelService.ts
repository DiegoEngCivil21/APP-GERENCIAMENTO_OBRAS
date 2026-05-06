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
    fitToHeight: 0, // Permite que o relatório cresça verticalmente em múltiplas páginas
    scale: 85, // Reduz a escala para caber melhor e não estourar a página
    margins: {
      left: 0.5, right: 0.5,
      top: 0.5, bottom: 0.5,
      header: 0.2, footer: 0.2
    }
    // printTitlesRow removed as the main header is gone
  };

  const leftHeader = data.config?.cabecalhoEsquerdo ? `&L&10${data.config.cabecalhoEsquerdo}` : '';
  const centerHeader = data.config?.cabecalhoCentral ? `&C&10${data.config.cabecalhoCentral}` : '';
  const rightHeader = data.config?.cabecalhoDireito ? `&R&10${data.config.cabecalhoDireito}` : '';
  
  const leftFooter = data.config?.rodapeEsquerdo ? `&L&10${data.config.rodapeEsquerdo}` : '';
  const centerFooter = data.config?.rodapeCentral ? `&C&10${data.config.rodapeCentral}` : '';
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
  // Respect the actual table width, no hardcoded minimum that exceeds it
  const numCols = totalPhysicalCols; 
  const lastColLetter = worksheet.getColumn(numCols).letter;

  // Distribute columns starting from column 3 (since A and B are for Logo)
  const currentStart = 3;
  const availableCols = Math.max(0, numCols - 2); 
  
  // Initial spans distribution based on ratios
  const distribution = [0.44, 0.22, 0.11, 0.11, 0.12]; // Target indices: 3..6 (Obra), 7..8 (Bancos), 9 (BDI), 10 (Desconto), 11 (Encargos)
  let spans = distribution.map(p => Math.round(availableCols * p));
  
  // Refined for Analytical (where numCols is 11? or availableCols is 9?)
  // Let's re-calculate: numCols = item(1), codigo(2), banco(3), descricao(4), tipo(5), unidade(6), quant(7), unit(8), total(9)
  // Wait, in my previous turns numCols was mentioned as 9 for analytical.
  // indices 1-indexed: 1,2,3,4,5,6,7,8,9
  // If availableCols is 7 (numCols-2), indices 3,4,5,6,7,8,9.
  // Target: Obra (3,4,5,6), Bancos (7,8) -> Col E, F. 
  // Let's check: 3=C, 4=D, 5=E, 6=F, 7=G, 8=H, 9=I.
  // If Bancos is E and F, that's indices 5 and 6.
  // That means Obra should be indices 3 and 4.
  // So spans[0]=2, spans[1]=2.
  if (availableCols === 7) {
    spans = [2, 2, 1, 1, 1]; // 2 (C,D), 2 (E,F), 1 (G), 1 (H), 1 (I)
  }

  // Adjust spans to fit exactly into availableCols
  let sumSpans = spans.reduce((a, b) => a + b, 0);
  if (availableCols > 0 && availableCols !== 7) {
    while (sumSpans > availableCols) {
      const maxIdx = spans.lastIndexOf(Math.max(...spans));
      if (spans[maxIdx] > 1) {
        spans[maxIdx]--;
        sumSpans--;
      } else break;
    }
    while (sumSpans < availableCols) {
      let bestIdx = -1;
      let maxDiff = -Infinity;
      for (let i = 0; i < spans.length; i++) {
        const theoretical = availableCols * distribution[i];
        const diff = theoretical - spans[i];
        if (diff > maxDiff) {
          maxDiff = diff;
          bestIdx = i;
        }
      }
      if (bestIdx !== -1) {
        spans[bestIdx]++;
        sumSpans++;
      } else {
        spans[0]++;
        sumSpans++;
      }
    }
  }

  // Helper function to create separated headers
  const createSplitHeader = (
    title: string, 
    value: string, 
    startIdx: number, 
    span: number,
    isDark: boolean = false
  ) => {
    if (startIdx > numCols || span <= 0) return;
    
    const endIdx = Math.min(numCols, startIdx + span - 1);
    const sCol = worksheet.getColumn(startIdx).letter;
    const eCol = worksheet.getColumn(endIdx).letter;
    
    const bgColorTitle = isDark ? 'FF003366' : 'FFF1F5F9';
    const fgColorTitle = isDark ? 'FFFFFFFF' : 'FF64748B';
    const bgColorValue = 'FFFFFFFF';
    const fgColorValue = 'FF0F172A';
    const borderColor = 'FFE2E8F0'; // slate-200, very light

    // Row 1: Title
    if (sCol !== eCol) worksheet.mergeCells(`${sCol}1:${eCol}1`);
    const titleCell = worksheet.getCell(`${sCol}1`);
    titleCell.value = title.toUpperCase();
    titleCell.font = { bold: true, size: 8, color: { argb: fgColorTitle } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColorTitle } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    titleCell.border = {
      top: { style: 'thin', color: { argb: borderColor } },
      left: { style: 'thin', color: { argb: borderColor } },
      right: { style: 'thin', color: { argb: borderColor } },
      bottom: { style: 'thin', color: { argb: borderColor } }
    };
    
    // Row 2-4: Value
    worksheet.mergeCells(`${sCol}2:${eCol}4`);
    const valCell = worksheet.getCell(`${sCol}2`);
    valCell.value = value;
    valCell.font = { bold: title === 'B.D.I.' || title === 'TOTAL', size: 9, color: { argb: fgColorValue } };
    valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColorValue } };
    valCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left', indent: 1 };
    valCell.border = {
      left: { style: 'thin', color: { argb: borderColor } },
      right: { style: 'thin', color: { argb: borderColor } },
      bottom: { style: 'thin', color: { argb: borderColor } }
    };
  };

  // Informações da Obra
  let runningCol = 3;
  createSplitHeader('Obra', data.obraName, runningCol, spans[0]);
  runningCol += spans[0];

  // Bancos
  createSplitHeader('Bancos', data.bancos, runningCol, spans[1]);
  runningCol += spans[1];

  // BDI
  createSplitHeader('B.D.I.', `${data.bdi.toLocaleString('pt-BR')}%`, runningCol, spans[2]);
  runningCol += spans[2];

  // Desconto
  createSplitHeader('Desconto', `${data.desconto.toLocaleString('pt-BR')}%`, runningCol, spans[3]);
  runningCol += spans[3];

  // Encargos
  createSplitHeader('Encargos Sociais', data.encargos, runningCol, spans[4]);

  
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


  // 2. TABELA DE DADOS
  const hasInnerHeaders = data.rows.some(r => r.isInnerHeader);
  
  if (!hasInnerHeaders) {
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

    let currentHeaderCol = 1;
    data.columns.forEach((col) => {
      const startColLetter = worksheet.getColumn(currentHeaderCol).letter;
      const cell1 = headerRow1.getCell(currentHeaderCol);
      const span = col.colspan || 1;
      
      if (col.subgroup && col.keys) {
        cell1.value = col.header;
        cell1.style = headerStyle;
        const endHeaderCol = currentHeaderCol + col.subgroup.length - 1;
        const endColLetter = worksheet.getColumn(endHeaderCol).letter;
        if (startColLetter !== endColLetter) worksheet.mergeCells(`${startColLetter}6:${endColLetter}6`);
        col.subgroup.forEach((subHeader, sIdx) => {
          const subCell = headerRow2.getCell(currentHeaderCol + sIdx);
          subCell.value = subHeader;
          subCell.style = headerStyle;
        });
        currentHeaderCol += col.subgroup.length;
      } else {
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

    worksheet.pageSetup = {
      ...worksheet.pageSetup,
      printTitlesRow: '6:7'
    };
  }

  // Renderização das Linhas
  data.rows.forEach((rowData) => {
    if (rowData.isInnerHeader) {
      const row = worksheet.addRow([]);
      for (let i = 1; i <= totalPhysicalCols; i++) {
        const cell = row.getCell(i);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // Pure white
      }

      data.columns.forEach((col, idx) => {
        const cell = row.getCell(idx + 1);
        if (col.key === 'item') cell.value = rowData.item;
        else if (col.key === 'codigo' || col.header === 'Código') cell.value = 'Código';
        else if (col.key === 'banco' || col.header === 'Banco') cell.value = 'Banco';
        else if (col.key === 'descricao' || col.header === 'Descrição') cell.value = 'Descrição';
        else if (col.key === 'item_tipo_label' || col.header === 'Tipo') cell.value = 'Tipo';
        else if (col.key === 'unidade' || col.header === 'Und') cell.value = 'Und';
        else if (col.key === 'quantidade' || col.header === 'Quant.') cell.value = 'Quant.';
        else if (col.key === 'valor_unit_sem_bdi' || col.header === 'Valor Unit.') cell.value = 'Valor Unit.';
        else if (col.key === 'total_geral' || col.header === 'Total') cell.value = 'Total';
        
        cell.font = { bold: true, size: 8, color: { argb: 'FF000000' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.border = { 
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } }, 
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } 
        };
      });
      return;
    }

    if (rowData.isFooter) {
       // Row 1: MO sem LS | LS | MO com LS
       const line1 = worksheet.addRow([]);
       const l1Num = line1.number;
       const descIdx = data.columns.findIndex(c => c.key === 'descricao' || c.header === 'Descrição') + 1;
       const startCol = Math.max(1, descIdx);
       worksheet.mergeCells(`${worksheet.getColumn(startCol).letter}${l1Num}:${worksheet.getColumn(totalPhysicalCols).letter}${l1Num}`);
       const c1 = line1.getCell(startCol);
       c1.value = `MO sem LS => R$ ${rowData.mo_sem_ls?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}    LS => R$ ${rowData.ls?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}    MO com LS => R$ ${rowData.mo_com_ls?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
       c1.alignment = { horizontal: 'right' };
       c1.font = { size: 9 };
       
       // Line 2: Valor do BDI | Valor com BDI
       const line2 = worksheet.addRow([]);
       const l2Num = line2.number;
       worksheet.mergeCells(`${worksheet.getColumn(startCol).letter}${l2Num}:${worksheet.getColumn(totalPhysicalCols).letter}${l2Num}`);
       const c2 = line2.getCell(startCol);
       c2.value = `Valor do BDI => R$ ${rowData.valor_bdi?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}    Valor com BDI => R$ ${rowData.valor_com_bdi?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
       c2.alignment = { horizontal: 'right' };
       c2.font = { size: 9 };

       // Line 3: Quant. | Preço Total
       const line3 = worksheet.addRow([]);
       const l3Num = line3.number;
       worksheet.mergeCells(`${worksheet.getColumn(startCol).letter}${l3Num}:${worksheet.getColumn(totalPhysicalCols).letter}${l3Num}`);
       const c3 = line3.getCell(startCol);
       c3.value = `Quant. => ${rowData.quantidade?.toLocaleString('pt-BR', { minimumFractionDigits: 7 })}    Preço Total => R$ ${rowData.preco_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
       c3.alignment = { horizontal: 'right' };
       c3.font = { size: 9, bold: true };

       // Apply styling and thick bottom border to line3
       [line1, line2, line3].forEach(l => {
          for (let i = 1; i <= totalPhysicalCols; i++) {
            const cell = l.getCell(i);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            cell.border = { 
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } }, 
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: l === line3 ? { style: 'medium', color: { argb: 'FF000000' } } : undefined 
            };
          }
       });

       worksheet.addRow([]); // Blank row
       worksheet.lastRow.height = 5;
       worksheet.addRow([]); // Blank row
       worksheet.lastRow.height = 5;
       
       // Removed forced page break management
       return; 
    }

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

    // Apply indentation for depth (analytical)
    if (rowData.depth > 1) {
       const descColIdx = data.columns.findIndex(c => c.key === 'descricao') + 1;
       if (descColIdx > 0) {
          const descCell = row.getCell(descColIdx);
          descCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: (rowData.depth - 1) * 2 };
       }
    }
    
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
    const depth = rowData.depth || 1;
    
    let fillColor = isEtapa ? 'FFDCE6F2' : 'FFFFFFFF'; // Default blue for etapa
    if (itemCategory === 'main-composition') fillColor = 'FFEBF1DE'; // Light green for main composition
    else if (itemCategory === 'main-insumo') fillColor = 'FFFFF9E6'; // Light yellow/cream for root insumo
    else if (itemCategory === 'auxiliary-composition') fillColor = 'FFD9D9D9'; // Grey
    else if (itemCategory === 'child-insumo') fillColor = 'FFF2F2F2'; // Light grey

    let fontColor = 'FF000000'; // default black
    let isBold = isEtapa || itemCategory === 'main-composition' || itemCategory === 'main-insumo'; 

    // Convert Hex to ARGB
    const hexToArgb = (hex?: string) => {
      if (!hex) return 'FF000000';
      const clean = hex.replace('#', '');
      return clean.length === 6 ? `FF${clean}`.toUpperCase() : clean.toUpperCase();
    };

    if (data.config && !rowData.itemCategory?.includes('main-') && !rowData.itemCategory?.includes('auxiliary-') && !rowData.itemCategory?.includes('child-')) {
      if (itemCategory === 'etapa') {
        fillColor = hexToArgb(data.config.corFundoEtapa) || fillColor;
        fontColor = hexToArgb(data.config.corLetraEtapa) || fontColor;
        isBold = data.config.negritoEtapa !== undefined ? data.config.negritoEtapa : isBold;
      } else if (itemCategory === 'composicao') {
        fillColor = hexToArgb(data.config.corFundoComposicao) || fillColor;
        fontColor = hexToArgb(data.config.corLetraComposicao) || fontColor;
        isBold = data.config.negritoComposicao !== undefined ? data.config.negritoComposicao : isBold;
      } else if (itemCategory === 'insumo') {
        fillColor = hexToArgb(data.config.corFundoInsumo) || fillColor;
        fontColor = hexToArgb(data.config.corLetraInsumo) || fontColor;
        isBold = data.config.negritoInsumo !== undefined ? data.config.negritoInsumo : isBold;
      }
    }

    row.eachCell((cell, colNumber) => {
        const colDef = physicalColDefs[colNumber - 1];
        if (!colDef) return;
        cell.font = { size: isEtapa ? 9 : 8, bold: isBold, color: { argb: fontColor } };
        cell.border = {
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'hair', color: { argb: 'FFCBD5E1' } }
        };

        // Indentation for analytical children handled earlier via alignment update but let's re-verify
        const existingAlign = cell.alignment || {};
        if (colDef.type === 'currency' || colDef.type === 'number' || colDef.type === 'percentage') {
          cell.alignment = { ...existingAlign, horizontal: 'right', vertical: 'middle' };
        } else {
          cell.alignment = { ...existingAlign, horizontal: 'left', vertical: 'middle', wrapText: true };
        }

        // Formatação Numérica e Fórmulas
        if (typeof cell.value === 'number' || (typeof cell.value === 'object' && cell.value !== null && 'result' in cell.value)) {
          if (colDef.type === 'currency') cell.numFmt = '#,##0.00';
          if (colDef.type === 'percentage') cell.numFmt = '0.00"%"';
          if (colDef.type === 'number') {
            if (colDef.key === 'quantidade') cell.numFmt = '#,##0.0000000';
            else cell.numFmt = '#,##0.00';
          }
          
          if (data.config?.relatoriosComFormulas && colDef.key) {
             cell.value = { result: cell.value as any, formula: '' } as any; 
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
    'item': 18,
    'codigo': 8,
    'banco': 12,
    'descricao': 75,
    'tipo_servico': 20,
    'unidade': 8,
    'quantidade': 18,
    'valor_unit_sem_bdi': 18,
    'valor_unit_com_bdi': 18,
    'mo_total': 18,
    'mo_percent': 10,
    'total_geral': 22,
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

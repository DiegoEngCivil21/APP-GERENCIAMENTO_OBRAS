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
    margins: {
      left: 0.3, right: 0.3,
      top: 0.4, bottom: 0.4,
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
  
  // Final spans distribution: strictly proportional to ensure we always cover the full width
  let spans = [0, 0, 0, 0, 0];
  if (availableCols > 0) {
    // Ratios: Obra (40%), Bancos (20%), BDI (10%), Desconto (10%), Encargos (20%)
    const ratios = [0.4, 0.2, 0.1, 0.1, 0.2];
    spans = ratios.map(p => Math.max(1, Math.floor(availableCols * p)));
    
    let currentSum = spans.reduce((a, b) => a + b, 0);
    
    // Adjust logic to match exactly availableCols
    if (currentSum > availableCols) {
      // Squeeze from largest spans first
      while (currentSum > availableCols) {
        let maxIdx = 0;
        for (let i = 1; i < spans.length; i++) if (spans[i] > spans[maxIdx]) maxIdx = i;
        if (spans[maxIdx] > 1) {
          spans[maxIdx]--;
          currentSum--;
        } else break;
      }
    } else if (currentSum < availableCols) {
      // Add to the main "Obra" span (spans[0])
      spans[0] += (availableCols - currentSum);
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
        const endHeaderCol = currentHeaderCol + col.subgroup.length - 1;
        const endColLetter = worksheet.getColumn(endHeaderCol).letter;
        
        // Apply style and basic alignment to all cells in the potential merge range before merging
        for (let i = currentHeaderCol; i <= endHeaderCol; i++) {
          headerRow1.getCell(i).style = headerStyle;
        }

        if (startColLetter !== endColLetter) worksheet.mergeCells(`${startColLetter}6:${endColLetter}6`);
        
        col.subgroup.forEach((subHeader, sIdx) => {
          const subCell = headerRow2.getCell(currentHeaderCol + sIdx);
          subCell.value = subHeader;
          subCell.style = headerStyle;
        });
        currentHeaderCol += col.subgroup.length;
      } else {
        cell1.value = col.header;
        const endColIdx = currentHeaderCol + span - 1;
        const endColLetter = worksheet.getColumn(endColIdx).letter;
        
        // Apply style to all cells involved in the merge for this column
        for (let i = currentHeaderCol; i <= endColIdx; i++) {
          headerRow1.getCell(i).style = headerStyle;
          headerRow2.getCell(i).style = headerStyle;
        }

        if (span > 1 || true) { // Always merge vertically for 6:7 if no subgroup
          worksheet.mergeCells(`${startColLetter}6:${endColLetter}7`);
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

    for (let colNumber = 1; colNumber <= totalPhysicalCols; colNumber++) {
        const cell = row.getCell(colNumber);
        const colDef = physicalColDefs[colNumber - 1];
        if (!colDef) continue;
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
            cell.numFmt = '#,##0.00';
          }
          
          if (data.config?.relatoriosComFormulas && colDef.key) {
             cell.value = { result: cell.value as any, formula: '' } as any; 
             cell.value = rowData[colDef.key];
          }
        }

        // Estilo de Fundo
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      }
    });

    // 3. RESUMO FINAL (Total sem BDI, Total BDI, Total Geral)
    if (data.summary) {
      worksheet.addRow([]);
      
      // Sempre alinhar com a última coluna, conforme solicitado
      const valCol = totalPhysicalCols;
      let labelCol = Math.max(1, valCol - 2);
      
      // Ajuste para não sobrepor colunas muito pequenas
      if (valCol === totalPhysicalCols && data.columns.find(c => c.key === 'peso') && !data.config?.retirarColunaPeso) {
        labelCol = Math.max(1, valCol - 2);
      } else {
          labelCol = Math.max(1, valCol - 1);
      }
      
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
  const signRow = worksheet.rowCount + 12;
  
  const assinatura1 = data.config?.assinatura1 || 'Assinatura do Responsável';
  const assinatura2 = data.config?.assinatura2 || '';

  if (assinatura2.trim() !== '') {
    // Symmetrical positioning with identical width for both fields
    const span = Math.max(4, Math.floor(totalPhysicalCols * 0.30));
    
    // Signature 1 (Left Side)
    const startIdx1 = Math.max(1, Math.floor(totalPhysicalCols * 0.10));
    const endIdx1 = startIdx1 + span - 1;
    const startCol1 = worksheet.getColumn(startIdx1).letter;
    const endCol1 = worksheet.getColumn(endIdx1).letter;
    
    worksheet.mergeCells(`${startCol1}${signRow}:${endCol1}${signRow}`);
    const borderCell1 = worksheet.getCell(`${startCol1}${signRow}`);
    borderCell1.border = { top: { style: 'medium' } };
    worksheet.mergeCells(`${startCol1}${signRow + 1}:${endCol1}${signRow + 1}`);
    const cellSign1 = worksheet.getCell(`${startCol1}${signRow + 1}`);
    cellSign1.value = assinatura1;
    cellSign1.alignment = { horizontal: 'center', wrapText: true, vertical: 'top' };

    // Signature 2 (Right Side) - Perfectly symmetrical
    const endIdx2 = Math.min(totalPhysicalCols, Math.ceil(totalPhysicalCols * 0.90));
    const startIdx2 = endIdx2 - span + 1;
    const startCol2 = worksheet.getColumn(startIdx2).letter;
    const endCol2 = worksheet.getColumn(endIdx2).letter;
    
    worksheet.mergeCells(`${startCol2}${signRow}:${endCol2}${signRow}`);
    const borderCell2 = worksheet.getCell(`${startCol2}${signRow}`);
    borderCell2.border = { top: { style: 'medium' } };
    worksheet.mergeCells(`${startCol2}${signRow + 1}:${endCol2}${signRow + 1}`);
    const cellSign2 = worksheet.getCell(`${startCol2}${signRow + 1}`);
    cellSign2.value = assinatura2;
    cellSign2.alignment = { horizontal: 'center', wrapText: true, vertical: 'top' };
    
    worksheet.getRow(signRow + 1).height = 40;
  } else {
    // Single signature perfectly centered on the sheet axis
    const spanWidth = Math.max(4, Math.floor(totalPhysicalCols * 0.4));
    const startIdx = Math.max(1, Math.floor((totalPhysicalCols - spanWidth) / 2) + 1);
    const endIdx = Math.min(totalPhysicalCols, startIdx + spanWidth - 1);
    
    const startCol = worksheet.getColumn(startIdx).letter;
    const endCol = worksheet.getColumn(endIdx).letter;
    
    worksheet.mergeCells(`${startCol}${signRow}:${endCol}${signRow}`);
    const borderCell = worksheet.getCell(`${startCol}${signRow}`);
    borderCell.border = { top: { style: 'medium' } };
    worksheet.mergeCells(`${startCol}${signRow + 1}:${endCol}${signRow + 1}`);
    const cellSign = worksheet.getCell(`${startCol}${signRow + 1}`);
    cellSign.value = assinatura1;
    cellSign.alignment = { horizontal: 'center', wrapText: true, vertical: 'top' };
    worksheet.getRow(signRow + 1).height = 40;
  }

  // Ajuste de largura das colunas (Otimizado para manter largura útil da folha em A4 Paisagem)
  const widthMap: { [key: string]: number } = {
    'item': 12,
    'codigo': 12,
    'banco': 10,
    'descricao': 72,
    'tipo_servico': 15,
    'unidade': 7,
    'quantidade': 14,
    'valor_unit_sem_bdi': 16,
    'valor_unit_com_bdi': 16,
    'mo_total': 16,
    'mo_percent': 9,
    'total_geral': 18,
    'peso': 10
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

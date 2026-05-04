import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface ExcelReportData {
  title: string;
  obraName: string;
  cliente: string;
  bancos: string;
  bdi: number;
  encargos: string;
  columns: { header: string; key: string; width: number; type?: 'currency' | 'number' | 'percentage' | 'text' }[];
  rows: any[];
  summary?: {
    totalSemBdi: number;
    totalBdi: number;
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
      left: 0.2, right: 0.2,
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
  const logoCell = worksheet.getCell('A1');
  logoCell.value = 'LOGO';
  logoCell.alignment = { vertical: 'middle', horizontal: 'center' };
  logoCell.font = { bold: true, size: 12, color: { argb: 'FF94a3b8' } };
  // Sem bordas no logo conforme solicitado

  // Estilo padrão para células do cabeçalho
  const headerInfoStyle: Partial<ExcelJS.Style> = {
    alignment: { wrapText: true, vertical: 'top', horizontal: 'left' }
  };

  // Informações da Obra
  worksheet.mergeCells('C1:F2');
  const c1 = worksheet.getCell('C1');
  c1.value = { richText: [{ font: { bold: true, size: 10 }, text: 'Obra\n' }, { font: { size: 10 }, text: data.obraName }] };
  c1.style = headerInfoStyle;

  // Bancos
  worksheet.mergeCells('G1:I2');
  const g1 = worksheet.getCell('G1');
  g1.value = { richText: [{ font: { bold: true, size: 10 }, text: 'Bancos\n' }, { font: { size: 9 }, text: data.bancos }] };
  g1.style = headerInfoStyle;

  // BDI
  worksheet.mergeCells('J1:J2');
  const j1 = worksheet.getCell('J1');
  j1.value = { richText: [{ font: { bold: true, size: 10 }, text: 'B.D.I.\n' }, { font: { size: 10 }, text: `${data.bdi.toLocaleString('pt-BR')}%` }] };
  j1.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };

  // Encargos
  worksheet.mergeCells('K1:M2');
  const k1 = worksheet.getCell('K1');
  k1.value = { richText: [{ font: { bold: true, size: 10 }, text: 'Encargos Sociais\n' }, { font: { size: 9 }, text: data.encargos }] };
  k1.style = headerInfoStyle;

  // Título Centralizado
  worksheet.mergeCells('A5:M5');
  const mainTitle = worksheet.getCell('A5');
  mainTitle.value = data.title;
  mainTitle.font = { bold: true, size: 12 };
  mainTitle.alignment = { horizontal: 'center', vertical: 'middle' };

  // 2. TABELA DE DADOS (CABEÇALHO DUPLO)
  const headerRow1 = worksheet.getRow(7);
  const headerRow2 = worksheet.getRow(8);
  headerRow1.height = 25;
  headerRow2.height = 25;

  const standardStyle = {
    font: { bold: true, size: 9 },
    alignment: { vertical: 'middle' as const, horizontal: 'center' as const, wrapText: true },
    border: {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    }
  };

  // Mapeamento das colunas para mesclagem
  // Usamos as chaves das colunas para identificar onde mesclar
  data.columns.forEach((col, idx) => {
    const colLetter = worksheet.getColumn(idx + 1).letter;
    const cell1 = headerRow1.getCell(idx + 1);
    const cell2 = headerRow2.getCell(idx + 1);

    if (col.key === 'mo_total') {
      // Início da seção Mão de Obra
      cell1.value = 'Mão de Obra';
      cell1.style = standardStyle;
      // Mescla horizontal (esta e a próxima)
      worksheet.mergeCells(`${colLetter}7:${worksheet.getColumn(idx + 2).letter}7`);
      
      // Sub-headers na linha 8
      cell2.value = 'Valor';
      cell2.style = standardStyle;
    } else if (col.key === 'mo_percent') {
      // Segunda parte da Mão de Obra
      cell2.value = '%';
      cell2.style = standardStyle;
      // O cell1 aqui já está mesclado
    } else {
      // Colunas normais: Mescla vertical
      cell1.value = col.header;
      cell1.style = standardStyle;
      cell2.style = standardStyle;
      worksheet.mergeCells(`${colLetter}7:${colLetter}8`);
    }
  });

  // Renderização das Linhas
  data.rows.forEach((rowData) => {
    const rowValues = data.columns.map(col => rowData[col.key]);
    const row = worksheet.addRow(rowValues);
    
    const isEtapa = rowData.tipo_item === 'etapa' || rowData.isEtapa;

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
        const colDef = data.columns[colNumber - 1];
        
        cell.font = { size: 9, bold: isBold, color: { argb: fontColor } };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        // Alinhamento com Wrap Text para evitar texto escondido
        if (colDef.type === 'currency' || colDef.type === 'number' || colDef.type === 'percentage') {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
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
      
      // Tenta encontrar a coluna 'total_geral' para alinhar os valores
      const totalGeralIdx = data.columns.findIndex(c => c.key === 'total_geral');
      const valCol = totalGeralIdx !== -1 ? totalGeralIdx + 1 : data.columns.length;
      const labelCol = valCol - 1;
      
      const addSummaryRow = (label: string, value: number) => {
        const row = worksheet.addRow([]);
        const labelCell = row.getCell(labelCol);
        labelCell.value = label;
        labelCell.font = { bold: true, size: 10 };
        labelCell.alignment = { horizontal: 'right' };
        
        const valCell = row.getCell(valCol);
        valCell.value = value;
        valCell.font = { bold: true, size: 10 };
        valCell.numFmt = '#,##0.00';
        valCell.alignment = { horizontal: 'right' };
        
        // Garante que a coluna do valor tenha largura suficiente para o total
        if (worksheet.getColumn(valCol).width < 20) {
          worksheet.getColumn(valCol).width = 20;
        }
      };

      if (!data.config?.retirarInfoBDI) {
        addSummaryRow('Total sem BDI', data.summary.totalSemBdi);
        addSummaryRow('Total do BDI', data.summary.totalBdi);
      }
      addSummaryRow('Total Geral', data.summary.totalGeral);
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

  data.columns.forEach((col, idx) => {
    let width = widthMap[col.key] || col.width || 12;
    // Garante largura mínima para colunas financeiras ou de total para evitar #########
    if (col.type === 'currency' || col.key === 'total_geral' || col.key === 'valor_unit_com_bdi') {
      width = Math.max(width, 18);
    }
    worksheet.getColumn(idx + 1).width = width;
  });

  // 4. ASSINATURA
  const signRow = worksheet.rowCount + 4;
  
  const assinatura1 = data.config?.assinatura1 || 'Assinatura do Responsável';
  const assinatura2 = data.config?.assinatura2 || '';
  
  const numCols = data.columns.length;

  if (assinatura2.trim() !== '') {
    // Duas assinaturas (Lado a Lado)
    // Assinatura 1
    const startCol1 = worksheet.getColumn(Math.max(2, Math.floor(numCols * 0.2))).letter;
    const endCol1 = worksheet.getColumn(Math.max(4, Math.floor(numCols * 0.4))).letter;
    worksheet.mergeCells(`${startCol1}${signRow}:${endCol1}${signRow}`);
    const borderCell1 = worksheet.getCell(`${startCol1}${signRow}`);
    borderCell1.border = { top: { style: 'thin' } };
    worksheet.mergeCells(`${startCol1}${signRow + 1}:${endCol1}${signRow + 1}`);
    const cellSign1 = worksheet.getCell(`${startCol1}${signRow + 1}`);
    cellSign1.value = assinatura1;
    cellSign1.alignment = { horizontal: 'center', wrapText: true, vertical: 'top' };
    worksheet.getRow(signRow + 1).height = 40;

    // Assinatura 2
    const startCol2 = worksheet.getColumn(Math.max(5, Math.floor(numCols * 0.6))).letter;
    const endCol2 = worksheet.getColumn(Math.max(8, Math.floor(numCols * 0.8))).letter;
    worksheet.mergeCells(`${startCol2}${signRow}:${endCol2}${signRow}`);
    const borderCell2 = worksheet.getCell(`${startCol2}${signRow}`);
    borderCell2.border = { top: { style: 'thin' } };
    worksheet.mergeCells(`${startCol2}${signRow + 1}:${endCol2}${signRow + 1}`);
    const cellSign2 = worksheet.getCell(`${startCol2}${signRow + 1}`);
    cellSign2.value = assinatura2;
    cellSign2.alignment = { horizontal: 'center', wrapText: true, vertical: 'top' };
  } else {
    // Uma assinatura apenas (Centralizada)
    const midCol = Math.floor(numCols / 2);
    const startCol = worksheet.getColumn(Math.max(2, midCol - 1)).letter;
    const endCol = worksheet.getColumn(Math.min(numCols - 1, midCol + 2)).letter;
    
    worksheet.mergeCells(`${startCol}${signRow}:${endCol}${signRow}`);
    const borderCell = worksheet.getCell(`${startCol}${signRow}`);
    borderCell.border = { top: { style: 'thin' } };
    worksheet.mergeCells(`${startCol}${signRow + 1}:${endCol}${signRow + 1}`);
    const cellSign = worksheet.getCell(`${startCol}${signRow + 1}`);
    cellSign.value = assinatura1;
    cellSign.alignment = { horizontal: 'center', wrapText: true, vertical: 'top' };
    worksheet.getRow(signRow + 1).height = 40;
  }

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

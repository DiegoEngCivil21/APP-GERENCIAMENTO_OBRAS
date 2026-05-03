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
}

export const generateExcelReport = async (data: ExcelReportData) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Orçamento');
  
  // --- CONFIGURAÇÃO DE IMPRESSÃO E VISUALIZAÇÃO ---
  worksheet.views = [{ 
    showGridLines: false,
    view: 'pageBreakPreview', // Abre com visão de quebra de página
    zoomScale: 100
  } as any];

  worksheet.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape', // Página deitada
    fitToPage: true,
    fitToWidth: 1, // Garante que caiba todas as colunas em 1 página de largura
    fitToHeight: 0, // Altura livre (serão quantas páginas forem necessárias)
    margins: {
      left: 0.5, right: 0.5,
      top: 0.5, bottom: 0.7,
      header: 0.3, footer: 0.3
    },
    printTitlesRow: '7:8' // Repete o cabeçalho da tabela em todas as páginas
  };

  // Rodapé de Impressão (Página X de Y)
  worksheet.headerFooter.oddFooter = '&C&"Arial,Italic"&8Engineering Pro - &P de &N';

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

    row.eachCell((cell, colNumber) => {
      const colDef = data.columns[colNumber - 1];
      
      cell.font = { size: 9, bold: isEtapa };
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

      // Formatação Numérica
      if (typeof cell.value === 'number') {
        if (colDef.type === 'currency') cell.numFmt = '#,##0.00';
        if (colDef.type === 'percentage') cell.numFmt = '0.00"%"';
        if (colDef.type === 'number') cell.numFmt = '#,##0.00';
      }

      // Estilo de Fundo (Conforme solicitado, mantendo as cores do sistema)
      const fillColor = rowData.rowColor || (isEtapa ? 'FFFFFFFF' : 'FFF1F5F9');
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
    });
  });

  // 3. RESUMO FINAL (Total sem BDI, Total BDI, Total Geral)
  if (data.summary) {
    worksheet.addRow([]);
    const startCol = data.columns.length - 1; // Ajustado para a penúltima/última coluna
    
    const addSummaryRow = (label: string, value: number) => {
      const row = worksheet.addRow([]);
      const labelCell = row.getCell(startCol);
      labelCell.value = label;
      labelCell.font = { bold: true };
      labelCell.alignment = { horizontal: 'right' };
      
      const valCell = row.getCell(startCol + 1);
      valCell.value = value;
      valCell.font = { bold: true };
      valCell.numFmt = '#,##0.00';
      valCell.alignment = { horizontal: 'right' };
    };

    addSummaryRow('Total sem BDI', data.summary.totalSemBdi);
    addSummaryRow('Total do BDI', data.summary.totalBdi);
    addSummaryRow('Total Geral', data.summary.totalGeral);
  }

  // Ajuste de largura das colunas (Valores refinados com base na necessidade operacional)
  const widthMap: { [key: string]: number } = {
    'item': 6,
    'codigo': 12,
    'banco': 10,
    'descricao': 55,
    'tipo_servico': 18,
    'unidade': 6,
    'quantidade': 10,
    'valor_unit_sem_bdi': 12,
    'valor_unit_com_bdi': 13,
    'mo_total': 13,
    'mo_percent': 8,
    'total_geral': 16,
    'peso': 8
  };

  data.columns.forEach((col, idx) => {
    worksheet.getColumn(idx + 1).width = widthMap[col.key] || col.width || 12;
  });

  // 4. ASSINATURA
  const signRow = worksheet.rowCount + 4;
  worksheet.mergeCells(`E${signRow}:I${signRow}`);
  const borderCell = worksheet.getCell(`E${signRow}`);
  borderCell.border = { top: { style: 'thin' } };
  
  worksheet.mergeCells(`E${signRow + 1}:I${signRow + 1}`);
  worksheet.getCell(`E${signRow + 1}`).value = 'Assinatura do Responsável';
  worksheet.getCell(`E${signRow + 1}`).alignment = { horizontal: 'center' };

  // Download do Arquivo
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${data.title.replace(/\s+/g, '_')}.xlsx`);
};

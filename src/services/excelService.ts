import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface ExcelReportData {
  title: string;
  obraName: string;
  cliente: string;
  columns: { header: string; key: string; width: number; type?: 'currency' | 'number' | 'text' }[];
  rows: any[];
  summaryValues?: { label: string; value: number }[];
}

export const generateExcelReport = async (data: ExcelReportData) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(data.title.substring(0, 31)); // Excel sheet name limit

  // --- CONFIGURAÇÃO DE ESTILOS ---
  const colors = {
    primary: 'FF0F172A',     // Slate 900
    secondary: 'FF475569',   // Slate 600
    accent: 'FF10B981',      // Emerald 500
    background: 'FFF8FAFC',  // Slate 50
    border: 'FFCBD5E1',      // Slate 300
    white: 'FFFFFFFF'
  };

  // 1. CABEÇALHO PROFISSIONAL
  // Espaço para Logo
  worksheet.mergeCells('A1:B4');
  const logoCell = worksheet.getCell('A1');
  logoCell.value = 'LOGO EMPRESA';
  logoCell.alignment = { vertical: 'middle', horizontal: 'center' };
  logoCell.font = { bold: true, size: 12, color: { argb: 'FF94a3b8' } };
  logoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.background } };
  logoCell.border = {
    top: { style: 'thin', color: { argb: colors.border } },
    left: { style: 'thin', color: { argb: colors.border } },
    bottom: { style: 'thin', color: { argb: colors.border } },
    right: { style: 'thin', color: { argb: colors.border } }
  };

  // Título do Relatório
  worksheet.mergeCells('C1:I2');
  const titleCell = worksheet.getCell('C1');
  titleCell.value = data.title.toUpperCase();
  titleCell.font = { bold: true, size: 16, color: { argb: colors.primary } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Informações da Obra e Data
  worksheet.mergeCells('C3:G3');
  const obraCell = worksheet.getCell('C3');
  obraCell.value = `OBRA: ${data.obraName || 'N/A'}`;
  obraCell.font = { bold: true, size: 10, color: { argb: colors.secondary } };

  worksheet.mergeCells('H3:I3');
  const dateCell = worksheet.getCell('H3');
  dateCell.value = `EMISSÃO: ${new Date().toLocaleDateString('pt-BR')}`;
  dateCell.font = { size: 9, color: { argb: colors.secondary } };
  dateCell.alignment = { horizontal: 'right' };

  worksheet.mergeCells('C4:I4');
  const clientCell = worksheet.getCell('C4');
  clientCell.value = `CLIENTE: ${data.cliente || 'N/A'}`;
  clientCell.font = { size: 10, color: { argb: colors.secondary } };

  worksheet.addRow([]); // Espaçador

  // 2. CORPO DO RELATÓRIO (TABELA)
  const headerRow = worksheet.addRow(data.columns.map(col => col.header));
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } };
    cell.font = { bold: true, color: { argb: colors.white }, size: 9 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Renderização das Linhas
  data.rows.forEach((rowData, index) => {
    const row = worksheet.addRow(data.columns.map(col => {
      // Se for um item de "Etapa" (negrito), tratamos depois
      return rowData[col.key];
    }));
    
    row.height = 22;
    const isStage = rowData.tipo === 'etapa' || rowData.isEtapa;

    row.eachCell((cell, colNumber) => {
      const colDef = data.columns[colNumber - 1];
      
      // Formatação Básica
      cell.font = { size: 9, bold: isStage, color: { argb: isStage ? colors.primary : 'FF334155' } };
      cell.alignment = { vertical: 'middle', horizontal: colDef.type === 'currency' || colDef.type === 'number' ? 'right' : 'left' };
      
      // Formatação de Moeda Nativa do Excel
      if (colDef.type === 'currency' && typeof cell.value === 'number') {
        cell.numFmt = '"R$ "#,##0.00';
      }

      // Estilo de Etapa
      if (isStage) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      }

      cell.border = { bottom: { style: 'hair', color: { argb: colors.border } } };
    });
  });

  // 3. RESUMO / TOTAIS NO FINAL
  if (data.summaryValues && data.summaryValues.length > 0) {
    worksheet.addRow([]);
    data.summaryValues.forEach(sum => {
      const sRow = worksheet.addRow(['', '', '', '', sum.label, sum.value]);
      sRow.getCell(5).font = { bold: true, size: 10 };
      sRow.getCell(5).alignment = { horizontal: 'right' };
      const valCell = sRow.getCell(6);
      valCell.font = { bold: true, size: 11, color: { argb: colors.accent } };
      valCell.numFmt = '"R$ "#,##0.00';
      valCell.alignment = { horizontal: 'right' };
    });
  }

  // Ajuste de largura das colunas
  data.columns.forEach((col, idx) => {
    worksheet.getColumn(idx + 1).width = col.width || 15;
  });

  // 4. RODAPÉ FIXO
  const footerRowNumber = worksheet.rowCount + 2;
  worksheet.mergeCells(`A${footerRowNumber}:I${footerRowNumber}`);
  const footerCell = worksheet.getCell(`A${footerRowNumber}`);
  footerCell.value = `Relatório gerado via Engineering Pro - Página 1 de 1`;
  footerCell.font = { italic: true, size: 8, color: { argb: colors.secondary } };
  footerCell.alignment = { horizontal: 'center' };

  // Download do Arquivo
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${data.title.replace(/\s+/g, '_')}_${data.obraName.replace(/\s+/g, '_')}.xlsx`);
};

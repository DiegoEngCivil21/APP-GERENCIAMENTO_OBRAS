import React from 'react';
import { FileText, Download, CheckCircle2, AlertCircle, ArrowRight, FileSpreadsheet, Database } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from './UIComponents';
import ExcelJS from 'exceljs';

const TemplatesView = () => {
  const steps = [
    {
      title: '1. Importação de Insumos',
      description: 'O primeiro passo é sempre importar os insumos. As composições dependem dos códigos dos insumos para existirem.',
      icon: Database,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
      details: [
        'Certifique-se de que todos os insumos da SINAPI/ORSE estão presentes.',
        'O código do insumo deve ser único.',
        'Valores devem estar formatados com ponto decimal.'
      ]
    },
    {
      title: '2. Importação de Composições',
      description: 'Após os insumos estarem no banco, você pode importar as composições que utilizam esses insumos.',
      icon: FileText,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      details: [
        'A composição deve referenciar códigos de insumos já existentes.',
        'O coeficiente (consumo) determina o valor total da composição.',
        'Mantenha a estrutura de colunas idêntica ao template.'
      ]
    },
    {
      title: '3. Verificação de Integridade',
      description: 'O sistema valida automaticamente se todos os itens da composição existem no banco de insumos.',
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      details: [
        'Itens não encontrados serão destacados no log de importação.',
        'Valores totais são recalculados com base nos preços atuais dos insumos.',
        'Garante que seu orçamento reflita a realidade do mercado.'
      ]
    }
  ];

  const templates = [
    {
      name: 'Template de Insumos (Excel)',
      description: 'Estrutura padrão para importação em massa de insumos com preços e unidades.',
      type: 'XLSX',
      icon: FileSpreadsheet,
      color: 'text-emerald-600'
    },
    {
      name: 'Template de Composições (Excel)',
      description: 'Estrutura para vincular insumos a composições e definir coeficientes.',
      type: 'XLSX',
      icon: FileSpreadsheet,
      color: 'text-blue-600'
    },
    {
      name: 'Guia de Importação (PDF)',
      description: 'Manual detalhado com regras de formatação e dicas para evitar erros.',
      type: 'PDF',
      icon: FileText,
      color: 'text-red-600'
    }
  ];

  const handleDownload = async (templateName: string) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template');
    let fileName = '';

    // Estilos Base
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }, // Slate 900
      alignment: { vertical: 'middle', horizontal: 'center' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    const rowStyle: Partial<ExcelJS.Style> = {
      alignment: { vertical: 'middle', horizontal: 'left' },
      border: {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      }
    };

    if (templateName.includes('Insumos')) {
      fileName = 'template_importacao_insumos.xlsx';
      
      // Cabeçalho da Logo/Sistema
      worksheet.mergeCells('A1:I1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'SISTEMA DE GESTÃO DE OBRAS - TEMPLATE DE INSUMOS';
      titleCell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } }, // Orange 500
        alignment: { horizontal: 'center', vertical: 'middle' }
      };
      worksheet.getRow(1).height = 30;

      const columns = [
        { header: 'Banco', key: 'base', width: 12 },
        { header: 'Código', key: 'codigo', width: 15 },
        { header: 'Descrição do Insumo', key: 'descricao', width: 50 },
        { header: 'Unidade', key: 'unidade', width: 10 },
        { header: 'Tipo', key: 'tipo', width: 15 },
        { header: 'Data Base', key: 'data', width: 18 },
        { header: 'Valor Não Desonerado', key: 'valor_nao_desonerado', width: 22 },
        { header: 'Valor Desonerado', key: 'valor_desonerado', width: 18 },
      ];

      worksheet.getRow(2).values = columns.map(c => c.header);
      worksheet.columns = columns;

      // Aplicar estilos ao cabeçalho (Linha 2)
      worksheet.getRow(2).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Dados de Exemplo
      const examples = [
        ['SINAPI', '00001234', 'CIMENTO PORTLAND CP II-32', 'KG', 'Material', '01/2024', 0.92, 0.85],
        ['ORSE', '00123', 'AREIA MEDIA - POSTO JAZIDA', 'M3', 'Material', '01/2024', 92.50, 85.00]
      ];

      examples.forEach((ex, i) => {
        const row = worksheet.addRow(ex);
        row.eachCell((cell) => {
          cell.style = rowStyle;
          // Formatar colunas G (Valor Não Desonerado) e H (Valor Desonerado) como moeda
          if (cell.address.match(/^[GH]\d+$/)) {
            cell.numFmt = '"R$ "#,##0.00';
          }
        });
      });

    } else if (templateName.includes('Composições')) {
      fileName = 'template_importacao_composicoes.xlsx';

      worksheet.mergeCells('A1:J1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'SISTEMA DE GESTÃO DE OBRAS - TEMPLATE DE COMPOSIÇÕES';
      titleCell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }, // Blue 500
        alignment: { horizontal: 'center', vertical: 'middle' }
      };
      worksheet.getRow(1).height = 30;

      const columns = [
        { header: 'Base da Composição', key: 'base_comp', width: 18 },
        { header: 'Data Ref. (Coluna J)', key: 'data', width: 20 },
        { header: 'Cód. Composição', key: 'c_comp', width: 18 },
        { header: 'Descrição Composição', key: 'd_comp', width: 45 },
        { header: 'Unidade', key: 'u_comp', width: 10 },
        { header: 'Categoria da Composição', key: 'cat_comp', width: 20 },
        { header: 'Base do Item', key: 'base_item', width: 15 },
        { header: 'Cód. Item', key: 'c_item', width: 15 },
        { header: 'Descrição do Item', key: 'd_item', width: 45 },
        { header: 'Tipo de Item', key: 'tipo_item', width: 15 },
        { header: 'Coeficiente', key: 'coef', width: 12 }
      ];

      worksheet.getRow(2).values = columns.map(c => c.header);
      worksheet.columns = columns;

      worksheet.getRow(2).eachCell((cell) => {
        cell.style = headerStyle;
      });

      const examples = [
        ['SINAPI', '01/2024', '88267', 'ENCANADOR COM ENCARGOS COMPLEMENTARES', 'H', 'Mão de Obra', 'SINAPI', '00001234', 'CIMENTO PORTLAND CP II-32', 'Insumo', 0.05],
        ['SINAPI', '01/2024', '88267', 'ENCANADOR COM ENCARGOS COMPLEMENTARES', 'H', 'Mão de Obra', 'SINAPI', '00005678', 'AREIA MEDIA', 'Insumo', 0.12]
      ];

      examples.forEach((ex) => {
        const row = worksheet.addRow(ex);
        row.eachCell((cell) => {
          cell.style = rowStyle;
          if (cell.address.includes('I')) cell.numFmt = '0.0000';
        });
      });
    } else if (templateName.includes('Guia')) {
      const content = `GUIA DE IMPORTAÇÃO - SISTEMA DE GESTÃO DE OBRAS

1. SEQUÊNCIA OBRIGATÓRIA:
   - Passo 1: Importe todos os Insumos necessários.
   - Passo 2: Importe as Composições que utilizam esses insumos.

2. REGRAS DE OURO PARA INTEGRIDADE:
   - CÓDIGOS: O código do item no arquivo de composições deve ser IDÊNTICO ao código cadastrado no arquivo de insumos.
   - FORMATAÇÃO: Use ponto (.) para decimais. Ex: 10.50 (Correto) | 10,50 (Incorreto).
   - COLUNAS: Não altere a ordem ou o nome das colunas dos templates fornecidos.

3. DICAS PARA VALORES EXATOS:
   - Certifique-se de que a Unidade de Medida (H, KG, M3, etc) seja a mesma em ambos os arquivos.
   - O sistema recalcula o valor total da composição multiplicando o Coeficiente pelo Preço Unitário do Insumo encontrado no banco.

4. SUPORTE A FORMATOS:
   - Excel (.xlsx) - Recomendado para manter a formatação.
   - CSV - Suportado para grandes volumes de dados.`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'guia_importacao.txt';
      a.click();
      return;
    }

    // Gerar e baixar o arquivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Templates & Guias</h2>
        <p className="text-slate-500 text-sm font-medium mt-1">Recursos para garantir a integridade e precisão dos seus dados.</p>
      </div>

      {/* Import Sequence */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all"
            >
              <div className={`w-12 h-12 ${step.bgColor} rounded-xl flex items-center justify-center mb-4`}>
                <Icon className={step.color} size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">{step.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">{step.description}</p>
              <ul className="space-y-2">
                {step.details.map((detail, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600 font-medium">
                    <div className="mt-1 w-1 h-1 bg-slate-300 rounded-full shrink-0" />
                    {detail}
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>

      {/* Download Section */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-3xl rounded-full -mr-32 -mt-32" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <Download className="text-orange-500" size={24} />
            <h3 className="text-2xl font-black uppercase tracking-tight">Arquivos para Download</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((template, index) => {
              const Icon = template.icon;
              return (
                <div 
                  key={index}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all group cursor-pointer"
                  onClick={() => handleDownload(template.name)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl bg-white/10 ${template.color}`}>
                      <Icon size={20} />
                    </div>
                    <span className="text-[10px] font-black px-2 py-1 bg-white/10 rounded-md uppercase tracking-widest">
                      {template.type}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm mb-1 group-hover:text-orange-400 transition-colors">{template.name}</h4>
                  <p className="text-white/50 text-[11px] leading-snug mb-4">{template.description}</p>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-orange-500 uppercase tracking-widest">
                    Baixar Agora <ArrowRight size={12} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Important Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4 items-start">
        <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
          <AlertCircle size={20} />
        </div>
        <div>
          <h4 className="font-bold text-amber-900 text-sm uppercase tracking-tight mb-1">Atenção à Integridade dos Dados</h4>
          <p className="text-amber-800/70 text-xs leading-relaxed">
            Para que os valores das composições fiquem exatos com os bancos oficiais (SINAPI/ORSE), é fundamental que os preços dos insumos sejam atualizados antes da importação das composições. O sistema utiliza o código do insumo como chave de ligação; qualquer divergência no código impedirá o cálculo correto do preço unitário da composição.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TemplatesView;

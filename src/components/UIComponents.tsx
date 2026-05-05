import React, { useState, useRef, useEffect } from 'react';
import { 
  LucideIcon, 
  Bell, 
  HelpCircle, 
  User, 
  Database, 
  ChevronDown, 
  FileText, 
  Plus,
  FileSpreadsheet,
  Settings2,
  TableProperties,
  Clock,
  BarChart3,
  ListFilter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateExcelReport } from '../services/excelService';

export const Button = ({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  icon: Icon, 
  className = '', 
  iconClassName = '',
  ...props 
}: any) => {
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm border border-transparent',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm',
    outline: 'bg-transparent text-slate-600 border border-slate-200 hover:bg-slate-50',
    ghost: 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900',
    action: 'text-slate-900 border border-slate-200 hover:border-slate-400 hover:bg-slate-50 shadow-sm uppercase tracking-wide text-[11px]',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm border border-transparent shadow-red-200',
  };

  const sizes = {
    xs: 'px-2 py-1 text-[10px]',
    sm: 'px-3 py-1.5 text-[12px]',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const iconSize = size === 'xs' ? 12 : size === 'sm' ? 14 : 18;

  return (
    <button 
      className={`
        rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant as keyof typeof variants]} 
        ${sizes[size as keyof typeof sizes]}
        ${className}
      `}
      {...props}
    >
      {Icon && (
        <Icon 
          size={iconSize} 
          className={`${variant === 'secondary' ? 'text-indigo-600' : ''} ${iconClassName}`} 
        />
      )}
      {children}
    </button>
  );
};

export const TopToolbar = ({ onNavigate, user, activeObraId }: { onNavigate?: (tab: string) => void, user?: any, activeObraId?: string | number | null }) => {
  const [isRelatoriosOpen, setIsRelatoriosOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isResumoModalOpen, setIsResumoModalOpen] = useState(false);
  const [resumoMaxLevel, setResumoMaxLevel] = useState<number>(2);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [reportConfig, setReportConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('engineering_pro_report_config');
      if (saved) return {
        corFundoEtapa: '#d9e9ff',
        corLetraEtapa: '#000000',
        negritoEtapa: true,
        corFundoComposicao: '#e2efda',
        corLetraComposicao: '#000000',
        negritoComposicao: false,
        corFundoInsumo: '#fff2cc',
        corLetraInsumo: '#000000',
        negritoInsumo: false,
        retirarColunaPeso: false,
        retirarInfoBDI: false,
        bloquearEdicao: true,
        relatoriosComFormulas: false,
        logoImagem: '',
        ...JSON.parse(saved)
      };
    } catch (e) {
      // ignore
    }
    return {
      cabecalhoCentral: '',
      cabecalhoEsquerdo: '',
      cabecalhoDireito: '',
      rodapeCentral: '',
      rodapeEsquerdo: '',
      rodapeDireito: '',
      assinatura1: 'Marcus Vinicius\nSócio/CEO/Proprietário',
      assinatura2: '',
      corFundoEtapa: '#d9e9ff',
      corLetraEtapa: '#000000',
      negritoEtapa: true,
      corFundoComposicao: '#e2efda',
      corLetraComposicao: '#000000',
      negritoComposicao: false,
      corFundoInsumo: '#fff2cc',
      corLetraInsumo: '#000000',
      negritoInsumo: false,
      retirarColunaPeso: false,
      retirarInfoBDI: false,
      bloquearEdicao: true,
      relatoriosComFormulas: false,
      logoImagem: ''
    };
  });
  
  const isAdmin = user?.role === 'admin' || user?.role === 'admin_master' || user?.role === 'admin_pj' || user?.role === 'gestor';
  
  const [localConfig, setLocalConfig] = useState(reportConfig);

  useEffect(() => {
    if (isCustomizerOpen) {
      setLocalConfig(reportConfig);
    }
  }, [isCustomizerOpen, reportConfig]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRelatoriosOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (reportName: string, maxLevel?: number) => {
    console.log(`Exportando: ${reportName}`);
    
    if (!activeObraId) {
      alert("Por favor, selecione uma obra para gerar o relatório.");
      setIsRelatoriosOpen(false);
      return;
    }

    setIsRelatoriosOpen(false);
    
    // Feedback visual
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-6 right-6 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-[9999] flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300';
    toast.innerHTML = `
      <div class="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
      </div>
      <div>
        <p class="text-xs font-black uppercase tracking-widest leading-none mb-1">Exportando Relatório</p>
        <p class="text-[11px] text-slate-400 font-bold">${reportName}</p>
      </div>
    `;
    document.body.appendChild(toast);

    try {
      // 1. Fetch Obra Data
      const obraRes = await fetch(`/api/obras/${activeObraId}`);
      if (!obraRes.ok) throw new Error("Erro ao buscar dados da obra");
      const obraData = await obraRes.json();

      // 2. Fetch Orcamento Items
      const orcamentoRes = await fetch(`/api/obras/${activeObraId}/orcamento?desonerado=${obraData.desonerado === 1}&estado=${obraData.uf}&data_referencia=${obraData.data_referencia}`);
      if (!orcamentoRes.ok) throw new Error("Erro ao buscar orçamento");
      const orcamentoData = await orcamentoRes.json();

      // 3. Define report structure based on name (Refined for professional layout)
      let columns: any[] = [];
      
      const bdiValue = obraData.bdi || 0;
      const bdiIncidence = obraData.bdi_incidencia || 'unitario';
      
      if (reportName === 'Resumo') {
        columns = [
          { header: 'Item', key: 'item', width: 24, colspan: 2 },
          { header: 'Descrição', key: 'descricao', width: 84, colspan: 6 },
          { header: 'Total', key: 'total_geral', width: 18, type: 'currency' },
          { header: 'Peso (%)', key: 'peso', width: 12, type: 'percentage' }
        ];
      } else {
        columns = [
          { header: 'Item', key: 'item', width: 6 },
          { header: 'Código', key: 'codigo', width: 12 },
          { header: 'Banco', key: 'banco', width: 10 },
          { header: 'Descrição', key: 'descricao', width: 55 },
          { header: 'Tipo', key: 'tipo_servico', width: 15 },
          { header: 'Und', key: 'unidade', width: 6 },
          { header: 'Quant.', key: 'quantidade', width: 10, type: 'number' },
        ];

        if (reportName.includes('Mão de Obra, Equipamento e Material')) {
          columns.push(
            { header: 'Valor Unit', key: 'valor_unit_sem_bdi', width: 12, type: 'currency' },
            { header: 'Valor Unit com BDI', subgroup: ['M. O.', 'MAT.', 'EQUIP.', 'Total'], keys: ['v_unit_bdi_mo', 'v_unit_bdi_mat', 'v_unit_bdi_equip', 'v_unit_bdi_total'], width: 12, type: 'currency' },
            { header: 'Total', subgroup: ['M. O.', 'MAT.', 'EQUIP.', 'Total'], keys: ['total_mo', 'total_mat', 'total_equip', 'total_total'], width: 12, type: 'currency' },
            { header: 'Peso (%)', key: 'peso', width: 8, type: 'percentage' }
          );
        } else if (reportName.includes('Mão de Obra e Material')) {
          columns.push(
            { header: 'Valor Unit', key: 'valor_unit_sem_bdi', width: 12, type: 'currency' },
            { header: 'Valor Unit com BDI', subgroup: ['M. O.', 'MAT.', 'Total'], keys: ['v_unit_bdi_mo', 'v_unit_bdi_mat', 'v_unit_bdi_total'], width: 12, type: 'currency' },
            { header: 'Total', subgroup: ['M. O.', 'MAT.', 'Total'], keys: ['total_mo', 'total_mat', 'total_total'], width: 12, type: 'currency' },
            { header: 'Peso (%)', key: 'peso', width: 8, type: 'percentage' }
          );
        } else if (reportName.includes('Mão de Obra')) {
          columns.push(
            { header: 'Valor Unit', key: 'valor_unit_sem_bdi', width: 12, type: 'currency' },
            { header: 'Valor Unit com BDI', key: 'valor_unit_com_bdi', width: 12, type: 'currency' },
            { header: 'Mão de Obra Valor', key: 'mo_total', width: 12, type: 'currency' },
            { header: '%', key: 'mo_percent', width: 8, type: 'percentage' },
            { header: 'Total', key: 'total_geral', width: 15, type: 'currency' },
            { header: 'Peso (%)', key: 'peso', width: 8, type: 'percentage' }
          );
        } else {
          columns.push(
            { header: 'Valor Unit', key: 'valor_unit_sem_bdi', width: 12, type: 'currency' },
            { header: 'Valor Unit com BDI', key: 'valor_unit_com_bdi', width: 12, type: 'currency' },
            { header: 'Total', key: 'total_geral', width: 15, type: 'currency' },
            { header: 'Peso (%)', key: 'peso', width: 8, type: 'percentage' }
          );
        }
      }

      // Remove colunas based on config
      if (reportConfig.retirarColunaPeso) {
        columns = columns.filter(c => c.key !== 'peso');
      }

      if (reportConfig.retirarInfoBDI) {
        const insertIdx = columns.findIndex(c => c.key === 'valor_unit_sem_bdi' || c.key === 'valor_unit_com_bdi');
        columns = columns.filter(c => c.key !== 'valor_unit_sem_bdi' && c.key !== 'valor_unit_com_bdi');
        if (insertIdx !== -1) {
          columns.splice(insertIdx, 0, { header: 'Valor Unit', key: 'valor_unit_com_bdi', width: 12, type: 'currency' });
        }
      }

      // Calculate Budget Totals accurately
      // subTotalRaw is the sum of (unit price * qty) for all items without BDI yet
      const subTotalRaw = orcamentoData.reduce((sum: number, it: any) => it.tipo === 'etapa' ? sum : sum + ((it.quantidade || 0) * (it.valor_unitario || 0)), 0);
      
      const totalSemBdi = subTotalRaw;
      const totalBdi = subTotalRaw * (bdiValue / 100);
      const totalComBdi = subTotalRaw + totalBdi;
      const totalDesconto = totalComBdi * ((obraData.desconto || 0) / 100);
      const totalBudget = totalComBdi - totalDesconto;
      
      // Map rows
      const rows = orcamentoData.map((it: any) => {
        const isEtapa = it.tipo === 'etapa';
        const qty = it.quantidade || 0;
        
        const rawUnitCost = it.valor_unitario || 0;
        const bdiMultiplier = (1 + bdiValue / 100);
        const unitWithBDI = bdiIncidence === 'unitario' ? rawUnitCost * bdiMultiplier : rawUnitCost;
        
        let moUnit = it.custo_mao_obra || 0;
        let matUnit = it.custo_material || 0;
        let equipUnit = it.custo_equipamento || 0;

        // SE os custos específicos estiverem zerados, tentamos inferir da categoria.
        if (!isEtapa && rawUnitCost > 0) {
          const cat = (it.categoria || "").toLowerCase();
          const desc = (it.descricao || "").toLowerCase();
          const tipoItem = (it.tipo_item || "").toLowerCase();
          const isMO = cat.includes("mão de obra") || cat.includes("mao de obra") || tipoItem === "mao_de_obra" || desc.includes("mão de obra");
          const isEquip = cat.includes("equipamento") || tipoItem === "equipamento" || desc.includes("equipamento");
          
          if (moUnit === 0 && isMO) {
            moUnit = rawUnitCost;
          } else if (equipUnit === 0 && isEquip) {
            equipUnit = rawUnitCost;
          } else if (matUnit === 0 && !isMO && !isEquip) {
            matUnit = rawUnitCost;
          }
        }

        const moUnitWithBDI = moUnit * bdiMultiplier;
        const matUnitWithBDI = matUnit * bdiMultiplier;
        const equipUnitWithBDI = equipUnit * bdiMultiplier;
        const unitTotalWithBDI = moUnitWithBDI + matUnitWithBDI + equipUnitWithBDI;

        const moUnitCost = moUnit;
        const matUnitCost = matUnit;
        const equipUnitCost = equipUnit;

        // Ensure calculations use raw costs times qty (or 1 for etapas)
        const moTotal = moUnitCost * (isEtapa ? 1 : qty) * bdiMultiplier;
        const matTotal = matUnitCost * (isEtapa ? 1 : qty) * bdiMultiplier;
        const equipTotal = equipUnitCost * (isEtapa ? 1 : qty) * bdiMultiplier;
        
        const total = isEtapa ? (it.total || 0) : (moTotal + matTotal + equipTotal);
        
        const moPercent = total > 0 ? (moTotal / total) * 100 : 0;
        const peso = totalBudget > 0 ? (total / totalBudget) * 100 : 0;

        let itemCategory = 'insumo';
        if (isEtapa) {
          itemCategory = 'etapa';
        } else {
          const tipoItem = (it.item_tipo || '').toLowerCase();
          if (tipoItem === 'composicao' || tipoItem === 'composição') {
            itemCategory = 'composicao';
          }
        }

        const mappedRow = {
          item: it.item || '',
          codigo: isEtapa ? '' : it.codigo,
          banco: isEtapa ? '' : it.base,
          descricao: isEtapa ? it.descricao?.toUpperCase() : it.descricao,
          tipo_servico: it.categoria || '',
          unidade: it.unidade || '',
          quantidade: isEtapa ? null : qty,
          valor_unit_sem_bdi: isEtapa ? null : it.custo_unitario_aplicado,
          valor_unit_com_bdi: isEtapa ? null : (it.custo_unitario_aplicado || 0) * bdiMultiplier,
          v_unit_bdi_mo: moUnitCost * bdiMultiplier,
          v_unit_bdi_mat: matUnitCost * bdiMultiplier,
          v_unit_bdi_equip: equipUnitCost * bdiMultiplier,
          v_unit_bdi_total: (it.custo_unitario_aplicado || 0) * bdiMultiplier,
          total_mo: moTotal,
          total_mat: matTotal,
          total_equip: equipTotal,
          total_total: total,
          mo_total: moTotal,
          mo_percent: moPercent,
          total_geral: total,
          peso: peso,
          isEtapa: isEtapa,
          itemCategory: itemCategory
        };
        return mappedRow;
      });

      // Filter rows if it's the Resumo report
      let finalRows = rows;
      if (reportName === 'Resumo') {
        const targetMaxLevel = maxLevel !== undefined ? maxLevel : 100;
        finalRows = rows.filter((row: any) => {
          if (!row.isEtapa) return false;
          const itemStr = (row.item || '').toString().trim();
          const parts = itemStr.split('.').filter(Boolean);
          return parts.length <= targetMaxLevel;
        });
      }

      // Identify unique bases (banks) used in the budget
      const rawBases = orcamentoData.map((it: any) => it.base).filter(Boolean);
      const normalizedBases = rawBases.map((b: string) => {
        const u = b.toUpperCase();
        if (u === 'PRÓPRIO' || u === 'PROPRIO' || u === 'PRÓPRIA' || u === 'PROPRIA') return 'PRÓPRIA';
        return u;
      });
      const uniqueBases = Array.from(new Set(normalizedBases));
      const bancosInfo = uniqueBases.length > 0 
        ? uniqueBases.map(b => `${b} - ${obraData.data_referencia} - ${obraData.uf}`).join('\n')
        : `SINAPI - ${obraData.data_referencia} - ${obraData.uf}`;

      await generateExcelReport({
        title: `Planilha Orçamentária ${reportName}`,
        obraName: obraData.nome.toUpperCase(),
        cliente: obraData.cliente?.toUpperCase() || "N/A",
        bancos: bancosInfo,
        bdi: bdiValue,
        desconto: obraData.desconto || 0,
        encargos: `${obraData.desonerado === 1 ? "Desonerado" : "Não Desonerado"}\nHorista: ${obraData.encargos_horista?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0.00'}%\nMensalista: ${obraData.encargos_mensalista?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0.00'}%`,
        columns,
        rows: finalRows,
        summary: {
          totalSemBdi: totalSemBdi,
          totalBdi: totalBdi,
          totalDesconto: totalDesconto,
          totalGeral: totalBudget
        },
        config: reportConfig
      });
    } catch (error) {
      console.error("Erro ao gerar excel:", error);
      alert("Ocorreu um erro ao gerar o relatório. Verifique se você está visualizando uma obra.");
    } finally {
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 300);
    }
  };

  const reportGroups = [
    ...(isAdmin ? [{
      title: "Configuração",
      options: [
        { label: "Personalizar Relatório", icon: <Settings2 size={13} className="text-slate-400" /> }
      ]
    }] : []),
    {
      title: "Sintético",
      options: [
        { label: "Resumo" },
        { label: "Sintético" },
        { label: "Sintético com Valor de Mão de Obra" },
        { label: "Sintético com Valor de Mão de Obra e Material" },
        { label: "Sintético com Valor da Mão de Obra, Equipamento e Material" }
      ]
    },
    {
      title: "Analítico",
      options: [
        { label: "Orçamento Analítico" },
        { label: "Composições Analíticas com Preço Unitário" },
        { label: "Composições Analíticas com Preço Unitário - Somente Insumos" }
      ]
    },
    {
      title: "Curvas e Custos",
      options: [
        { label: "Curva ABC de Insumos", icon: <BarChart3 size={13} className="text-emerald-500" /> },
        { label: "Curva ABC de Serviços", icon: <BarChart3 size={13} className="text-blue-500" /> },
        { label: "Custo Horário de Equipamentos" },
        { label: "Custo Horário de Mão de Obra" },
        { label: "Produção de Equipe Mecânica" }
      ]
    },
    {
      title: "Outros",
      options: [
        { label: "Cronograma", icon: <Clock size={13} className="text-indigo-400" /> },
        { label: "Memória de Cálculo" },
        { label: "Importações" }
      ]
    },
  ];

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-2xl shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-widest">Sistema Ativo</span>
        </div>
        
        <div className="h-6 w-[1px] bg-slate-200" />
        
        {user?.role !== 'admin_master' && (
          <>
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsRelatoriosOpen(!isRelatoriosOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all group font-bold ${
                  isRelatoriosOpen ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileSpreadsheet size={16} className={isRelatoriosOpen ? 'text-emerald-400' : 'text-slate-400 group-hover:text-emerald-500'} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Relatórios</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isRelatoriosOpen ? 'rotate-180' : ''} opacity-50`} />
              </button>

              <AnimatePresence>
                {isRelatoriosOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="max-h-[75vh] overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-slate-200">
                      {reportGroups.map((group, gIdx) => (
                        <div key={gIdx} className="mb-3 last:mb-0">
                          <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                            {group.title}
                          </div>
                          <div className="px-1 space-y-0.5">
                            {group.options.map((opt, oIdx) => (
                              <button 
                                key={oIdx}
                                onClick={() => {
                                  if (opt.label === "Personalizar Relatório") {
                                    setIsCustomizerOpen(true);
                                    setIsRelatoriosOpen(false);
                                  } else if (opt.label === "Resumo") {
                                    setIsResumoModalOpen(true);
                                    setIsRelatoriosOpen(false);
                                  } else {
                                    handleExport(opt.label);
                                  }
                                }}
                                className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg transition-colors flex items-center justify-between group/row"
                              >
                                <span className="flex items-center gap-3">
                                  {opt.icon || <div className="w-1.5 h-1.5 bg-slate-200 rounded-full group-hover/row:bg-emerald-400 transition-colors" />}
                                  {opt.label}
                                </span>
                                <FileSpreadsheet size={12} className="opacity-0 group-hover/row:opacity-40" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="border-t border-slate-100 my-2" />
                      
                      <div className="px-4 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Bancos de Dados
                      </div>
                      <div className="px-1 space-y-0.5">
                        <button 
                          onClick={() => { onNavigate?.('insumos'); setIsRelatoriosOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors flex items-center gap-3"
                        >
                          <Database size={14} className="text-orange-400" />
                          BANCO DE INSUMOS
                        </button>
                        <button 
                          onClick={() => { onNavigate?.('composicoes'); setIsRelatoriosOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors flex items-center gap-3"
                        >
                          <Database size={14} className="text-orange-400" />
                          BANCO DE COMPOSIÇÃO
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => onNavigate?.('templates')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-slate-500 hover:bg-slate-100 hover:text-slate-900 group"
            >
              <FileText size={15} className="text-slate-400 group-hover:text-slate-900" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Templates</span>
            </button>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
      <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all relative shadow-sm hover:shadow-md bg-white/40 border border-transparent hover:border-slate-200">
        <Bell size={17} />
        <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-white" />
      </button>
      <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow-md bg-white/40 border border-transparent hover:border-slate-200">
        <HelpCircle size={17} />
      </button>
      <div className="h-6 w-[1px] bg-slate-200 mx-2" />
      <button className="flex items-center gap-3 pl-3 pr-1 py-1 hover:bg-white rounded-xl transition-all group shadow-sm hover:shadow-md bg-white/40 border border-transparent hover:border-slate-200">
        <div className="text-right hidden sm:block">
          <p className="text-[12px] font-black text-slate-900 uppercase leading-none">{user?.nome || 'Usuário'}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
            {user?.role === 'admin_master' ? 'Administrador Master' : 
             user?.role === 'admin_pj' ? 'Administrador' : 
             user?.role === 'orcamentista' ? 'Orçamentista' : 
             user?.role === 'comprador' ? 'Comprador' : 'Usuário'}
          </p>
        </div>
        <div className="w-[30px] h-[30px] bg-slate-900 rounded-lg flex items-center justify-center text-white group-hover:bg-orange-500 transition-colors">
          <User size={15} />
        </div>
      </button>
      </div>
      
      {/* Report Customization Modal */}
      <AnimatePresence>
        {isCustomizerOpen && (
          <div className="fixed inset-0 z-[100] p-4 sm:p-8 pt-[5vh] sm:pt-[5vh] bg-slate-900/40 backdrop-blur-sm flex items-start justify-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl flex flex-col max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <Settings2 size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Personalizar Relatório</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configurações de Exportação e Documento</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCustomizerOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                >
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto custom-scrollbar min-h-0">
                <div className="space-y-6">
                  {/* Logo Marca */}
                  <section>
                    <h3 className="text-[13px] font-black text-slate-800 border-b border-slate-100 pb-2 mb-4">Logo Marca</h3>
                    <div className="flex items-start gap-8">
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" 
                            checked={!!localConfig.logoImagem}
                            onChange={(e) => {
                              if (!e.target.checked) setLocalConfig({...localConfig, logoImagem: ''});
                            }}
                          />
                          <span className="text-[12px] text-slate-700">Exibir Logo</span>
                        </label>
                        <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center text-white font-bold tracking-widest text-sm overflow-hidden relative group">
                          {localConfig.logoImagem ? (
                            <>
                              <img src={localConfig.logoImagem} alt="Logo" className="w-full h-full object-cover" />
                              <button 
                                onClick={() => setLocalConfig({...localConfig, logoImagem: ''})}
                                className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white text-[10px] font-bold"
                              >
                                Remover
                              </button>
                            </>
                          ) : (
                            <span>LOGO</span>
                          )}
                        </div>
                      </div>
                      <div className="pt-8">
                        <div className="flex items-center gap-2">
                          <label className="px-3 py-1 bg-slate-100 border border-slate-300 rounded text-[11px] cursor-pointer hover:bg-slate-200 transition-colors">
                            Escolher arquivo
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/png, image/jpeg, image/jpg, .png, .jpg, .jpeg" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  if (file.size > 2 * 1024 * 1024) {
                                    alert("A imagem não deve exceder 2MB.");
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setLocalConfig({...localConfig, logoImagem: reader.result as string});
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                          <span className="text-[11px] text-slate-500">
                            {localConfig.logoImagem ? 'Imagem selecionada' : 'Nenhum arquivo escolhido'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Cabeçalho */}
                  <section>
                    <h3 className="text-[13px] font-black text-slate-800 border-b border-slate-100 pb-2 mb-4">Cabeçalho</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">Cabeçalho Central</label>
                        <textarea 
                          value={localConfig.cabecalhoCentral}
                          onChange={e => setLocalConfig({...localConfig, cabecalhoCentral: e.target.value})}
                          className="w-full h-16 px-3 py-2 border border-slate-300 rounded outline-none focus:border-indigo-500 text-[12px] resize-y" 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">Cabeçalho Esquerdo</label>
                        <textarea 
                          value={localConfig.cabecalhoEsquerdo}
                          onChange={e => setLocalConfig({...localConfig, cabecalhoEsquerdo: e.target.value})}
                          className="w-full h-16 px-3 py-2 border border-slate-300 rounded outline-none focus:border-indigo-500 text-[12px] resize-y" 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">Cabeçalho Direito</label>
                        <div className="relative">
                          <textarea 
                            value={localConfig.cabecalhoDireito}
                            onChange={e => setLocalConfig({...localConfig, cabecalhoDireito: e.target.value})}
                            className="w-full h-16 px-3 py-2 border border-slate-300 rounded outline-none focus:border-indigo-500 text-[12px] resize-y" 
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Rodapé */}
                  <section className="pt-4">
                    <h3 className="text-[13px] font-black text-slate-800 border-b border-slate-100 pb-2 mb-4">Rodapé</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">Rodapé Central</label>
                        <textarea 
                          value={localConfig.rodapeCentral}
                          onChange={e => setLocalConfig({...localConfig, rodapeCentral: e.target.value})}
                          className="w-full h-16 px-3 py-2 border border-slate-300 rounded outline-none focus:border-indigo-500 text-[12px] resize-y" 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">Rodapé Esquerdo</label>
                        <textarea 
                          value={localConfig.rodapeEsquerdo}
                          onChange={e => setLocalConfig({...localConfig, rodapeEsquerdo: e.target.value})}
                          className="w-full h-16 px-3 py-2 border border-slate-300 rounded outline-none focus:border-indigo-500 text-[12px] resize-y" 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">Rodapé Direito</label>
                        <div className="relative">
                          <textarea 
                            value={localConfig.rodapeDireito}
                            onChange={e => setLocalConfig({...localConfig, rodapeDireito: e.target.value})}
                            className="w-full h-16 px-3 py-2 border border-slate-300 rounded outline-none focus:border-indigo-500 text-[12px] resize-y" 
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Assinatura */}
                  <section className="pt-4">
                    <h3 className="text-[13px] font-black text-slate-800 border-b border-slate-100 pb-2 mb-4">Assinatura</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">Assinatura 1</label>
                        <textarea 
                          className="w-full h-16 px-3 py-2 border border-slate-300 rounded outline-none focus:border-indigo-500 text-[12px] text-center resize-y leading-tight" 
                          value={localConfig.assinatura1}
                          onChange={(e) => setLocalConfig({...localConfig, assinatura1: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">Assinatura 2</label>
                        <textarea 
                          className="w-full h-16 px-3 py-2 border border-slate-300 rounded outline-none focus:border-indigo-500 text-[12px] text-center resize-y" 
                          value={localConfig.assinatura2}
                          onChange={(e) => setLocalConfig({...localConfig, assinatura2: e.target.value})}
                        />
                      </div>
                    </div>
                  </section>

                  {/* Cores */}
                  <section>
                    <h3 className="text-[13px] font-black text-slate-800 border-b border-slate-100 pb-2 mb-4">Cores</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Etapas */}
                      <div>
                        <h4 className="text-[14px] text-slate-700 mb-2">Etapas</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">Cor de fundo</label>
                            <div className="flex items-center">
                              <input 
                                type="color" 
                                value={localConfig.corFundoEtapa}
                                onChange={e => setLocalConfig({...localConfig, corFundoEtapa: e.target.value})}
                                className="w-8 h-8 p-0 border-0 rounded cursor-pointer" 
                              />
                              <span className="ml-2 px-2 py-1 border border-slate-300 text-[11px] w-full bg-slate-50 uppercase">{localConfig.corFundoEtapa}</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">Cor da Letra</label>
                            <div className="flex items-center">
                              <input 
                                type="color" 
                                value={localConfig.corLetraEtapa}
                                onChange={e => setLocalConfig({...localConfig, corLetraEtapa: e.target.value})}
                                className="w-8 h-8 p-0 border-0 rounded cursor-pointer" 
                              />
                              <span className="ml-2 px-2 py-1 border border-slate-300 text-[11px] w-full bg-slate-50 uppercase">{localConfig.corLetraEtapa}</span>
                            </div>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer pt-1">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" 
                              checked={localConfig.negritoEtapa}
                              onChange={e => setLocalConfig({...localConfig, negritoEtapa: e.target.checked})}
                            />
                            <span className="text-[12px] text-slate-700">Negrito</span>
                          </label>
                        </div>
                      </div>

                      {/* Composições */}
                      <div>
                        <h4 className="text-[14px] text-slate-700 mb-2">Composições</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">Cor de fundo</label>
                            <div className="flex items-center">
                              <input 
                                type="color" 
                                value={localConfig.corFundoComposicao}
                                onChange={e => setLocalConfig({...localConfig, corFundoComposicao: e.target.value})}
                                className="w-8 h-8 p-0 border-0 rounded cursor-pointer" 
                              />
                              <span className="ml-2 px-2 py-1 border border-slate-300 text-[11px] w-full bg-slate-50 uppercase">{localConfig.corFundoComposicao}</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">Cor da Letra</label>
                            <div className="flex items-center">
                              <input 
                                type="color" 
                                value={localConfig.corLetraComposicao}
                                onChange={e => setLocalConfig({...localConfig, corLetraComposicao: e.target.value})}
                                className="w-8 h-8 p-0 border-0 rounded cursor-pointer" 
                              />
                              <span className="ml-2 px-2 py-1 border border-slate-300 text-[11px] w-full bg-slate-50 uppercase">{localConfig.corLetraComposicao}</span>
                            </div>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer pt-1">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" 
                              checked={localConfig.negritoComposicao}
                              onChange={e => setLocalConfig({...localConfig, negritoComposicao: e.target.checked})}
                            />
                            <span className="text-[12px] text-slate-700">Negrito</span>
                          </label>
                        </div>
                      </div>

                      {/* Insumos */}
                      <div>
                        <h4 className="text-[14px] text-slate-700 mb-2">Insumos</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">Cor de fundo</label>
                            <div className="flex items-center">
                              <input 
                                type="color" 
                                value={localConfig.corFundoInsumo}
                                onChange={e => setLocalConfig({...localConfig, corFundoInsumo: e.target.value})}
                                className="w-8 h-8 p-0 border-0 rounded cursor-pointer" 
                              />
                              <span className="ml-2 px-2 py-1 border border-slate-300 text-[11px] w-full bg-slate-50 uppercase">{localConfig.corFundoInsumo}</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">Cor da Letra</label>
                            <div className="flex items-center">
                              <input 
                                type="color" 
                                value={localConfig.corLetraInsumo}
                                onChange={e => setLocalConfig({...localConfig, corLetraInsumo: e.target.value})}
                                className="w-8 h-8 p-0 border-0 rounded cursor-pointer" 
                              />
                              <span className="ml-2 px-2 py-1 border border-slate-300 text-[11px] w-full bg-slate-50 uppercase">{localConfig.corLetraInsumo}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 pt-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" 
                                checked={localConfig.negritoInsumo}
                                onChange={e => setLocalConfig({...localConfig, negritoInsumo: e.target.checked})}
                              />
                              <span className="text-[12px] text-slate-700">Negrito</span>
                            </label>
                            <button 
                              onClick={() => {
                                setLocalConfig({
                                  ...localConfig,
                                  corFundoEtapa: '#d9e9ff',
                                  corLetraEtapa: '#000000',
                                  negritoEtapa: true,
                                  corFundoComposicao: '#e2efda',
                                  corLetraComposicao: '#000000',
                                  negritoComposicao: false,
                                  corFundoInsumo: '#fff2cc',
                                  corLetraInsumo: '#000000',
                                  negritoInsumo: false,
                                });
                              }}
                              className="text-[11px] text-blue-600 hover:underline self-end"
                            >
                              Restaurar cores originais
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Ocultar Informações */}
                  <section>
                    <h3 className="text-[13px] font-black text-slate-800 border-b border-slate-100 pb-2 mb-4">Ocultar Informações</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300" 
                          checked={localConfig.retirarColunaPeso}
                          onChange={e => setLocalConfig({...localConfig, retirarColunaPeso: e.target.checked})}
                        />
                        <span className="text-[12px] text-slate-700">Retirar coluna de Peso (%)</span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 mt-0.5" 
                          checked={localConfig.retirarInfoBDI}
                          onChange={e => setLocalConfig({...localConfig, retirarInfoBDI: e.target.checked})}
                        />
                        <div className="flex flex-col leading-tight">
                          <span className="text-[12px] text-slate-700">Retirar informações de BDI</span>
                          <span className="text-[10px] text-slate-500">Somente para relatórios sintéticos</span>
                        </div>
                      </label>
                    </div>
                  </section>

                  {/* Opções para os Arquivos */}
                  <section>
                    <h3 className="text-[13px] font-black text-slate-800 border-b border-slate-100 pb-2 mb-4">Opções para os Arquivos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 mt-0.5" 
                            checked={localConfig.bloquearEdicao}
                            onChange={e => setLocalConfig({...localConfig, bloquearEdicao: e.target.checked})}
                          />
                          <div className="flex flex-col leading-tight">
                            <span className="text-[12px] text-slate-700">Bloquear edição do arquivo</span>
                            <span className="text-[10px] text-slate-500">senha para desbloqueio</span>
                            <span className="text-[11px] font-bold text-slate-800 mt-1">9a64b3330b</span>
                          </div>
                        </label>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer items-start">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 mt-0.5" 
                          checked={localConfig.relatoriosComFormulas}
                          onChange={e => setLocalConfig({...localConfig, relatoriosComFormulas: e.target.checked})}
                        />
                        <span className="text-[12px] text-slate-700 mt-0.5">Relatórios com fórmulas</span>
                      </label>
                    </div>
                  </section>
                </div>
              </div>

              <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button 
                  onClick={() => setIsCustomizerOpen(false)}
                  className="px-5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    setReportConfig(localConfig);
                    localStorage.setItem('engineering_pro_report_config', JSON.stringify(localConfig));
                    setIsCustomizerOpen(false);
                    const toast = document.createElement('div');
                    toast.className = 'fixed bottom-6 right-6 bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl z-[9999] animate-in slide-in-from-bottom-5 duration-300';
                    toast.innerHTML = '<p class="text-xs font-black uppercase tracking-widest">Configurações Salvas com Sucesso!</p>';
                    document.body.appendChild(toast);
                    setTimeout(() => {
                      toast.style.opacity = '0';
                      setTimeout(() => toast.remove(), 300);
                    }, 2000);
                  }}
                  className="px-6 py-2.5 bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 rounded-xl shadow-lg transition-all"
                >
                  Salvar Configurações
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isResumoModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-16">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsResumoModalOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-emerald-500" />
                  Opções do Resumo
                </h2>
                <button onClick={() => setIsResumoModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              <div className="p-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nível máximo de sub-etapas</label>
                <div className="flex flex-col gap-1">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={resumoMaxLevel}
                    onChange={e => setResumoMaxLevel(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-slate-700"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Exemplo: Nível 2 imprimirá etapas como 1.1, 1.2, etc. mas ignorará 1.1.1.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button 
                  onClick={() => setIsResumoModalOpen(false)}
                  className="px-5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    handleExport("Resumo", resumoMaxLevel);
                    setIsResumoModalOpen(false);
                  }}
                  className="px-6 py-2.5 bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
                >
                  Gerar Relatório
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  delay?: number;
}

export const MetricCard = ({ title, value, icon: Icon, color, delay = 0 }: MetricCardProps) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex items-center justify-between"
  >
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{title}</p>
      <h3 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h3>
    </div>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} bg-opacity-10`}>
      <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
    </div>
  </motion.div>
);

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed?: boolean;
}

export const SidebarItem = ({ icon: Icon, label, active, onClick, collapsed = false }: SidebarItemProps) => (
  <button 
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={`w-full flex items-center transition-all duration-300 group relative ${
      collapsed ? 'justify-center px-0 py-3 gap-0' : 'gap-2 px-4 py-3'
    } ${
      active 
        ? 'bg-[#2d3748]/50 text-white' 
        : 'text-slate-400 hover:text-white hover:bg-[#2d3748]/30'
    }`}
  >
    {active && (
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
    )}
    <Icon size={18} className={`${active ? 'text-amber-500' : 'text-slate-400 group-hover:text-white'} transition-colors`} />
    {!collapsed && <span className="text-[13px] font-bold tracking-tight">{label}</span>}
  </button>
);

export const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    'Em Andamento': 'bg-blue-50 text-blue-600 border-blue-100',
    'Em Planejamento': 'bg-indigo-50 text-indigo-600 border-indigo-100',
    'Concluída': 'bg-slate-50 text-slate-600 border-slate-100',
    'Atrasada': 'bg-rose-50 text-rose-600 border-rose-100',
  };
  
  return (
    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${colors[status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
      {status}
    </span>
  );
};

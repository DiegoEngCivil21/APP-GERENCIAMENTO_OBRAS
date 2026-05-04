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
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRelatoriosOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (reportName: string) => {
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
      let columns: any[] = [
        { header: 'Item', key: 'item', width: 6 },
        { header: 'Código', key: 'codigo', width: 12 },
        { header: 'Banco', key: 'banco', width: 10 },
        { header: 'Descrição', key: 'descricao', width: 55 },
        { header: 'Tipo', key: 'tipo_servico', width: 15 },
        { header: 'Und', key: 'unidade', width: 6 },
        { header: 'Quant.', key: 'quantidade', width: 10, type: 'number' },
      ];

      const bdiValue = obraData.bdi || 0;
      const bdiIncidence = obraData.bdi_incidencia || 'unitario';

      if (reportName.includes('Mão de Obra')) {
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

      // Calculate Budget Totals accurately (BDI is already in it.total coming from server)
      const totalBudget = orcamentoData.reduce((sum: number, it: any) => it.tipo === 'etapa' ? sum : sum + (it.total || 0), 0);
      const totalSemBdi = totalBudget / (1 + bdiValue / 100);
      const totalBdi = totalBudget - totalSemBdi;

      // Map rows
      const rows = orcamentoData.map((it: any) => {
        const isEtapa = it.tipo === 'etapa';
        const qty = it.quantidade || 0;
        
        const rawUnitCost = it.valor_unitario || 0;
        const bdiMultiplier = (1 + bdiValue / 100);
        
        const unitWithBDI = bdiIncidence === 'unitario' ? rawUnitCost * bdiMultiplier : rawUnitCost;
        const total = isEtapa ? (it.total || 0) : (qty * unitWithBDI);
        
        const moUnit = it.custo_mao_obra || 0;
        const moTotal = isEtapa ? (it.custo_mao_obra_total || 0) : (moUnit * qty * bdiMultiplier);
        
        const moPercent = total > 0 ? (moTotal / total) * 100 : 0;
        const peso = totalBudget > 0 ? (total / totalBudget) * 100 : 0;

        // Mapeamento de cores baseado no TIPO do item (igual ao sistema)
        // Etapa = Azul, Composição = Verde, Insumo = Amarelo
        let rowColor = 'FFFFFFFF'; 
        if (isEtapa) {
          rowColor = 'FFD9E9FF'; // Azul suave para Etapas
        } else {
          const tipoItem = (it.item_tipo || '').toLowerCase();
          if (tipoItem === 'composicao' || tipoItem === 'composição') {
            rowColor = 'FFE2EFDA'; // Verde para Composições
          } else {
            rowColor = 'FFFFF2CC'; // Amarelo para Insumos
          }
        }

        return {
          item: it.item || '',
          codigo: isEtapa ? '' : it.codigo,
          banco: isEtapa ? '' : it.base,
          descricao: isEtapa ? it.descricao?.toUpperCase() : it.descricao,
          tipo_servico: it.categoria || '',
          unidade: it.unidade || '',
          quantidade: isEtapa ? null : qty,
          valor_unit_sem_bdi: isEtapa ? null : rawUnitCost,
          valor_unit_com_bdi: isEtapa ? null : unitWithBDI,
          mo_total: isEtapa ? null : moTotal,
          mo_percent: isEtapa ? null : moPercent,
          total_geral: total,
          peso: peso,
          isEtapa: isEtapa,
          rowColor: rowColor
        };
      });

      // Identify unique bases (banks) used in the budget
      const uniqueBases = Array.from(new Set(orcamentoData.map((it: any) => it.base).filter(Boolean)));
      const bancosInfo = uniqueBases.length > 0 
        ? uniqueBases.map(b => `${b} - ${obraData.data_referencia} - ${obraData.uf}`).join('\n')
        : `SINAPI - ${obraData.data_referencia} - ${obraData.uf}`;

      await generateExcelReport({
        title: `Planilha Orçamentária ${reportName}`,
        obraName: obraData.nome.toUpperCase(),
        cliente: obraData.cliente?.toUpperCase() || "N/A",
        bancos: bancosInfo,
        bdi: bdiValue,
        encargos: obraData.desonerado === 1 ? "Desonerado: 85.00%" : "Não Desonerado: 112.00%",
        columns,
        rows,
        summary: {
          totalSemBdi: totalSemBdi,
          totalBdi: totalBdi,
          totalGeral: totalBudget
        }
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
    {
      title: "Configuração",
      options: [
        { label: "Personalizar Relatório", icon: <Settings2 size={13} className="text-slate-400" /> }
      ]
    },
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
          <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-10 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <Settings2 size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Personalizar Relatório</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configurações de Exportação e Documento</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCustomizerOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                >
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <div className="p-8 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
                  <div className="space-y-8">
                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Cabeçalho e Identificação</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                         <label className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                           <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" defaultChecked />
                           <span className="text-[11px] font-bold text-slate-600 uppercase">Mostrar Logotipo</span>
                         </label>
                         <label className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                           <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" defaultChecked />
                           <span className="text-[11px] font-bold text-slate-600 uppercase">Dados da Obra</span>
                         </label>
                         <label className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                           <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" defaultChecked />
                           <span className="text-[11px] font-bold text-slate-600 uppercase">Incluir BDI Un.</span>
                         </label>
                         <label className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                           <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                           <span className="text-[11px] font-bold text-slate-600 uppercase">Resumo Financeiro</span>
                         </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Configuração de Rodapé</label>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Rodapé Esquerdo</label>
                            <textarea 
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                              placeholder="Endereço, etc..."
                              rows={3}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Rodapé Direito</label>
                            <textarea 
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                              placeholder="Outras infos..."
                              rows={3}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                             <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" defaultChecked />
                             <span className="text-[11px] font-bold text-slate-600 uppercase">Numerar Páginas</span>
                          </label>
                          <label className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                             <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" defaultChecked />
                             <span className="text-[11px] font-bold text-slate-600 uppercase">Data/Hora no Rodapé</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Opções de Layout</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Orientação</label>
                          <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 outline-none">
                            <option>Retrato (Portrait)</option>
                            <option>Paisagem (Landscape)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Tam. da Fonte</label>
                          <select defaultValue="Média (10pt)" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 outline-none">
                            <option>Pequena (8pt)</option>
                            <option>Média (10pt)</option>
                            <option>Grande (12pt)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Visual Preview */}
                  <div className="space-y-4">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Pré-visualização</label>
                    <div className="aspect-[3/4] bg-slate-100 rounded-2xl border border-slate-200 p-4 relative shadow-inner overflow-hidden flex flex-col">
                      {/* Paper Look */}
                      <div className="flex-1 bg-white shadow-sm rounded-lg p-3 flex flex-col ring-1 ring-black/5">
                        <div className="h-4 w-12 bg-indigo-100 rounded mb-2" />
                        <div className="space-y-1 mb-4">
                          <div className="h-2 w-full bg-slate-100 rounded" />
                          <div className="h-2 w-2/3 bg-slate-100 rounded" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-full bg-slate-50 rounded border border-slate-100" />
                          {[1,2,3,4,5,6,7].map(i => (
                            <div key={i} className="h-3 w-full border-b border-slate-100 flex items-center justify-between px-1">
                              <div className="h-1.5 w-1/3 bg-slate-50 rounded" />
                              <div className="h-1.5 w-8 bg-slate-50 rounded" />
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 pt-2 border-t border-slate-100 flex justify-between text-[6px] font-bold text-slate-400">
                          <div className="w-1/3 truncate">Texto do rodapé esquerdo configurado</div>
                          <div>Pág. 1 de 12</div>
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-100/50 to-transparent pointer-events-none" />
                    </div>
                    <p className="text-[10px] text-center font-bold text-slate-400 leading-relaxed px-4">
                      A visualização é uma representação esquemática do layout final do documento.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-4">
                <button 
                  onClick={() => setIsCustomizerOpen(false)}
                  className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    // Aqui salvaria as configurações
                    setIsCustomizerOpen(false);
                    // Feedback de sucesso
                    const toast = document.createElement('div');
                    toast.className = 'fixed bottom-6 right-6 bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl z-[9999] animate-in slide-in-from-bottom-5 duration-300';
                    toast.innerHTML = '<p class="text-xs font-black uppercase tracking-widest">Configurações Salvas com Sucesso!</p>';
                    document.body.appendChild(toast);
                    setTimeout(() => {
                      toast.style.opacity = '0';
                      setTimeout(() => toast.remove(), 300);
                    }, 2000);
                  }}
                  className="px-8 py-3 bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 rounded-xl shadow-lg transition-all"
                >
                  Salvar Configurações
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

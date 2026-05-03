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

      // 3. Define report structure based on name
      let columns: any[] = [
        { header: 'ITEM', key: 'item', width: 10 },
        { header: 'DESCRIÇÃO', key: 'descricao', width: 55 },
        { header: 'UND', key: 'unidade', width: 8 },
        { header: 'QTD', key: 'quantidade', width: 12, type: 'number' },
      ];

      const bdiValue = obraData.bdi || 0;
      const bdiIncidence = obraData.bdi_incidencia || 'unitario';

      // Customizing columns for specific report types
      if (reportName.includes('Mão de Obra') && reportName.includes('Material') && reportName.includes('Equipamento')) {
        columns.push(
          { header: 'MAT (UNIT)', key: 'mat_unit', width: 15, type: 'currency' },
          { header: 'MO (UNIT)', key: 'mo_unit', width: 15, type: 'currency' },
          { header: 'EQUIP (UNIT)', key: 'equip_unit', width: 15, type: 'currency' },
          { header: 'TOTAL UNIT.', key: 'total_unit', width: 16, type: 'currency' },
          { header: 'TOTAL GERAL', key: 'total_geral', width: 20, type: 'currency' }
        );
      } else if (reportName.includes('Mão de Obra') && reportName.includes('Material')) {
        columns.push(
          { header: 'MAT (UNIT)', key: 'mat_unit', width: 15, type: 'currency' },
          { header: 'MO (UNIT)', key: 'mo_unit', width: 15, type: 'currency' },
          { header: 'TOTAL UNIT.', key: 'total_unit', width: 16, type: 'currency' },
          { header: 'TOTAL GERAL', key: 'total_geral', width: 20, type: 'currency' }
        );
      } else if (reportName.includes('Mão de Obra')) {
        columns.push(
          { header: 'CUSTO MO', key: 'mo_unit', width: 15, type: 'currency' },
          { header: 'PREÇO UNIT.', key: 'total_unit', width: 16, type: 'currency' },
          { header: 'TOTAL', key: 'total_geral', width: 20, type: 'currency' }
        );
      } else {
        columns.push(
          { header: 'PREÇO UNIT.', key: 'total_unit', width: 16, type: 'currency' },
          { header: 'TOTAL', key: 'total_geral', width: 20, type: 'currency' }
        );
      }

      // Map rows with cost breakdown
      const rows = orcamentoData.map((it: any) => {
        const isEtapa = it.tipo === 'etapa';
        const qty = it.quantidade || 0;
        
        let unitPrice = it.valor_unitario || 0;
        let matVal = it.custo_material || 0;
        let moVal = it.custo_mao_obra || 0;
        let equipVal = it.custo_equipamento || 0;

        // Apply BDI if needed
        const applyBDI = (val: number) => bdiIncidence === 'unitario' ? val * (1 + bdiValue / 100) : val;

        if (isEtapa) {
          // For stages, the server already sends them summed up (total, mat, mo, equip)
          return {
            item: it.item || '',
            descricao: it.descricao?.toUpperCase(),
            unidade: it.unidade || '',
            quantidade: null,
            mat_unit: applyBDI(matVal),
            mo_unit: applyBDI(moVal),
            equip_unit: applyBDI(equipVal),
            total_unit: null,
            total_geral: it.total || 0,
            isEtapa: true
          };
        }

        return {
          item: it.item || '',
          descricao: it.descricao,
          unidade: it.unidade || '',
          quantidade: qty,
          mat_unit: applyBDI(matVal),
          mo_unit: applyBDI(moVal),
          equip_unit: applyBDI(equipVal),
          total_unit: applyBDI(unitPrice),
          total_geral: it.total || 0,
          isEtapa: false
        };
      });

      // Calculate Summary
      const totalGeral = rows.filter((r: any) => r.isEtapa && r.item.split('.').length === 1)
        .reduce((sum: number, r: any) => sum + (r.total_geral || 0), 0);

      await generateExcelReport({
        title: reportName,
        obraName: obraData.nome.toUpperCase(),
        cliente: obraData.cliente?.toUpperCase() || "N/A",
        columns,
        rows,
        summaryValues: [
          { label: 'VALOR TOTAL DO ORÇAMENTO', value: totalGeral }
        ]
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
                                onClick={() => handleExport(opt.label)}
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

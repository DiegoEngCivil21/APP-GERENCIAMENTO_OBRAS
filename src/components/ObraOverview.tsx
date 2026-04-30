import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import { formatFinancial } from '../utils';

interface ObraOverviewProps {
  obra: any;
  orcamento: any[];
  cronograma: any[];
  medicoes: any[];
  encargos?: {
    desonerado: boolean;
    estado: string;
    dataReferencia: string;
  };
  currentBancosAtivos?: any[];
  bdiIncidence?: 'unitario' | 'final';
  bdiValue?: number;
}

export const ObraOverview: React.FC<ObraOverviewProps> = ({ obra, orcamento, cronograma, medicoes, encargos, currentBancosAtivos, bdiIncidence = 'unitario', bdiValue = 0 }) => {
  const bdiMultiplier = bdiIncidence === 'final' ? (1 + bdiValue / 100) : 1;
  const totalOrcado = orcamento.filter(r => r.tipo === 'etapa' && !(r.item || '').toString().includes('.')).reduce((acc, r) => acc + (r.total || 0), 0) * bdiMultiplier;
  const totalMedido = medicoes.reduce((acc, med) => acc + (med.total_valor || 0), 0);
  const variacao = totalOrcado - totalMedido;

  // Use encargos if provided, otherwise fallback to obra data
  const desonerado = encargos ? encargos.desonerado : !!obra?.desonerado;
  const uf = encargos ? encargos.estado : (obra?.uf || 'DF');
  const dataReferencia = encargos ? encargos.dataReferencia : (obra?.data_referencia || 'N/A');
  const bancosAtivos = currentBancosAtivos || (() => {
    try {
      return typeof obra?.bancos_ativos === 'string' ? JSON.parse(obra.bancos_ativos) : (Array.isArray(obra?.bancos_ativos) ? obra.bancos_ativos : []);
    } catch (e) {
      return [];
    }
  })();

  // Prepare S-Curve Data (Cumulative Calculated)
  const getSCurveData = () => {
    // 1. Get unique months from schedule and measurements
    const monthsSet = new Set<string>();
    
    // Planned dates
    cronograma.forEach(act => {
      if (act.data_inicio_prevista) monthsSet.add(act.data_inicio_prevista.substring(0, 7));
      if (act.data_fim_prevista) monthsSet.add(act.data_fim_prevista.substring(0, 7));
    });
    
    // Actual dates
    medicoes.forEach(med => {
      if (med.data_medicao) monthsSet.add(med.data_medicao.substring(0, 7));
    });
    
    const sortedMonths = Array.from(monthsSet).sort();
    
    let cumPlanned = 0;
    let cumActual = 0;
    
    // Group activities by month of end date (simplified allocation)
    const plannedByMonth = new Map<string, number>();
    cronograma.forEach(act => {
      const month = act.data_fim_prevista?.substring(0, 7) || act.data_inicio_prevista?.substring(0, 7);
      if (month) {
        // Find corresponding budget item value
        const budgetItem = orcamento.find(oi => oi.id === act.orcamento_item_id || oi.id === `item-${act.orcamento_item_id}`);
        const value = (budgetItem?.total || (totalOrcado / (cronograma.length || 1))) * bdiMultiplier;
        plannedByMonth.set(month, (plannedByMonth.get(month) || 0) + value);
      }
    });

    const actualByMonth = new Map<string, number>();
    medicoes.forEach(med => {
      const month = med.data_medicao.substring(0, 7);
      actualByMonth.set(month, (actualByMonth.get(month) || 0) + (med.total_valor || 0));
    });

    return sortedMonths.map(month => {
      cumPlanned += (plannedByMonth.get(month) || 0);
      cumActual += (actualByMonth.get(month) || 0);
      
      // Don't show actual for future months
      const isPastOrCurrent = month <= new Date().toISOString().substring(0, 7);

      return {
        month: month.split('-').reverse().join('/'),
        planejado: cumPlanned,
        realizado: isPastOrCurrent ? cumActual : null,
        target: totalOrcado // Full budget line
      };
    });
  };

  const sCurveData = getSCurveData();

  // Prepare material data: Top 5 items from orcamento by value
  const materialData = orcamento
    .filter(item => item.tipo !== 'etapa')
    .sort((a, b) => (b.total || 0) - (a.total || 0))
    .slice(0, 6)
    .map(item => {
      const unitPrice = bdiIncidence === 'unitario' ? (item.valor_bdi || item.valor_unitario || 0) : (item.valor_unitario || 0);
      const medido = ((item.progresso || 0) / 100) * (item.total || 0) * bdiMultiplier;
      return {
        name: item.descricao.length > 20 ? item.descricao.substring(0, 20) + '...' : item.descricao,
        orcado: (item.total || 0) * bdiMultiplier,
        medido: medido
      };
    });

  // Prepare progress data
  const progressData = cronograma
    .sort((a, b) => new Date(a.data_inicio_prevista || 0).getTime() - new Date(b.data_inicio_prevista || 0).getTime())
    .slice(0, 8)
    .map(act => ({
      name: act.nome.length > 15 ? act.nome.substring(0, 15) + '...' : act.nome,
      progresso: act.progresso || 0
    }));

  return (
    <div className="space-y-8 pb-10">
      {/* Header Info Banner */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-6">
        <div className="flex gap-10">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 underline decoration-orange-500 decoration-2 underline-offset-4">Localização</span>
            <span className="text-sm font-black text-slate-900">{uf}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 underline decoration-blue-500 decoration-2 underline-offset-4">Tributação</span>
            <span className="text-sm font-black text-slate-900">{desonerado ? 'Desonerado' : 'Não Desonerado'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 underline decoration-emerald-500 decoration-2 underline-offset-4">Database Global</span>
            <span className="text-sm font-black text-slate-900">{dataReferencia}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fontes:</span>
          <div className="flex gap-2">
            {bancosAtivos.filter((b: any) => typeof b === 'string' || b.active !== false).map((b: any) => (
              <span key={typeof b === 'string' ? b : b.id} className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-black text-slate-600 uppercase tracking-tight">
                {typeof b === 'string' ? b : `${b.id} (${b.data_referencia || 'N/A'})`}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Totals */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Total Orçado</h4>
          <p className="text-2xl font-black text-slate-900 relative z-10">R$ {formatFinancial(totalOrcado)}</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Total Realizado</h4>
          <p className="text-2xl font-black text-emerald-600 relative z-10">R$ {formatFinancial(totalMedido)}</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Variação Acumulada</h4>
          <p className={`text-2xl font-black relative z-10 ${variacao >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
            R$ {formatFinancial(variacao)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Eficiência Geral</h4>
          <p className="text-2xl font-black text-indigo-600 relative z-10">
            {totalOrcado > 0 ? ((totalMedido / totalOrcado) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Curva S */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Curva S de Desempenho</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Acumulado Planejado vs Realizado</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sCurveData}>
                <defs>
                  <linearGradient id="colorPl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                <YAxis 
                  axisLine={false} tickLine={false} 
                  tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} 
                  tickFormatter={(value) => `R$ ${value/1000}k`} 
                />
                <Tooltip 
                  formatter={(value: number) => `R$ ${formatFinancial(value)}`}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                <Area type="monotone" dataKey="planejado" name="Planejado" stroke="#3b82f6" strokeWidth={3} fill="url(#colorPl)" />
                <Area type="monotone" dataKey="realizado" name="Realizado" stroke="#10b981" strokeWidth={3} fill="url(#colorReal)" />
                <Area type="monotone" dataKey="target" name="Orçamento Total" stroke="#94a3b8" strokeWidth={1} strokeDasharray="5 5" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Maiores Custos */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Maiores Impactos Financeiros</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Principais itens do orçamento</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={materialData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} width={120} />
                <Tooltip 
                   formatter={(value: number) => `R$ ${formatFinancial(value)}`}
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                <Bar dataKey="orcado" name="Orçado" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={12} />
                <Bar dataKey="medido" name="Realizado" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Progress of Activities */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-8 lg:col-span-2">
           <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Progresso do Cronograma</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Status das 8 primeiras atividades</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} unit="%" />
                <Tooltip 
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="progresso" name="Progresso" fill="#f59e0b" radius={[8, 8, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

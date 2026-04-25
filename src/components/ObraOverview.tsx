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

  // Prepare evolution data: Medicoes over time
  const evolutionData = medicoes.map(med => ({
    name: new Date(med.data_medicao).toLocaleDateString('pt-BR', { month: 'short' }),
    realizado: med.total_valor || 0,
    planejado: totalOrcado / (cronograma.length || 1) // Simple approximation
  }));

  // Prepare material data: Top 5 items from orcamento
  const materialData = orcamento
    .filter(item => item.tipo === 'insumo')
    .slice(0, 5)
    .map(item => {
      const quantidadeMedida = ((item.progresso || 0) / 100) * (item.quantidade || 0);
      const unitPrice = bdiIncidence === 'unitario' ? (item.valor_bdi || item.valor_unitario || 0) : (item.valor_unitario || 0);
      return {
        name: item.descricao.substring(0, 15),
        orcado: (item.total || 0) * bdiMultiplier,
        comprado: quantidadeMedida * unitPrice * bdiMultiplier
      };
    });

  // Prepare progress data
  const progressData = cronograma.slice(0, 5).map(act => ({
    name: act.descricao.substring(0, 15),
    progresso: act.percentual_concluido || 0
  }));

  // Simple forecast: 90% of budget for testing purposes
  const previsaoGasto = totalOrcado * 0.9;

  const financialComparisonData = [
    { name: 'Financeiro', orcado: totalOrcado, previsto: previsaoGasto, real: totalMedido }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-wrap gap-8">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado (UF)</span>
          <span className="text-sm font-bold text-[#003366]">{uf}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Desoneração</span>
          <span className="text-sm font-bold text-[#003366]">{desonerado ? 'Desonerado' : 'Não Desonerado'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Referência Global</span>
          <span className="text-sm font-bold text-[#003366]">{dataReferencia}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bancos Ativos</span>
          <div className="flex gap-2">
            {bancosAtivos.filter((b: any) => typeof b === 'string' || b.active !== false).map((b: any) => (
              <span key={typeof b === 'string' ? b : b.id} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-600 uppercase">
                {typeof b === 'string' ? b : `${b.id} (${b.data_referencia || 'N/A'})`}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Orçado</h4>
          <p className="text-2xl font-black text-slate-900">R$ {formatFinancial(totalOrcado)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Medido (Real)</h4>
          <p className="text-2xl font-black text-emerald-600">R$ {formatFinancial(totalMedido)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Variação (Orçado - Real)</h4>
          <p className={`text-2xl font-black ${variacao >= 0 ? 'text-blue-600' : 'text-red-600'}`}>R$ {formatFinancial(variacao)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">Comparativo Financeiro</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialComparisonData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{fontSize: 10}} />
                <YAxis tick={{fontSize: 10}} tickFormatter={(value) => `R$ ${value/1000}k`} />
                <Tooltip formatter={(value: number) => `R$ ${formatFinancial(value)}`} />
                <Legend />
                <Bar dataKey="orcado" name="Orçado" fill="#e2e8f0" />
                <Bar dataKey="previsto" name="Previsto" fill="#f59e0b" />
                <Bar dataKey="real" name="Real" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">Evolução Financeira (Medições)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{fontSize: 10}} />
                <YAxis tick={{fontSize: 10}} />
                <Tooltip />
                <Area type="monotone" dataKey="realizado" name="Realizado" fill="#10b981" stroke="#10b981" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">Materiais (Orçado vs Medido)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={materialData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{fontSize: 10}} width={80} />
                <Tooltip />
                <Legend />
                <Bar dataKey="orcado" name="Orçado" fill="#e2e8f0" />
                <Bar dataKey="comprado" name="Medido" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">Progresso das Atividades</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{fontSize: 10}} />
                <YAxis tick={{fontSize: 10}} />
                <Tooltip />
                <Bar dataKey="progresso" name="Progresso (%)" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

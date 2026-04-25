import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Package, TrendingUp, Calendar, ArrowRight, FileText, DollarSign, Ruler } from 'lucide-react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { MetricCard, StatusBadge } from '../components/UIComponents';
import { api } from '../services/api';
import { Obra, DashboardMetrics } from '../types/index';
import { truncateToTwo, formatFinancial } from '../utils';

export const Dashboard = ({ isAdmin, onSelectObra, setActiveTab }: { isAdmin: boolean, onSelectObra: (id: string | number) => void, setActiveTab: (tab: string) => void }) => {
  console.log("Dashboard rendering...");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [obrasRecentes, setObrasRecentes] = useState<Obra[]>([]);
  const [cronogramasAtivos, setCronogramasAtivos] = useState<any[]>([]);
  const [ultimasMedicoes, setUltimasMedicoes] = useState<any[]>([]);
  const [ultimosDiarios, setUltimosDiarios] = useState<any[]>([]);

  const handleClearDatabase = async () => {
    if (confirm("Tem certeza que deseja excluir TODO o banco de dados? Esta ação é irreversível.")) {
      try {
        const res = await fetch('/api/admin/clear-database', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: 'all' })
        });
        if (res.ok) {
          alert("Banco de dados limpo com sucesso!");
          window.location.reload();
        } else {
          alert("Erro ao limpar banco de dados.");
        }
      } catch (err) {
        alert("Erro de conexão.");
      }
    }
  };

  useEffect(() => {
    api.getDashboard().then(data => {
      if (data) {
        setMetrics(data.metrics);
        setObrasRecentes(data.obrasRecentes);
        setCronogramasAtivos(data.cronogramasAtivos || []);
        setUltimasMedicoes(data.ultimasMedicoes || []);
        setUltimosDiarios(data.ultimosDiarios || []);
      } else {
        setError("Dados do dashboard não encontrados.");
      }
    }).catch(err => {
      console.error("Erro ao carregar dashboard:", err);
      setError("Erro ao carregar dados do dashboard. Verifique sua conexão ou tente novamente mais tarde.");
    });
  }, []);

  if (error) {
    return (
      <div className="p-12 text-center">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md mx-auto">
          <p className="text-red-600 font-bold mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) return <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest">Carregando dashboard...</div>;

  return (
    <div className="space-y-8 pb-20">
      {isAdmin && (
        <div className="flex justify-end">
          <button 
            onClick={handleClearDatabase}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all"
          >
            Limpar Todo o Banco de Dados
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <MetricCard 
          title="Total de Obras" 
          value={metrics.totalObras} 
          icon={FileText} 
          color="bg-blue-600" 
          delay={0.1}
        />
        <MetricCard 
          title="Ativas" 
          value={metrics.obrasAndamento} 
          icon={TrendingUp} 
          color="bg-indigo-600" 
          delay={0.15}
        />
        <MetricCard 
          title="Progresso Médio" 
          value={`${metrics.progressoMedio}%`} 
          icon={TrendingUp} 
          color="bg-amber-500" 
          delay={0.2}
        />
        <MetricCard 
          title="Orçado Total" 
          value={`R$ ${formatFinancial(metrics?.totalOrcado || 0)}`} 
          icon={DollarSign} 
          color="bg-emerald-500" 
          delay={0.3}
        />
        <MetricCard 
          title="Medido Total" 
          value={`R$ ${formatFinancial(metrics?.totalMedido || 0)}`} 
          icon={Ruler} 
          color="bg-indigo-500" 
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Obras Recentes */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 flex justify-between items-center border-b border-slate-50">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Obras Recentes</h3>
            <button 
              onClick={() => setActiveTab('obras')}
              className="text-[10px] font-black text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors uppercase tracking-widest"
            >
              Ver todas <ArrowRight size={12} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Obra</th>
                  <th className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {obrasRecentes.map((obra, idx) => (
                  <tr key={`recent-obra-${obra.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-3 py-1.5">
                      <span className="font-bold text-slate-900 text-sm">{obra.nome}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusBadge status={obra.status} />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <button 
                        onClick={() => onSelectObra(obra.id)}
                        className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <ArrowRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cronogramas em Andamento */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 flex justify-between items-center border-b border-slate-50">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Cronogramas em Andamento</h3>
          </div>
          <div className="p-6 space-y-4">
            {cronogramasAtivos.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-sm font-bold uppercase tracking-widest">Nenhuma atividade ativa</p>
            ) : cronogramasAtivos.map((task, idx) => (
              <div key={`active-task-${idx}`} className="space-y-2">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{task.obra_nome}</p>
                    <p className="text-sm font-bold text-slate-900">{task.nome}</p>
                  </div>
                  <span className="text-xs font-black text-slate-900">{task.progresso}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${task.progresso}%` }}
                    className="h-full bg-orange-500" 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Últimas Medições */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Últimas Medições</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {ultimasMedicoes.length === 0 ? (
              <p className="text-center py-12 text-slate-400 text-sm font-bold uppercase tracking-widest">Nenhuma medição recente</p>
            ) : ultimasMedicoes.map((med, idx) => (
              <div key={`recent-med-${idx}`} className="p-6 flex justify-between items-center hover:bg-slate-50/50 transition-colors">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{med.obra_nome}</p>
                  <p className="text-sm font-bold text-slate-900">{new Date(med.data_medicao).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-emerald-600">R$ {formatFinancial(med.total_valor || 0)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Últimos Diários */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Últimos Diários de Obra</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {ultimosDiarios.length === 0 ? (
              <p className="text-center py-12 text-slate-400 text-sm font-bold uppercase tracking-widest">Nenhum diário recente</p>
            ) : ultimosDiarios.map((diario, idx) => (
              <div key={`recent-diario-${idx}`} className="p-6 hover:bg-slate-50/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{diario.obra_nome}</p>
                    <p className="text-sm font-bold text-slate-900">{new Date(diario.data).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                    {diario.usuario_responsavel || 'Sistema'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{diario.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

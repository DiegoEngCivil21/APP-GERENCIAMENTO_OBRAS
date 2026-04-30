import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Package, TrendingUp, Calendar, ArrowRight, FileText, DollarSign, Ruler, Building2, Users, Briefcase, HardHat, Plus, AlertCircle, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend } from 'recharts';
import { MetricCard, StatusBadge } from '../components/UIComponents';
import { api } from '../services/api';
import { Obra, DashboardMetrics } from '../types/index';
import { truncateToTwo, formatFinancial } from '../utils';

export const Dashboard = ({ isAdmin, onSelectObra, setActiveTab }: { isAdmin: boolean, onSelectObra: (id: string | number) => void, setActiveTab: (tab: string) => void }) => {
  console.log("Dashboard rendering...");
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    api.getDashboard().then(res => {
      if (res) {
        setData(res);
      } else {
        setError("Dados do dashboard não encontrados.");
      }
    }).catch(err => {
      console.error("Erro ao carregar dashboard:", err);
      setError("Erro ao carregar dados do dashboard.");
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

  if (!data) return <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest">Carregando dashboard...</div>;

  // Master Admin view
  if (data.isMaster) {
    return (
      <div className="space-y-8 pb-20 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <MetricCard 
            title="Empresas" 
            value={data.metrics.totalTenants} 
            icon={Building2} 
            color="bg-orange-500" 
            delay={0.1}
          />
          <MetricCard 
            title="Potencial Mensal" 
            value={`R$ ${formatFinancial(data.metrics.projectedRevenue || 0)}`} 
            icon={TrendingUp} 
            color="bg-blue-600" 
            delay={0.2}
          />
          <MetricCard 
            title="Receita Real (Mês)" 
            value={`R$ ${formatFinancial(data.metrics.totalRevenue || 0)}`} 
            icon={DollarSign} 
            color="bg-emerald-500" 
            delay={0.3}
          />
          <MetricCard 
            title="Assinaturas Ativas" 
            value={data.metrics.activeTenants} 
            icon={Briefcase} 
            color="bg-indigo-600" 
            delay={0.4}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden lg:col-span-2">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <h3 style={{ height: '20px' }} className="text-xs font-black text-slate-900 uppercase tracking-widest">Projeção Financeira</h3>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white rounded-lg transition-all hover:bg-slate-800">Mês</button>
                <button className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Semana</button>
              </div>
            </div>
            <div className="p-6 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.charts.financial}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(val) => `R$ ${val/1000}k`}
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  />
                  <Tooltip 
                    formatter={(val: any) => [`R$ ${formatFinancial(val)}`, 'Receita']}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorRev)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Status das Empresas</h3>
            </div>
            <div className="p-6 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.status}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Crescimento de Base</h3>
            </div>
            <div className="p-6 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.charts.growth}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#f97316" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorCount)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 flex justify-between items-center border-b border-slate-50">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Empresas Recém Cadastradas</h3>
              <button 
                onClick={() => setActiveTab('empresas')}
                className="text-[10px] font-black text-orange-500 hover:text-orange-600 flex items-center gap-1 transition-all uppercase tracking-widest"
              >
                Gerenciar Empresas <ArrowRight size={14} />
              </button>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {data.recentTenants.map((tenant: any) => (
                  <div key={tenant.id} className="group flex items-center justify-between p-5 bg-slate-50/50 border border-slate-100 rounded-2xl hover:border-orange-500/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white border border-slate-200 text-slate-900 rounded-xl flex items-center justify-center font-black text-lg shadow-sm">
                        {tenant.nome.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                           <h4 className="font-bold text-slate-900 tracking-tight">{tenant.nome}</h4>
                           <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-black uppercase tracking-widest">{tenant.plano}</span>
                           {tenant.valor_mensalidade > 0 && (
                             <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold uppercase tracking-widest">R$ {formatFinancial(tenant.valor_mensalidade)}</span>
                           )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                            tenant.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                          }`}>
                            {tenant.status === 'active' ? 'Ativo' : 'Trial'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">Desde {new Date(tenant.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveTab('empresas')}
                      className="p-2 text-slate-400 hover:text-orange-500 transition-colors"
                    >
                      <ArrowRight size={18} />
                    </button>
                  </div>
                ))}
                {data.recentTenants.length === 0 && (
                  <div className="py-20 text-center">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Nenhuma empresa cadastrada</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { metrics, obrasRecentes, cronogramasAtivos, ultimasMedicoes, ultimosDiarios, alerts } = data;
  const hasAlerts = alerts && alerts.length > 0;

  return (
    <div className="space-y-8 pb-20">
      {/* Seção de Alertas Críticos */}
      {hasAlerts && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((alert: any) => (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              key={alert.id}
              className={`flex items-start gap-4 p-4 rounded-2xl border ${
                alert.type === 'danger' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
              }`}
            >
              <div className={`p-2 rounded-xl scale-75 ${
                alert.type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
              }`}>
                <AlertCircle size={20} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                   <h4 className={`text-xs font-black uppercase tracking-widest ${
                     alert.type === 'danger' ? 'text-red-700' : 'text-amber-700'
                   }`}>{alert.title}</h4>
                   <button 
                     onClick={() => onSelectObra(alert.obraId)}
                     className="text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all"
                   >
                     Resolver <ChevronRight size={10} className="inline" />
                   </button>
                </div>
                <p className={`text-xs mt-1 font-medium leading-relaxed ${
                  alert.type === 'danger' ? 'text-red-600/80' : 'text-amber-600/80'
                }`}>{alert.message}</p>
              </div>
            </motion.div>
          ))}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico de Orçado vs Medido */}
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden lg:col-span-2">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Desempenho Financeiro por Obra</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Comparativo Orçado vs Medido (Executado)</p>
            </div>
          </div>
          <div className="p-6 h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts?.budgetVsMedido || []} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  type="number"
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(val) => `R$ ${val/1000}k`}
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                />
                <YAxis 
                  dataKey="nome" 
                  type="category"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  width={150}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  formatter={(val: any) => `R$ ${formatFinancial(val)}`}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                <Bar name="Orçado" dataKey="orçado" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                <Bar name="Medido" dataKey="medido" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Status das Obras */}
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Distribuição de Status</h3>
          </div>
          <div className="p-6 h-[350px] flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.charts?.obrasPorStatus || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="status"
                >
                  {(data.charts?.obrasPorStatus || []).map((entry: any, index: number) => {
                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444'];
                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                  })}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-4 w-full mt-4">
              {(data.charts?.obrasPorStatus || []).map((entry: any, index: number) => {
                const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-indigo-500', 'bg-red-500'];
                return (
                  <div key={`legend-${index}`} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${colors[index % colors.length]}`} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase truncate">{entry.status || 'N/A'}: {entry.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Obras Recentes */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 flex justify-between items-center border-b border-slate-50">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Obras Recentes</h3>
            <button 
              onClick={() => setActiveTab('obras')}
              className="text-[10px] font-black text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-all uppercase tracking-widest"
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

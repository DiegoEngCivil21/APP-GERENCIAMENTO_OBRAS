import React, { useState, useEffect, useRef, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { 
  LayoutDashboard, 
  HardHat, 
  Database, 
  Layers, 
  FileText, 
  Calendar, 
  TrendingUp, 
  BookOpen, 
  Ruler,
  Plus,
  Search,
  ChevronRight,
  MoreVertical,
  AlertCircle,
  Settings,
  LogOut,
  Hammer,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  DollarSign,
  Building2,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Bell,
  User,
  Users,
  HelpCircle,
  Clock,
  Briefcase,
  Package,
  List,
  ListChecks,
  Download,
  Upload,
  X,
  ShieldCheck,
  BrickWall,
  Box,
  FileUp,
  Trash2,
  Wrench,
  Edit2,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Check,
  RefreshCw,
  ShoppingCart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OrcamentoItem } from './types/index';
import { format } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart
} from 'recharts';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { ObraOverview } from './components/ObraOverview';
import { BudgetFilterBar } from './components/BudgetFilterBar';
import { Obra, Insumo, Composicao, DashboardData } from './types/index';
import { MetricCard, StatusBadge, SidebarItem, Button, TopToolbar } from './components/UIComponents';
import { BancosModal } from './components/Modals';
import { Dashboard } from './pages/Dashboard';
import { truncateToTwo, formatFinancial, calculateItemTotal, parseBrazilianNumber, BRAZILIAN_STATES } from './utils';
import InsumosView from './components/InsumosView';
import InsumosMgmtView from './components/InsumosMgmtView';
import ComposicoesView from './components/ComposicoesView';
import ComposicoesMgmtView from './components/ComposicoesMgmtView';
import ComposicaoDetailView from './components/ComposicaoDetailView';
import AutocompleteDropdown from './components/AutocompleteDropdown';
import { SearchDialog } from './components/SearchDialog';
import TemplatesView from './components/TemplatesView';
import EmpresasMgmtView from './components/EmpresasMgmtView';
import DiarioObraTab from './components/DiarioObraTab';
import MedicaoTab from './components/MedicaoTab';
import { Login } from './pages/Login';
import { SettingsView } from './pages/Settings';
import { ResetPassword } from './pages/ResetPassword';

import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate,
  useLocation
} from 'react-router-dom';

// --- Views ---

// Removed local InsumosView, ComposicoesView, and AutocompleteDropdown to resolve TS2440 conflicts
// Removed local InsumosView implementation
// Removed local ComposicoesView implementation
// Removed local AutocompleteDropdown to resolve TS2440 conflict
import { CronogramaView } from './components/CronogramaView';

const MedicaoView = ({ obraId, orcamento, bdiIncidence, bdiValue }: { obraId: string | number; orcamento: any[]; bdiIncidence: string; bdiValue: number }) => {
  const [medicoes, setMedicoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewMedicao, setShowNewMedicao] = useState(false);
  const [medicaoItems, setMedicaoItems] = useState<any[]>([]);
  const [medicaoDate, setMedicaoDate] = useState(new Date().toISOString().split('T')[0]);
  const [medicaoPeriodoInicio, setMedicaoPeriodoInicio] = useState('');
  const [medicaoPeriodoFim, setMedicaoPeriodoFim] = useState('');
  const [medicaoObservacoes, setMedicaoObservacoes] = useState('');

  const fetchMedicoes = async () => {
    try {
      const response = await fetch(`/api/obras/${obraId}/medicoes`);
      if (response.ok) {
        const data = await response.json();
        setMedicoes(data);
      }
    } catch (error) {
      console.error("Error fetching medicoes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicoes();
  }, [obraId]);

  const handleOpenNewMedicao = () => {
    const items = orcamento
      .filter(item => item.tipo === 'composicao' || item.tipo === 'insumo')
      .map(item => ({
        ...item,
        quantidade_medida: 0
      }));
    setMedicaoItems(items);
    setShowNewMedicao(true);
  };

  const handleSaveMedicao = async () => {
    const itemsToSave = medicaoItems
      .filter(item => item.quantidade_medida > 0)
      .map(item => ({
        orcamento_item_id: item.id,
        quantidade_medida: item.quantidade_medida
      }));

    if (itemsToSave.length === 0) {
      alert("Adicione pelo menos um item medido.");
      return;
    }

    try {
      const response = await fetch(`/api/obras/${obraId}/medicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_medicao: medicaoDate,
          periodo_inicio: medicaoPeriodoInicio,
          periodo_fim: medicaoPeriodoFim,
          observacoes: medicaoObservacoes,
          itens: itemsToSave
        })
      });

      if (response.ok) {
        setShowNewMedicao(false);
        fetchMedicoes();
      } else {
        const error = await response.json();
        alert("Erro ao salvar medição: " + error.message);
      }
    } catch (error) {
      console.error("Error saving medicao:", error);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest">Carregando medições...</div>;

  return (
    <div className="space-y-6 pb-[50vh] px-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Histórico de Medições</h3>
        <button 
          onClick={handleOpenNewMedicao}
          className="px-4 py-2 bg-[#1a2233] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"
        >
          <Plus size={14} /> Nova Medição
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="bg-slate-50/50 border-b border-slate-200">
              <th className="px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-28">Data</th>
              <th className="px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Período</th>
              <th className="px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-32">Valor</th>
              <th className="px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-16">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {medicoes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-slate-400 text-sm font-bold uppercase tracking-widest">Nenhuma medição registrada</td>
              </tr>
            ) : medicoes.map((med, idx) => (
              <tr key={`med-${med.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-1.5 w-28">
                  <span className="text-sm font-bold text-slate-900">{new Date(med.data_medicao).toLocaleDateString('pt-BR')}</span>
                </td>
                <td className="px-4 py-1.5">
                  <span className="text-xs font-medium text-slate-500 truncate block">
                    {new Date(med.periodo_inicio).toLocaleDateString('pt-BR')} até {new Date(med.periodo_fim).toLocaleDateString('pt-BR')}
                  </span>
                </td>
                <td className="px-4 py-1.5 text-right w-32">
                  <span className="text-sm font-black text-emerald-600">R$ {formatFinancial(med.total_valor || 0)}</span>
                </td>
                <td className="px-4 py-1.5 text-right w-16">
                  <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                    <ArrowRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNewMedicao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Registrar Nova Medição</h3>
              <button onClick={() => setShowNewMedicao(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-8 grid grid-cols-2 gap-6 bg-white border-b border-slate-100">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Data da Medição</label>
                <input
                  type="date"
                  value={medicaoDate}
                  onChange={(e) => setMedicaoDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Período Início</label>
                <input
                  type="date"
                  value={medicaoPeriodoInicio}
                  onChange={(e) => setMedicaoPeriodoInicio(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Período Fim</label>
                <input
                  type="date"
                  value={medicaoPeriodoFim}
                  onChange={(e) => setMedicaoPeriodoFim(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Observações</label>
                <input
                  type="text"
                  value={medicaoObservacoes}
                  onChange={(e) => setMedicaoObservacoes(e.target.value)}
                  placeholder="Ex: Medição referente a..."
                  className="w-full px-4 py-3 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <table className="w-full text-left border-collapse table-fixed">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-slate-100">
                    <th className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                    <th className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-24">Qtd. Total</th>
                    <th className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-24">Já Medido</th>
                    <th className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-28">Qtd. Medir</th>
                    <th className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-32">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {medicaoItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2">
                        <div className="text-sm font-bold text-slate-900 truncate" title={item.descricao}>{item.descricao}</div>
                        <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{item.codigo}</div>
                      </td>
                      <td className="py-2 text-right text-xs font-medium text-slate-500 w-24">{item.quantidade} {item.unidade}</td>
                      <td className="py-2 text-right text-xs font-medium text-slate-500 w-24">
                        {((item.progresso || 0) / 100 * item.quantidade).toFixed(2)}
                      </td>
                      <td className="py-2 text-right w-28">
                        <input
                          type="number"
                          value={isNaN(item.quantidade_medida) ? "" : item.quantidade_medida}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const newItems = [...medicaoItems];
                            newItems[idx].quantidade_medida = val;
                            setMedicaoItems(newItems);
                          }}
                          className="w-full px-3 py-1.5 border border-slate-100 rounded-xl text-right text-sm font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        />
                      </td>
                      <td className="py-2 text-right text-sm font-black text-slate-900 w-32 truncate">
                        {formatFinancial(item.quantidade_medida * (item.custo_unitario_aplicado || 0) * (bdiIncidence === 'unitario' ? (1 + bdiValue / 100) : 1))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                Total da Medição: <span className="text-xl font-black text-slate-900 ml-2">
                  R$ {formatFinancial(medicaoItems.reduce((acc, item) => acc + (item.quantidade_medida * (item.custo_unitario_aplicado || 0) * (bdiIncidence === 'unitario' ? (1 + bdiValue / 100) : 1)), 0) * (bdiIncidence === 'final' ? (1 + bdiValue / 100) : 1))}
                </span>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowNewMedicao(false)}
                  className="px-6 py-3 border border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveMedicao}
                  className="px-8 py-3 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all"
                >
                  Salvar Medição
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

import { useDragScroll } from './hooks/useDragScroll';

const ObraDetailView = ({ obraId, onBack, onNavigateToComposicao, isAdmin = false, isMaster = false }: { obraId: string | number, onBack: () => void, onNavigateToComposicao: (id: string | number) => void, isAdmin?: boolean, isMaster?: boolean }) => {
  const dragScroll = useDragScroll();
  const [obra, setObra] = useState<Obra | null>(null);
  const [orcamento, setOrcamento] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [encargos, setEncargos] = useState({
    desonerado: false,
    horista: 0.0,
    mensalista: 0.0,
    incidir: false,
    estado: 'DF',
    dataReferencia: '2026-04'
  });

  const [bancosAtivos, setBancosAtivos] = useState<any[]>([
    { id: 'sinapi', name: 'SINAPI - 04/2026', active: true, data_referencia: '2026-04-01' },
  ]);

  const [bdiValue, setBdiValue] = useState(0);
  const [descontoValue, setDescontoValue] = useState(0);
  const [bdiIncidence, setBdiIncidence] = useState<'unitario' | 'final'>('unitario');
  const [bdiType, setBdiType] = useState<'unico' | 'detalhado'>('unico');

  const fetchCompositionInsumos = useCallback(async (composicaoId: number, dataReferencia: string, estado: string, desonerado: boolean, bancosAtivos: any[]) => {
    console.log(`Fetching insumos for composition ${composicaoId} with dataReferencia: "${dataReferencia}"`);
    if (!dataReferencia) {
        console.error(`dataReferencia is missing for composition ${composicaoId}`);
    }
    const params = new URLSearchParams({
      data_referencia: dataReferencia,
      estado: estado,
      desonerado: desonerado.toString(),
      bancos_ativos: JSON.stringify(bancosAtivos.filter(b => b.active).map(b => ({ id: b.id, data_referencia: b.data_referencia })))
    });
    const url = `/api/composicoes/${composicaoId}/insumos?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Error fetching insumos for composition ${composicaoId}: ${res.status} - ${errorText}`);
        throw new Error(`Failed to fetch insumos: ${res.status} - ${errorText}`);
    }
    return await res.json();
  }, []);

  const [abcData, setAbcData] = useState<any[]>([]);
  const [abcCategoryFilter, setAbcCategoryFilter] = useState<'all' | 'material' | 'mao_de_obra' | 'equipamento' | 'encargos'>('all');

  const calculateAbcData = useCallback(async (orcamentoItems: OrcamentoItem[], dataReferencia: string, estado: string, desonerado: boolean, bancosAtivos: any[], bdiIncidence: string = 'unitario', bdiValue: number = 0) => {
    try {
      console.log('Calculating ABC data. Total items:', orcamentoItems.length, 'Data Referencia:', dataReferencia);
      
      let itemsToProcess: any[] = [];
      // ABC/Suprimentos analysis should use direct costs (no BDI)
      const bdiMultiplier = 1;

      // ABC of Insumos: Explode all compositions
      const compositionItems = orcamentoItems.filter(item => item.tipo === 'composicao');
      const insumoItems = orcamentoItems.filter(item => item.tipo === 'insumo');

        const insumosMap = new Map<number, { descricao: string, unidade: string, quantidade: number, preco_unitario: number, valor_total: number, tipo: string, categoria: string }>();

        const results = await Promise.all(compositionItems.map(item => fetchCompositionInsumos(item.item_id!, dataReferencia, estado, desonerado, bancosAtivos)));
        
        compositionItems.forEach((item, index) => {
          const subInsumos = results[index];
          if (Array.isArray(subInsumos)) {
            for (const sub of subInsumos) {
              const existing = insumosMap.get(sub.item_id) || { 
                descricao: sub.descricao, 
                unidade: sub.unidade || 'un',
                quantidade: 0,
                preco_unitario: 0,
                valor_total: 0, 
                tipo: 'Insumo', 
                categoria: sub.categoria || 'Material' 
              };
              const subQty = (sub.quantidade || 0) * item.quantidade;
              const subTotal = (sub.valor_unitario || 0) * (sub.quantidade || 0) * item.quantidade;
              existing.quantidade += subQty;
              existing.valor_total += subTotal;
              existing.preco_unitario = existing.quantidade > 0 ? existing.valor_total / existing.quantidade : 0;
              insumosMap.set(sub.item_id, existing);
            }
          }
        });

        insumoItems.forEach(item => {
          if (item.item_id) {
            const existing = insumosMap.get(item.item_id) || { 
              descricao: item.descricao, 
              unidade: item.unidade || 'un',
              quantidade: 0,
              preco_unitario: 0,
              valor_total: 0, 
              tipo: 'Insumo', 
              categoria: item.categoria || 'Material' 
            };
            existing.quantidade += item.quantidade;
            console.log("Analyzing item for ABC:", item);
            existing.valor_total += (item.valor_unitario || 0) * item.quantidade;
            existing.preco_unitario = existing.quantidade > 0 ? existing.valor_total / existing.quantidade : 0;
            insumosMap.set(item.item_id, existing);
          }
        });

        itemsToProcess = Array.from(insumosMap.entries()).map(([id, data]) => ({
          id,
          ...data
        }));

      // Calculate total value
      const totalValue = itemsToProcess.reduce((acc, item) => acc + item.valor_total, 0);
      console.log('Total budget value for ABC:', totalValue);

      // Sort and classify
      const sortedItems = itemsToProcess.sort((a, b) => b.valor_total - a.valor_total);

      let accumulatedPercent = 0;
      const abcResult = sortedItems.map(item => {
        const percentual = totalValue > 0 ? (item.valor_total / totalValue) * 100 : 0;
        accumulatedPercent += percentual;
        let classe = 'C';
        if (accumulatedPercent <= 80) classe = 'A';
        else if (accumulatedPercent <= 95) classe = 'B';
        return { ...item, percentual, percentualAcumulado: accumulatedPercent, classe };
      });

      console.log('ABC data calculated, items:', abcResult.length);
      setAbcData(abcResult);
    } catch (error) {
      console.error('Error calculating ABC data:', error);
    }
  }, [fetchCompositionInsumos]);

  useEffect(() => {
    console.log('useEffect triggered for orcamento change, length:', orcamento.length);
    if (orcamento.length > 0) {
      calculateAbcData(orcamento, encargos.dataReferencia, encargos.estado, encargos.desonerado, bancosAtivos, bdiIncidence, bdiValue);
    }
  }, [orcamento, calculateAbcData, encargos.dataReferencia, encargos.estado, encargos.desonerado, bancosAtivos, bdiIncidence, bdiValue]);

  const fetchJson = async (url: string) => {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}, message: ${text}`);
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON: ${text.substring(0, 50)}...`);
    }
  };

  const fetchDatabases = async (initialDataReferencia?: string, initialBancosAtivos?: any[]) => {
    try {
      const data = await fetchJson('/api/databases');
      if (Array.isArray(data) && data.length > 0) {
        let activeBancos: any[] = initialBancosAtivos || [{ id: 'sinapi', active: true }];
        if (!initialBancosAtivos && obra?.bancos_ativos) {
          try {
            const parsed = typeof obra.bancos_ativos === 'string' ? JSON.parse(obra.bancos_ativos) : (Array.isArray(obra.bancos_ativos) ? obra.bancos_ativos : [{ id: 'sinapi', active: true }]);
            activeBancos = Array.isArray(parsed) ? parsed : [{ id: 'sinapi', active: true }];
          } catch (e) {
            console.error("Error parsing bancos_ativos:", e);
          }
        }
        const currentDataRef = initialDataReferencia || encargos.dataReferencia;
        const merged = data.map(db => {
          const found = activeBancos.find(ab => (typeof ab === 'string' ? ab === db.id : ab.id === db.id));
          return {
            ...db,
            active: !!found,
            ...(typeof found === 'object' ? found : {}),
            available_dates: db.available_dates,
            data_referencia: (typeof found === 'object' && found.data_referencia) ? found.data_referencia : (currentDataRef || db.data_referencia)
          };
        });
        setBancosAtivos(merged);
      }
    } catch (err) {
      console.error("Error fetching databases:", err);
    }
  };

  const fetchData = async () => {
    if (isInitialLoad && !obra) return;
    
    const params = new URLSearchParams({
      desonerado: encargos.desonerado.toString(),
      estado: encargos.estado,
      data_referencia: encargos.dataReferencia,
      bancos_ativos: JSON.stringify(bancosAtivos.filter(b => b.active).map(b => ({ id: b.id, data_referencia: b.data_referencia })))
    });

    const endpoints = [
      { key: 'obra', url: `/api/obras/${obraId}` },
      { key: 'orcamento', url: `/api/obras/${obraId}/orcamento?${params.toString()}` },
      { key: 'diarios', url: `/api/obras/${obraId}/diario` },
      { key: 'cronograma', url: `/api/obras/${obraId}/cronograma` },
      { key: 'medicoes', url: `/api/obras/${obraId}/medicoes` }
    ];

    try {
      const results = await Promise.all(endpoints.map(e => fetchJson(e.url).catch(err => {
        console.error(`Error fetching ${e.url}:`, err);
        return null;
      })));

      let hasError = false;
      results.forEach((data, i) => {
        if (!data) {
          if (endpoints[i].key === 'obra') hasError = true;
          return;
        }
        const key = endpoints[i].key;
        if (key === 'obra' && !Array.isArray(data)) setObra(data);
        else if (key === 'orcamento' && Array.isArray(data)) {
          console.log('Orcamento data received:', data.length, 'items');
          setOrcamento(data);
        }
        else if (key === 'diarios' && Array.isArray(data)) setDiarios(data);
        else if (key === 'cronograma' && Array.isArray(data)) setCronograma(data);
        else if (key === 'medicoes' && Array.isArray(data)) setMedicoes(data);
      });

      if (hasError && !obra) {
        setError("Erro ao carregar dados da obra.");
      }
    } catch (err) {
      console.error("Error in fetchData:", err);
      setError("Erro de conexão com o servidor.");
    }
  };

  useEffect(() => {
    const loadObra = async () => {
      try {
        const res = await fetch(`/api/obras/${obraId}`);
        if (!res.ok) {
          console.error("Error loading obra:", res.status, res.statusText);
          if (res.status === 404) {
            onBack(); // Go back to the list if obra is not found
          }
          return;
        }
        const data = await res.json();
        setObra(data);
        console.log("DEBUG: Obra data loaded:", data);
        if (data?.bdi !== undefined) setBdiValue(data.bdi);
        if (data?.desconto !== undefined) setDescontoValue(data.desconto);
        if (data?.bdi_incidencia) setBdiIncidence(data.bdi_incidencia);
        if (data?.bdi_tipo) setBdiType(data.bdi_tipo);
        
        // Initialize encargos from Obra data
        const obraDataRef = data?.data_referencia || encargos.dataReferencia;
        setEncargos(prev => ({
          ...prev,
          desonerado: (data?.desonerado !== undefined && data?.desonerado !== null) ? data?.desonerado === 1 : prev.desonerado,
          horista: data?.encargos_horista || prev.horista,
          mensalista: data?.encargos_mensalista || prev.mensalista,
          incidir: (data?.encargos_incidir !== undefined && data?.encargos_incidir !== null) ? data?.encargos_incidir === 1 : prev.incidir,
          estado: data?.uf || prev.estado,
          dataReferencia: obraDataRef
        }));
        
        setIsInitialLoad(false);
        
        let activeBancosFromObra: any[] = [{ id: 'sinapi', active: true }];
        if (data?.bancos_ativos) {
          try {
            const parsed = typeof data.bancos_ativos === 'string' ? JSON.parse(data.bancos_ativos) : (Array.isArray(data.bancos_ativos) ? data.bancos_ativos : [{ id: 'sinapi', active: true }]);
            activeBancosFromObra = Array.isArray(parsed) ? parsed : [{ id: 'sinapi', active: true }];
          } catch (e) {
            console.error("Error parsing bancos_ativos from obra:", e);
          }
        }
        
        fetchDatabases(obraDataRef, activeBancosFromObra);
      } catch (err) {
        console.error("Error loading obra:", err);
      }
    };
    loadObra();
  }, [obraId]);

  useEffect(() => {
    if (!isInitialLoad) {
      fetchData();
    }
  }, [
    obraId, 
    encargos.desonerado, 
    encargos.estado, 
    encargos.dataReferencia, 
    isInitialLoad, 
    JSON.stringify(bancosAtivos.filter(b => b.active).map(b => ({ id: b.id, data_referencia: b.data_referencia })))
  ]);

  // Save changes to DB
  useEffect(() => {
    if (isInitialLoad || !obra) return;

    const timer = setTimeout(async () => {
      await fetch(`/api/obras/${obraId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...obra,
          uf: encargos.estado,
          desonerado: encargos.desonerado ? 1 : 0,
          desconto: descontoValue,
          encargos_horista: encargos.horista,
          encargos_mensalista: encargos.mensalista,
          encargos_incidir: encargos.incidir ? 1 : 0,
          data_referencia: encargos.dataReferencia,
          bancos_ativos: JSON.stringify(bancosAtivos.filter(b => b.active))
        })
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [encargos.desonerado, encargos.horista, encargos.mensalista, encargos.incidir, encargos.estado, encargos.dataReferencia, bdiValue, bdiIncidence, bdiType, descontoValue, isInitialLoad, obraId, obra, bancosAtivos]);

  const handleItemChange = async (id: string, newItem: string) => {
    const targetRow = orcamento.find(r => r.id === id);
    if (!targetRow) return;

    // Clean input by removing .0 suffix if present
    const cleanedNewItem = newItem.endsWith('.0') ? newItem.slice(0, -2) : newItem;
    const isEtapa = targetRow.tipo === 'etapa';

    // Update the row itself
    const updatedRow = { ...targetRow, item: cleanedNewItem };
    await fetch(`/api/obras/${obraId}/orcamento/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedRow)
    });

    // If it's an etapa, update its children's item numbers (including sub-etapas)
    if (isEtapa) {
      const oldPrefix = targetRow.item.toString().replace(/\.0$/, '');
      const newPrefix = cleanedNewItem;
      
      const rawEtapaId = parseInt(id.replace('etapa-', ''), 10);
      const childrenToUpdate = orcamento.filter(r => r.etapa_id === rawEtapaId || r.etapa_pai_id === rawEtapaId);
      
      for (const child of childrenToUpdate) {
        if (child.item) {
          const childItemStr = child.item.toString();
          if (childItemStr.startsWith(oldPrefix)) {
            const newChildItem = childItemStr.replace(oldPrefix, newPrefix).replace(/\.0$/, '');
            await fetch(`/api/obras/${obraId}/orcamento/${child.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...child, item: newChildItem })
            });
          }
        }
      }
    }

    // Automatically resequence after changing the item code to organize the list
    await fetch(`/api/obras/${obraId}/orcamento/resequence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeItemId: id })
    });

    fetchData();
    setEditingCell(null);
  };

  const handleRowUpdate = async (id: string, updates: any) => {
    const targetRow = orcamento.find(r => r.id === id);
    if (!targetRow) return;

    // Standardize stage descriptions to uppercase
    if (targetRow.tipo === 'etapa' && updates.descricao) {
      updates.descricao = updates.descricao.toUpperCase();
    }

    const updatedRow = { ...targetRow, ...updates };

    const res = await fetch(`/api/obras/${obraId}/orcamento/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedRow)
    });

    if (res.ok) {
      // If the item code was updated, trigger resequence to maintain order
      if (updates.item) {
        await fetch(`/api/obras/${obraId}/orcamento/resequence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activeItemId: id })
        });
      }
      fetchData();
    }
  };

  const handleAddItem = async (tipo: 'etapa' | 'composicao' | 'insumo', itemData: any) => {
    try {
      if (tipo !== 'etapa' && !itemData.item_id && !itemData.isNew) {
        setToast({ message: 'Selecione um item da lista ou crie um novo.', type: 'error' });
        return;
      }
      if (tipo === 'etapa' && !itemData.descricao) {
        setToast({ message: 'A descrição da etapa é obrigatória.', type: 'error' });
        return;
      }

      let finalItemData = { ...itemData, tipo, insert_after_id: addingRowParentId };
      if (finalItemData.item) {
        finalItemData.item = finalItemData.item.toString().replace(/\.0$/, '');
      }
      if (tipo === 'etapa' && finalItemData.descricao) {
        finalItemData.descricao = finalItemData.descricao.toUpperCase();
      }
      
      // If it's a new item (not in database), create it first
      if (itemData.isNew) {
        const createItemRes = await fetch('/api/itens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: itemData.descricao,
            tipo: tipo,
            unidade: itemData.unidade || 'un',
            base: itemData.base || 'PRÓPRIO',
            valor_unitario: itemData.preco_unitario || 0,
            estado: encargos.estado
          })
        });
        
        if (!createItemRes.ok) throw new Error('Erro ao criar novo item no banco de dados');
        const newItem = await createItemRes.json();
        finalItemData.item_id = newItem.id;
        delete finalItemData.isNew;
      }

      const res = await fetch(`/api/obras/${obraId}/orcamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [finalItemData] // Backend expects an array of items
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        const newId = data.ids && data.ids.length > 0 ? data.ids[0] : null;

        // Automatically resequence after adding a new item
        await fetch(`/api/obras/${obraId}/orcamento/resequence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activeItemId: newId })
        });

        fetchData();
        setAddingRowType(null);
        setAddingRowParentId(null);
        setNewItemData({ item: '', base: '', codigo: '', descricao: '', item_tipo: 'insumo', item_id: null, quantidade: 0, preco_unitario: 0, unidade: '', etapa_id: null, etapa_pai_id: null, isNew: false });
        setLocalNewQty('0,00');
        setLocalNewPrice('0,00');
      } else {
        const err = await res.json();
        setToast({ message: err.message || 'Erro ao adicionar item', type: 'error' });
      }
    } catch (error) {
      console.error("Error adding item:", error);
      setToast({ message: 'Erro ao conectar com o servidor', type: 'error' });
    }
  };

  const handleDeleteItem = async (id: string, tipo: string) => {
    // No alert/confirm as per guidelines, but the user requested "Finish what you were doing" 
    // and usually a delete needs a confirmation. I'll use a simple check or just delete.
    // The guidelines say: "Do NOT use confirm(), window.confirm(), alert() or window.alert() in the code."
    // I should use a custom modal or just proceed. For now, I'll just proceed to keep it simple 
    // but I'll add a small delay or something if needed. Actually, I'll just proceed.
    
    const res = await fetch(`/api/obras/${obraId}/orcamento/${id}?tipo=${tipo}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      // Automatically resequence after deleting an item
      await fetch(`/api/obras/${obraId}/orcamento/resequence`, {
        method: 'POST'
      });

      fetchData();
    }
  };

  const getNextItem = (targetTipo: 'etapa' | 'composicao' | 'insumo', targetId: number | string | null, behavior: 'sibling' | 'child' = 'child') => {
    if (!orcamento || orcamento.length === 0) return '1';

    const cleanList = orcamento.map(i => {
      let it = (i.item || '').toString().trim();
      if (it.endsWith('.0')) it = it.substring(0, it.length - 2);
      if (it.endsWith('.')) it = it.substring(0, it.length - 1);
      return it;
    }).filter(it => it !== '');

    let targetItem = "";
    if (targetId && targetId !== '__root__') {
      const row = orcamento.find(r => r.id === targetId || r.id?.toString() === targetId.toString());
      if (row) {
        targetItem = (row.item || '').toString().trim().replace(/\.0$/, '');
        if (targetItem.endsWith('.')) targetItem = targetItem.substring(0, targetItem.length - 1);
      }
    }

    let parent = "";
    if (behavior === 'child') {
      parent = (!targetItem || targetItem === '__root__') ? "" : targetItem;
    } else {
      // Sibling logic
      if (!targetItem || targetItem === '__root__' || !targetItem.includes('.')) {
        parent = "";
      } else {
        const parts = targetItem.split('.').filter(p => p !== '');
        parts.pop();
        parent = parts.join('.');
      }
    }

    // Find max sibling number among children of 'parent'
    const prefix = parent ? parent + '.' : '';
    const level = parent ? parent.split('.').filter(p => p !== '').length + 1 : 1;
    
    let max = 0;
    cleanList.forEach(it => {
      if (parent) {
        if (it.startsWith(prefix)) {
          const parts = it.split('.').filter(p => p !== '');
          if (parts.length === level) {
            const lastPart = parts[parts.length - 1];
            const lastNum = parseInt(lastPart, 10);
            if (!isNaN(lastNum) && lastNum > max) max = lastNum;
          }
        }
      } else {
        // Root level
        if (!it.includes('.')) {
          const val = parseInt(it, 10);
          if (!isNaN(val) && val > max) max = val;
        }
      }
    });

    return (parent ? parent + '.' : '') + (max + 1);
  };

  const [diarios, setDiarios] = useState<any[]>([]);
  const [cronograma, setCronograma] = useState<any[]>([]);
  const [medicoes, setMedicoes] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState(() => localStorage.getItem('activeSubTab') || 'visao_geral');
  const [custosReais, setCustosReais] = useState<Record<number, {quantidade: number, preco_unitario: number}>>({});

  useEffect(() => {
    localStorage.setItem('activeSubTab', activeSubTab);
  }, [activeSubTab]);

  useEffect(() => {
    if (obra?.custos_reais) {
      try {
        const parsed = typeof obra.custos_reais === 'string' ? JSON.parse(obra.custos_reais) : obra.custos_reais;
        setCustosReais(parsed || {});
      } catch (e) {
        setCustosReais({});
      }
    }
  }, [obra]);

  const handleSaveCustosReais = async () => {
    try {
      const res = await fetch(`/api/obras/${obraId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custos_reais: JSON.stringify(custosReais) })
      });
      if (res.ok) {
        setToast({ message: 'Custos reais salvos com sucesso!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error("Error saving custos reais:", error);
      setToast({ message: 'Erro ao salvar custos reais.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };
  
  // Modals state
  const [showBdiModal, setShowBdiModal] = useState(false);
  const [showBancosModal, setShowBancosModal] = useState(false);
  const [updateMode, setUpdateMode] = useState<'estrutura' | 'precos'>('estrutura');
  const [showEncargosModal, setShowEncargosModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showDiarioModal, setShowDiarioModal] = useState(false);
  const [addingRowType, setAddingRowType] = useState<'etapa' | 'composicao' | 'insumo' | null>(null);
  const [addingRowParentId, setAddingRowParentId] = useState<string | null>(null);
  const addItemRowRef = React.useRef<HTMLTableRowElement>(null);
  const editingRowRef = React.useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (addingRowType && addItemRowRef.current) {
      addItemRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [addingRowType]);

  // New Record States
  const [newDiario, setNewDiario] = useState({ relato: '', clima: 'Ensolarado', mao_de_obra: '', equipamentos: '' });
  const [newItemData, setNewItemData] = useState<{
    item: string;
    base: string;
    codigo: string;
    descricao: string;
    item_tipo: string;
    item_id: any;
    quantidade: number;
    preco_unitario: number;
    unidade: string;
    etapa_id: number | null;
    etapa_pai_id: number | null;
    isNew: boolean | undefined;
  }>({ 
    item: '', 
    base: '',
    codigo: '',
    descricao: '', 
    item_tipo: '', 
    item_id: null as any, 
    quantidade: 0, 
    preco_unitario: 0,
    unidade: '',
    etapa_id: null as number | null,
    etapa_pai_id: null as number | null,
    isNew: false as boolean | undefined
  });
  
  // Editing state
  const [editingCell, setEditingCell] = useState<{ id: string, field: string } | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [localQty, setLocalQty] = useState<string>('');
  const [localPrice, setLocalPrice] = useState<string>('');
  const [localNewQty, setLocalNewQty] = useState<string>('0,00');
  const [localNewPrice, setLocalNewPrice] = useState<string>('0,00');

  useEffect(() => {
    if (editingCell && editingRowRef.current) {
      editingRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [editingCell]);
  
  useEffect(() => {
    if (obra?.bdi !== undefined) {
      setBdiValue(obra.bdi);
      setBdiIncidence((obra.bdi_incidencia as 'unitario' | 'final') || 'unitario');
      setBdiType((obra.bdi_tipo as 'unico' | 'detalhado') || 'unico');
    }
  }, [obra]);

  const handleSaveBdi = async () => {
    const res = await fetch(`/api/obras/${obraId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...obra, bdi: bdiValue, bdi_incidencia: bdiIncidence, bdi_tipo: bdiType })
    });
    if (res.ok) {
      setShowBdiModal(false);
      fetchData();
    }
  };


  useEffect(() => {
    if (!isInitialLoad) {
      // Removed redundant full fetches of insumos and composicoes
      // AutocompleteDropdown handles searching on demand
    }
  }, [obraId, isInitialLoad]);

  const handleImportOrcamento = () => {
    if (!importFile) return;
    setIsImporting(true);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // Skip header
        const rows = json.slice(1);
        const itemsToImport = rows.map(row => {
          const item = String(row[0] || '').trim();
          const base = String(row[1] || '').trim();
          const codigo = String(row[2] || '').trim();
          const descricao = String(row[3] || '').trim();
          const unidade = String(row[4] || '').trim();
          const quantidade = parseFloat(String(row[5] || '').replace(',', '.')) || 0;
          const valor_unitario = parseFloat(String(row[6] || '').replace(',', '.')) || 0;
          
          const isEtapa = (!base && !codigo) || (item && !item.includes('.') && !codigo);
          
          return {
            tipo: isEtapa ? 'etapa' : 'item',
            item,
            base,
            codigo,
            descricao,
            unidade,
            quantidade,
            valor_unitario
          };
        }).filter(r => r.item || r.descricao);

        const res = await fetch(`/api/obras/${obraId}/orcamento/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToImport })
        });

        if (res.ok) {
          setToast({ message: 'Orçamento importado com sucesso!', type: 'success' });
          
          // Automatically resequence after import to organize the list
          await fetch(`/api/obras/${obraId}/orcamento/resequence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });

          fetchData();
          setShowImportModal(false);
        } else {
          const err = await res.json();
          setToast({ message: err.message || 'Erro ao importar', type: 'error' });
        }
      } catch (error) {
        console.error('Import error:', error);
        setToast({ message: 'Erro ao processar arquivo', type: 'error' });
      } finally {
        setIsImporting(false);
        setImportFile(null);
      }
    };
    reader.readAsBinaryString(importFile);
  };

  const handleAddDiario = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/obras/${obraId}/diario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDiario)
    });
    if (res.ok) {
      setShowDiarioModal(false);
      setNewDiario({ relato: '', clima: 'Ensolarado', mao_de_obra: '', equipamentos: '' });
      fetchData();
    }
  };


  // Removed manual style manipulation to avoid layout issues
  useEffect(() => {
    // Scroll handling moved to activeTab useEffect
  }, [activeSubTab]);

  if (error) {
    return (
      <div className="p-12 text-center">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md mx-auto">
          <p className="text-red-600 font-bold mb-4">{error}</p>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all"
            >
              Tentar Novamente
            </button>
            <button 
              onClick={onBack}
              className="px-6 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
            >
              Voltar para Lista
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isInitialLoad || !obra) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-black uppercase tracking-widest text-xs animate-pulse">Carregando Obra...</p>
      </div>
    );
  }

  let filteredAbcData = abcData.filter(item => {
    if (abcCategoryFilter === 'all') return true;
    const categoria = item.categoria?.toLowerCase() || '';
    if (abcCategoryFilter === 'material') return categoria.includes('material');
    if (abcCategoryFilter === 'mao_de_obra') return categoria.includes('mão de obra') || categoria.includes('mao de obra');
    if (abcCategoryFilter === 'equipamento') return categoria.includes('equipamento');
    if (abcCategoryFilter === 'encargos') return categoria.includes('encargos');
    return true;
  });

  const top20Data = filteredAbcData.slice(0, 20);
  const classACount = top20Data.filter(i => i.classe === 'A').length;
  const classBCount = top20Data.filter(i => i.classe === 'B').length;
  const totalCount = top20Data.length;
  const offsetA = totalCount > 0 ? (classACount / totalCount) * 100 : 0;
  const offsetB = totalCount > 0 ? ((classACount + classBCount) / totalCount) * 100 : 0;

  return (
    <div className={`flex flex-col min-h-screen ${activeSubTab === 'cronograma' ? 'flex-1' : 'space-y-8 bg-slate-50'}`}>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-xl text-sm font-bold flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-4 hover:opacity-70"><X size={16} /></button>
        </div>
      )}
      {/* Header conforme o print */}
      <div className={`space-y-4 shrink-0 px-4 ${activeSubTab === 'cronograma' ? 'mb-6' : ''}`}>
        <Button 
          variant="ghost" 
          size="sm" 
          icon={ArrowLeft} 
          onClick={onBack}
          className="!px-0 !bg-transparent !shadow-none text-slate-500 hover:text-slate-900"
        >
          Voltar para Obras
        </Button>
        
        <div className="flex items-center gap-4">
          <h3 style={{ fontSize: '21px', lineHeight: '28px' }} className="font-black text-slate-900 tracking-tighter uppercase">
            {obra.nome}
          </h3>
          <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[11px] font-bold uppercase tracking-wider rounded-md border border-blue-100">
            {obra.status}
          </span>
        </div>
        <p style={{ marginLeft: '0px', marginRight: '0px', marginBottom: '-17px' }} className="text-slate-500 text-sm font-medium flex items-center gap-2">
          <MapPin size={15} className="text-slate-400" />
          {obra.uf ? `${obra.uf} - ` : ''}{obra.localizacao || 'Localização não informada'}
        </p>
      </div>

      {/* Tabs conforme o print */}
      <div style={{ fontSize: '18px', borderWidth: '-3px', paddingLeft: '4px', paddingRight: '14px', marginBottom: '-8px' }} className="flex gap-8 border-b border-slate-200 shrink-0 px-4">
        {[
          { id: 'visao_geral', label: 'Visão Geral', icon: LayoutDashboard },
          { id: 'orcamento', label: 'Orçamento', icon: FileText },
          { id: 'cronograma', label: 'Cronograma', icon: Calendar },
          { id: 'curva_abc', label: 'Curva ABC', icon: TrendingUp },
          { id: 'orcado_real', label: 'Suprimentos', icon: ShoppingCart },
          { id: 'diario', label: 'Diário de Obra', icon: BookOpen },
          { id: 'medicao', label: 'Medições', icon: Ruler }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-1 py-4 text-sm font-bold transition-all relative ${
              activeSubTab === tab.id ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
            {activeSubTab === tab.id && (
              <motion.div 
                layoutId="activeSubTab" 
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" 
              />
            )}
          </button>
        ))}
      </div>

      <div className={`${activeSubTab === 'curva_abc' ? 'mt-0' : 'mt-8'} flex flex-col ${activeSubTab === 'cronograma' ? 'flex-1 min-h-0' : ''}`}>
        {activeSubTab === 'visao_geral' && (
          <div className="space-y-8 pb-10 sm:overflow-visible">
            {/* Cards de Resumo conforme o print */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-1.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">Entrega Prevista</p>
                  <Calendar size={14} className="text-slate-300" />
                </div>
                <h4 className="text-xl font-black text-slate-900 leading-none">
                  {(() => {
                    let maxDate: string | null = null;
                    
                    if (cronograma && cronograma.length > 0) {
                      let maxTime = -Infinity;
                      cronograma.forEach(act => {
                        const ed = act.data_fim_prevista || act.data_inicio_prevista;
                        if (ed) {
                          // Robust parsing to avoid timezone shifts
                          const [y, m, d] = ed.split('-').map(Number);
                          const time = new Date(y, m - 1, d).getTime();
                          if (!isNaN(time) && time > maxTime) {
                            maxTime = time;
                            maxDate = ed;
                          }
                        }
                      });
                    }

                    // Fallback to obra data or a default if everything else fails
                    const finalDate = maxDate || obra.data_fim_prevista;
                    
                    if (!finalDate || finalDate === '30/11/2026') {
                        // If it's still the placeholder or null, and we have no schedule, it's truly unknown
                        if (!maxDate) return 'Definir no Cronograma';
                    }
                    
                    const parts = finalDate.split('-');
                    if (parts.length === 3) {
                       return `${parts[2]}/${parts[1]}/${parts[0]}`;
                    }
                    return finalDate;
                  })()}
                </h4>
              </div>
              
              <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-1.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">Cliente</p>
                  <User size={14} className="text-slate-300" />
                </div>
                <h4 className="text-[15px] font-black text-slate-900 uppercase tracking-tight leading-tight truncate" title={obra.cliente || 'Horizonte Empreendimentos'}>
                  {obra.cliente || 'Horizonte Empreendimentos'}
                </h4>
              </div>

              <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-1.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">Status Atual</p>
                  <Briefcase size={14} className="text-slate-300" />
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${obra.status === 'Em Andamento' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                  <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">
                    {obra.status}
                  </h4>
                </div>
              </div>

              {/* Descrição da Obra Compacta */}
              <div className="bg-[#1e293b] p-5 rounded-[24px] shadow-lg border border-slate-800 md:col-span-1">
                <div className="flex justify-between items-start mb-1.5">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.1em]">Descrição</p>
                  <FileText size={14} className="text-white/20" />
                </div>
                <p className="text-[11px] text-slate-300 leading-tight line-clamp-2">
                  {obra.descricao || 'Sem descrição detalhada cadastrada para esta obra no momento.'}
                </p>
              </div>
            </div>

            {/* Dashboard de Evolução - Aprimoramento solicitado */}
            <ObraOverview 
              obra={obra} 
              orcamento={orcamento} 
              cronograma={cronograma} 
              medicoes={medicoes} 
              encargos={encargos}
              currentBancosAtivos={bancosAtivos}
              bdiIncidence={bdiIncidence}
              bdiValue={bdiValue}
            />
            
            </div>
        )}

        {activeSubTab === 'orcamento' && (
          <div className="flex-1 flex flex-col space-y-4 bg-[#f8fafc] pb-10">
            {/* Filtros Rápidos no Cabeçalho */}
            <BudgetFilterBar 
              encargos={encargos} 
              setEncargos={setEncargos} 
              setBancosAtivos={setBancosAtivos}
            />

            {/* Header de Ações de Orçamento */}
            <div className="flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                {isMaster && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    icon={Upload}
                    onClick={() => setShowImportModal(true)}
                  >
                    Importar Planilha
                  </Button>
                )}
                {isMaster && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    icon={Download}
                  >
                    Exportar Orçamento
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                <Clock size={13} />
                Última alteração: Hoje, 10:45
              </div>
            </div>

            {/* Top Section: Summary */}
            <div className="flex flex-col justify-between items-start gap-4 shrink-0">
              {/* Summary Card - Table structure as per print */}
              <div className="bg-white border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col rounded-2xl">
                <div className="divide-y divide-slate-200 flex-1">
                  {/* Bancos Row */}
                  <div 
                    onClick={() => setShowBancosModal(true)}
                    className="flex items-stretch cursor-pointer hover:bg-slate-50 transition-colors min-h-10 group"
                  >
                    <div className="w-40 bg-slate-100 p-2 border-r border-slate-200 flex items-center">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bancos</span>
                    </div>
                    <div className="flex-1 p-2 flex items-center gap-4 flex-wrap">
                      {bancosAtivos.filter(b => b.active).map((banco, idx, arr) => (
                        <React.Fragment key={banco.id}>
                          <span className="text-[12px] font-bold text-[#003366] group-hover:text-indigo-600 transition-colors">
                            {banco.name}
                          </span>
                          {idx < arr.length - 1 && <div className="h-3 w-[1px] bg-slate-200" />}
                        </React.Fragment>
                      ))}
                      {bancosAtivos.filter(b => b.active).length === 0 && (
                        <span className="text-[11px] italic text-slate-400">Nenhum banco selecionado</span>
                      )}
                    </div>
                  </div>

                  {/* BDI Row */}
                  <div 
                    onClick={() => setShowBdiModal(true)}
                    className="flex items-stretch cursor-pointer hover:bg-slate-50 transition-colors min-h-10 group"
                  >
                    <div className="w-40 bg-slate-100 p-2 border-r border-slate-200 flex items-center">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">BDI</span>
                    </div>
                    <div className="flex-1 p-2 flex items-center gap-12">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">BDI:</span>
                        <span className="text-[13px] font-bold text-[#003366] group-hover:text-indigo-600 transition-colors">{bdiValue.toFixed(2)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Desconto:</span>
                        <span className="text-[13px] font-bold text-red-600 group-hover:text-red-700 transition-colors">{descontoValue.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Encargos Sociais Row */}
                  <div 
                    onClick={() => setShowEncargosModal(true)}
                    className="flex items-stretch min-h-16 cursor-pointer hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-40 bg-slate-100 p-2 border-r border-slate-200 flex items-center">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Encargos Sociais</span>
                    </div>
                    <div className="flex-1 p-2 flex gap-6 items-start">
                      <div className="space-y-1">
                        <p className="text-[12px] font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {encargos.desonerado ? 'Desonerada' : 'Não Desonerada'}
                        </p>
                        <div className="flex gap-4">
                          <p className="text-[11px] font-bold text-slate-700">Horista <span className="ml-1 text-[#003366]">{encargos.horista.toFixed(1)}%</span></p>
                          <p className="text-[11px] font-bold text-slate-700">Mensalista <span className="ml-1 text-[#003366]">{encargos.mensalista.toFixed(1)}%</span></p>
                        </div>
                      </div>
                      <div className="flex-1 text-[10px] text-slate-400 font-medium leading-tight max-w-xs italic pt-0.5">
                        {encargos.incidir 
                          ? 'As porcentagens dos Encargos Sociais estão incidindo sobre os insumos do tipo Mão de Obra.'
                          : 'As porcentagens cadastradas não estão incidindo sobre os preços unitários dos insumos de mão de obra, elas somente são exibidas nos relatórios.'}
                      </div>
                    </div>
                  </div>

                  {/* Valor Total Row */}
                  <div className="flex items-stretch min-h-10 border-t border-[#003366] group">
                    <div className="w-40 bg-[#003366] p-2 border-r border-[#002244] flex items-center">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Valor Total</span>
                    </div>
                    <div className="flex-1 p-2 flex items-center bg-[#003366]">
                      <span className="text-[13px] font-bold text-white">
                        R$ {(
                          orcamento.filter(r => r.tipo !== 'etapa').reduce((acc, r) => acc + (r.total || 0), 0) * 
                          (bdiIncidence === 'final' ? (1 + bdiValue / 100) : 1) * 
                          (1 - (descontoValue || 0) / 100)
                        ).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BDI Modal */}
            {showBdiModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden"
                >
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-2xl font-bold text-slate-800">Editar BDI</h3>
                    <button onClick={() => setShowBdiModal(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={24} />
                    </button>
                  </div>
                  
                  <div className="p-8 space-y-8">
                    <p className="text-sm text-slate-500">Formulário de configuração das porcentagens dos Benefícios e Despesas Indiretas</p>
                    
                    <div className="space-y-4">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">O BDI deve incidir sobre:</label>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="radio" 
                            name="bdi_incidence" 
                            checked={bdiIncidence === 'unitario'}
                            onChange={() => setBdiIncidence('unitario')}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" 
                          />
                          <span className="text-sm text-slate-700 group-hover:text-slate-900">O preço unitário da composição (Método de cálculo <span className="font-bold">recomendado</span> pelo TCU)</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="radio" 
                            name="bdi_incidence" 
                            checked={bdiIncidence === 'final'}
                            onChange={() => setBdiIncidence('final')}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" 
                          />
                          <span className="text-sm text-slate-700 group-hover:text-slate-900">O preço final do orçamento</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Porcentagem de BDI Padrão</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-bold"
                          value={isNaN(bdiValue) ? "" : bdiValue}
                          onChange={(e) => setBdiValue(parseFloat(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider text-red-600">Porcentagem de Desconto</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-bold text-red-600"
                          value={isNaN(descontoValue) ? "" : descontoValue}
                          onChange={(e) => setDescontoValue(parseFloat(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">BDI Único ou Detalhado</label>
                      <div className="flex gap-8">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="radio" 
                            name="bdi_type" 
                            checked={bdiType === 'unico'}
                            onChange={() => setBdiType('unico')}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" 
                          />
                          <span className="text-sm text-slate-700 group-hover:text-slate-900">Único</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="radio" 
                            name="bdi_type" 
                            checked={bdiType === 'detalhado'}
                            onChange={() => setBdiType('detalhado')}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" 
                          />
                          <span className="text-sm text-slate-700 group-hover:text-slate-900">Detalhado por tipo Insumo (não recomendável)</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50 flex justify-end gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => setShowBdiModal(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      variant="primary"
                      className="bg-[#003366] hover:bg-[#002244] px-8"
                      onClick={handleSaveBdi}
                    >
                      Salvar
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Bancos Modal */}
            {showBancosModal && (
              <BancosModal 
                isOpen={showBancosModal} 
                onClose={() => setShowBancosModal(false)} 
                bancos={bancosAtivos} 
                updateMode={updateMode}
                onUpdateModeChange={setUpdateMode}
                onToggle={(id: string) => setBancosAtivos(prev => {
                  const activeCount = prev.filter(b => b.active).length;
                  const isCurrentlyActive = prev.find(b => b.id === id)?.active;
                  
                  // Don't allow deselecting the last active database
                  if (activeCount === 1 && isCurrentlyActive) {
                    return prev;
                  }
                  
                  return prev.map(b => b.id === id ? { ...b, active: !b.active } : b);
                })} 
                onDateChange={(id: string, date: string) => setBancosAtivos(prev => prev.map(b => {
                  if (b.id === id) {
                    const d = new Date(date);
                    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
                    const year = d.getUTCFullYear();
                    return { ...b, data_referencia: date, name: `${b.id.toUpperCase()} - ${month}/${year}` };
                  }
                  return b;
                }))}
              />
            )}

            {/* Import Modal */}
            {showImportModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden"
                >
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <Upload size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Importar Orçamento</h3>
                        <p className="text-sm text-slate-500">Selecione uma planilha Excel (.xlsx)</p>
                      </div>
                    </div>
                    <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors">
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="import-file"
                      />
                      <label htmlFor="import-file" className="cursor-pointer flex flex-col items-center">
                        <Upload className="text-slate-400 mb-3" size={32} />
                        <span className="text-sm font-medium text-slate-700">
                          {importFile ? importFile.name : 'Clique para selecionar o arquivo'}
                        </span>
                        <span className="text-xs text-slate-500 mt-1">Formato suportado: Excel (.xlsx)</span>
                      </label>
                    </div>
                  </div>
                  <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setShowImportModal(false)}>Cancelar</Button>
                    <Button 
                      variant="primary" 
                      onClick={handleImportOrcamento}
                      disabled={!importFile || isImporting}
                    >
                      {isImporting ? 'Importando...' : 'Importar'}
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Encargos Sociais Modal */}
            {showEncargosModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden"
                >
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-2xl font-bold text-slate-800">Editar Encargos Sociais</h3>
                    <button onClick={() => setShowEncargosModal(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={24} />
                    </button>
                  </div>
                  
                  <div className="p-8 space-y-8">
                    <p className="text-sm text-slate-500">Formulário de configuração da porcentagem de Encargos Sociais</p>
                    
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="radio" 
                            name="desonerado" 
                            checked={encargos.desonerado} 
                            onChange={() => {
                              setEncargos(prev => ({ ...prev, desonerado: true }));
                            }}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" 
                          />
                          <span className="text-sm text-slate-700 group-hover:text-slate-900">Desonerado</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="radio" 
                            name="desonerado" 
                            checked={!encargos.desonerado} 
                            onChange={() => {
                              setEncargos(prev => ({ ...prev, desonerado: false }));
                            }}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" 
                          />
                          <span className="text-sm text-slate-700 group-hover:text-slate-900">Não Desonerado</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-700">Estado (UF)</label>
                        <select 
                          value={encargos.estado}
                          onChange={(e) => setEncargos(prev => ({ ...prev, estado: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-bold"
                        >
                          {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-700">Data de Referência</label>
                        <input 
                          type="month"
                          value={encargos.dataReferencia}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            setEncargos(prev => ({ ...prev, dataReferencia: newDate }));
                            
                            // Also update all active banks to this date if possible
                            setBancosAtivos(prev => prev.map(b => {
                              if (!b.active) return b;
                              
                              // Try to find a matching date in available_dates
                              // newDate is YYYY-MM
                              const matchingDate = b.available_dates?.find((d: string) => d.startsWith(newDate));
                              if (matchingDate) {
                                const d = new Date(matchingDate);
                                const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
                                const year = d.getUTCFullYear();
                                return { ...b, data_referencia: matchingDate, name: `${b.id.toUpperCase()} - ${month}/${year}` };
                              } else {
                                // If no exact match, just use the month string, the backend will handle it
                                return { ...b, data_referencia: newDate, name: `${b.id.toUpperCase()} - ${newDate.split('-').reverse().join('/')}` };
                              }
                            }));
                          }}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Porcentagem de Encargos Sociais</p>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700">Horista</label>
                          <input 
                            type="number" 
                            step="0.1"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-bold"
                            value={encargos.horista}
                            onChange={(e) => setEncargos(prev => ({ ...prev, horista: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700">Mensalista</label>
                          <input 
                            type="number" 
                            step="0.1"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-bold"
                            value={encargos.mensalista}
                            onChange={(e) => setEncargos(prev => ({ ...prev, mensalista: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="radio" 
                            name="incidir" 
                            checked={encargos.incidir} 
                            onChange={() => setEncargos(prev => ({ ...prev, incidir: true }))}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" 
                          />
                          <span className="text-sm text-slate-700 group-hover:text-slate-900">Incidir as Porcentagens dos Encargos Sociais sobre os insumos do tipo Mão de Obra.</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="radio" 
                            name="incidir" 
                            checked={!encargos.incidir} 
                            onChange={() => setEncargos(prev => ({ ...prev, incidir: false }))}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" 
                          />
                          <span className="text-sm text-slate-700 group-hover:text-slate-900">Não incidir as Porcentagens dos Encargos Sociais sobre os insumos do tipo Mão de Obra, somente mostrá-la nos relatórios.</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50 flex justify-end gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => setShowEncargosModal(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      variant="primary"
                      className="bg-[#003366] hover:bg-[#002244] px-8"
                      onClick={() => {
                        setShowEncargosModal(false);
                        fetchData();
                      }}
                    >
                      Salvar
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Tabela de Orçamento conforme o print */}
            <div 
              className="bg-white rounded-2xl border border-slate-100 shadow-sm budget-table-container" 
              onClick={() => setSelectedRowId(null)}
            >
              <div style={{ paddingLeft: '9px', paddingRight: '16px', paddingBottom: '2px', paddingTop: '2px' }} className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h3 style={{ fontSize: '15.5px', lineHeight: '21.5px', marginRight: '0px', marginBottom: '-26px', marginTop: '-36px' }} className="text-xs font-black text-slate-900 uppercase tracking-widest">Planilha de Orçamento</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { const nextItem = getNextItem('etapa', null); setNewItemData({ item: nextItem, base: '', codigo: '', descricao: '', item_tipo: 'etapa', item_id: null, quantidade: 0, preco_unitario: 0, unidade: '', etapa_id: null, etapa_pai_id: null, isNew: false }); setAddingRowType('etapa'); }} 
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded text-[11px] font-black uppercase hover:bg-blue-100"
                  >
                    +ETAPA
                  </button>
                  <button 
                    onClick={() => { const nextItem = getNextItem('composicao', null); const defaultBase = bancosAtivos.find(b => b.active)?.name.split(' ')[0] || ''; setNewItemData({ item: nextItem, base: defaultBase, codigo: '', descricao: '', item_tipo: 'composicao', item_id: null, quantidade: 0, preco_unitario: 0, unidade: '', etapa_id: null, etapa_pai_id: null, isNew: false }); setAddingRowType('composicao'); }} 
                    className="px-3 py-1.5 bg-green-50 text-green-600 rounded text-[11px] font-black uppercase hover:bg-green-100"
                  >
                    +COMP
                  </button>
                  <button 
                    onClick={() => { const nextItem = getNextItem('insumo', null); const defaultBase = bancosAtivos.find(b => b.active)?.name.split(' ')[0] || ''; setNewItemData({ item: nextItem, base: defaultBase, codigo: '', descricao: '', item_tipo: 'insumo', item_id: null, quantidade: 0, preco_unitario: 0, unidade: '', etapa_id: null, etapa_pai_id: null, isNew: false }); setAddingRowType('insumo'); }} 
                    className="px-3 py-1.5 bg-yellow-50 text-yellow-600 rounded text-[11px] font-black uppercase hover:bg-yellow-100"
                  >
                    +INSUMO
                  </button>
                </div>
              </div>
              
              <div 
                ref={dragScroll.ref}
                onMouseDown={dragScroll.onMouseDown}
                onMouseMove={dragScroll.onMouseMove}
                onMouseUp={dragScroll.onMouseUp}
                onMouseLeave={dragScroll.onMouseLeave}
                className="overflow-x-auto custom-scrollbar"
              >
                <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr className="bg-slate-50/30">
                    <th className="px-4 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest text-center w-28">Item</th>
                    <th className="px-4 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest text-center w-20">Base</th>
                    <th className="px-4 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest text-center w-24">Código</th>
                    <th className="pr-4 pl-0 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest">Descrição</th>
                    <th className="px-4 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest text-center w-16">Unid</th>
                    <th className="px-4 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right w-20">QUANT</th>
                    <th style={{ fontSize: '10px', textAlign: 'center', lineHeight: '16.5px', paddingLeft: '38px' }} className="px-4 py-1.5 font-black text-slate-500 uppercase tracking-widest text-right w-28">Valor Unitário</th>
                    <th className="px-4 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right w-28">Valor com BDI</th>
                    <th className="px-4 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {orcamento.map((row, idx) => (
                    <React.Fragment key={`${row.id}-${idx}`}>
                      <tr 
                        id={row.id}
                        ref={editingCell?.id === row.id ? editingRowRef : null}
                        className={`${
                          selectedRowId === row.id ? 'ring-2 ring-indigo-500 ring-inset z-10 relative' : ''
                        } ${
                          row.tipo === 'etapa' 
                            ? 'bg-blue-200 border-b border-blue-300' 
                            : row.tipo === 'composicao' 
                              ? 'bg-green-200 border-b border-green-300' 
                              : row.tipo === 'insumo' 
                                ? 'bg-yellow-50 border-b border-yellow-100' 
                                : 'border-b border-slate-50'
                        } transition-colors group cursor-pointer relative`}
                        onMouseEnter={() => setHoveredRowId(row.id)}
                        onMouseLeave={() => setHoveredRowId(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRowId(row.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (!editingCell || editingCell.id !== row.id) {
                            if (row.tipo === 'etapa') {
                              setEditingCell({ id: row.id, field: 'item' });
                            } else {
                              setEditingCell({ id: row.id, field: 'quantidade' });
                              setLocalQty(formatFinancial(row.quantidade));
                            }
                          }
                        }}
                      >
                      <td className="px-4 py-1.5 text-center relative w-28">
                        {hoveredRowId === row.id && (
                          <div className="absolute left-0 top-[70%] z-50 flex gap-1 bg-white p-1 rounded-r-lg shadow-lg border border-slate-200 whitespace-nowrap">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const currentParts = (row.item || '').toString().split('.');
                                const root = parseInt(currentParts[0], 10);
                                const nextItem = isNaN(root) ? '1' : (root + 1).toString();
                                setNewItemData({ item: nextItem, base: '', codigo: '', descricao: '', item_tipo: 'etapa', item_id: null, quantidade: 0, preco_unitario: 0, unidade: '', etapa_id: null, etapa_pai_id: null, isNew: false });
                                setAddingRowType('etapa');
                                setAddingRowParentId(row.id);
                              }}
                              className="px-2 py-1 hover:bg-blue-50 rounded text-blue-600 font-black text-[10px] uppercase"
                              title="Adicionar Etapa (Abaixo)"
                            >
                              +ETAPA
                            </button>
                            {(row.tipo === 'etapa' || row.etapa_id) && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  let nextItem = '';
                                  if (row.tipo === 'etapa') {
                                    // If we click +SUB on an etapa, we create its first child right below it
                                    nextItem = row.item + '.1';
                                  } else {
                                    // If we click +SUB on an item, we create a sub-etapa sibling to it
                                    const parts = (row.item || '').toString().split('.');
                                    const last = parseInt(parts[parts.length - 1], 10);
                                    parts[parts.length - 1] = isNaN(last) ? '1' : (last + 1).toString();
                                    nextItem = parts.join('.');
                                  }
                                  const parentId = row.tipo === 'etapa' ? row.id : row.etapa_id;
                                  setNewItemData({ ...newItemData, item: nextItem, item_tipo: 'etapa', etapa_pai_id: parentId, isNew: false });
                                  setAddingRowType('etapa');
                                  setAddingRowParentId(row.id);
                                }}
                                className="px-2 py-1 hover:bg-indigo-50 rounded text-indigo-600 font-black text-[10px] uppercase"
                                title="Adicionar Sub-Etapa (Abaixo)"
                              >
                                +SUB
                              </button>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                let nextItem = '';
                                if (row.tipo === 'etapa') {
                                  nextItem = row.item + '.1';
                                } else {
                                  const parts = (row.item || '').toString().split('.');
                                  const last = parseInt(parts[parts.length - 1], 10);
                                  parts[parts.length - 1] = isNaN(last) ? '1' : (last + 1).toString();
                                  nextItem = parts.join('.');
                                }
                                const etapaId = row.tipo === 'etapa' ? row.id : row.etapa_id;
                                const defaultBase = bancosAtivos.find(b => b.active)?.name.split(' ')[0] || '';
                                setNewItemData({ ...newItemData, item: nextItem, base: defaultBase, item_tipo: 'composicao', item_id: null, quantidade: 0, preco_unitario: 0, unidade: '', etapa_id: etapaId, isNew: false });
                                setAddingRowType('composicao');
                                setAddingRowParentId(row.id);
                              }}
                              className="px-2 py-1 hover:bg-green-50 rounded text-green-600 font-black text-[10px] uppercase"
                              title="Adicionar Composição (Abaixo)"
                            >
                              +COMP
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                let nextItem = '';
                                if (row.tipo === 'etapa') {
                                  nextItem = row.item + '.1';
                                } else {
                                  const parts = (row.item || '').toString().split('.');
                                  const last = parseInt(parts[parts.length - 1], 10);
                                  parts[parts.length - 1] = isNaN(last) ? '1' : (last + 1).toString();
                                  nextItem = parts.join('.');
                                }
                                const etapaId = row.tipo === 'etapa' ? row.id : row.etapa_id;
                                const defaultBase = bancosAtivos.find(b => b.active)?.name.split(' ')[0] || '';
                                setNewItemData({ ...newItemData, item: nextItem, base: defaultBase, item_tipo: 'insumo', item_id: null, quantidade: 0, preco_unitario: 0, unidade: '', etapa_id: etapaId, isNew: false });
                                setAddingRowType('insumo');
                                setAddingRowParentId(row.id);
                              }}
                              className="px-2 py-1 hover:bg-yellow-50 rounded text-yellow-600 font-black text-[10px] uppercase"
                              title="Adicionar Insumo (Abaixo)"
                            >
                              +INSUMO
                            </button>
                            <div className="w-[1px] bg-slate-200 mx-1" />
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (row.tipo === 'etapa') {
                                  setEditingCell({ id: row.id, field: 'item' });
                                } else {
                                  setEditingCell({ id: row.id, field: 'quantidade' });
                                  setLocalQty(formatFinancial(row.quantidade));
                                }
                              }}
                              className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                              title="Editar"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem(row.id, row.tipo);
                              }}
                              className="p-1.5 hover:bg-red-50 rounded text-red-500"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-1 justify-center">
                          {editingCell?.id === row.id && editingCell.field === 'item' ? (
                            <input 
                              autoFocus
                              className="w-full bg-white border border-indigo-300 rounded px-1 py-0.5 text-center outline-none text-[13px] text-slate-700 font-medium"
                              defaultValue={row.item.toString().replace(/\.0$/, '')}
                              onClick={(e) => e.stopPropagation()}
                              onBlur={(e) => {
                                handleItemChange(row.id, e.target.value);
                                setEditingCell(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleItemChange(row.id, (e.target as HTMLInputElement).value);
                                  setEditingCell(null);
                                }
                              }}
                            />
                          ) : (
                            <div 
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCell({ id: row.id, field: 'item' });
                              }}
                            >
                              <span className={`text-[13px] text-slate-700 ${row.tipo === 'etapa' ? 'font-semibold' : 'font-medium'}`}>{row.item.toString().replace(/\.0$/, '')}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-center relative w-20">
                        {row.tipo !== 'etapa' && editingCell?.id === row.id && editingCell.field === 'base' ? (
                          <input 
                            autoFocus
                            className="w-full bg-white border border-indigo-300 rounded px-1 py-0.5 text-[13px] text-slate-700 outline-none text-center"
                            defaultValue={row.base}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => {
                              handleRowUpdate(row.id, { base: e.target.value });
                              setEditingCell(null);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingCell(null)}
                          />
                        ) : (
                          <div 
                            className={row.tipo !== 'etapa' ? 'cursor-pointer flex justify-center text-[13px] text-slate-600 font-medium' : ''}
                            onClick={(e) => {
                              if (row.tipo !== 'etapa') {
                                e.stopPropagation();
                                setEditingCell({ id: row.id, field: 'base' });
                              }
                            }}
                          >
                            {row.tipo !== 'etapa' && row.base && (
                              <span>{row.base}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center relative w-24">
                        {row.tipo !== 'etapa' && (
                          <div className="font-mono text-[13px] text-slate-600 font-medium truncate">
                            {String(row.codigo).replace(/\.\d+$/, '')}
                          </div>
                        )}
                      </td>
                      <td className="pr-3 pl-0 py-1.5 relative">
                        <div className="flex items-center">
                          {editingCell?.id === row.id && row.tipo === 'etapa' && editingCell.field === 'descricao' ? (
                            <div className="relative flex-1">
                              <input 
                                autoFocus
                                className="w-full bg-white border border-indigo-300 rounded px-2 py-1 outline-none font-semibold text-slate-900 uppercase tracking-tight text-[13px]"
                                defaultValue={row.descricao}
                                onClick={(e) => e.stopPropagation()}
                                onBlur={(e) => {
                                  handleRowUpdate(row.id, { descricao: e.target.value });
                                  setEditingCell(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleRowUpdate(row.id, { descricao: (e.target as HTMLInputElement).value });
                                    setEditingCell(null);
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div 
                              className={`flex-1 truncate ${row.tipo === 'etapa' ? 'font-semibold text-slate-900 uppercase tracking-tight text-[13px] cursor-pointer' : 'text-slate-700 text-[13px]'} group/desc relative`}
                              onClick={(e) => {
                                if (row.tipo === 'etapa') {
                                  e.stopPropagation();
                                  setEditingCell({ id: row.id, field: 'descricao' });
                                }
                              }}
                            >
                              {row.tipo === 'etapa' ? row.descricao?.toUpperCase() : row.descricao}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-center text-slate-500 w-16">
                        {editingCell?.id === row.id && editingCell.field === 'unidade' ? (
                          <input 
                            type="text"
                            className="w-full bg-white border border-indigo-300 rounded px-1 py-0.5 text-center font-mono text-[13px] outline-none focus:ring-1 focus:ring-indigo-500"
                            value={row.unidade}
                            onChange={(e) => handleRowUpdate(row.id, { unidade: e.target.value })}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingCell(null)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span 
                            className="font-mono text-[13px] text-slate-600 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ id: row.id, field: 'unidade' });
                            }}
                          >
                            {row.unidade}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-600 relative w-20">
                        {row.tipo !== 'etapa' ? (
                          <div className={`flex items-center justify-end gap-1 ${editingCell?.id === row.id ? 'bg-white border border-indigo-200 rounded-lg p-1 shadow-sm' : ''}`}>
                            <input 
                              type="text"
                              autoFocus={editingCell?.id === row.id && editingCell.field === 'quantidade'}
                              className={`w-full bg-transparent border-none text-right text-slate-700 font-mono text-[13px] outline-none transition-colors ${editingCell?.id === row.id ? 'text-indigo-600 font-semibold' : 'cursor-pointer'}`}
                              value={editingCell?.id === row.id ? localQty : formatFinancial(row.quantidade)}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (editingCell?.id !== row.id) {
                                  setEditingCell({ id: row.id, field: 'quantidade' });
                                  setLocalQty(formatFinancial(row.quantidade));
                                }
                              }}
                              onFocus={(e) => {
                                if (editingCell?.id !== row.id) {
                                  setEditingCell({ id: row.id, field: 'quantidade' });
                                  setLocalQty(formatFinancial(row.quantidade));
                                }
                                (e.target as HTMLInputElement).select();
                              }}
                              onChange={(e) => setLocalQty(e.target.value)}
                              onBlur={(e) => {
                                if (editingCell?.id === row.id) {
                                  const val = parseBrazilianNumber(localQty);
                                  if (val !== null) {
                                    handleRowUpdate(row.id, { quantidade: val });
                                  }
                                }
                                const tr = e.currentTarget.closest('tr');
                                if (!tr?.contains(e.relatedTarget as Node)) {
                                  setEditingCell(null);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = parseBrazilianNumber(localQty);
                                  if (val !== null) {
                                    handleRowUpdate(row.id, { quantidade: val });
                                  }
                                  setEditingCell(null);
                                }
                              }}
                            />
                          </div>
                        ) : null}
                      </td>
                      <td style={{ paddingLeft: '-30.5px' }} className="px-3 py-1.5 text-right text-slate-500 relative w-28">
                        {row.tipo !== 'etapa' ? (
                          <div className="text-right text-slate-600 font-mono text-[13px] truncate">
                            {row.valor_unitario >= 0 ? `R$ ${formatFinancial(row.valor_unitario)}` : ''}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-500 font-mono text-[13px] w-28 truncate">
                        {bdiIncidence === 'unitario' 
                          ? (row.valor_bdi > 0 ? `R$ ${formatFinancial(row.valor_bdi)}` : '')
                          : (row.tipo !== 'etapa' ? `R$ ${formatFinancial(row.valor_unitario)}` : '')
                        }
                      </td>
                      <td style={{ width: '84.997px' }} className="px-3 py-1.5 text-right w-32">
                        <div className="flex items-center justify-end gap-2">
                          <span className={`font-mono text-[13px] truncate ${row.tipo === 'etapa' ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                            R$ {formatFinancial(row.total || 0)}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {addingRowType && addingRowParentId === row.id && (
                      <tr ref={addItemRowRef} className={`${
                        addingRowType === 'etapa' 
                          ? 'bg-blue-300 border-b border-blue-400' 
                          : addingRowType === 'composicao' 
                            ? 'bg-green-300 border-b border-green-400' 
                            : 'bg-yellow-200 border-b border-yellow-300'
                      } z-20 relative shadow-inner`}>
                      <td className="px-3 py-1.5 text-center w-28">
                        <input 
                          className={`w-full border border-blue-300 rounded px-2 py-1 text-center outline-none focus:ring-1 focus:ring-blue-500 text-[13px] text-slate-700 font-bold bg-amber-50`}
                          value={newItemData.item}
                          onChange={e => setNewItemData({...newItemData, item: e.target.value})}
                          onKeyDown={e => e.key === 'Enter' && handleAddItem(addingRowType, newItemData)}
                        />
                      </td>
                        <td className="px-3 py-1.5 text-center w-20">
                          {addingRowType === 'etapa' ? (
                            <span className="text-slate-500">-</span>
                          ) : (
                            <input 
                              className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-[13px] text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 text-center"
                              value={newItemData.base}
                              onChange={e => setNewItemData({...newItemData, base: e.target.value})}
                              onKeyDown={e => e.key === 'Enter' && handleAddItem(addingRowType, newItemData)}
                            />
                          )}
                        </td>
                        <td className="px-3 py-1.5 w-24">
                          {addingRowType === 'etapa' ? (
                            <div className="text-center text-slate-500">-</div>
                          ) : (
                            <div className="relative group">
                              <input 
                                className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-[13px] text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-mono text-center"
                                placeholder="Código"
                                value={newItemData.codigo}
                                onChange={e => setNewItemData({...newItemData, codigo: e.target.value})}
                                onKeyDown={e => e.key === 'Enter' && handleAddItem(addingRowType, newItemData)}
                              />
                            </div>
                          )}
                        </td>
                        <td className="pr-3 pl-0 py-1.5">
                          <div className="flex flex-col gap-1 relative">
                            {addingRowType === 'etapa' ? (
                              <input 
                                autoFocus
                                className="w-full bg-white border border-blue-300 rounded px-3 py-1 font-semibold text-slate-900 uppercase tracking-tight text-[13px] outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Descrição da Etapa"
                                value={newItemData.descricao}
                                onChange={e => setNewItemData({...newItemData, descricao: e.target.value})}
                                onKeyDown={e => e.key === 'Enter' && handleAddItem(addingRowType, newItemData)}
                              />
                            ) : (
                              <div className="relative w-full">
                                <input 
                                  className="w-full bg-white border border-blue-300 rounded px-3 py-1 text-[13px] text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                                  placeholder={`Descrição do ${addingRowType === 'insumo' ? 'Insumo' : 'Composição'}`}
                                  value={newItemData.descricao}
                                  onChange={e => setNewItemData({...newItemData, descricao: e.target.value})}
                                  onKeyDown={e => e.key === 'Enter' && handleAddItem(addingRowType, newItemData)}
                                  autoFocus
                                />
                                <AutocompleteDropdown 
                                  type={addingRowType as 'insumo' | 'composicao'} 
                                  showInput={false}
                                  codigo={newItemData.codigo}
                                  descricao={newItemData.descricao}
                                  desonerado={encargos.desonerado}
                                  estado={encargos.estado}
                                  dataReferencia={encargos.dataReferencia}
                                  bases={bancosAtivos.filter(b => b.active).map(b => b.id.toUpperCase())}
                                  onSelect={(item) => {
                                    if (item.isNew) {
                                      setNewItemData({
                                        ...newItemData,
                                        isNew: true,
                                        descricao: item.descricao,
                                        codigo: 'NOVO',
                                        preco_unitario: 0,
                                        unidade: 'un',
                                        base: 'PRÓPRIO'
                                      });
                                      setLocalNewPrice('0,00');
                                    } else {
                                      setNewItemData({
                                        ...newItemData,
                                        item_id: addingRowType === 'insumo' ? item.id_insumo : item.id_composicao,
                                        descricao: item.descricao?.replace(/^[\d\.]+\s*/, ''),
                                        codigo: addingRowType === 'insumo' ? item.codigo : item.codigo_composicao,
                                        preco_unitario: item.preco_unitario || 0,
                                        unidade: item.unidade,
                                        base: item.base || newItemData.base
                                      });
                                      setLocalNewPrice(formatFinancial(item.preco_unitario || 0));
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-center font-mono text-[13px] text-slate-600 w-16">
                          {newItemData.unidade || '-'}
                        </td>
                        <td className="px-3 py-1.5 w-20">
                          {addingRowType !== 'etapa' && (
                            <input 
                              type="text"
                              className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-[13px] text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 text-right font-mono"
                              placeholder="Qtd"
                              value={localNewQty !== '0,00' ? localNewQty : (newItemData.quantidade ? formatFinancial(newItemData.quantidade) : '')}
                              onChange={e => setLocalNewQty(e.target.value)}
                              onBlur={(e) => {
                                const val = parseBrazilianNumber(e.target.value);
                                if (val !== null) setNewItemData({...newItemData, quantidade: val});
                                setLocalNewQty(val !== null ? formatFinancial(val) : '');
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const val = parseBrazilianNumber(localNewQty);
                                  if (val !== null) setNewItemData({...newItemData, quantidade: val});
                                  handleAddItem(addingRowType, { ...newItemData, quantidade: val !== null ? val : newItemData.quantidade });
                                }
                              }}
                            />
                          )}
                        </td>
                        <td className="px-3 py-1.5 w-28">
                          {addingRowType !== 'etapa' && (
                            <div className="text-right font-mono text-[13px] text-slate-600 truncate">
                              {formatFinancial(newItemData.preco_unitario || 0)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right w-28 truncate">
                          {addingRowType !== 'etapa' 
                            ? `R$ ${formatFinancial((newItemData.preco_unitario || 0) * (1 + (obra?.bdi || 0)/100))}`
                            : '-'
                          }
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-[13px] text-slate-900 font-bold w-32">
                          <div className="flex items-center justify-end gap-2">
                            <span className="truncate">R$ {formatFinancial((newItemData.quantidade || 0) * (newItemData.preco_unitario || 0))}</span>
                            <div className="flex gap-1 flex-shrink-0">
                              <button 
                                onClick={() => handleAddItem(addingRowType, newItemData)}
                                className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                title="Adicionar"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                onClick={() => {
                                  setAddingRowType(null);
                                  setAddingRowParentId(null);
                                }}
                                className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                title="Cancelar"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}

                {addingRowType && !addingRowParentId && (
                    <tr ref={addItemRowRef} className={`${
                      addingRowType === 'etapa' 
                        ? 'bg-blue-300 border-b border-blue-400' 
                        : addingRowType === 'composicao' 
                          ? 'bg-green-300 border-b border-green-400' 
                          : 'bg-yellow-100 border-b border-yellow-200'
                    } relative`}>
                      <td className="px-3 py-1.5 text-center w-28">
                        <div className="flex flex-col gap-1 items-center">
                          <input 
                            className={`w-full border border-blue-300 rounded px-2 py-1 text-center outline-none focus:ring-1 focus:ring-blue-500 text-[13px] text-slate-700 font-bold bg-amber-50`}
                            value={newItemData.item}
                            onChange={e => setNewItemData({...newItemData, item: e.target.value})}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-center w-20">
                        {addingRowType === 'etapa' ? (
                          <span className="text-slate-400 text-[13px] font-medium">-</span>
                        ) : (
                          <input 
                            className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-center text-[13px] text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Base"
                            value={newItemData.base || ''}
                            onChange={e => setNewItemData({...newItemData, base: e.target.value})}
                          />
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center w-24">
                        {addingRowType === 'etapa' ? (
                          <span className="text-slate-400 text-[13px] font-medium">-</span>
                        ) : (
                          <div className="relative group">
                            <input 
                              className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-center font-mono text-[13px] font-medium text-slate-600 outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Código"
                              value={newItemData.codigo}
                              onChange={e => setNewItemData({...newItemData, codigo: e.target.value})}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex flex-col gap-1 relative">
                          {addingRowType === 'etapa' ? (
                            <input 
                              autoFocus
                              className="w-full bg-white border border-blue-300 rounded px-3 py-1 font-semibold text-slate-900 uppercase tracking-tight text-[13px] outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Descrição da Etapa"
                              value={newItemData.descricao}
                              onChange={e => setNewItemData({...newItemData, descricao: e.target.value})}
                              onKeyDown={e => e.key === 'Enter' && handleAddItem(addingRowType, newItemData)}
                            />
                          ) : (
                            <div className="relative w-full">
                              <input 
                                className="w-full bg-white border border-blue-300 rounded px-3 py-1 text-[13px] text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder={`Descrição do ${addingRowType === 'insumo' ? 'Insumo' : 'Composição'}`}
                                value={newItemData.descricao}
                                onChange={e => setNewItemData({...newItemData, descricao: e.target.value})}
                                onKeyDown={e => e.key === 'Enter' && handleAddItem(addingRowType, newItemData)}
                                autoFocus
                              />
                                <AutocompleteDropdown 
                                  type={addingRowType as 'insumo' | 'composicao'} 
                                  showInput={false}
                                  codigo={newItemData.codigo}
                                  descricao={newItemData.descricao}
                                  desonerado={encargos.desonerado}
                                  estado={encargos.estado}
                                  dataReferencia={encargos.dataReferencia}
                                  bases={bancosAtivos.filter(b => b.active).map(b => b.id.toUpperCase())}
                                  onSelect={(item) => {
                                    if (item.isNew) {
                                      setNewItemData({
                                        ...newItemData,
                                        isNew: true,
                                        descricao: item.descricao,
                                        codigo: 'NOVO',
                                        preco_unitario: 0,
                                        unidade: 'un',
                                        base: 'PRÓPRIO'
                                      });
                                      setLocalNewPrice('0,00');
                                    } else {
                                      setNewItemData({
                                        ...newItemData,
                                        item_id: addingRowType === 'insumo' ? item.id_insumo : item.id_composicao,
                                        descricao: item.descricao?.replace(/^[\d\.]+\s*/, ''),
                                        codigo: addingRowType === 'insumo' ? item.codigo : item.codigo_composicao,
                                        preco_unitario: item.preco_unitario || 0,
                                        unidade: item.unidade,
                                        base: item.base || newItemData.base
                                      });
                                      setLocalNewPrice(formatFinancial(item.preco_unitario || 0));
                                    }
                                  }}
                                />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-center font-mono text-[13px] text-slate-600">
                        {newItemData.unidade || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {addingRowType !== 'etapa' && (
                          <input 
                            type="text"
                            className="w-20 bg-white border border-blue-300 rounded px-2 py-1 text-right font-mono text-[13px] text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="1,00"
                            value={localNewQty}
                            onChange={e => {
                              setLocalNewQty(e.target.value);
                              const val = parseBrazilianNumber(e.target.value);
                              if (val !== null) setNewItemData({...newItemData, quantidade: val});
                            }}
                            onBlur={() => setLocalNewQty(formatFinancial(newItemData.quantidade))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const val = parseBrazilianNumber(localNewQty);
                                handleAddItem(addingRowType, { ...newItemData, quantidade: val !== null ? val : newItemData.quantidade });
                              }
                            }}
                          />
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {addingRowType !== 'etapa' && (
                          <div className="font-mono text-[13px] text-slate-600">
                            {formatFinancial(newItemData.preco_unitario)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-[13px] text-slate-500">
                        {addingRowType !== 'etapa' 
                          ? (bdiIncidence === 'unitario' 
                            ? `R$ ${formatFinancial(newItemData.preco_unitario * (1 + bdiValue/100))}` 
                            : `R$ ${formatFinancial(newItemData.preco_unitario)}`)
                          : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={`font-mono text-[13px] ${addingRowType === 'etapa' ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                            R$ {formatFinancial(bdiIncidence === 'unitario' ? (newItemData.quantidade * newItemData.preco_unitario * (1 + bdiValue/100)) : (newItemData.quantidade * newItemData.preco_unitario))}
                          </span>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => handleAddItem(addingRowType, newItemData)}
                              className="p-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                              title="Salvar"
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              onClick={() => setAddingRowType(null)}
                              className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                              title="Cancelar"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {/* Spacer for scrolling last lines to middle */}
                  <tr>
                    <td colSpan={9} className="h-[50vh]"></td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'cronograma' && (
          <div className="flex-1 flex flex-col bg-[#f8fafc] pb-20">
            <CronogramaView obraId={obraId} orcamento={orcamento} onRefresh={fetchData} />
          </div>
        )}

        {activeSubTab === 'medicao' && (
          <div className="flex-1 flex flex-col bg-[#f8fafc] pb-20">
            <MedicaoTab obraId={obraId} orcamento={orcamento} bdiIncidence={bdiIncidence} bdiValue={bdiValue} onRefresh={fetchData} />
          </div>
        )}

        {activeSubTab === 'diario' && (
          <DiarioObraTab obraId={obraId} onRefresh={fetchData} />
        )}

        {activeSubTab === 'curva_abc' && (
          <div className="space-y-6 pt-4 pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Análise Curva ABC</h3>
                <p className="text-xs text-slate-500 font-medium">Distribuição de custos por insumos</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <select 
                  value={abcCategoryFilter}
                  onChange={(e) => setAbcCategoryFilter(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="all">Todas Categorias</option>
                  <option value="material">Materiais</option>
                  <option value="mao_de_obra">Mão de Obra</option>
                  <option value="equipamento">Equipamentos</option>
                  <option value="encargos">Encargos</option>
                </select>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Total ABC</p>
                <p className="text-xl font-black text-slate-900">R$ {formatFinancial(filteredAbcData.reduce((acc, i) => acc + i.valor_total, 0))}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-red-500">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Classe A (80%)</p>
                <p className="text-xl font-black text-slate-900">{filteredAbcData.filter(i => i.classe === 'A').length} itens</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Classe B (15%)</p>
                <p className="text-xl font-black text-slate-900">{filteredAbcData.filter(i => i.classe === 'B').length} itens</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Classe C (5%)</p>
                <p className="text-xl font-black text-slate-900">{filteredAbcData.filter(i => i.classe === 'C').length} itens</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4">
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Gráfico de Pareto (Top 20 Custos)</h4>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={filteredAbcData.slice(0, 20).map(item => ({
                        name: item.descricao.length > 15 ? item.descricao.substring(0, 15) + '...' : item.descricao,
                        descricaoCompleta: item.descricao,
                        valor: item.valor_total,
                        percentualAcumulado: item.percentualAcumulado,
                        classe: item.classe
                      }))}
                      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    >
                      <defs>
                        <linearGradient id="colorPercent" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#EF4444" stopOpacity={0.2}/>
                          <stop offset={`${offsetA}%`} stopColor="#EF4444" stopOpacity={0.2}/>
                          <stop offset={`${offsetA}%`} stopColor="#F59E0B" stopOpacity={0.2}/>
                          <stop offset={`${offsetB}%`} stopColor="#F59E0B" stopOpacity={0.2}/>
                          <stop offset={`${offsetB}%`} stopColor="#10B981" stopOpacity={0.2}/>
                          <stop offset="100%" stopColor="#10B981" stopOpacity={0.2}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45} 
                        textAnchor="end" 
                        height={40} 
                        tick={{ fontSize: 9, fill: '#64748b' }} 
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                      />
                      <YAxis 
                        yAxisId="left" 
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} 
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        domain={[0, 100]} 
                        tickFormatter={(value) => `${Math.round(value)}%`} 
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-lg max-w-xs">
                                <p className="text-xs font-bold text-slate-800 mb-2">{data.descricaoCompleta}</p>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] text-slate-500 uppercase">Valor:</span>
                                  <span className="text-xs font-black text-indigo-600">R$ {formatFinancial(data.valor)}</span>
                                </div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] text-slate-500 uppercase">% Acumulado:</span>
                                  <span className="text-xs font-black text-emerald-600">{data.percentualAcumulado.toFixed(2)}%</span>
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-100">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    data.classe === 'A' ? 'bg-red-50 text-red-600' :
                                    data.classe === 'B' ? 'bg-amber-50 text-amber-600' :
                                    'bg-emerald-50 text-emerald-600'
                                  }`}>
                                    Classe {data.classe}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Area 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey="percentualAcumulado" 
                        fill="url(#colorPercent)" 
                        stroke="none" 
                      />
                      <Bar yAxisId="left" dataKey="valor" name="Valor Total (R$)" radius={[4, 4, 0, 0]} maxBarSize={50}>
                        {
                          filteredAbcData.slice(0, 20).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={
                              entry.classe === 'A' ? '#EF4444' : 
                              entry.classe === 'B' ? '#F59E0B' : 
                              '#10B981'
                            } />
                          ))
                        }
                      </Bar>
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey="percentualAcumulado" 
                        name="% Acumulado" 
                        stroke="#4F46E5" 
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Distribuição de Valor por Classe</h4>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Classe A', value: filteredAbcData.filter(i => i.classe === 'A').reduce((acc, i) => acc + i.valor_total, 0) },
                          { name: 'Classe B', value: filteredAbcData.filter(i => i.classe === 'B').reduce((acc, i) => acc + i.valor_total, 0) },
                          { name: 'Classe C', value: filteredAbcData.filter(i => i.classe === 'C').reduce((acc, i) => acc + i.valor_total, 0) },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#EF4444" />
                        <Cell fill="#F59E0B" />
                        <Cell fill="#10B981" />
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => `R$ ${formatFinancial(value)}`}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <table className="w-full text-left border-collapse table-fixed">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest w-20">Classe</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest w-32">Categoria</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center w-16">Unid.</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right w-24">Qtd.</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right w-32">Preço Unit.</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right w-32">Valor Total</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right w-20">%</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right w-24">% Acum.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAbcData.length === 0 ? (
                      <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">Nenhum dado para gerar curva ABC.</td></tr>
                    ) : filteredAbcData
                        .map((item, i) => (
                      <tr key={`abc-${item.id || i}`} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-4 py-3 w-20">
                          <span className={`px-2.5 py-1 rounded-lg font-black text-[10px] uppercase tracking-wider ${
                            item.classe === 'A' ? 'bg-red-50 text-red-600 border border-red-100' :
                            item.classe === 'B' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                            'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            {item.classe}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col truncate">
                            <span className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate" title={item.descricao}>{item.descricao}</span>
                            <span className="text-[10px] text-slate-400 font-mono uppercase">ID: {item.id}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 w-32">
                          <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-md truncate block text-center">
                            {item.categoria || 'Insumo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-slate-500 w-16">{item.unidade}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-slate-700 w-24">{item.quantidade?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-slate-700 w-32">R$ {formatFinancial(item.preco_unitario || 0)}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-900 w-32">R$ {formatFinancial(item.valor_total || 0)}</td>
                        <td className="px-4 py-3 text-right w-20">
                          <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md">
                            {item.percentual.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right w-24">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs font-bold text-slate-700">{item.percentualAcumulado.toFixed(2)}%</span>
                            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  item.classe === 'A' ? 'bg-red-500' :
                                  item.classe === 'B' ? 'bg-amber-500' :
                                  'bg-emerald-500'
                                }`}
                                style={{ width: `${item.percentualAcumulado}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {activeSubTab === 'orcado_real' && (() => {
          const totalOrcadoSuprimentos = filteredAbcData.reduce((acc, item) => acc + item.valor_total, 0);
          const totalRealSuprimentos = filteredAbcData.reduce((acc, item) => {
            const real = custosReais[item.id] || { quantidade: 0, preco_unitario: 0 };
            return acc + ((real.quantidade || 0) * (real.preco_unitario || 0));
          }, 0);
          const desvioTotalSuprimentos = totalOrcadoSuprimentos - totalRealSuprimentos;
          const isSavingTotal = desvioTotalSuprimentos >= 0;

          return (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Suprimentos / Orçado x Real</h2>
                  <p className="text-sm text-slate-500">Controle de aquisições e desvios de custo</p>
                </div>
                <div className="flex items-center gap-4">
                  <select 
                    value={abcCategoryFilter}
                    onChange={(e) => setAbcCategoryFilter(e.target.value as any)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="all">Todas Categorias</option>
                    <option value="material">Materiais</option>
                    <option value="mao_de_obra">Mão de Obra</option>
                    <option value="equipamento">Equipamentos</option>
                    <option value="encargos">Encargos</option>
                  </select>
                  <button
                    onClick={handleSaveCustosReais}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-sm"
                  >
                    <Check size={18} />
                    Salvar Alterações
                  </button>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <p className="text-sm font-medium text-slate-500 mb-1">Total Orçado (Filtrado)</p>
                  <p className="text-2xl font-black text-slate-800">R$ {formatFinancial(totalOrcadoSuprimentos)}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <p className="text-sm font-medium text-slate-500 mb-1">Total Realizado</p>
                  <p className="text-2xl font-black text-slate-800">R$ {formatFinancial(totalRealSuprimentos)}</p>
                </div>
                <div className={`p-4 rounded-xl shadow-sm border ${isSavingTotal ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-sm font-medium mb-1 ${isSavingTotal ? 'text-emerald-700' : 'text-red-700'}`}>Desvio (R$)</p>
                  <p className={`text-2xl font-black ${isSavingTotal ? 'text-emerald-600' : 'text-red-600'}`}>
                    {isSavingTotal ? '+' : '-'} R$ {formatFinancial(Math.abs(desvioTotalSuprimentos))}
                  </p>
                </div>
                <div className={`p-4 rounded-xl shadow-sm border flex items-center justify-center ${isSavingTotal ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="text-center">
                    <p className={`text-sm font-bold uppercase tracking-wider mb-1 ${isSavingTotal ? 'text-emerald-700' : 'text-red-700'}`}>Status</p>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${isSavingTotal ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>
                      {isSavingTotal ? 'SAVING (ECONOMIA)' : 'ESTOURO DE CUSTO'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <div>
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-24">Código</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Descrição</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-center w-16">Unid.</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-right w-24">Qtd Orçada</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-right w-32">Preço Orçado</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-right w-32">Total Orçado</th>
                        <th className="px-4 py-3 text-xs font-semibold text-emerald-700 uppercase text-right bg-emerald-50/50 w-24">Qtd Real</th>
                        <th className="px-4 py-3 text-xs font-semibold text-emerald-700 uppercase text-right bg-emerald-50/50 w-32">Preço Real</th>
                        <th className="px-4 py-3 text-xs font-semibold text-emerald-700 uppercase text-right bg-emerald-50/50 w-32">Total Real</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-right w-32">Desvio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAbcData.map((item) => {
                        const itemId = item.id;
                        const real = custosReais[itemId] || { quantidade: 0, preco_unitario: 0 };
                        const totalReal = (real.quantidade || 0) * (real.preco_unitario || 0);
                        const desvio = item.valor_total - totalReal;
                        const isSaving = desvio >= 0;

                        return (
                          <tr key={itemId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-xs font-medium text-slate-500 truncate w-24">{item.codigo}</td>
                            <td className="px-4 py-3 text-sm text-slate-900 truncate" title={item.descricao}>{item.descricao}</td>
                            <td className="px-4 py-3 text-xs text-center text-slate-500 w-16">{item.unidade}</td>
                            <td className="px-4 py-3 text-xs text-right text-slate-700 w-24">{item.quantidade?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-xs text-right text-slate-700 w-32">R$ {formatFinancial(item.preco_unitario)}</td>
                            <td className="px-4 py-3 text-xs text-right font-bold text-slate-900 w-32">R$ {formatFinancial(item.valor_total)}</td>
                            <td className="px-4 py-2 text-right bg-emerald-50/30 w-24">
                              <input
                                type="number"
                                value={real.quantidade || ''}
                                onChange={(e) => setCustosReais(prev => ({
                                  ...prev,
                                  [itemId]: { ...real, quantidade: parseFloat(e.target.value) || 0 }
                                }))}
                                className="w-full text-right text-xs p-1.5 border border-slate-200 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-4 py-2 text-right bg-emerald-50/30 w-32">
                              <input
                                type="number"
                                value={real.preco_unitario || ''}
                                onChange={(e) => setCustosReais(prev => ({
                                  ...prev,
                                  [itemId]: { ...real, preco_unitario: parseFloat(e.target.value) || 0 }
                                }))}
                                className="w-full text-right text-xs p-1.5 border border-slate-200 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-4 py-3 text-xs text-right font-bold text-emerald-700 bg-emerald-50/30 w-32 truncate">
                              R$ {formatFinancial(totalReal)}
                            </td>
                            <td className={`px-4 py-3 text-xs text-right font-bold w-32 truncate ${isSaving ? 'text-emerald-600' : 'text-red-600'}`}>
                              {isSaving ? '+' : '-'} R$ {formatFinancial(Math.abs(desvio))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

// --- Main App ---

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="text-red-500" size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Ops! Algo deu errado</h2>
              <p className="text-slate-500 text-sm font-medium">
                Ocorreu um erro inesperado na aplicação. Nossa equipe técnica foi notificada.
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl text-left overflow-auto max-h-32">
              <code className="text-xs text-red-600 font-mono break-all">
                {this.state.error?.message}
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AppContent />
      </Router>
    </ErrorBoundary>
  );
}

function AppContent() {
  console.log("AppContent rendering...");
  const [user, setUser] = useState<any>(null);
  const location = useLocation();
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'dashboard');
  const [selectedObraId, setSelectedObraId] = useState<string | number | null>(() => {
    const saved = localStorage.getItem('selectedObraId');
    return saved ? parseInt(saved, 10) : null;
  });
  const [composicaoStack, setComposicaoStack] = useState<number[]>(() => {
    const saved = localStorage.getItem('selectedComposicaoId');
    return saved ? [parseInt(saved, 10)] : [];
  });
  const selectedComposicaoId = composicaoStack.length > 0 ? composicaoStack[composicaoStack.length - 1] : null;
  const [selectedEstado, setSelectedEstado] = useState<string>(() => localStorage.getItem('selectedEstado') || 'Todos');
  const [selectedDataRef, setSelectedDataRef] = useState<string>(() => localStorage.getItem('selectedDataRef') || 'Todos');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('isSidebarCollapsed') === 'true');
  const isAdmin = user?.role === 'admin' || user?.role === 'admin_master' || user?.role === 'admin_pj' || user?.role === 'gestor';
  const isMaster = user?.role === 'admin_master';

  useEffect(() => {
    localStorage.setItem('isSidebarCollapsed', isSidebarCollapsed.toString());
    document.documentElement.style.setProperty('--sidebar-width', isSidebarCollapsed ? '64px' : '208px');
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem('auth_token');
      setUser(null);
    };
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    // Check if user is logged in
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then(data => {
        setUser(data.user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setIsAuthLoading(false);
      });
  }, []);

  useEffect(() => {
    if (user?.role === 'admin_master' && !['dashboard', 'empresas', 'settings', 'insumos', 'composicoes'].includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [user, activeTab]);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
    const scrollArea = document.getElementById('main-scroll-area');
    if (scrollArea) scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  useEffect(() => {
    if (selectedObraId != null) {
      localStorage.setItem('selectedObraId', selectedObraId.toString());
    } else {
      localStorage.removeItem('selectedObraId');
    }
  }, [selectedObraId]);

  useEffect(() => {
    if (selectedComposicaoId != null) {
      localStorage.setItem('selectedComposicaoId', selectedComposicaoId.toString());
      localStorage.setItem('selectedEstado', selectedEstado);
      localStorage.setItem('selectedDataRef', selectedDataRef);
    } else {
      localStorage.removeItem('selectedComposicaoId');
    }
  }, [selectedComposicaoId, selectedEstado, selectedDataRef]);

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
    setSelectedObraId(null);
    setComposicaoStack([]);
  };

  const handleSelectComposicao = (id: number, estado: string, dataRef: string) => {
    setSelectedEstado(estado);
    setSelectedDataRef(dataRef);
    setComposicaoStack([id]);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('auth_token');
      setUser(null);
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando Sistema...</p>
        </div>
      </div>
    );
  }

  if (location.pathname === '/reset-password') {
    return <ResetPassword />;
  }

  if (!user) {
    return <Login onLoginSuccess={(userData) => {
      setActiveTab('dashboard');
      setSelectedObraId(null);
      setComposicaoStack([]);
      setUser(userData);
    }} />;
  }

  const renderContent = () => {
    if (selectedObraId != null) {
      return (
        <ObraDetailView 
          obraId={selectedObraId} 
          onBack={() => setSelectedObraId(null)} 
          onNavigateToComposicao={(id) => setComposicaoStack([Number(id)])} 
          isAdmin={isAdmin}
          isMaster={isMaster}
        />
      );
    }

    if (selectedComposicaoId != null) {
      return (
        <ComposicaoDetailView 
          composicaoId={selectedComposicaoId} 
          onBack={() => setComposicaoStack(prev => prev.slice(0, -1))} 
          onNavigateToComposicao={(id) => setComposicaoStack(prev => [...prev, id])}
          isAdmin={isAdmin} 
          isMaster={isMaster}
          estado={selectedEstado}
          dataReferencia={selectedDataRef}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard': return <Dashboard isAdmin={isAdmin} onSelectObra={setSelectedObraId} setActiveTab={handleNavigate} />;
      case 'obras': return <ObrasView onSelectObra={setSelectedObraId} />;
      case 'insumos': return <InsumosMgmtView isAdmin={isAdmin} isMaster={isMaster} />;
      case 'composicoes': return <ComposicoesMgmtView onSelectComposicao={handleSelectComposicao} isAdmin={isAdmin} isMaster={isMaster} />;
      case 'templates': return <TemplatesView />;
      case 'empresas': return <EmpresasMgmtView />;
      case 'colaboradores': return <SettingsView user={user} forceTab="usuarios" />;
      case 'settings': return <SettingsView user={user} />;
      default: return <Dashboard isAdmin={isAdmin} onSelectObra={setSelectedObraId} setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] gap-[0.5px]">
      {/* Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-16' : 'w-52'} transition-all duration-300 bg-[#111827] flex flex-col sticky top-0 h-screen shadow-2xl z-[60] overflow-hidden shrink-0`}>
        <div className="w-full h-full flex flex-col">
          <div className={`flex items-center h-[72px] p-4 mb-2 ${isSidebarCollapsed ? 'justify-center' : 'justify-start gap-2'}`}>
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="w-10 h-10 bg-orange-500 hover:bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-950/50 shrink-0 transition-colors"
              title={isSidebarCollapsed ? "Expandir" : "Recolher"}
            >
              <Hammer size={20} strokeWidth={2.5} />
            </button>
            {!isSidebarCollapsed && (
              <div 
                className="cursor-pointer"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                title="Recolher"
              >
                <h1 className="text-[12px] font-bold text-white uppercase tracking-[0.1em] leading-tight whitespace-nowrap">Gestão de <br/>Obras</h1>
              </div>
            )}
          </div>
          
          <nav className="flex-1 mt-2">
              <SidebarItem icon={LayoutDashboard} label={user?.role === 'admin_master' ? 'Gestão Geral' : 'Dashboard'} active={activeTab === 'dashboard'} onClick={() => handleNavigate('dashboard')} collapsed={isSidebarCollapsed} />
              
              {user?.role === 'admin_master' ? (
                <>
                  <SidebarItem icon={Building2} label="Empresas" active={activeTab === 'empresas'} onClick={() => handleNavigate('empresas')} collapsed={isSidebarCollapsed} />
                  <SidebarItem icon={Database} label="Insumos" active={activeTab === 'insumos'} onClick={() => handleNavigate('insumos')} collapsed={isSidebarCollapsed} />
                  <SidebarItem icon={Layers} label="Composições" active={activeTab === 'composicoes'} onClick={() => handleNavigate('composicoes')} collapsed={isSidebarCollapsed} />
                </>
              ) : (
                <>
                  <SidebarItem icon={HardHat} label="Obras" active={activeTab === 'obras'} onClick={() => handleNavigate('obras')} collapsed={isSidebarCollapsed} />
                  {(user?.role === 'admin_pj') && (
                    <SidebarItem icon={Users} label="Colaboradores" active={activeTab === 'colaboradores'} onClick={() => handleNavigate('colaboradores')} collapsed={isSidebarCollapsed} />
                  )}
                  <SidebarItem icon={Database} label="Insumos" active={activeTab === 'insumos'} onClick={() => handleNavigate('insumos')} collapsed={isSidebarCollapsed} />
                  <SidebarItem icon={Layers} label="Composições" active={activeTab === 'composicoes'} onClick={() => handleNavigate('composicoes')} collapsed={isSidebarCollapsed} />
                </>
              )}
            </nav>

          <div className="py-2 border-t border-slate-800/30">
            <SidebarItem icon={Settings} label="Configurações" active={activeTab === 'settings'} onClick={() => handleNavigate('settings')} collapsed={isSidebarCollapsed} />
            <SidebarItem icon={LogOut} label="Sair" active={false} onClick={handleLogout} collapsed={isSidebarCollapsed} />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Fixed Header Area */}
        <div id="top-toolbar-wrapper" className="px-4 pt-6 pb-2 z-50">
          <TopToolbar onNavigate={handleNavigate} user={user} activeObraId={selectedObraId} />
        </div>

        {/* Scrollable Content Area */}
        <div 
          id="main-scroll-area" 
          className="flex-1 overflow-auto px-4 pb-10 w-full"
        >
          <AnimatePresence mode="wait">
              <motion.div
                key={selectedObraId ? `obra-${selectedObraId}` : (selectedComposicaoId ? `comp-${selectedComposicaoId}` : activeTab)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

const ObrasView = ({ onSelectObra }: { onSelectObra: (id: string | number) => void }) => {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('obrasSearchTerm') || '');
  const [newObra, setNewObra] = useState<Partial<Obra>>({ 
    nome: '', 
    cliente: '', 
    descricao: '',
    status: 'Em Planejamento', 
    data_inicio: '', 
    uf: 'DF',
    desonerado: 1,
    data_referencia: '2025-10',
    bancos_ativos: '["sinapi"]'
  });
  const [editingObraId, setEditingObraId] = useState<string | number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | number | null>(null);

  const fetchObras = () => {
    setLoading(true);
    fetch('/api/obras')
      .then(async res => {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new Error(`Invalid JSON: ${text.substring(0, 20)}...`);
        }
      })
      .then(data => {
        if (Array.isArray(data)) {
          setObras(data);
        } else {
          setObras([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching obras:", err);
        setObras([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchObras();
  }, []);

  useEffect(() => {
    localStorage.setItem('obrasSearchTerm', searchTerm);
  }, [searchTerm]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingObraId) {
      console.log("Updating obra. newObra:", newObra);
      const res = await fetch(`/api/obras/${editingObraId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newObra)
      });
      if (res.ok) {
        setShowModal(false);
        setEditingObraId(null);
        setNewObra({ 
          nome: '', 
          cliente: '', 
          descricao: '',
          status: 'Em Planejamento', 
          data_inicio: '', 
          uf: 'DF',
          desonerado: 1,
          data_referencia: '2025-10',
          bancos_ativos: '["sinapi"]'
        });
        
        fetchObras();
      }
    } else {
      const res = await fetch('/api/obras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newObra)
      });
      if (res.ok) {
        setShowModal(false);
        setNewObra({ 
          nome: '', 
          cliente: '', 
          descricao: '',
          status: 'Em Planejamento', 
          data_inicio: '', 
          uf: 'DF',
          desonerado: 1,
          data_referencia: '2025-10',
          bancos_ativos: '["sinapi"]'
        });
        fetchObras();
      }
    }
  };

  const handleEditClick = (obra: Obra) => {
    setEditingObraId(obra.id);
    setNewObra({
      ...obra,
      uf: obra.uf || 'DF',
      desonerado: obra.desonerado ?? 1,
      data_referencia: obra.data_referencia || '2025-10',
      bancos_ativos: obra.bancos_ativos || '["sinapi"]'
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string | number) => {
    try {
      const response = await fetch(`/api/obras/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchObras();
      } else {
        console.error('Erro ao excluir obra');
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const filteredObras = (obras || []).filter(o => 
    o && (
      (o.nome || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
      (o.cliente || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    )
  );

  return (
    <div className="space-y-7">
      <div className="space-y-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Obra</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Gerencie todos os seus projetos</p>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input 
              type="text" 
              placeholder="Buscar obra..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            variant="primary"
            icon={Plus}
            onClick={() => {
              setEditingObraId(null);
              setNewObra({ 
                nome: '', 
                cliente: '', 
                status: 'Em Planejamento', 
                data_inicio: '', 
                uf: 'DF',
                desonerado: 1,
                data_referencia: '2025-10',
                bancos_ativos: '["sinapi"]'
              });
              setShowModal(true);
            }}
          >
            Nova Obra
          </Button>
        </div>
      </div>

      <ObrasList 
        onSelectObra={onSelectObra} 
        obras={filteredObras} 
        loading={loading} 
        onEditObra={handleEditClick}
        onDeleteObra={setDeleteConfirm}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
          >
            <h3 className="text-xl font-bold text-slate-900 mb-6">
              {editingObraId ? 'Editar Obra' : 'Cadastrar Nova Obra'}
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome da Obra</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newObra.nome}
                  onChange={e => setNewObra({...newObra, nome: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cliente</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newObra.cliente}
                  onChange={e => setNewObra({...newObra, cliente: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Descrição</label>
                <textarea 
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  value={newObra.descricao || ''}
                  onChange={e => setNewObra({...newObra, descricao: e.target.value})}
                  placeholder="Descreva a obra detalhadamente..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data Início</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newObra.data_inicio}
                    onChange={e => setNewObra({...newObra, data_inicio: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">UF da Obra</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newObra.uf}
                    onChange={e => setNewObra({...newObra, uf: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    {BRAZILIAN_STATES.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data Referência</label>
                  <input 
                    type="month"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newObra.data_referencia}
                    onChange={e => setNewObra({...newObra, data_referencia: e.target.value})}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input 
                    type="checkbox"
                    id="new-desonerado-app"
                    checked={newObra.desonerado === 1}
                    onChange={e => setNewObra({...newObra, desonerado: e.target.checked ? 1 : 0})}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="new-desonerado-app" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer">
                    Desonerado
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Status</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newObra.status}
                    onChange={e => setNewObra({...newObra, status: e.target.value})}
                  >
                    <option>Em Planejamento</option>
                    <option>Em Andamento</option>
                    <option>Paralisada</option>
                    <option>Concluída</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowModal(false);
                    setEditingObraId(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="primary"
                  className="flex-1"
                  type="submit"
                >
                  {editingObraId ? 'Atualizar' : 'Salvar'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
          >
            <h3 className="text-xl font-bold text-slate-900 mb-4">Confirmar Exclusão</h3>
            <p className="text-slate-600 mb-8">
              Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita e removerá todos os dados associados.
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancelar
              </Button>
              <Button 
                variant="danger"
                className="flex-1"
                onClick={() => handleDelete(deleteConfirm)}
              >
                Excluir
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const ObrasList = ({ 
  onSelectObra, 
  obras, 
  loading,
  onEditObra,
  onDeleteObra
}: { 
  onSelectObra: (id: string | number) => void, 
  obras: Obra[], 
  loading: boolean,
  onEditObra?: (obra: Obra) => void,
  onDeleteObra?: (id: string | number) => void
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {loading ? (
        <div className="col-span-full py-12 text-center text-slate-500">Carregando obras...</div>
      ) : (Array.isArray(obras) ? obras : []).map((obra, idx) => (
        <div 
          key={`${obra.id}-${idx}`} 
          className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group relative"
        >
          <div className="h-1.5 bg-[#111827]/80" />
          <div className="p-6 cursor-pointer" onClick={() => onSelectObra(obra.id)}>
            <div className="flex justify-between items-center">
              <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                obra.status === 'Em Andamento' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
              }`}>
                {obra.status}
              </span>
              <span className="text-slate-400 text-[11px] font-mono font-medium">#000{obra.id}</span>
            </div>

            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-4 leading-tight group-hover:text-orange-500 transition-colors">
              {obra.nome}
            </h3>
            <p className="text-[14px] text-slate-500 mt-2 leading-relaxed line-clamp-2" title={obra.descricao || ''}>
              {obra.descricao ? obra.descricao : <span className="italic text-slate-400">Nenhuma descrição informada.</span>}
            </p>
            
            <div className="my-6 border-t border-slate-100" />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-500 text-[13px] font-medium">
                <MapPin size={13} className="text-slate-400" />
                <span>{obra.uf ? `UF: ${obra.uf}` : 'Local não informado'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 text-[13px] font-medium">
                <Calendar size={13} className="text-slate-400" />
                <span>Início: {obra.data_inicio ? new Date(obra.data_inicio).toLocaleDateString('pt-BR') : 'Não informado'}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
              <div className="text-slate-900 font-black text-sm">
                R$ {formatFinancial(obra.valor_total || 0)}
              </div>
              <div className="text-slate-900 font-bold text-[13px] flex items-center gap-1 group-hover:gap-2 transition-all">
                Detalhes <ChevronRight size={13} strokeWidth={3} />
              </div>
            </div>
          </div>
          
          <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEditObra && (
              <button 
                onClick={(e) => { e.stopPropagation(); onEditObra(obra); }}
                className="p-2 bg-white rounded-full shadow-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Editar"
              >
                <Edit2 size={14} />
              </button>
            )}
            {onDeleteObra && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDeleteObra(obra.id); }}
                className="p-2 bg-white rounded-full shadow-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Excluir"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

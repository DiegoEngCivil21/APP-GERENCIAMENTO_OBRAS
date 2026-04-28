import { useState, useEffect } from "react";
import { api } from "../services/api";
import { Plus, Eye, X, Loader2, ArrowRight, Trash2, Calendar, HardHat } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatFinancial = (value: number) => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function MedicaoTab({ obraId, orcamento, bdiIncidence, bdiValue }: { obraId: string | number, orcamento: any[], bdiIncidence: string, bdiValue: number }) {
  const [medicoes, setMedicoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  
  const [medicaoItems, setMedicaoItems] = useState<any[]>([]);
  const [medicaoDate, setMedicaoDate] = useState(new Date().toISOString().split('T')[0]);
  const [medicaoPeriodoInicio, setMedicaoPeriodoInicio] = useState('');
  const [medicaoPeriodoFim, setMedicaoPeriodoFim] = useState('');
  const [medicaoObservacoes, setMedicaoObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState<any>(null);
  const [viewingItems, setViewingItems] = useState<any[]>([]);
  const [loadingView, setLoadingView] = useState(false);

  const load = () => {
    api.getMedicoes(obraId)
      .then(r => setMedicoes(r))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [obraId]);

  const openNew = () => {
    const items = orcamento
      .filter(item => item.tipo === 'composicao' || item.tipo === 'insumo')
      .map(item => ({ ...item, quantidade_medida: 0 }));
    setMedicaoItems(items);
    setMedicaoDate(new Date().toISOString().split('T')[0]);
    setMedicaoPeriodoInicio('');
    setMedicaoPeriodoFim('');
    setMedicaoObservacoes('');
    setModalOpen(true);
  };

  const handleSave = async () => {
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

    setSaving(true);
    try {
      const response = await fetch(`/api/obras/${obraId}/medicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_medicao: medicaoDate,
          periodo_inicio: medicaoPeriodoInicio || medicaoDate,
          periodo_fim: medicaoPeriodoFim || medicaoDate,
          observacoes: medicaoObservacoes,
          itens: itemsToSave
        })
      });

      if (response.ok) {
        setModalOpen(false);
        load();
      } else {
        const error = await response.json();
        alert("Erro ao salvar medição: " + error.message);
      }
    } catch (error) {
      console.error("Error saving medicao:", error);
    } finally {
      setSaving(false);
    }
  };

  const openView = async (m: any) => {
    setViewing(m);
    setViewOpen(true);
    setLoadingView(true);
    try {
      const itens = await api.getMedicaoItens(obraId, m.id);
      setViewingItems(itens);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingView(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir esta medição? Isso irá reverter o progresso dos itens. Continuar?")) return;
    await api.deleteMedicao(obraId, id);
    load();
  };

  const fmtDate = (d: string) => {
    try { return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openNew} className="px-5 py-2.5 flex items-center justify-center rounded-xl font-bold transition-colors bg-[#F97316] hover:bg-orange-600 text-white text-sm">
          <Plus size={17} className="mr-2" /> Nova Medição
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 bg-slate-50 rounded-2xl animate-pulse border border-slate-100" />)}</div>
      ) : medicoes.length === 0 ? (
        <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-3xl">
          <HardHat size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm font-medium">Nenhuma medição registrada para esta obra.</p>
          <button className="px-4 py-2 mt-4 rounded-xl border border-slate-200 font-medium transition-colors hover:bg-slate-50 text-slate-700" onClick={openNew}>Registrar primeira medição</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {medicoes.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-sm transition-shadow flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <p className="text-sm font-bold text-slate-900">{fmtDate(m.data_medicao)}</p>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 outline outline-1 outline-slate-200 text-[10px] font-bold uppercase tracking-wider">
                      {fmtDate(m.periodo_inicio)} - {fmtDate(m.periodo_fim)}
                    </span>
                  </div>
                  {m.observacoes && <p className="text-sm text-slate-500 line-clamp-1">{m.observacoes}</p>}
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-0.5">Total Medido</p>
                  <p className="text-sm font-black text-emerald-600">R$ {formatFinancial(m.total_valor || 0)}</p>
                </div>
                
                <div className="flex gap-2 border-l border-slate-100 pl-4">
                  <button className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors" title="Visualizar" onClick={() => openView(m)}><Eye size={18} /></button>
                  <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="Excluir" onClick={() => handleDelete(m.id)}><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nova Medição */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 sm:px-8 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-bold text-xl text-slate-800">Registrar Nova Medição</h3>
              <button onClick={() => setModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-5 sm:px-8 bg-slate-50/50 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Data Medição</label>
                <input type="date" value={medicaoDate} onChange={e => setMedicaoDate(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Período Início</label>
                <input type="date" value={medicaoPeriodoInicio} onChange={e => setMedicaoPeriodoInicio(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Período Fim</label>
                <input type="date" value={medicaoPeriodoFim} onChange={e => setMedicaoPeriodoFim(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Observações</label>
                <input type="text" value={medicaoObservacoes} onChange={e => setMedicaoObservacoes(e.target.value)} placeholder="Opcional..." className="w-full border border-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-0">
              <table className="w-full text-left text-sm table-fixed border-collapse">
                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                  <tr>
                    <th className="py-3 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-white">Item do Orçamento</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right w-28 bg-white">Qtd. Prevista</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right w-28 bg-white">Já Medido</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center w-36 bg-white border-l border-slate-100">Executado (Mês)</th>
                    <th className="py-3 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right w-36 bg-white">Valor (Mês)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {medicaoItems.map((item, idx) => {
                    const progressoNum = (item.progresso || 0) / 100 * item.quantidade;
                    const bdiMult = bdiIncidence === 'unitario' ? (1 + bdiValue / 100) : 1;
                    const valorItem = item.quantidade_medida * (item.custo_unitario_aplicado || 0) * bdiMult;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-6">
                          <div className="font-bold text-slate-800 text-sm truncate" title={item.descricao}>{item.descricao}</div>
                          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">{item.codigo}</div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-medium text-slate-700">{item.quantidade}</span> <span className="text-xs text-slate-400">{item.unidade}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-medium text-slate-500">{progressoNum.toFixed(2)}</span>
                        </td>
                        <td className="py-2 px-4 border-l border-slate-100 bg-orange-50/30">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.quantidade_medida || ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const newItems = [...medicaoItems];
                              newItems[idx].quantidade_medida = val;
                              setMedicaoItems(newItems);
                            }}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-right text-sm font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-sm"
                          />
                        </td>
                        <td className="py-3 px-6 text-right font-black text-slate-900">
                          R$ {formatFinancial(valorItem)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-5 sm:px-8 bg-slate-50 border-t border-slate-200 flex justify-between items-center rounded-b-2xl">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total da Medição</p>
                <p className="text-2xl font-black text-slate-800 tracking-tight">
                  R$ {formatFinancial(medicaoItems.reduce((acc, item) => acc + (item.quantidade_medida * (item.custo_unitario_aplicado || 0) * (bdiIncidence === 'unitario' ? (1 + bdiValue / 100) : 1)), 0) * (bdiIncidence === 'final' ? (1 + bdiValue / 100) : 1))}
                </p>
              </div>
              <div className="flex gap-3">
                <button disabled={saving} className="px-5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button disabled={saving} className="px-5 py-2.5 bg-[#F97316] hover:bg-orange-600 rounded-xl text-sm font-bold text-white shadow-sm transition-colors flex items-center gap-2" onClick={handleSave}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? "Salvando..." : "Salvar Medição"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal View */}
      {viewOpen && viewing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 sm:px-8 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-bold text-xl text-slate-800">Detalhes da Medição</h3>
              <button onClick={() => setViewOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-5 sm:px-8 bg-slate-50/50 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data</p><p className="form-medium text-sm text-slate-800">{fmtDate(viewing.data_medicao)}</p></div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Período</p><p className="form-medium text-sm text-slate-800">{fmtDate(viewing.periodo_inicio)} até {fmtDate(viewing.periodo_fim)}</p></div>
              <div className="md:col-span-2"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Observações</p><p className="form-medium text-sm text-slate-800">{viewing.observacoes || "-"}</p></div>
            </div>

            <div className="flex-1 overflow-y-auto p-0">
              {loadingView ? (
                <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 text-orange-400 animate-spin" /></div>
              ) : (
                <table className="w-full text-left text-sm table-fixed border-collapse">
                  <thead className="sticky top-0 bg-white z-10 shadow-sm border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-white">Item Medido</th>
                      <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right w-28 bg-white">Qtd</th>
                      <th className="py-3 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right w-36 bg-white">Valor R$</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingItems.map(item => {
                       const bdiMult = bdiIncidence === 'unitario' ? (1 + bdiValue / 100) : 1;
                       const valor = item.quantidade_medida * (item.custo_unitario_aplicado || 0) * bdiMult;
                       return (
                         <tr key={item.id} className="hover:bg-slate-50/50">
                           <td className="py-3 px-6">
                             <div className="font-bold text-slate-800 text-sm truncate" title={item.descricao}>{item.descricao}</div>
                             <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">{item.codigo}</div>
                           </td>
                           <td className="py-3 px-4 text-right">
                             <span className="font-bold text-slate-700">{item.quantidade_medida}</span> <span className="text-xs text-slate-400">{item.unidade}</span>
                           </td>
                           <td className="py-3 px-6 text-right font-bold text-emerald-600">
                             {formatFinancial(valor)}
                           </td>
                         </tr>
                       );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-5 sm:px-8 border-t border-slate-100 bg-white flex justify-end items-center rounded-b-2xl">
              <div className="text-right flex items-center gap-4">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Total da Medição</span>
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  R$ {formatFinancial(viewing.total_valor || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

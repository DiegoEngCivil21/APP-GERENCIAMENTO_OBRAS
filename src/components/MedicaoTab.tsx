import { useState, useEffect } from "react";
import { api } from "../services/api";
import { Loader2, Plus, X, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatFinancial = (value: number) => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function MedicaoTab({ 
  obraId, 
  orcamento, 
  bdiIncidence = 'unitario', 
  bdiValue = 0 
}: { 
  obraId: string | number, 
  orcamento: any[],
  bdiIncidence?: 'unitario' | 'final',
  bdiValue?: number
}) {
  const [medicoes, setMedicoes] = useState<any[]>([]);
  const [itensMedicao, setItensMedicao] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<Record<string, number>>({});

  const bdiFactor = bdiIncidence === 'final' ? (1 + (bdiValue || 0) / 100) : 1;

  const load = async () => {
    setLoading(true);
    setEdits({});
    try {
      const medicoesData = await api.getMedicoes(obraId);
      const response = await fetch(`/api/obras/${obraId}/medicao-itens-flat?t=${Date.now()}`);
      const itensData = await response.json();
      setMedicoes(medicoesData);
      setItensMedicao(itensData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => { load(); }, [obraId]);
  
  const getQtd = (itemId: number, medicaoId: number) => {
    const editKey = `${medicaoId}-${itemId}`;
    if (edits.hasOwnProperty(editKey)) return edits[editKey];
    const item = itensMedicao.find(i => i.orcamento_item_id === itemId && i.medicao_id === medicaoId);
    return item ? item.quantidade_medida : 0;
  };
  
  const handleEdit = (itemId: number, medicaoId: number, value: number) => {
    const numericValue = isNaN(value) ? 0 : value;
    setEdits(prev => ({ ...prev, [`${medicaoId}-${itemId}`]: numericValue }));
  };

  const saveMedicoes = async () => {
    if (Object.keys(edits).length === 0) return;
    setSaving(true);
    try {
        const res = await fetch(`/api/obras/${obraId}/medicao-itens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ changes: edits })
        });
        
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            alert("Erro ao salvar: " + (errorData.message || errorData.error || res.statusText));
            return;
        }

        setEdits({});
        await load();
    } catch (e: any) {
        console.error(e);
        alert("Erro de conexão ao salvar.");
    } finally {
        setSaving(false);
    }
  };
  
  const getTotalMedido = (itemId: number) => {
    let total = 0;
    const medicoesForItem = new Set(itensMedicao.filter(i => i.orcamento_item_id === itemId).map(i => i.medicao_id));
    medicoes.forEach(m => medicoesForItem.add(m.id));
    
    medicoesForItem.forEach(medId => {
        const editKey = `${medId}-${itemId}`;
        if (edits.hasOwnProperty(editKey)) {
            total += edits[editKey];
        } else {
            const serverItem = itensMedicao.find(i => i.orcamento_item_id === itemId && i.medicao_id === medId);
            total += (serverItem ? serverItem.quantidade_medida : 0);
        }
    });

    return total;
  };

  const getChildren = (itemCode: string) => {
    return orcamento.filter(i => {
      // Exclude stages and sub-stages, we want actual items (insumos/composições)
      if (i.tipo === 'etapa' || i.tipo === 'subetapa') return false;
      if (i.item === itemCode) return false;
      // Precise check: starts with prefix and followed by a dot or is exactly a child
      return i.item.startsWith(itemCode + ".");
    });
  };

  const getStageTotalMedido = (itemCode: string, medicaoId?: number) => {
    const children = getChildren(itemCode);
    return children.reduce((acc, child) => {
        if (medicaoId) {
            return acc + (getQtd(child.id, medicaoId) * (child.valor_unitario || 0) * bdiFactor);
        }
        return acc + (getTotalMedido(child.id) * (child.valor_unitario || 0) * bdiFactor);
    }, 0);
  };
  
  const [showNewMedicaoModal, setShowNewMedicaoModal] = useState(false);
  const [newMedicaoData, setNewMedicaoData] = useState({
    data_medicao: new Date().toISOString().split('T')[0],
    periodo_inicio: '',
    periodo_fim: '',
    observacoes: ''
  });

  const handleCreateMedicao = async () => {
    if (!newMedicaoData.periodo_inicio || !newMedicaoData.periodo_fim) {
      alert("Informe os períodos de início e fim.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/obras/${obraId}/medicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMedicaoData)
      });
      if (res.ok) {
        setShowNewMedicaoModal(false);
        await load();
      } else {
        const err = await res.json();
        alert("Erro ao criar medição: " + err.message);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao criar medição.");
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizarMedicao = async (medicaoId: number) => {
    if(!confirm("Tem certeza que deseja finalizar esta medição? Esta ação não pode ser desfeita.")) return;
    setSaving(true);
    try {
        const res = await fetch(`/api/obras/${obraId}/medicoes/${medicaoId}/finalizar`, {
            method: 'POST'
        });
        if(res.ok) {
            await load();
        } else {
            alert("Erro ao finalizar medição.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
         <h3 className="text-lg font-bold text-slate-800">Planilha de Medições</h3>
         <div className="flex items-center gap-3">
             <button
               onClick={() => setShowNewMedicaoModal(true)}
               className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold text-sm"
             >
               <Plus size={14} /> Nova
             </button>
             {saving && <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />}
             <button
              onClick={saveMedicoes}
              disabled={saving || Object.keys(edits).length === 0}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 font-semibold text-sm"
             >
               {saving ? 'Salvando...' : 'Salvar'}
             </button>
         </div>
      </div>

      {showNewMedicaoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h4 className="font-bold text-slate-800">Nova Medição</h4>
              <button onClick={() => setShowNewMedicaoModal(false)} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data da Medição</label>
                <input 
                  type="date"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  value={newMedicaoData.data_medicao}
                  onChange={e => setNewMedicaoData({...newMedicaoData, data_medicao: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Início do Período</label>
                  <input 
                    type="date"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    value={newMedicaoData.periodo_inicio}
                    onChange={e => setNewMedicaoData({...newMedicaoData, periodo_inicio: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Fim do Período</label>
                  <input 
                    type="date"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    value={newMedicaoData.periodo_fim}
                    onChange={e => setNewMedicaoData({...newMedicaoData, periodo_fim: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Observações</label>
                <textarea 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                  value={newMedicaoData.observacoes}
                  onChange={e => setNewMedicaoData({...newMedicaoData, observacoes: e.target.value})}
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setShowNewMedicaoModal(false)}
                className="px-4 py-2 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors font-semibold"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreateMedicao}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
          <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-3 font-bold text-slate-600 w-[60px] text-center">Item</th>
                  <th className="px-3 py-3 font-bold text-slate-600">Descrição dos Serviços</th>
                  <th className="px-3 py-3 font-bold text-center text-slate-600 w-[90px]">Orcado (R$)</th>
                  <th className="px-3 py-3 font-bold text-center text-emerald-800 w-[90px] bg-emerald-50/50">Med. Acum (R$)</th>
                  {medicoes.map(m => (
                    <th key={m.id} className="px-1 py-2 font-bold text-center text-slate-600 w-[80px] border-l border-slate-100">
                      <div className="text-[10px] uppercase font-bold">{format(parseISO(m.data_medicao), "MMM/yy", { locale: ptBR })}</div>
                      <div className="text-[9px] font-normal text-slate-400">ID: {m.id}</div>
                      {m.status !== 'fechada' && (
                        <button 
                          onClick={() => handleFinalizarMedicao(m.id)}
                          className="mt-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white rounded px-2 py-0.5 hover:bg-emerald-700 transition-colors"
                        >
                          <Check size={10} /> Concluir
                        </button>
                      )}
                    </th>
                  ))}
                  <th className="px-3 py-3 font-bold text-center text-slate-600 w-[90px]">Saldo (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orcamento.map(item => {
                  const totalMedidoQtd = getTotalMedido(item.id);
                  const totalMedidoValor = totalMedidoQtd * (item.valor_unitario || 0) * bdiFactor;
                  const valorTotalOrcado = (item.quantidade || 0) * (item.valor_unitario || 0) * bdiFactor;
                  const saldoValor = valorTotalOrcado - totalMedidoValor;
                  const percentTotal = valorTotalOrcado > 0 ? (totalMedidoValor / valorTotalOrcado) * 100 : 0;
                  
                  if (item.tipo === 'etapa' || item.tipo === 'subetapa') {
                    const stageItemTotal = (item.total || 0) * bdiFactor;
                    const stageTotalMedido = getStageTotalMedido(item.item);
                    const stagePercent = stageItemTotal > 0 ? (stageTotalMedido / stageItemTotal) * 100 : 0;
                    const stageSaldo = stageItemTotal - stageTotalMedido;

                    return (
                        <tr key={item.id} className="bg-slate-100 font-bold text-slate-800">
                             <td className="px-3 py-2 text-center">{item.item}</td>
                             <td className="px-3 py-2" colSpan={1}>{item.descricao}</td>
                             <td className="px-3 py-2 text-center">
                               <div className="font-semibold">{formatFinancial(stageItemTotal)}</div>
                             </td>
                             <td className="px-3 py-2 text-center">
                               <div className="font-semibold text-emerald-700">R$ {formatFinancial(stageTotalMedido)}</div>
                               <div className="text-[10px] text-emerald-500">{stagePercent.toFixed(1)} %</div>
                             </td>
                             {medicoes.map(m => {
                               const medStageValor = getStageTotalMedido(item.item, m.id);
                               const medStagePercent = stageItemTotal > 0 ? (medStageValor / stageItemTotal) * 100 : 0;
                               return (
                                <td key={m.id} className="px-3 py-2 text-center">
                                  <div className="text-[11px] font-bold">R$ {formatFinancial(medStageValor)}</div>
                                  <div className="text-[9px] text-slate-400">{medStagePercent.toFixed(1)} %</div>
                                </td>
                               );
                             })}
                             <td className="px-3 py-2 text-center">R$ {formatFinancial(stageSaldo)}</td>
                        </tr>
                    )
                  }

                  return (
                   <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                       <td className="px-3 py-2 text-center text-slate-500 font-mono">{item.item}</td>
                       <td className="px-3 py-2 text-slate-700 truncate max-w-xs">{item.descricao}</td>
                       <td className="px-3 py-2 text-center">
                         <div className="font-semibold text-slate-900">{formatFinancial(item.quantidade)}</div>
                         <div className="text-[10px] text-slate-400">R$ {formatFinancial(valorTotalOrcado)}</div>
                       </td>
                       <td className="px-3 py-2 text-center text-emerald-700 font-semibold">
                         <div>R$ {formatFinancial(totalMedidoValor)}</div>
                         <div className="text-[10px] text-emerald-500">{percentTotal.toFixed(1)} %</div>
                       </td>
                       {medicoes.map(m => {
                          const qtd = getQtd(item.id, m.id);
                          const valorMedido = qtd * (item.valor_unitario || 0) * bdiFactor;
                          const percent = valorTotalOrcado > 0 ? (valorMedido / valorTotalOrcado) * 100 : 0;
                          return (
                            <td key={m.id} className="px-1 py-1 text-center">
                              <div className="flex flex-col items-center">
                                  <input
                                   type="number"
                                   disabled={m.status === 'fechada'}
                                   className={`w-16 p-1 text-center font-medium text-slate-800 bg-white border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-emerald-500 focus:outline-none ${edits[`${m.id}-${item.id}`] !== undefined ? 'border-emerald-300 bg-emerald-50' : ''} ${m.status === 'fechada' ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                   value={getQtd(item.id, m.id)}
                                   onChange={(e) => handleEdit(item.id, m.id, parseFloat(e.target.value) || 0)}
                                   onBlur={() => {
                                       saveMedicoes();
                                   }}
                                   onKeyDown={(e) => {
                                       if (e.key === 'Enter') {
                                         saveMedicoes();
                                         e.currentTarget.blur();
                                       }
                                   }}
                                />
                                <div className="text-[9px] text-slate-400 text-center pt-0.5">{percent.toFixed(1)} %</div>
                              </div>
                            </td>
                          )
                        })}
                        <td className={`px-3 py-2 text-center font-semibold ${saldoValor < 0 ? 'text-red-700' : 'text-slate-700'}`}>R$ {formatFinancial(saldoValor)}</td>
                    </tr>
                  )})}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr className="border-t-2 border-slate-300">
                    <td colSpan={3} className="px-3 py-3 font-bold text-slate-700 text-right uppercase tracking-wider text-xs">Total Geral da Obra (R$)</td>
                    <td className="px-3 py-2 text-center font-bold text-emerald-900 bg-emerald-50">
                        R$ {formatFinancial(orcamento.filter(i => i.tipo !== 'etapa' && i.tipo !== 'subetapa').reduce((acc, i) => acc + (getTotalMedido(i.id) * (i.valor_unitario || 0) * bdiFactor), 0))}
                    </td>
                    {medicoes.map(m => {
                       const medTotal = orcamento.filter(i => i.tipo !== 'etapa' && i.tipo !== 'subetapa').reduce((acc, i) => acc + (getQtd(i.id, m.id) * (i.valor_unitario || 0) * bdiFactor), 0);
                       return (
                        <td key={m.id} className="px-3 py-2 text-center font-bold text-slate-900">
                            {formatFinancial(medTotal)}
                        </td>
                       );
                    })}
                    <td className="bg-slate-100"></td>
                </tr>
              </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

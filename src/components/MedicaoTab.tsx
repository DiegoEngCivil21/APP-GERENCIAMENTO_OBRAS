import { useState, useEffect } from "react";
import { api } from "../services/api";
import { Plus, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatFinancial = (value: number) => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function MedicaoTab({ obraId, orcamento }: { obraId: string | number, orcamento: any[] }) {
  const [medicoes, setMedicoes] = useState<any[]>([]);
  const [itensMedicao, setItensMedicao] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    setEdits({});
    try {
      const medicoesData = await api.getMedicoes(obraId);
      const response = await fetch(`/api/obras/${obraId}/medicao-itens-flat`);
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
    setEdits(prev => ({ ...prev, [`${medicaoId}-${itemId}`]: value }));
  };

  const saveMedicoes = async () => {
    setSaving(true);
    try {
        await fetch(`/api/obras/${obraId}/medicao-itens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ changes: edits })
        });
        load(); // Reload to clear edits
    } catch (e) {
        console.error(e);
    } finally {
        setSaving(false);
    }
  };
  
  const getTotalMedido = (itemId: number) => {
    return itensMedicao
      .filter(i => i.orcamento_item_id === itemId)
      .reduce((acc, curr) => acc + curr.quantidade_medida, 0);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Planilha de Medições</h2>
        <div className="flex gap-2">
            {Object.keys(edits).length > 0 && (
                <button 
                  onClick={saveMedicoes}
                  disabled={saving}
                  className="px-4 py-2 bg-[#107C41] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#0c6533] transition"
                >
                    {saving ? <Loader2 className="animate-spin" size={16}/> : null} Salvar Alterações
                </button>
            )}
            <button className="px-4 py-2 bg-[#F97316] text-white rounded-xl text-sm font-bold flex items-center gap-2">
                <Plus size={16} /> Nova Medição
            </button>
        </div>
      </div>
      {loading ? (
        <div className="p-12 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto"/></div>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow-sm border border-slate-200 bg-white">
          <table className="w-full text-left border-collapse text-xs">
             <thead>
               <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                 <th className="px-3 py-3 font-bold uppercase tracking-wider text-center w-[60px]">Item</th>
                 <th className="px-3 py-3 font-bold uppercase tracking-wider">Descrição</th>
                 <th className="px-3 py-3 font-bold uppercase tracking-wider text-right w-[100px]">Qtd / Valor</th>
                 <th className="px-3 py-3 font-bold uppercase tracking-wider text-right w-[100px]">Med. Acum (R$)</th>
                 {medicoes.map((m, i) => (
                   <th key={m.id} className="px-3 py-3 font-bold text-center">
                     <div className="text-slate-600">{i + 1}ª Med</div>
                     <div className="text-[10px] font-normal text-slate-400">{format(parseISO(m.data_medicao), "dd/MM/yy")}</div>
                   </th>
                 ))}
                 <th className="px-3 py-3 font-bold text-right text-slate-600">Saldo (R$)</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
               {orcamento.map(item => {
                 const totalMedidoQtd = getTotalMedido(item.id);
                 const totalMedidoValor = totalMedidoQtd * (item.valor_unitario || 0);
                 const valorTotalOrcado = (item.quantidade || 0) * (item.valor_unitario || 0);
                 const saldoValor = valorTotalOrcado - totalMedidoValor;
                 const percentTotal = valorTotalOrcado > 0 ? (totalMedidoValor / valorTotalOrcado) * 100 : 0;
                 
                 if (item.tipo === 'etapa') {
                    return (
                        <tr key={item.id} className="bg-slate-50 font-semibold text-slate-800">
                             <td className="px-3 py-2 text-center">{item.item}</td>
                             <td className="px-3 py-2" colSpan={3 + medicoes.length}>{item.descricao}</td>
                             <td className="px-3 py-2 text-right">R$ {formatFinancial(item.total || 0)}</td>
                        </tr>
                    )
                 }

                 return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 text-center text-slate-500 font-mono">{item.item}</td>
                      <td className="px-3 py-2 text-slate-700 truncate max-w-xs">{item.descricao}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="font-semibold text-slate-900">{formatFinancial(item.quantidade)}</div>
                        <div className="text-[10px] text-slate-400">R$ {formatFinancial(valorTotalOrcado)}</div>
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-700 font-semibold">
                        <div>R$ {formatFinancial(totalMedidoValor)}</div>
                        <div className="text-[10px] text-emerald-500">{percentTotal.toFixed(1)} %</div>
                      </td>
                      {medicoes.map(m => {
                         const qtd = getQtd(item.id, m.id);
                         const valorMedido = qtd * (item.valor_unitario || 0);
                         const percent = valorTotalOrcado > 0 ? (valorMedido / valorTotalOrcado) * 100 : 0;
                         return (
                           <td key={m.id} className="px-1 py-1">
                             <input
                                type="number"
                                className={`w-16 p-1 text-right font-medium text-slate-800 bg-white border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-emerald-500 focus:outline-none ${edits[`${m.id}-${item.id}`] ? 'border-emerald-300 bg-emerald-50' : ''}`}
                                defaultValue={qtd}
                                onBlur={(e) => handleEdit(item.id, m.id, parseFloat(e.target.value) || 0)}
                             />
                             <div className="text-[9px] text-slate-400 text-right pr-1 pt-0.5">{percent.toFixed(1)} %</div>
                           </td>
                         )
                       })}
                       <td className={`px-3 py-2 text-right font-semibold ${saldoValor < 0 ? 'text-red-700' : 'text-slate-700'}`}>R$ {formatFinancial(saldoValor)}</td>
                   </tr>
                 )})}
             </tbody>
             <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                    <td colSpan={3} className="px-3 py-3 font-bold text-slate-700 text-right">Total Executado (R$)</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900"></td>
                    {medicoes.map(m => (
                       <td key={m.id} className="px-3 py-2 text-right font-bold text-slate-900">
                           {formatFinancial(m.total_valor || 0)}
                       </td>
                    ))}
                    <td></td>
                </tr>
             </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

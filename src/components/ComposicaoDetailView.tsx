import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Layers, Plus, Trash2, Edit2, Check, X, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { Composicao } from '../types';
import { Button } from './UIComponents';
import AutocompleteDropdown from './AutocompleteDropdown';
import { formatCode, truncateToTwo, formatTruncated, calculateItemTotal } from '../utils';

interface ComposicaoDetailViewProps {
  composicaoId: number | null;
  onBack: () => void;
  onNavigateToComposicao?: (id: number) => void;
  isAdmin?: boolean;
  isMaster?: boolean;
  estado?: string;
  dataReferencia?: string;
}

const ComposicaoDetailView = ({ 
  composicaoId, 
  onBack, 
  onNavigateToComposicao,
  isAdmin = false,
  isMaster = false,
  estado = 'Todos',
  dataReferencia = 'Todos'
}: ComposicaoDetailViewProps) => {
  const [composicao, setComposicao] = useState<Composicao | null>(null);
  const [subitens, setSubitens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState<any>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemTypeToAdd, setItemTypeToAdd] = useState<'insumo' | 'composicao' | 'both'>('both');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [resolvedDataRef, setResolvedDataRef] = useState<string>('');
  const [resolvedEstado, setResolvedEstado] = useState<string>('');

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchData = async () => {
    if (!composicaoId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    console.log('Fetching details for composicaoId:', composicaoId);
    try {
      let currentDataReferencia = dataReferencia;
      let currentEstado = estado;
      if (currentEstado === 'Todos') currentEstado = 'DF';
      setResolvedEstado(currentEstado);
      
      if (currentDataReferencia === 'Todos' || currentDataReferencia === '') {
        const res = await fetch('/api/composicoes/datas');
        const datas = await res.json();
        if (datas.length > 0) {
          currentDataReferencia = datas[0];
        }
      }
      setResolvedDataRef(currentDataReferencia);

      const params = new URLSearchParams();
      params.append('id', composicaoId.toString());
      params.append('estado', currentEstado);
      params.append('data_referencia', currentDataReferencia);

      const [compRes, subRes] = await Promise.all([
        fetch(`/api/composicoes?${params.toString()}`),
        fetch(`/api/composicoes/${composicaoId}/subitens?${params.toString()}`)
      ]);
      
      const comps = await compRes.json();
      console.log('Fetched composicoes:', comps);
      const comp = comps.find((c: any) => c.id_composicao === composicaoId);
      console.log('Found comp:', comp);
      setComposicao(comp);
      
      const data = await subRes.json();
      console.log('Fetched data:', data);
      
      if (Array.isArray(data)) {
        setSubitens(data);
        setTotalNaoDesonerado(comp?.valor_nao_desonerado || 0);
        setTotalDesonerado(comp?.valor_desonerado || 0);
      } else {
        setSubitens(data.items || []);
        setTotalNaoDesonerado(comp?.valor_nao_desonerado || data.totalNaoDesonerado || 0);
        setTotalDesonerado(comp?.valor_desonerado || data.totalDesonerado || 0);
      }
    } catch (err) {
      console.error('Error fetching composicao details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [composicaoId, estado, dataReferencia]);

  const [totalNaoDesonerado, setTotalNaoDesonerado] = useState(0);
  const [totalDesonerado, setTotalDesonerado] = useState(0);

  const handleAddSubitem = async () => {
    if (!selectedItemToAdd) return;
    
    // Check if it's a new item (not yet in the database)
    if (selectedItemToAdd.isNew) {
      setToast({ 
        message: 'Por favor, crie o insumo/composição primeiro na aba de Cadastro antes de adicioná-lo.', 
        type: 'error' 
      });
      return;
    }

    // Ensure we have the correct ID regardless of whether it's an insumo or composition
    const resolvedType = selectedItemToAdd.type || itemTypeToAdd;
    const itemId = (resolvedType === 'insumo' || selectedItemToAdd.id_insumo) 
      ? selectedItemToAdd.id_insumo 
      : selectedItemToAdd.id_composicao;

    if (!itemId) {
      setToast({ message: 'Erro: ID do item não encontrado.', type: 'error' });
      return;
    }

    const payload = {
      item_id: itemId,
      consumo_unitario: itemQuantity,
      estado: resolvedEstado || estado,
      data_referencia: resolvedDataRef || dataReferencia
    };

    const res = await fetch(`/api/composicoes/${composicaoId}/subitens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      fetchData();
      setShowAddItem(false);
      setSelectedItemToAdd(null);
      setItemQuantity(1);
      setToast({ message: 'Item adicionado com sucesso!', type: 'success' });
    } else {
      setToast({ message: 'Erro ao adicionar item.', type: 'error' });
    }
  };

  const handleRemoveSubitem = async (itemId: number) => {
    if (!confirm('Remover este item da composição?')) return;
    
    const res = await fetch(`/api/composicoes/${composicaoId}/subitens/${itemId}?estado=${resolvedEstado || estado}&data_referencia=${resolvedDataRef || dataReferencia}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, data_referencia: resolvedDataRef || dataReferencia })
    });

    if (res.ok) {
      fetchData();
      setToast({ message: 'Item removido com sucesso!', type: 'success' });
    }
  };

  const handleUpdateQuantity = async (itemId: number, newQty: number) => {
    const res = await fetch(`/api/composicoes/${composicaoId}/subitens/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consumo_unitario: newQty, estado: resolvedEstado || estado, data_referencia: resolvedDataRef || dataReferencia })
    });

    if (res.ok) {
      fetchData();
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Carregando detalhes da composição...</div>;
  }

  if (!composicao) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500 mb-4">Composição não encontrada.</p>
        <Button variant="secondary" onClick={onBack}>Voltar</Button>
      </div>
    );
  }

  const isPropria = composicao?.base === 'PRÓPRIA';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-xl text-sm font-bold z-50 transition-all ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {composicao.base || 'SINAPI'} - {formatCode(composicao.codigo_composicao)}
          </h2>
          <p className="text-slate-500 text-[11px] font-bold mt-1 uppercase tracking-wider leading-tight">
            {composicao.descricao?.replace(/^[\d\.]+\s*/, '')}
          </p>
        </div>
        {!isPropria && (
          <div className="ml-auto px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase rounded-lg">
            Base Oficial - Somente Leitura
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Unidade</div>
          <div className="text-sm font-bold text-slate-800">{composicao.unidade}</div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Tipo</div>
          <div className="text-sm font-bold text-slate-800 truncate">{composicao.tipo || 'Composição'}</div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Data Ref.</div>
          <div className="text-sm font-bold text-slate-800">
            {composicao.data_referencia && composicao.data_referencia.includes('-') 
              ? `${composicao.data_referencia.split('-')[1]}/${composicao.data_referencia.split('-')[0]}`
              : composicao.data_referencia || '-'}
          </div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Valor Não Deson.</div>
          <div className="text-sm font-bold text-slate-800">
            R$ {formatTruncated(totalNaoDesonerado || 0)}
          </div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Valor Desonerado</div>
          <div className="text-sm font-bold text-indigo-600">
            R$ {formatTruncated(totalDesonerado || 0)}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-visible relative budget-table-container">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Layers size={20} className="text-indigo-500" />
            Itens da Composição
          </h3>
          {isAdmin && isPropria && (
            <div className="flex gap-2">
              <Button variant="secondary" icon={RefreshCw} onClick={async () => {
                setIsRecalculating(true);
                try {
                  const res = await fetch(`/api/composicoes/${composicaoId}/recalculate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ estado: resolvedEstado || estado, data_referencia: resolvedDataRef || dataReferencia })
                  });
                  if (res.ok) {
                    setToast({ message: 'Preços recalculados com sucesso!', type: 'success' });
                    fetchData();
                  } else {
                    setToast({ message: 'Erro ao recalcular preços.', type: 'error' });
                  }
                } catch (e) {
                  setToast({ message: 'Erro ao recalcular preços.', type: 'error' });
                } finally {
                  setIsRecalculating(false);
                }
              }}>
                {isRecalculating ? 'Recalculando...' : 'Recalcular'}
              </Button>
              <Button variant="primary" icon={Plus} onClick={() => setShowAddItem(true)}>
                Adicionar Item
              </Button>
            </div>
          )}
        </div>

        {showAddItem && isAdmin && isPropria && (
          <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex bg-white p-1 rounded-lg border border-slate-200">
                <button 
                  onClick={() => { setItemTypeToAdd('both'); setSelectedItemToAdd(null); }}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${itemTypeToAdd === 'both' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Tudo
                </button>
                <button 
                  onClick={() => { setItemTypeToAdd('insumo'); setSelectedItemToAdd(null); }}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${itemTypeToAdd === 'insumo' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Insumo
                </button>
                <button 
                  onClick={() => { setItemTypeToAdd('composicao'); setSelectedItemToAdd(null); }}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${itemTypeToAdd === 'composicao' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Composição
                </button>
              </div>

              {selectedItemToAdd && (
                <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 animate-in fade-in slide-in-from-right-4">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${selectedItemToAdd.type === 'composicao' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {selectedItemToAdd.type === 'composicao' ? 'C' : 'I'}
                  </span>
                  <span className="text-xs font-bold text-indigo-700">{selectedItemToAdd.codigo || selectedItemToAdd.codigo_composicao}</span>
                  <span className="text-xs text-slate-600 truncate max-w-[300px]">{selectedItemToAdd.descricao}</span>
                  <button onClick={() => setSelectedItemToAdd(null)} className="text-slate-400 hover:text-red-500">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-end gap-4">
              <div className="flex-1 relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Buscar Item {itemTypeToAdd === 'both' ? '' : (itemTypeToAdd === 'insumo' ? '(Insumo)' : '(Composição)')}
                </label>
                <AutocompleteDropdown 
                  type={itemTypeToAdd} 
                  estado={resolvedEstado || estado}
                  dataReferencia={resolvedDataRef || dataReferencia}
                  dropdownStyle={{ left: '50%', transform: 'translateX(-50%)', width: '1000px', minWidth: '1000px' }}
                  onSelect={(item) => {
                    setSelectedItemToAdd(item);
                    // Focus quantity input automatically after selection
                    setTimeout(() => {
                      if (quantityInputRef.current) {
                        quantityInputRef.current.focus();
                        quantityInputRef.current.select();
                      }
                    }, 50);
                  }} 
                  placeholder="Digite o código ou descrição..."
                />
              </div>
              <div className="w-32">
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantidade</label>
                <input 
                  ref={quantityInputRef}
                  type="number" 
                  min="0.0000001" 
                  step="0.0000001"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(parseFloat(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && selectedItemToAdd) {
                      handleAddSubitem();
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="primary" onClick={handleAddSubitem} disabled={!selectedItemToAdd}>
                  Adicionar
                </Button>
                <Button variant="secondary" onClick={() => {
                  setShowAddItem(false);
                  setSelectedItemToAdd(null);
                }}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">C/I</th>
                <th className="px-3 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Base</th>
                <th className="px-3 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Código</th>
                <th className="px-3 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="px-3 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria</th>
                <th className="px-3 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Und</th>
                <th className="px-3 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Valor Não Deson.</th>
                <th className="px-3 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Valor Deson.</th>
                <th className="px-3 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Coeficiente</th>
                <th className="px-3 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total Não Deson.</th>
                <th className="px-3 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total Deson.</th>
                {isAdmin && <th className="px-3 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subitens.length > 0 ? subitens.map((sub, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-1.5 text-[13px] font-bold text-center">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] ${
                      (sub.e_subcomposicao || sub.tipo === 'composicao' || sub.tipo === 'Composição' || sub.tipo_item === 'COMPOSICAO')
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {(sub.e_subcomposicao || sub.tipo === 'composicao' || sub.tipo === 'Composição' || sub.tipo_item === 'COMPOSICAO') ? 'C' : 'I'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-[13px] text-slate-600">{sub.base}</td>
                  <td className="px-3 py-1.5 text-[13px] text-slate-600">
                    {/* Debug: {sub.id_subcomposicao} / {sub.item_id} */}
                    {(sub.e_subcomposicao || sub.tipo === 'composicao' || sub.tipo === 'Composição' || sub.tipo_item === 'COMPOSICAO') && onNavigateToComposicao ? (
                      <button 
                        onClick={() => onNavigateToComposicao(sub.item_id || sub.id_subcomposicao)}
                        className="font-bold text-slate-700 hover:text-indigo-600 hover:underline"
                      >
                        {formatCode(sub.codigo)}
                      </button>
                    ) : (
                      <span className="font-bold text-slate-700">{formatCode(sub.codigo)}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-[13px] text-slate-600 relative group/desc">
                    {(sub.e_subcomposicao || sub.tipo === 'composicao' || sub.tipo === 'Composição' || sub.tipo_item === 'COMPOSICAO') && onNavigateToComposicao ? (
                      <button 
                        onClick={() => onNavigateToComposicao(sub.item_id || sub.id_subcomposicao)}
                        className="text-left text-slate-600 hover:text-slate-600"
                      >
                        {sub.descricao?.replace(/^[\d\.]+\s*/, '')}
                      </button>
                    ) : (
                      <div className="text-slate-600">{sub.descricao?.replace(/^[\d\.]+\s*/, '')}</div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-[13px] text-slate-500 font-medium">
                    {sub.categoria || ((sub.e_subcomposicao || sub.tipo === 'composicao' || sub.tipo === 'Composição' || sub.tipo_item === 'COMPOSICAO') ? 'Composição' : 'Insumo')}
                  </td>
                  <td className="px-3 py-1.5 text-[13px] text-slate-500 text-center">
                    {sub.unidade}
                  </td>
                  <td className="px-3 py-1.5 text-[13px] font-mono text-slate-700 text-right">
                    R$ {formatTruncated(sub.valor_nao_desonerado || 0)}
                  </td>
                  <td className="px-3 py-1.5 text-[13px] font-mono text-slate-700 text-right">
                    R$ {formatTruncated(sub.valor_desonerado || 0)}
                  </td>
                  <td className="px-3 py-1.5 text-[13px] font-mono text-slate-700 text-right">
                    {isAdmin && isPropria ? (
                      <input 
                        type="number"
                        className="w-24 text-right px-2 py-1 border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        defaultValue={sub.consumo_unitario}
                        onBlur={(e) => handleUpdateQuantity(sub.id_comp_insumo, parseFloat(e.target.value))}
                        step="0.0000001"
                      />
                    ) : (
                      sub.consumo_unitario?.toFixed(7)
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-[13px] font-mono text-slate-700 text-right">
                    R$ {formatTruncated(calculateItemTotal(truncateToTwo(sub.valor_nao_desonerado || 0), (sub.consumo_unitario || 0)))}
                  </td>
                  <td className="px-3 py-1.5 text-[13px] font-mono font-bold text-indigo-600 text-right">
                    R$ {formatTruncated(calculateItemTotal(truncateToTwo(sub.valor_desonerado || 0), (sub.consumo_unitario || 0)))}
                  </td>
                  {isAdmin && isPropria && (
                    <td className="px-3 py-1.5 text-center">
                      <button 
                        onClick={() => handleRemoveSubitem(sub.id_comp_insumo)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        title="Remover Item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              )) : (
                <tr>
                  <td colSpan={isAdmin ? 12 : 11} className="px-5 py-8 text-center text-slate-400 text-sm">
                    Nenhum item cadastrado nesta composição.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default ComposicaoDetailView;

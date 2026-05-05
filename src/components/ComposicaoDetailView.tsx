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
  const [isAdding, setIsAdding] = useState(false);
  const [resolvedDataRef, setResolvedDataRef] = useState<string>('');
  const [resolvedEstado, setResolvedEstado] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'composition' | 'subitem', id?: number | string } | null>(null);

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
    if (!selectedItemToAdd || isAdding) return;
    
    // Check if it's a new item (not yet in the database)
    if (selectedItemToAdd.isNew) {
      setToast({ 
        message: 'Por favor, crie o insumo/composição primeiro na aba de Cadastro antes de adicioná-lo.', 
        type: 'error' 
      });
      return;
    }

    setIsAdding(true);

    // We strictly need the 'item_id' which corresponds to v2_itens.id
    const itemId = selectedItemToAdd.item_id || 
                   selectedItemToAdd.id_insumo || 
                   selectedItemToAdd.id_composicao || 
                   selectedItemToAdd.id;

    console.log('Attempting to add subitem:', { composicaoId, itemId, itemQuantity });

    if (!itemId) {
      setToast({ message: 'Erro: Identificador do item não encontrado. Tente selecionar novamente.', type: 'error' });
      setIsAdding(false);
      return;
    }

    try {
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
        // Clear inputs first
        setSelectedItemToAdd(null);
        setItemQuantity(1);
        setToast({ message: 'Item adicionado com sucesso!', type: 'success' });
        
        // REFRESH DATA
        await fetchData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        setToast({ message: errorData.message || 'Erro ao adicionar item.', type: 'error' });
      }
    } catch (e) {
      console.error('Add error:', e);
      setToast({ message: 'Erro de conexão ao adicionar item.', type: 'error' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveSubitem = async (itemId: number) => {
    try {
      const res = await fetch(`/api/composicoes/${composicaoId}/subitens/${itemId}?estado=${resolvedEstado || estado}&data_referencia=${resolvedDataRef || dataReferencia}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        setToast({ message: 'Item removido com sucesso!', type: 'success' });
        fetchData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        setToast({ message: errorData.message || 'Erro ao remover item.', type: 'error' });
      }
    } catch (e) {
      setToast({ message: 'Erro de conexão ao remover item.', type: 'error' });
    }
  };

  const handleDeleteComposition = async () => {
    if (!composicaoId) return;
    try {
      const res = await fetch(`/api/composicoes/${composicaoId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setToast({ message: 'Composição excluída com sucesso!', type: 'success' });
        setTimeout(() => onBack(), 1000);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setToast({ message: errorData.message || 'Erro ao excluir composição.', type: 'error' });
      }
    } catch (e) {
      setToast({ message: 'Erro de conexão.', type: 'error' });
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
        {!isPropria ? (
          <div className="ml-auto px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase rounded-lg">
            Base Oficial - Somente Leitura
          </div>
        ) : isAdmin && (
          <button
            onClick={() => setDeleteConfirm({ type: 'composition' })}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-red-100 text-red-500 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all font-black text-xs uppercase tracking-widest shadow-sm active:scale-95 ml-auto"
            title="Excluir Composição Base"
          >
            <Trash2 size={16} />
            EXCLUIR
          </button>
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
              {!showAddItem && (
                <Button variant="primary" icon={Plus} onClick={() => {
                  setSelectedItemToAdd(null);
                  setShowAddItem(true);
                }}>
                  Adicionar Item
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm mb-6 min-h-[500px] budget-table-container">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center w-12">C/I</th>
                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">Base</th>
                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">Código</th>
                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider min-w-[300px]">Descrição</th>
                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">Categoria</th>
                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Und</th>
                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">V. Não Deson.</th>
                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">V. Deson.</th>
                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center w-32">Coeficiente</th>
                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">T. Não Des.</th>
                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">T. Des.</th>
                {isAdmin && <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {showAddItem && isAdmin && isPropria && (
                <tr className="bg-indigo-50/50 border-b-2 border-indigo-200 animate-in slide-in-from-top-2 duration-300">
                  <td className="px-3 py-4 text-center">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-black shadow-sm mx-auto ${selectedItemToAdd?.type === 'composicao' ? 'bg-emerald-500 text-white' : selectedItemToAdd ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                      {selectedItemToAdd?.type === 'composicao' ? 'C' : selectedItemToAdd ? 'I' : '?'}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">BANCO</span>
                      <span className="text-[11px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {selectedItemToAdd?.base || '-'}
                      </span>
                      {!selectedItemToAdd && (
                        <select 
                          className="text-[9px] bg-white border border-slate-200 rounded p-0.5 font-bold outline-none mt-1"
                          onChange={(e) => setItemTypeToAdd(e.target.value as any)}
                          value={itemTypeToAdd}
                        >
                          <option value="both">TUDO</option>
                          <option value="insumo">INSUMO</option>
                          <option value="composicao">COMP</option>
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">CÓDIGO</span>
                      <span className="text-[12px] font-black text-indigo-600 font-mono">
                        {selectedItemToAdd?.codigo || '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4 relative">
                    {!selectedItemToAdd ? (
                      <AutocompleteDropdown 
                        type={itemTypeToAdd} 
                        estado={resolvedEstado || estado}
                        dataReferencia={resolvedDataRef || dataReferencia}
                        dropdownStyle={{ left: '0', width: '900px', minWidth: '900px', top: '100%' }}
                        onSelect={(item) => {
                          console.log('Item selected for addition:', item);
                          // Ensure we collect EVERY possible ID field because different versions of the API use different keys
                          const normalizedItem = {
                            ...item,
                            type: item.itemType || (item.codigo_composicao ? 'composicao' : 'insumo'),
                            codigo: item.codigo_composicao || item.codigo || item.item_id || item.id_insumo || item.id_composicao,
                            item_id: item.item_id || item.id_insumo || item.id_composicao || item.id
                          };
                          setSelectedItemToAdd(normalizedItem);
                          // Auto focus quantity after selection
                          setTimeout(() => {
                            if (quantityInputRef.current) {
                                quantityInputRef.current.focus();
                                quantityInputRef.current.select();
                            }
                          }, 100);
                        }}
                        placeholder="Clique para pesquisar insumos ou composições..."
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-3 bg-indigo-50 px-3 py-2 rounded-xl border-2 border-indigo-200 shadow-sm animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-2 overflow-hidden">
                           <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-[9px] font-black ${selectedItemToAdd.type === 'composicao' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                             {selectedItemToAdd.type === 'composicao' ? 'C' : 'I'}
                           </span>
                           <span className="text-[12px] font-bold text-slate-800 truncate">{selectedItemToAdd.descricao}</span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItemToAdd(null);
                          }}
                          className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                          title="Trocar item"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase">
                    {selectedItemToAdd?.type === 'composicao' ? 'Composição' : selectedItemToAdd ? 'Insumo' : '-'}
                  </td>
                  <td className="px-3 py-4 text-[10px] font-black text-slate-500 text-center uppercase">
                    {selectedItemToAdd?.unidade || '-'}
                  </td>
                  <td className="px-3 py-4 text-right text-[11px] font-black text-slate-700 font-mono">
                    {selectedItemToAdd ? formatTruncated(selectedItemToAdd.valor_nao_desonerado || 0) : '-'}
                  </td>
                  <td className="px-3 py-4 text-right text-[11px] font-black text-slate-700 font-mono">
                    {selectedItemToAdd ? formatTruncated(selectedItemToAdd.valor_desonerado || 0) : '-'}
                  </td>
                  <td className="px-3 py-4">
                    <div className="relative">
                      <input
                        ref={quantityInputRef}
                        type="number"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        disabled={!selectedItemToAdd || isAdding}
                        className="h-9 w-full bg-white border-2 border-slate-200 rounded-lg px-2 text-[12px] font-black font-mono focus:border-indigo-500 outline-none text-center shadow-sm"
                        placeholder="0.000"
                        step="0.0001"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddSubitem()}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-4 text-right text-[10px] font-black text-slate-400 font-mono">
                    {selectedItemToAdd ? formatTruncated((selectedItemToAdd.valor_nao_desonerado || 0) * itemQuantity) : '-'}
                  </td>
                  <td className="px-3 py-4 text-right text-[11px] font-black text-indigo-500 font-mono">
                    {selectedItemToAdd ? formatTruncated((selectedItemToAdd.valor_desonerado || 0) * itemQuantity) : '-'}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex gap-1 justify-center">
                      <button 
                        onClick={handleAddSubitem}
                        disabled={!selectedItemToAdd || isAdding || itemQuantity <= 0}
                        className={`h-10 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group whitespace-nowrap font-black text-[10px] uppercase tracking-widest ${
                          (!selectedItemToAdd || isAdding || itemQuantity <= 0)
                            ? 'bg-slate-100 text-slate-300 shadow-none' 
                            : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200'
                        }`}
                      >
                        {isAdding ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <>
                            <Check size={18} className="group-hover:scale-110 transition-transform" />
                            <span>Confirmar</span>
                          </>
                        )}
                      </button>
                      <button 
                        onClick={() => {
                          setShowAddItem(false);
                          setSelectedItemToAdd(null);
                        }}
                        disabled={isAdding}
                        className="h-9 w-9 flex items-center justify-center rounded-lg bg-white border-2 border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-all active:scale-95"
                        title="Cancelar"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
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
                        onClick={() => setDeleteConfirm({ type: 'subitem', id: sub.id_comp_insumo })}
                        className="text-slate-400 hover:text-red-500 transition-all p-1.5 border border-slate-200 rounded hover:border-red-200 hover:bg-red-50"
                        title="Remover Item"
                      >
                        <Trash2 size={14} />
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
      {showAddItem && isAdmin && isPropria && (
        <div className="mt-4 p-4 bg-indigo-50/30 border border-indigo-100 rounded-2xl">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">Pesquisar para Adicionar</p>
          <AutocompleteDropdown 
             type={itemTypeToAdd} 
             estado={resolvedEstado || estado}
             dataReferencia={resolvedDataRef || dataReferencia}
             onSelect={(item) => {
               console.log('Item selected for addition:', item);
               const normalizedItem = {
                 ...item,
                 type: item.itemType || (item.codigo_composicao ? 'composicao' : 'insumo'),
                 codigo: item.codigo_composicao || item.codigo || item.item_id || item.id_insumo || item.id_composicao,
                 item_id: item.item_id || item.id_insumo || item.id_composicao || item.id
               };
               setSelectedItemToAdd(normalizedItem);
               setTimeout(() => quantityInputRef.current?.focus(), 50);
             }}
             placeholder="Pesquise o código ou descrição do item..."
          />
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 font-sans">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center"
          >
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
              <Trash2 size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Confirmar Exclusão</h3>
            <p className="text-slate-500 text-sm font-medium mb-8">
              {deleteConfirm.type === 'subitem' 
                ? 'Tem certeza que deseja remover este item desta composição?' 
                : 'Tem certeza que deseja excluir esta composição permanentemente?'}
              <br/><span className="text-red-500 font-bold">Esta ação não pode ser desfeita.</span>
            </p>
            <div className="flex gap-3">
              <Button 
                variant="secondary"
                className="flex-1"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancelar
              </Button>
              <Button 
                variant="danger"
                className="flex-1"
                onClick={() => {
                  if (deleteConfirm.type === 'subitem' && deleteConfirm.id !== undefined) {
                    handleRemoveSubitem(Number(deleteConfirm.id));
                  } else if (deleteConfirm.type === 'composition') {
                    handleDeleteComposition();
                  }
                  setDeleteConfirm(null);
                }}
              >
                Excluir
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default ComposicaoDetailView;

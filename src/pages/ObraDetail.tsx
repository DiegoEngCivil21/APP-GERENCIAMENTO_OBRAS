import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, LayoutDashboard, FileText, Calendar, 
  Settings, Percent, Database, ShieldCheck, 
  Plus, ChevronDown, Check, X, Layers, Box, ListTree, Pencil, Trash2, ChevronRight, Hash,
  Maximize2, Minimize2, RefreshCw, Clock
} from 'lucide-react';
import { api } from '../services/api';
import { Obra, OrcamentoItem, DiarioObra } from '../types/index';
import { StatusBadge, MetricCard } from '../components/UIComponents';
import AutocompleteDropdown from '../components/AutocompleteDropdown';
import { BdiModal, BancosModal, EncargosModal } from '../components/Modals';
import { BudgetFilterBar } from '../components/BudgetFilterBar';
import { ObraOverview } from '../components/ObraOverview';
import { recalculateTotals } from '../utils/calculations';
import { truncateToTwo, formatCurrency, formatCurrencyPrecise, formatFinancial, parseBrazilianNumber } from '../utils';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DiarioObraTab from '../components/DiarioObraTab';

export const getSemanticRoot = (itemStr: string) => {
  const parts = (itemStr || '').split('.');
  while (parts.length > 1 && parts[parts.length - 1] === '0') {
    parts.pop();
  }
  return parts.join('.') + '.';
};

const getSemanticParent = (item: string) => {
  if (!item) return '__root__';
  const cleanItem = item.toString().trim().replace(/\.0$/, '');
  if (!cleanItem || cleanItem === '__root__') return '__root__';
  const parts = cleanItem.split('.').filter(p => p !== '');
  if (parts.length <= 1) return '__root__';
  
  parts.pop(); // remove current index
  if (parts.length === 0) return '__root__';
  return parts.join('.');
};

const getSuggestedNextNumber = (list: OrcamentoItem[], afterItem: string | null, behavior: 'sibling' | 'child'): string => {
  if (!list || list.length === 0) return "1";
  
  const cleanList = list.map(i => {
    let it = (i.item || '').toString().trim();
    if (it.endsWith('.0')) it = it.substring(0, it.length - 2);
    // Remove trailing dot if any
    if (it.endsWith('.')) it = it.substring(0, it.length - 1);
    return it;
  }).filter(it => it !== '');

  let cleanTarget = (afterItem || '').toString().trim().replace(/\.0$/, '');
  if (cleanTarget.endsWith('.')) cleanTarget = cleanTarget.substring(0, cleanTarget.length - 1);

  let parent = "";
  if (behavior === 'child') {
    parent = (cleanTarget === '__root__' || !cleanTarget) ? "" : cleanTarget;
  } else {
    // Sibling of cleanTarget
    if (!cleanTarget || cleanTarget === '__root__' || !cleanTarget.includes('.')) {
      parent = "";
    } else {
      const parts = cleanTarget.split('.').filter(p => p !== '');
      parts.pop();
      parent = parts.join('.');
    }
  }

  // Now find max sibling number among all children of 'parent'
  const prefix = parent ? parent + '.' : '';
  const level = parent ? parent.split('.').filter(p => p !== '').length + 1 : 1;
  
  let max = 0;
  cleanList.forEach(it => {
    if (parent) {
      // It must start with parent. and have exactly one more part
      if (it.startsWith(prefix)) {
        const parts = it.split('.').filter(p => p !== '');
        if (parts.length === level) {
          const lastPart = parts[parts.length - 1];
          const lastNum = parseInt(lastPart, 10);
          if (!isNaN(lastNum) && lastNum > max) max = lastNum;
        }
      }
    } else {
      // Root level (no dots)
      if (!it.includes('.')) {
        const val = parseInt(it, 10);
        if (!isNaN(val) && val > max) max = val;
      }
    }
  });

  return (parent ? parent + '.' : '') + (max + 1);
};

const getNextItemNumber = (list: OrcamentoItem[], parentItem: string | null, targetTipo: 'etapa' | 'insumo' | 'composicao'): string => {
  return getSuggestedNextNumber(list, parentItem, 'child');
};

export const applyAutoRenumber = (orcamentoList: OrcamentoItem[]): OrcamentoItem[] => {
  if (!orcamentoList || orcamentoList.length === 0) return [];
  
  // Create a deep copy
  let list = [...orcamentoList];
  
  const ctx: { [key: string]: number } = { root: 0 };
  const renumbered: OrcamentoItem[] = [];

  list.forEach((row, idx) => {
    let newItem = "";
    
    if (row.tipo === 'etapa') {
      const parts = (row.item || "").toString().split('.').filter(p => p !== '' && p !== '0');
      const depth = Math.max(1, parts.length);
      
      // Look for parent stage above
      let parentCode = "";
      for (let i = idx - 1; i >= 0; i--) {
        const prev = list[i];
        if (prev.tipo === 'etapa') {
          const prevParts = (prev.item || "").toString().split('.').filter(p => p !== '' && p !== '0');
          if (prevParts.length < depth) {
            parentCode = (prev.item || "").toString();
            break;
          }
        }
      }
      
      const pKey = parentCode || 'root';
      if (ctx[pKey] === undefined) ctx[pKey] = 0;
      ctx[pKey]++;
      
      newItem = parentCode ? `${parentCode}.${ctx[pKey]}` : `${ctx[pKey]}`;
    } else {
      // Find the nearest stage above this item
      let parentEtapaCode = "";
      for (let i = idx - 1; i >= 0; i--) {
        if (list[i].tipo === 'etapa') {
          // If we found a stage, but it was just renumbered in this pass, use that
          const alreadyProcessed = renumbered[i];
          parentEtapaCode = alreadyProcessed ? alreadyProcessed.item.toString() : list[i].item.toString();
          break;
        }
      }
      
      const pKey = parentEtapaCode || 'root';
      if (ctx[pKey] === undefined) ctx[pKey] = 0;
      ctx[pKey]++;
      
      newItem = parentEtapaCode ? `${parentEtapaCode}.${ctx[pKey]}` : `${ctx[pKey]}`;
    }
    
    // Fallback if renumbering failed
    if (!newItem) newItem = (row.item || (idx + 1)).toString();
    
    const updatedRow = { ...row, item: newItem };
    renumbered.push(updatedRow);
    // Update the local list so subsequent rows see the new parent item
    list[idx] = updatedRow;
  });

  return renumbered;
};

export const ObraDetail = ({ obraId, onBack }: { obraId: string | number, onBack: () => void }) => {
  const [obra, setObra] = useState<Obra | null>(null);
  const [orcamento, setOrcamento] = useState<OrcamentoItem[]>([]);
  const [diarios, setDiarios] = useState<DiarioObra[]>([]);
  const [cronograma, setCronograma] = useState<any[]>([]);
  const [medicoes, setMedicoes] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState(() => localStorage.getItem('activeSubTab') || 'visao_geral');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const [bancosAtivos, setBancosAtivos] = useState<{id: string, name: string, active: boolean, available_dates: string[], data_referencia?: string}[]>([]);
  const activeBases = useMemo(() => bancosAtivos.filter(b => b.active).map(b => b.id.toLowerCase()), [bancosAtivos]);

  const [encargos, setEncargos] = useState({
    desonerado: false, // Default to false
    horista: 0.0,
    mensalista: 0.0,
    incidir: false,
    estado: 'DF',
    dataReferencia: '2026-04-01'
  });

  const [bdiConfig, setBdiConfig] = useState({ 
    porcentagem: 0, 
    incidencia: 'unitario' as 'unitario' | 'final',
    tipo: 'unico' as 'unico' | 'detalhado'
  });

  const refreshObraData = useCallback(async () => {
    try {
      const data = await api.getObraById(obraId);
      setObra(data);
      
      const activeBancos = bancosAtivos.filter(b => b.active).map(b => ({ id: b.id, data_referencia: b.data_referencia }));
      const freshData = await api.getOrcamento(obraId, { 
        desonerado: encargos.desonerado,
        estado: encargos.estado,
        data_referencia: encargos.dataReferencia,
        bancos_ativos: activeBancos
      });
      // We rely on server sorting and re-sequencing now. 
      // applyAutoRenumber is only for manual reordering in the UI if we add that later.
      const withTotals = recalculateTotals(freshData, { porcentagem: bdiConfig.porcentagem });
      setOrcamento(withTotals);
    } catch (err) {
      console.error("Error refreshing obra data:", err);
    }
  }, [obraId, encargos.desonerado, encargos.estado, encargos.dataReferencia, bancosAtivos, bdiConfig.porcentagem]);

  const formatLastUpdated = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = parseISO(dateStr);
      // UTC to Local (approximate if SQLite sends ISO without offset)
      // Actually SQLite CURRENT_TIMESTAMP is UTC. ISO string might look like "2023-10-27T10:45:00Z"
      const label = isToday(date) ? 'HOJE' : format(date, "dd/MM/yyyy", { locale: ptBR });
      return `ÚLTIMA ALTERAÇÃO: ${label}, ${format(date, "HH:mm", { locale: ptBR })}`;
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  
  const [showBdiModal, setShowBdiModal] = useState(false);
  const [showBancosModal, setShowBancosModal] = useState(false);
  const [showEncargosModal, setShowEncargosModal] = useState(false);
  
  const [newItemData, setNewItemData] = useState({
    item: '',
    codigo: '',
    descricao: '',
    tipo: 'etapa' as 'etapa' | 'composicao' | 'insumo',
    unidade: 'un',
    quantidade: 0,
    valor_unitario: 0,
    base: 'PRÓPRIO'
  });

  const [addingItemToEtapa, setAddingItemToEtapa] = useState<string | null>(null);
  const [localNewQty, setLocalNewQty] = useState('');
  const [addingAfterItemId, setAddingAfterItemId] = useState<string | number | null>(null);
  const addItemRowRef = useRef<HTMLTableRowElement>(null);
  const newItemCodigoRef = useRef<HTMLInputElement>(null);
  const newItemQuantRef = useRef<HTMLInputElement>(null);
  const newItemDescRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingItemToEtapa) {
      setTimeout(() => {
        if (newItemDescRef.current) newItemDescRef.current.focus();
      }, 100);
    }
  }, [addingItemToEtapa, newItemData.tipo]);
  const editingRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (addingItemToEtapa && addItemRowRef.current) {
      addItemRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [addingItemToEtapa]);

  const [editingCell, setEditingCell] = useState<{ id: string | number, field: string } | null>(null);

  useEffect(() => {
    if (editingCell && editingRowRef.current) {
      editingRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [editingCell]);
  
  const [updateMode, setUpdateMode] = useState<'estrutura' | 'precos'>('estrutura');

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    localStorage.setItem('activeSubTab', activeSubTab);
  }, [activeSubTab]);

  // Initial load of Obra data
  useEffect(() => {
    api.getObraById(obraId).then(data => {
      setObra(data);
      if (data?.bdi !== undefined && data.bdi !== 0) {
        setBdiConfig(prev => ({ 
          ...prev, 
          porcentagem: data.bdi,
          incidencia: (data.bdi_incidencia as 'unitario' | 'final') || 'unitario',
          tipo: (data.bdi_tipo as 'unico' | 'detalhado') || 'unico'
        }));
      } else {
        // Apply defaults
        const defaultConfig = { porcentagem: 20, incidencia: 'unitario' as const, tipo: 'unico' as const };
        setBdiConfig(defaultConfig);
        handleSaveBdi(defaultConfig);
      }
      
      // Initialize encargos from Obra data if available
      setEncargos(prev => ({
        ...prev,
        desonerado: data?.desonerado !== undefined ? data.desonerado === 1 : prev.desonerado,
        estado: data?.uf || prev.estado,
        dataReferencia: data?.data_referencia || prev.dataReferencia
      }));
      
      console.log("Initialized encargos with data_referencia:", data?.data_referencia);

      // Load available databases and merge with obra's active bancos
      api.getDatabases().then(async (dbList) => {
        if (Array.isArray(dbList)) {
          let activeBancos: any[] = [{ id: 'sinapi' }];
          if (data?.bancos_ativos) {
            try {
              const parsed = JSON.parse(data.bancos_ativos);
              if (Array.isArray(parsed) && parsed.length > 0) {
                if (typeof parsed[0] === 'string') {
                  activeBancos = parsed.map(id => ({ id }));
                } else {
                  activeBancos = parsed;
                }
              }
            } catch (e) {
              console.error("Error parsing bancos_ativos:", e);
            }
          }
          
          console.log("activeBancos parsed from data:", activeBancos);
          const merged = await Promise.all(dbList.map(async (db) => {
            const url = `/api/composicoes/datas?base=${db.id.toUpperCase()}`;
            console.log("Fetching dates from:", url);
            const res = await fetch(url);
            
            const activeBanco = activeBancos.find(b => b.id.toLowerCase() === db.id.toLowerCase());
            const isActive = !!activeBanco;
            
            if (!res.ok) {
              console.error(`Error fetching dates from ${url}: ${res.status}`);
              return { ...db, active: isActive, available_dates: [], data_referencia: activeBanco?.data_referencia || data?.data_referencia || '2025-10' };
            }
            const dates = await res.json();
            console.log(`Dates for ${db.id}:`, dates);
            console.log(`Database ${db.id} is active:`, isActive);
            return {
              ...db,
              active: isActive,
              available_dates: dates,
              data_referencia: activeBanco?.data_referencia || data?.data_referencia || '2025-10'
            };
          }));
          console.log("Merged bancosAtivos:", merged);
          setBancosAtivos(merged);
          
          // Set default base for new items to the first active one
          const firstActive = merged.find(b => b.active);
          if (firstActive) {
            setNewItemData(prev => ({ ...prev, base: firstActive.id.toUpperCase() }));
          }
          setIsInitialLoad(false);
        }
      }).catch(err => {
        console.error("Error loading databases:", err);
        setIsInitialLoad(false);
      });
      
    }).catch(err => {
      console.error("Error loading obra:", err);
      setIsInitialLoad(false);
    });
    api.getDiarios(obraId).then(setDiarios);
    api.getCronograma(obraId).then(setCronograma).catch(err => console.error("Error loading cronograma:", err));
    api.getMedicoes(obraId).then(setMedicoes).catch(err => console.error("Error loading medicoes:", err));
  }, [obraId]);

  // Fetch budget when filters change
  useEffect(() => {
    if (isInitialLoad) return;

    const activeBancos = bancosAtivos.filter(b => b.active).map(b => ({ id: b.id, data_referencia: b.data_referencia }));

    api.getOrcamento(obraId, { 
      desonerado: encargos.desonerado,
      estado: encargos.estado,
      data_referencia: encargos.dataReferencia,
      bancos_ativos: activeBancos
    }).then(data => {
      const structuredData = applyAutoRenumber(data);
      const recalculated = recalculateTotals(structuredData, { porcentagem: bdiConfig.porcentagem });
      setOrcamento(prev => JSON.stringify(prev) === JSON.stringify(recalculated) ? prev : recalculated);
    });
  }, [obraId, encargos.desonerado, encargos.estado, encargos.dataReferencia, isInitialLoad, bdiConfig, bancosAtivos]);

  // Save encargos to Obra when they change
  useEffect(() => {
    if (isInitialLoad || !obra) return;

    const timer = setTimeout(async () => {
      await api.updateObra(obraId, {
        uf: encargos.estado,
        desonerado: encargos.desonerado ? 1 : 0,
        data_referencia: encargos.dataReferencia,
        bancos_ativos: JSON.stringify(bancosAtivos.filter(b => b.active).map(b => ({ id: b.id, data_referencia: b.data_referencia }))),
        bdi: bdiConfig.porcentagem,
        bdi_incidencia: bdiConfig.incidencia,
        bdi_tipo: bdiConfig.tipo
      });
      await refreshObraData();
    }, 1000); // Debounce save

    return () => clearTimeout(timer);
  }, [encargos.desonerado, encargos.estado, encargos.dataReferencia, isInitialLoad, obraId, bancosAtivos, bdiConfig]);

  const handleSaveBdi = (val: any) => {
    setBdiConfig(val);
    const updated = recalculateTotals(orcamento, { porcentagem: val.porcentagem });
    setOrcamento(updated);
    setShowBdiModal(false);
  };

  const handleNewItemChange = useCallback((val: string) => {
    setNewItemData(prev => prev.codigo === val ? prev : ({...prev, codigo: val}));
  }, []);

  const handleNewItemSelect = useCallback((item: any) => {
    setNewItemData(prev => {
      const next = {
        ...prev,
        base: item.base || 'SINAPI',
        codigo: item.codigo || item.codigo_composicao,
        descricao: item.descricao?.replace(/^[\d\.]+\s*/, ''),
        unidade: item.unidade || 'un',
        valor_unitario: item.preco_unitario || 0,
      };
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
    // Focus quantity after selection
    setTimeout(() => {
      if (newItemQuantRef.current) {
        newItemQuantRef.current.focus();
      }
    }, 150);
  }, []);

  const handleNewItemDescricaoChange = useCallback((val: string) => {
    setNewItemData(prev => prev.descricao === val ? prev : ({...prev, descricao: val}));
  }, []);

  const handleNewItemDescricaoSelect = useCallback((item: any) => {
    setNewItemData(prev => {
      const next = {
        ...prev,
        base: item.base || 'SINAPI',
        codigo: item.codigo || item.codigo_composicao,
        descricao: item.descricao?.replace(/^[\d\.]+\s*/, ''),
        unidade: item.unidade || 'un',
        valor_unitario: item.preco_unitario || 0,
      };
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
    // Focus quantity after selection
    setTimeout(() => {
      if (newItemQuantRef.current) {
        newItemQuantRef.current.focus();
      }
    }, 150);
  }, []);

  const handleItemChange = async (id: string | number, newItem: string) => {
    const targetRow = orcamento.find(r => r.id?.toString() === (id || '').toString());
    if (!targetRow) return;

    // Clean input
    const cleanNewItem = newItem.toString().replace(/\.0$/, '');
    
    const oldItem = (targetRow.item || "").toString().replace(/\.0$/, '');
    const isEtapa = targetRow.tipo === 'etapa';
    
    // First, cascade the change to children
    const oldPrefix = getSemanticRoot(oldItem);
    const newPrefix = getSemanticRoot(cleanNewItem);

    // Provide a grouping suffix
    const uniqueSuffix = `_ZZZ_moved`;

    const updated = orcamento.map(row => {
      const currentItemStr = (row.item || '').toString();
      if (row.id?.toString() === (id || '').toString()) {
        return { ...row, item: cleanNewItem + uniqueSuffix };
      }
      if (isEtapa && currentItemStr.startsWith(oldPrefix) && currentItemStr !== oldItem) {
        const suffix = currentItemStr.slice(oldPrefix.length);
        return { ...row, item: newPrefix + suffix + uniqueSuffix };
      }
      return row;
    });

    const autoRenumbered = applyAutoRenumber(updated);

    setOrcamento(autoRenumbered);
    
    const reversed = [...autoRenumbered].reverse();
    for (const row of reversed) {
      const originalRow = orcamento.find(r => r.id === row.id);
      if (!originalRow || originalRow.item !== row.item) {
        await api.updateOrcamentoItem(obraId, row.id, row);
      }
    }
    
    await api.resequenceOrcamento(obraId);
    await refreshObraData();

    setEditingCell(null);
  };

  const handleAddNewItem = async (overrideData?: any) => {
    if (!addingItemToEtapa) return;
    
    // Merge newItemData with overrideData if provided
    const payloadData = overrideData ? { ...newItemData, ...overrideData } : newItemData;

    try {
      // Find the parent etapa ID if it's not root
      let targetEtapaId: string | number | null = null;
      if (addingItemToEtapa !== '__root__') {
        const parentStage = orcamento.find(i => (i.tipo === 'etapa' || i.id?.toString().startsWith('etapa-')) && i.item?.toString() === addingItemToEtapa);
        if (parentStage) {
          targetEtapaId = parentStage.id;
        }
      }

      // Check if we are inserting after a specific item
      // We'll calculate the index to insert at
      let insertIdx = orcamento.length;
      if (addingItemToEtapa === '__root__') {
        // Find end of last stage
        insertIdx = orcamento.length;
      } else {
        const parentPrefix = addingItemToEtapa + '.';
        const children = orcamento.filter(i => i.item.toString().startsWith(parentPrefix));
        if (children.length > 0) {
          const lastChild = children[children.length - 1];
          insertIdx = orcamento.indexOf(lastChild) + 1;
        } else {
          // If no children, insert after the parent stage
          const parentStage = orcamento.find(i => i.item === addingItemToEtapa && (i.tipo === 'etapa' || i.id?.toString().startsWith('etapa-')));
          if (parentStage) {
            insertIdx = orcamento.indexOf(parentStage) + 1;
          }
        }
      }

      const newItem: any = {
        obra_id: Number(obraId),
        tipo: payloadData.tipo,
        item: payloadData.item?.toString().trim().replace(/\.0$/, ''),
        base: payloadData.tipo === 'etapa' ? undefined : payloadData.base,
        codigo: payloadData.tipo === 'etapa' ? undefined : payloadData.codigo,
        descricao: payloadData.descricao,
        unidade: payloadData.tipo === 'etapa' ? undefined : payloadData.unidade,
        quantidade: payloadData.tipo === 'etapa' ? 0 : payloadData.quantidade,
        valor_unitario: payloadData.tipo === 'etapa' ? 0 : payloadData.valor_unitario,
        etapa_id: targetEtapaId,
        etapa_pai_id: payloadData.tipo === 'etapa' ? targetEtapaId : undefined,
        insert_after_id: addingAfterItemId
      };

      // 1. Save new item and get its ID
      const response = await api.saveOrcamento(obraId, [newItem]);
      const savedItemId = response?.[0]?.id;

      // 2. Automaitcaly move existing direct children to this new sub-stage if it's an etapa
      if (newItem.tipo === 'etapa' && targetEtapaId) {
          // Identify children that were direct children of targetEtapaId
          // These are items where etapa_id == targetEtapaId
          const childrenToMove = orcamento.filter(i => i.etapa_id === targetEtapaId && i.id !== savedItemId && i.tipo !== 'etapa');
          
          for (const item of childrenToMove) {
              await api.updateOrcamentoItem(obraId, item.id, {
                  etapa_id: savedItemId,
                  etapa_pai_id: savedItemId
              });
          }
      }

      // 3. Clear adding state
      setAddingItemToEtapa(null);
      setAddingAfterItemId(null);
      setNewItemData({ item: '', tipo: 'insumo', base: 'SINAPI', codigo: '', descricao: '', unidade: '', quantidade: 0, valor_unitario: 0 });
      setLocalNewQty('');

      // 3. Renumber everything locally to ensure correct sequence immediately
      // Actually, server-side re-sequencing is more reliable for tree structure
      await api.resequenceOrcamento(obraId);
      
      // 4. Refresh
      await refreshObraData();
      
      setToast({ message: "Item adicionado com sucesso", type: 'success' });
    } catch (err: any) {
      console.error("Error adding item:", err);
      setToast({ message: "Erro ao adicionar item", type: 'error' });
    }
  };

  const handleDeleteItem = async (id: string | number) => {
    try {
      const target = orcamento.find(i => i.id === id);
      if (!target) return;

      let updated: OrcamentoItem[];
      let itemsToDelete: OrcamentoItem[] = [];
      
      if (target.tipo === 'etapa') {
        // Delete stage and all its children
        itemsToDelete = orcamento.filter(i => 
          i.id === id || 
          (i.item || '').toString().startsWith((target.item || '').toString() + '.')
        );
        updated = orcamento.filter(i => !itemsToDelete.includes(i));
      } else {
        itemsToDelete = [target];
        updated = orcamento.filter(i => i.id !== id);
      }

      const autoRenumbered = applyAutoRenumber(updated);
      const recalculated = recalculateTotals(autoRenumbered, { porcentagem: bdiConfig.porcentagem });
      setOrcamento(recalculated);
      
      // Delete all removed items from the database
      const deletePromises = itemsToDelete.map(item => 
        api.deleteOrcamentoItem(obraId, item.id, item.tipo)
      );
      await Promise.all(deletePromises);

      // We must also update the DB for the renumbered remaining items
      for (const row of autoRenumbered) {
        const originalRow = orcamento.find(r => r.id === row.id);
        if (originalRow && originalRow.item !== row.item) {
          await api.updateOrcamentoItem(obraId, row.id, row);
        }
      }
      await api.resequenceOrcamento(obraId);
      await refreshObraData();
      
      try {
          const activeBancos = bancosAtivos.filter(b => b.active).map(b => ({ id: b.id, data_referencia: b.data_referencia }));
          const updatedServerOrcamento = await api.getOrcamento(obraId, {
            desonerado: encargos.desonerado,
            estado: encargos.estado,
            data_referencia: encargos.dataReferencia,
            bancos_ativos: activeBancos
          });
          const structuredData = applyAutoRenumber(updatedServerOrcamento);
          const withTotals = recalculateTotals(structuredData, { porcentagem: bdiConfig.porcentagem });
          setOrcamento(withTotals);
      } catch (err) {
         console.error("Failed to fetch fresh orcamento after delete", err);
      }

      setToast({ message: "Item excluído com sucesso", type: 'success' });
    } catch (err: any) {
      console.error("Error deleting item:", err);
      let msg = "Erro ao excluir item";
      try {
        const parsed = JSON.parse(err.message.split('message: ')[1]);
        msg = parsed.message || msg;
      } catch (e) {}
      setToast({ message: msg, type: 'error' });
    }
  };

  const handleRowUpdate = async (id: string | number, updates: Partial<OrcamentoItem>) => {
    try {
      const updated = orcamento.map(row => row.id?.toString() === (id || '').toString() ? { ...row, ...updates } : row);
      const recalculated = recalculateTotals(updated, { porcentagem: bdiConfig.porcentagem });
      setOrcamento(recalculated);
      
      const updatedRow = recalculated.find(row => row.id?.toString() === (id || '').toString());
      if (updatedRow) {
        console.log("Saving row update:", { id, updatedRow });
        await api.updateOrcamentoItem(obraId, id, updatedRow);
        await refreshObraData();
      }
    } catch (err: any) {
      console.error("Error updating row:", err);
      let msg = "Erro ao atualizar item";
      try {
        const parsed = JSON.parse(err.message.split('message: ')[1]);
        msg = parsed.message || msg;
      } catch (e) {}
      setToast({ message: msg, type: 'error' });
      // Revert or refresh to ensure UI matches DB?
      // api.getOrcamento(obraId, ...).then(...)
    }
  };

  if (!obra) return <div className="p-8 text-center text-slate-500">Carregando detalhes da obra...</div>;

  const totalOrcamento = orcamento.filter(r => r.tipo === 'etapa' && !(r.item || '').toString().includes('.')).reduce((acc, r) => acc + (r.total || 0), 0);

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={`fixed bottom-8 right-8 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-white ${
              toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
            }`}
          >
            {toast.type === 'error' ? <X size={20} /> : <Check size={20} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-4 py-2 border-b border-slate-100">
        <button 
          onClick={onBack}
          className="p-1.5 bg-white border border-slate-100 rounded-lg text-slate-400 hover:text-[#003366] hover:shadow-sm transition-all"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">{obra.nome}</h2>
          <StatusBadge status={obra.status} />
          {obra.cliente && (
              <span className="text-xs font-medium text-slate-400 border-l border-slate-200 pl-3 uppercase">{obra.cliente}</span>
          )}
        </div>
      </div>

      <div style={{ fontSize: '18px', borderWidth: '-3px', paddingLeft: '4px', paddingRight: '14px', marginBottom: '-8px' }} className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
        {[
          { id: 'visao_geral', label: 'Visão Geral', icon: LayoutDashboard },
          { id: 'orcamento', label: 'Orçamento', icon: FileText },
          { id: 'diario', label: 'Diário de Obra', icon: Calendar },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${
              activeSubTab === tab.id ? 'bg-white text-[#003366] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'visao_geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <ObraOverview 
              obra={obra} 
              orcamento={orcamento} 
              cronograma={cronograma} 
              medicoes={medicoes} 
              encargos={encargos}
              currentBancosAtivos={bancosAtivos}
            />

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 style={{ fontSize: '27.5px', lineHeight: '25.5px' }} className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Informações da Obra</h3>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Localização</p>
                  <p className="font-bold text-slate-700">{obra.localizacao || 'Não informada'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Data de Início</p>
                  <p className="font-bold text-slate-700">{new Date(obra.data_inicio).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'orcamento' && (
        <div className={`space-y-1 pb-[50vb]`}>
          {/* Filtros Rápidos no Cabeçalho */}
          <div className="flex items-center justify-between px-3 h-8">
            <div className="flex items-center gap-2 text-slate-400">
               {obra?.updated_at && (
                 <div className="flex items-center gap-1.5 font-bold text-[10px] tracking-tight text-slate-400">
                   <Clock size={12} className="text-slate-300" />
                   <span className="uppercase">{formatLastUpdated(obra.updated_at)}</span>
                 </div>
               )}
            </div>
          </div>
          <BudgetFilterBar
            encargos={encargos}
            setEncargos={setEncargos}
            setBancosAtivos={setBancosAtivos}
          />

          {/* Exibição das Bases Ativas */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bases:</span>
            <div className="flex items-center gap-2">
              {bancosAtivos.filter(b => b.active).map(banco => (
                <span key={banco.id} className="text-[10px] font-bold text-[#003366] bg-blue-50 px-2 py-1 rounded-lg">
                  {banco.id.toUpperCase()} ({banco.data_referencia})
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowBdiModal(true)}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-100 transition-all text-xs uppercase tracking-widest"
                >
                  <Percent size={16} className="text-[#003366]" /> BDI: {bdiConfig.porcentagem}%
                </button>
                <button 
                  onClick={() => setShowBancosModal(true)}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-100 transition-all text-xs uppercase tracking-widest"
                >
                  <Database size={16} className="text-[#003366]" /> Bancos
                </button>
                <button 
                  onClick={() => setShowEncargosModal(true)}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-100 transition-all text-xs uppercase tracking-widest"
                >
                  <ShieldCheck size={16} className="text-[#003366]" /> Encargos
                </button>
                <button 
                  onClick={async () => {
                    try {
                      await api.resequenceOrcamento(obraId);
                      const updated = await api.getOrcamento(obraId, {
                        desonerado: encargos.desonerado,
                        estado: encargos.estado,
                        data_referencia: encargos.dataReferencia,
                        bancos_ativos: bancosAtivos.filter(b => b.active)
                      });
                      setOrcamento(updated);
                      await refreshObraData();
                      setToast({ message: "Orçamento renumerado com sucesso", type: 'success' });
                    } catch (err) {
                      console.error("Error resequencing:", err);
                      setToast({ message: "Erro ao renumerar orçamento", type: 'error' });
                    }
                  }}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-[#107C41] flex items-center gap-2 hover:bg-slate-100 transition-all text-xs uppercase tracking-widest"
                  title="Corrige a numeração sequencial de todos os itens"
                >
                  <Hash size={16} /> Renumerar
                </button>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-[#003366] rounded-xl text-white shadow-md">
                <span className="text-[10px] font-black uppercase tracking-widest">Valor Total:</span>
                <span className="font-bold text-sm">R$ {formatFinancial(totalOrcamento)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-300 shadow-sm overflow-visible budget-table-container">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#107C41] text-white">
                  <th className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-center border border-slate-300 w-[64px]">Item</th>
                  <th className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider border border-slate-300 w-[80px]">Fonte</th>
                  <th className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider border border-slate-300 w-[112px]">Código</th>
                  <th className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider border border-slate-300">Descrição</th>
                  <th className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-center border border-slate-300 w-[48px]">Unid</th>
                  <th className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-right border border-slate-300 w-[80px]">QUANT</th>
                  <th style={{ fontSize: '10px', textAlign: 'center', lineHeight: '16.5px', paddingLeft: '38px' }} className="px-2 py-1 font-bold uppercase tracking-wider text-right border border-slate-300 w-[100px]">Valor Unit.</th>
                  <th className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-right border border-slate-300 w-[100px]">Valor c/ BDI</th>
                  <th className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-right border border-slate-300 w-[120px]">Total</th>
                </tr>
              </thead>
              <tbody className="text-[11px] text-slate-700">
                {orcamento.map((row, idx) => (
                  <React.Fragment key={`orcamento-row-frag-${row.id}-${idx}`}>
                    <tr 
                      key={`orcamento-row-${row.id}-${idx}`} 
                      ref={editingCell?.id === row.id ? editingRowRef : null}
                      className={`${row.tipo === 'etapa' ? 'bg-[#E2EFDA] font-bold text-[#375623]' : 'bg-white even:bg-[#F3F2F1] hover:bg-slate-100'} transition-colors group cursor-pointer relative`}
                    >
                    <td className="px-2 py-1 text-center border border-slate-300 w-[64px]">
                      <div className="flex items-center justify-center gap-1">
                        <input 
                          key={`item-input-${row.id}-${row.item}`}
                          className={`w-12 bg-transparent border border-transparent rounded px-1 py-0.5 text-center outline-none transition-all focus:bg-white focus:border-[#107C41] focus:shadow-sm ${row.tipo === 'etapa' ? 'text-[#375623] font-bold' : 'text-slate-700'}`}
                          defaultValue={row.item?.toString().replace(/\.0$/, '')}
                          onBlur={(e) => {
                            if (e.target.value !== row.item) {
                              handleItemChange(row.id, e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                        {row.tipo === 'etapa' ? (
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                // Adicionar Etapa (Irmã) - Inserir logo acima desta etapa (para ser a nova .1 se esta for a primeira)
                                // Ou melhor, manter como estava (inserindo após a etapa anterior)
                                const parentOfRow = getSemanticParent(row.item);
                                const nextVal = getSuggestedNextNumber(orcamento, row.item, 'sibling');
                                
                                setAddingItemToEtapa(parentOfRow);
                                setAddingAfterItemId(row.id);
                                setNewItemData({
                                  item: nextVal,
                                  codigo: '',
                                  base: 'SINAPI',
                                  descricao: '',
                                  unidade: 'un',
                                  quantidade: 0,
                                  valor_unitario: 0,
                                  tipo: 'etapa',
                                });
                                setTimeout(() => {
                                  if (newItemDescRef.current) newItemDescRef.current.focus();
                                }, 150);
                              }}
                              className="p-0.5 text-[#107C41] hover:bg-[#c8e6c9] rounded transition-colors opacity-0 group-hover:opacity-100 absolute right-12"
                              title="Adicionar Etapa (Sequencial)"
                            >
                              <Plus size={12} />
                            </button>
                            
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                // Adicionar Insumo/Composição - NO TOPO DA ETAPA (como Orçafascio)
                                const parentPrefix = row.item + '.';
                                const hasChildren = orcamento.some(i => i.item.toString().startsWith(parentPrefix));
                                
                                // Se já tem filhos, sugerimos o próximo, mas inserimos no topo
                                // Se não tem filhos, sugerimos .1
                                const nextVal = getSuggestedNextNumber(orcamento, row.item, 'child');
                                const suggestedVal = hasChildren ? (row.item + '.1') : nextVal;

                                setAddingItemToEtapa(row.item);
                                setAddingAfterItemId(row.id); 
                                setNewItemData({
                                  item: suggestedVal,
                                  codigo: '',
                                  base: 'SINAPI',
                                  descricao: '',
                                  unidade: 'un',
                                  quantidade: 0,
                                  valor_unitario: 0,
                                  tipo: 'insumo',
                                });
                                setTimeout(() => {
                                  if (newItemCodigoRef.current) newItemCodigoRef.current.focus();
                                }, 150);
                              }}
                              className="p-0.5 text-[#003366] hover:bg-slate-100 rounded transition-colors opacity-0 group-hover:opacity-100 absolute right-6"
                              title="Adicionar Ítem Filho (Início da Etapa)"
                            >
                              <Plus size={12} />
                            </button>
                            
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                // Adicionar Sub-etapa (Filha) - NO TOPO DA ETAPA
                                const parentPrefix = row.item + '.';
                                const hasChildren = orcamento.some(i => i.item.toString().startsWith(parentPrefix));
                                const nextVal = getSuggestedNextNumber(orcamento, row.item, 'child');
                                const suggestedVal = hasChildren ? (row.item + '.1') : nextVal;

                                setAddingItemToEtapa(row.item);
                                setAddingAfterItemId(row.id);
                                setNewItemData({
                                  item: suggestedVal,
                                  codigo: '',
                                  base: 'SINAPI',
                                  descricao: '',
                                  unidade: '',
                                  quantidade: 0,
                                  valor_unitario: 0,
                                  tipo: 'etapa',
                                });
                                setTimeout(() => {
                                  if (newItemDescRef.current) newItemDescRef.current.focus();
                                }, 150);
                              }}
                              className="p-0.5 text-[#107C41] hover:bg-[#c8e6c9] rounded transition-colors opacity-0 group-hover:opacity-100 absolute right-1"
                              title="Adicionar Sub-etapa"
                            >
                              <Layers size={12} />
                            </button>
                          </>
                        ) : (
                          <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                // Adicionar Item (Irmão/Sibling)
                                const itemStr = (row.item || '').toString().trim().replace(/\.0$/, '');
                                const nextVal = getSuggestedNextNumber(orcamento, itemStr, 'sibling');
                                const parentOfRow = getSemanticParent(itemStr);
                                
                                setAddingItemToEtapa(parentOfRow);
                                setAddingAfterItemId(row.id);
                                setNewItemData({
                                  item: nextVal,
                                  codigo: '',
                                  base: row.base || 'SINAPI',
                                  descricao: '',
                                  unidade: '',
                                  quantidade: 0,
                                  valor_unitario: 0,
                                  tipo: row.tipo as any,
                                });
                                setTimeout(() => {
                                  if (newItemCodigoRef.current) newItemCodigoRef.current.focus();
                                }, 150);
                              }}
                              className="p-0.5 text-[#003366] hover:bg-slate-100 rounded transition-colors opacity-0 group-hover:opacity-100 absolute right-1"
                              title="Adicionar Ítem Sibling"
                            >
                              <Plus size={12} />
                            </button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1 border border-slate-300 w-[80px]">
                      {row.tipo !== 'etapa' && editingCell && editingCell.id?.toString() === row.id?.toString() && editingCell.field === 'base' ? (
                        <select 
                          autoFocus
                          className="w-full bg-white border border-[#107C41] rounded px-1 py-0.5 text-[11px] font-bold text-slate-700 uppercase outline-none shadow-sm focus:border-[#107C41]"
                          defaultValue={row.base}
                          onBlur={(e) => {
                            handleRowUpdate(row.id, { base: e.target.value });
                            setEditingCell(null);
                          }}
                          onChange={(e) => {
                            handleRowUpdate(row.id, { base: e.target.value });
                            setEditingCell(null);
                          }}
                        >
                          {['SINAPI', 'SETOP', 'ORSE', 'SICRO', 'PROPRIO'].map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      ) : (
                        <div 
                          className={row.tipo !== 'etapa' ? 'cursor-pointer hover:text-[#107C41] w-full h-full flex items-center' : 'w-full h-full flex items-center'}
                          onClick={() => row.tipo !== 'etapa' && setEditingCell({ id: row.id, field: 'base' })}
                        >
                          {row.base}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1 border border-slate-300 w-[112px] relative">
                      {row.tipo !== 'etapa' && (
                        editingCell && editingCell.id?.toString() === row.id?.toString() && editingCell.field === 'codigo' ? (
                          <AutocompleteDropdown 
                            type={row.tipo as 'insumo' | 'composicao'} 
                            desonerado={encargos.desonerado}
                            estado={encargos.estado}
                            dataReferencia={encargos.dataReferencia}
                            bases={activeBases}
                            dropdownStyle={{ left: '50%', transform: 'translateX(-50%)', width: '1200px', minWidth: '1200px' }}
                            onSelect={(item) => {
                              handleRowUpdate(row.id, { 
                                base: item.base || 'SINAPI',
                                codigo: item.codigo || item.codigo_composicao, 
                                descricao: item.descricao?.replace(/^[\d\.]+\s*/, ''), 
                                unidade: item.unidade, 
                                valor_unitario: item.preco_unitario || 0
                              });
                              setEditingCell(null);
                            }}
                            inputClassName="w-full bg-white border border-[#107C41] rounded px-1 py-0.5 text-[11px] font-mono outline-none shadow-sm"
                            hideIcon={true}
                          />
                        ) : (
                          <div 
                            className="font-mono hover:text-[#107C41] hover:underline cursor-pointer w-full h-full flex items-center"
                            onClick={() => {
                              setEditingCell({ id: row.id, field: 'codigo' });
                            }}
                          >
                            {row.codigo}
                          </div>
                        )
                      )}
                    </td>
                    <td className="px-2 py-1 border border-slate-300 relative">
                      {editingCell && editingCell.id?.toString() === row.id?.toString() && editingCell.field === 'descricao' ? (
                        row.tipo === 'etapa' ? (
                          <input 
                            autoFocus
                            className={`w-full bg-white border border-[#107C41] rounded px-1 py-0.5 outline-none font-bold text-[#375623] text-[11px] shadow-sm focus:border-[#107C41]`}
                            defaultValue={row.descricao?.replace(/^[\d\.]+\s*/, '')}
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
                        ) : (
                          <AutocompleteDropdown 
                            type={row.tipo as 'insumo' | 'composicao'} 
                            desonerado={encargos.desonerado}
                            estado={encargos.estado}
                            dataReferencia={encargos.dataReferencia}
                            bases={activeBases}
                            dropdownStyle={{ left: '50%', transform: 'translateX(-50%)', width: '1200px', minWidth: '1200px' }}
                            onSelect={(item) => {
                              handleRowUpdate(row.id, { 
                                base: item.base || 'SINAPI',
                                codigo: item.codigo || item.codigo_composicao, 
                                descricao: item.descricao?.replace(/^[\d\.]+\s*/, ''), 
                                unidade: item.unidade, 
                                valor_unitario: item.preco_unitario || 0
                              });
                              setEditingCell(null);
                            }}
                            inputClassName="w-full bg-white border border-[#107C41] rounded px-1 py-0.5 text-[11px] outline-none shadow-sm"
                            hideIcon={true}
                          />
                        )
                      ) : (
                        <div 
                          className={`cursor-pointer hover:text-[#107C41] truncate max-w-[400px] w-full h-full flex items-center`}
                          onClick={() => {
                            setEditingCell({ id: row.id, field: 'descricao' });
                          }}
                          title={row.descricao?.replace(/^[\d\.]+\s*/, '')}
                        >
                          {row.descricao?.replace(/^[\d\.]+\s*/, '')}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1 text-center border border-slate-300 w-[48px]">
                      {row.tipo !== 'etapa' ? (
                        <input 
                          className="w-10 bg-transparent border border-transparent rounded px-1 py-0.5 text-center outline-none transition-all focus:bg-white focus:border-[#107C41] focus:shadow-sm"
                          defaultValue={row.unidade}
                          onBlur={(e) => {
                            if (e.target.value !== row.unidade) {
                              handleRowUpdate(row.id, { unidade: e.target.value });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                      ) : null}
                    </td>
                    <td className="px-2 py-1 text-right border border-slate-300">
                      {row.tipo !== 'etapa' ? (
                        <input 
                          type="text"
                          className="w-16 bg-transparent border border-transparent rounded px-1 py-0.5 text-right outline-none transition-all focus:bg-white focus:border-[#107C41] focus:shadow-sm"
                          defaultValue={formatFinancial(row.quantidade)}
                          onBlur={(e) => {
                            const val = parseBrazilianNumber(e.target.value);
                            if (val !== null && val !== row.quantidade) {
                              handleRowUpdate(row.id, { quantidade: val });
                            }
                            e.target.value = formatFinancial(val !== null ? val : row.quantidade);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                      ) : null}
                    </td>
                    <td style={{ paddingLeft: '-30.5px' }} className="px-2 py-1 text-right border border-slate-300">
                      {row.tipo !== 'etapa' ? (
                        <input 
                          type="number"
                          step="0.01"
                          className="w-20 bg-transparent border border-transparent rounded px-1 py-0.5 text-right outline-none transition-all focus:bg-white focus:border-[#107C41] focus:shadow-sm"
                          defaultValue={row.valor_unitario}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            if (val !== row.valor_unitario) {
                              handleRowUpdate(row.id, { valor_unitario: val });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                      ) : null}
                    </td>
                    <td className="px-2 py-1 text-right border border-slate-300">{row.valor_bdi > 0 ? formatCurrencyPrecise(row.valor_bdi) : ''}</td>
                    <td style={{ width: '84.997px' }} className="px-2 py-1 text-right border border-slate-300 font-bold">
                      <div className="flex items-center justify-end gap-1">
                        {formatCurrency(row.total || 0)}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(row.id);
                          }}
                          className="p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100 absolute right-1"
                          title="Excluir Item"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Render the "Add Item" row if it was triggered for this row or its stage */}
                  {(() => {
                    function renderAddItemRow() {
                        const isEtapa = newItemData.tipo === 'etapa';
                        const previewTotal = (newItemData.quantidade || 0) * (newItemData.valor_unitario || 0);
                        const bdiFactor = 1 + (bdiConfig.porcentagem || 0) / 100;
                        const previewTotalWithBdi = previewTotal * bdiFactor;

                        return (
                          <tr ref={addItemRowRef} className={`${isEtapa ? 'bg-[#E2EFDA]' : 'bg-[#F3F2F1]'} border-b border-slate-300 relative`}>
                            <td className="px-2 py-1 border border-slate-300 w-[64px]">
                              <input 
                                className={`w-12 bg-white border ${isEtapa ? 'border-[#107C41]' : 'border-slate-300'} rounded px-1 py-0.5 text-[11px] font-mono text-slate-900 font-bold outline-none shadow-sm focus:border-[#107C41] bg-amber-50`}
                                value={newItemData.item || ''}
                                onChange={(e) => setNewItemData({...newItemData, item: e.target.value})}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddNewItem()}
                              />
                            </td>
                          <td className="px-2 py-1 border border-slate-300 w-[80px]">
                            {isEtapa ? (
                              <span className="text-[10px] font-bold text-[#107C41] uppercase tracking-wider">Etapa</span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <div className="flex bg-white p-0.5 rounded border border-slate-200 w-fit">
                                  {(['insumo', 'composicao'] as const).map((t) => (
                                    <button 
                                      key={t}
                                      onClick={() => setNewItemData({...newItemData, tipo: t})}
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${newItemData.tipo === t ? 'bg-[#107C41] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                                    >
                                      {t === 'composicao' ? 'Comp.' : t}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex items-center gap-1">
                                  <select 
                                    className="bg-white border border-slate-300 rounded px-1 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider outline-none cursor-pointer shadow-sm focus:border-[#107C41]"
                                    value={newItemData.base}
                                    onChange={(e) => setNewItemData({...newItemData, base: e.target.value})}
                                  >
                                    {bancosAtivos.filter(b => b.active).map(b => (
                                      <option key={b.id} value={b.id.toUpperCase()}>{b.id.toUpperCase()}</option>
                                    ))}
                                    <option value="PROPRIO">PROPRIO</option>
                                  </select>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1 border border-slate-300 w-[112px] relative">
                            {!isEtapa && (
                              <AutocompleteDropdown 
                                ref={newItemCodigoRef}
                                type={newItemData.tipo === 'composicao' ? 'composicao' : 'insumo'}
                                base={newItemData.base}
                                value={newItemData.codigo}
                                desonerado={encargos.desonerado}
                                bases={activeBases}
                                dropdownStyle={{ left: '50%', transform: 'translateX(-50%)', width: '1200px', minWidth: '1200px' }}
                                onChange={handleNewItemChange}
                                onSelect={handleNewItemSelect}
                                placeholder="Código"
                                inputClassName="w-full px-1 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono focus:border-[#107C41] outline-none shadow-sm"
                                hideIcon={true}
                              />
                            )}
                          </td>
                          <td className="px-2 py-1 border border-slate-300 relative">
                            {isEtapa ? (
                              <input 
                                ref={newItemDescRef}
                                className="w-full bg-white border border-[#107C41] rounded px-1 py-0.5 text-[11px] text-[#375623] outline-none shadow-sm font-bold focus:border-[#107C41]"
                                placeholder="Descrição da Etapa"
                                value={newItemData.descricao}
                                onChange={(e) => setNewItemData({...newItemData, descricao: e.target.value})}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddNewItem()}
                              />
                            ) : (
                              <AutocompleteDropdown 
                                ref={newItemDescRef}
                                type={newItemData.tipo === 'composicao' ? 'composicao' : 'insumo'}
                                base={newItemData.base}
                                value={newItemData.descricao}
                                desonerado={encargos.desonerado}
                                estado={encargos.estado}
                                dataReferencia={encargos.dataReferencia}
                                bases={activeBases}
                                dropdownStyle={{ left: '50%', transform: 'translateX(-50%)', width: '1200px', minWidth: '1200px' }}
                                onChange={handleNewItemDescricaoChange}
                                onSelect={handleNewItemDescricaoSelect}
                                placeholder="Descrição do item..."
                                inputClassName="w-full px-1 py-0.5 bg-white border border-slate-300 rounded text-[11px] focus:border-[#107C41] outline-none shadow-sm"
                                hideIcon={true}
                              />
                            )}
                          </td>
                          <td className="px-2 py-1 border border-slate-300 text-center w-[48px]">
                            {!isEtapa ? (
                              <input 
                                className="w-10 bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px] text-center text-slate-700 outline-none shadow-sm focus:border-[#107C41]"
                                value={newItemData.unidade || ''}
                                onChange={(e) => setNewItemData({...newItemData, unidade: e.target.value})}
                                placeholder="Un"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddNewItem()}
                              />
                            ) : '-'}
                          </td>
                          <td className="px-2 py-1 border border-slate-300 text-right w-[80px]">
                            {!isEtapa ? (
                              <input 
                                ref={newItemQuantRef}
                                type="text"
                                className="w-16 bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px] text-right text-slate-700 outline-none shadow-sm focus:border-[#107C41]"
                                placeholder="Qtd"
                                value={localNewQty !== '' ? localNewQty : (newItemData.quantidade ? formatFinancial(newItemData.quantidade) : '')}
                                onChange={(e) => setLocalNewQty(e.target.value)}
                                onBlur={(e) => {
                                  const val = parseBrazilianNumber(e.target.value);
                                  if (val !== null) setNewItemData({...newItemData, quantidade: val});
                                  setLocalNewQty(val !== null ? formatFinancial(val) : '');
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseBrazilianNumber(localNewQty);
                                    if (val !== null) setNewItemData({...newItemData, quantidade: val});
                                    handleAddNewItem({ quantidade: val !== null ? val : newItemData.quantidade });
                                  }
                                }}
                              />
                            ) : <div className="text-center text-slate-400">-</div>}
                          </td>
                          <td className="px-2 py-1 border border-slate-300 text-right w-[100px]">
                            {!isEtapa ? (
                              <input 
                                type="number"
                                step="0.01"
                                className="w-20 bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px] text-right text-slate-700 outline-none shadow-sm focus:border-[#107C41]"
                                placeholder="R$ 0,00"
                                value={newItemData.valor_unitario || ''}
                                onChange={(e) => setNewItemData({...newItemData, valor_unitario: parseFloat(e.target.value) || 0})}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddNewItem()}
                              />
                            ) : '-'}
                          </td>
                          <td className="px-2 py-1 border border-slate-300 text-right text-[11px] text-slate-500 w-[100px]">
                            {!isEtapa && previewTotalWithBdi > 0 ? (
                              <div className="flex flex-col items-end leading-tight">
                                <span className="text-[10px] text-slate-400">Total c/ BDI</span>
                                <span className="font-bold text-[#107C41]">{formatCurrency(previewTotalWithBdi)}</span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-2 py-1 border border-slate-300 w-[120px]">
                            <div className="flex items-center justify-end gap-1">
                              {!isEtapa && previewTotal > 0 && (
                                <div className="mr-2 text-right invisible md:visible">
                                  <div className="text-[8px] text-slate-400 uppercase font-black">Subtotal</div>
                                  <div className="text-[10px] font-bold text-slate-600">{formatCurrency(previewTotal)}</div>
                                </div>
                              )}
                              <button 
                                onClick={handleAddNewItem}
                                className={`p-1 bg-[#107C41] text-white rounded flex items-center justify-center hover:opacity-90 transition-all shadow-sm`}
                                title="Confirmar"
                              >
                                <Check size={12} strokeWidth={3} />
                              </button>
                              <button 
                                onClick={() => {
                                  setAddingItemToEtapa(null);
                                  setAddingAfterItemId(null);
                                }}
                                className="p-1 bg-white border border-slate-300 text-slate-500 rounded flex items-center justify-center hover:bg-slate-50 hover:text-red-500 transition-all shadow-sm"
                                title="Cancelar"
                              >
                                <X size={12} strokeWidth={2} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    if (addingAfterItemId === row.id) return renderAddItemRow();

                    const parentItemStr = addingItemToEtapa || '';
                    if (!parentItemStr || parentItemStr === '__root__') return null;

                    const isThisEtapa = row.item === parentItemStr && (row.tipo === 'etapa' || row.id?.toString().startsWith('etapa-'));
                    const parentPrefix = parentItemStr + '.';
                    const hasChildren = orcamento.some(i => i.item.toString().startsWith(parentPrefix));

                    if (isThisEtapa && !hasChildren) return renderAddItemRow();

                    const isChildOfAdding = row.item !== parentItemStr && row.item.toString().startsWith(parentPrefix);
                    if (isChildOfAdding) {
                      const nextRow = orcamento[idx + 1];
                      const isNextChild = nextRow && nextRow.item.toString().startsWith(parentPrefix);
                      if (!isNextChild) return renderAddItemRow();
                    }
                    
                    return null;
                  })()}
                  </React.Fragment>
                ))}
                {addingItemToEtapa === '__root__' && (
                  <tr ref={addItemRowRef} className="bg-[#E2EFDA] border-b border-slate-300">
                    <td className="px-2 py-1 border border-slate-300">
                      <input 
                        className="w-12 bg-amber-50 border border-[#107C41] rounded px-1 py-0.5 text-[11px] font-mono text-slate-900 font-bold outline-none shadow-sm focus:border-[#107C41]"
                        value={newItemData.item || ''}
                        onChange={(e) => setNewItemData({...newItemData, item: e.target.value})}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddNewItem()}
                      />
                    </td>
                    <td className="px-2 py-1 border border-slate-300">
                      <span className="text-[10px] font-bold text-[#107C41] uppercase tracking-wider">Etapa</span>
                    </td>
                    <td className="px-2 py-1 border border-slate-300"></td>
                    <td className="px-2 py-1 border border-slate-300">
                      <input 
                        ref={newItemDescRef}
                        className="w-full bg-white border border-[#107C41] rounded px-1 py-0.5 text-[11px] text-[#375623] outline-none shadow-sm font-bold focus:border-[#107C41]"
                        placeholder="Descrição da Etapa"
                        value={newItemData.descricao}
                        onChange={(e) => setNewItemData({...newItemData, descricao: e.target.value})}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddNewItem()}
                      />
                    </td>
                    <td className="px-2 py-1 border border-slate-300 text-center text-slate-500">-</td>
                    <td className="px-2 py-1 border border-slate-300 text-center text-slate-400">-</td>
                    <td className="px-2 py-1 border border-slate-300 text-right text-slate-600 font-medium">-</td>
                    <td className="px-2 py-1 border border-slate-300 text-right text-slate-400">-</td>
                    <td className="px-2 py-1 border border-slate-300">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={handleAddNewItem}
                          className="p-1 bg-[#107C41] text-white rounded flex items-center justify-center hover:opacity-90 transition-all shadow-sm"
                          title="Confirmar"
                        >
                          <Check size={12} strokeWidth={3} />
                        </button>
                        <button 
                          onClick={() => {
                            setAddingItemToEtapa(null);
                            setAddingAfterItemId(null);
                          }}
                          className="p-1 bg-white border border-slate-300 text-slate-500 rounded flex items-center justify-center hover:bg-slate-50 hover:text-red-500 transition-all shadow-sm"
                          title="Cancelar"
                        >
                          <X size={12} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center gap-3">
              <button
                onClick={async () => {
                    try {
                      await api.resequenceOrcamento(obraId);
                      const updated = await api.getOrcamento(obraId, {
                        desonerado: encargos.desonerado,
                        estado: encargos.estado,
                        data_referencia: encargos.dataReferencia,
                        bancos_ativos: bancosAtivos.filter(b => b.active)
                      });
                      const withTotals = recalculateTotals(updated, { porcentagem: bdiConfig.porcentagem });
                      setOrcamento(withTotals);
                      await refreshObraData();
                      setToast({ message: "Orçamento renumerado com sucesso", type: 'success' });
                    } catch (err) {
                      console.error("Error resequencing:", err);
                      setToast({ message: "Erro ao renumerar orçamento", type: 'error' });
                    }
                }}
                className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-amber-600 uppercase tracking-widest hover:bg-amber-50 transition-all shadow-sm"
                title="Corrigir lacunas e organizar toda a numeração do orçamento automaticamente"
              >
                <RefreshCw size={14} />
                Auto-Renumerar
              </button>
              <button 
                onClick={() => {
                  const nextVal = getSuggestedNextNumber(orcamento, '__root__', 'child');
                  setAddingItemToEtapa('__root__');
                  setNewItemData({
                    item: nextVal,
                    codigo: '',
                    base: 'SINAPI',
                    descricao: '',
                    unidade: '',
                    quantidade: 0,
                    valor_unitario: 0,
                    tipo: 'etapa'
                  });
                  setTimeout(() => {
                    if (newItemDescRef.current) newItemDescRef.current.focus();
                  }, 150);
                }}
                className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-[#107C41] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
              >
                <Plus size={14} />
                Adicionar Nova Etapa
              </button>
            </div>
          </div>
      )}

      {activeSubTab === 'diario' && (
        <DiarioObraTab obraId={obraId} />
      )}

      <BdiModal isOpen={showBdiModal} onClose={() => setShowBdiModal(false)} bdiConfig={bdiConfig} onChange={handleSaveBdi} />
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
        onDateChange={(id: string, date: string) => {
          setBancosAtivos(prev => {
            const next = prev.map(b => b.id === id ? {...b, data_referencia: date} : b);
            const firstActive = next.find(b => b.active);
            if (firstActive && firstActive.id === id) {
              setEncargos(encargosPrev => ({ ...encargosPrev, dataReferencia: date }));
            }
            return next;
          });
        }}
      />
      <EncargosModal isOpen={showEncargosModal} onClose={() => setShowEncargosModal(false)} encargos={encargos} onChange={setEncargos} />
    </div>
  );
};

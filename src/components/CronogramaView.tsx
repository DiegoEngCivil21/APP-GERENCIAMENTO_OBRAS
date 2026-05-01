import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Printer, Target, CheckCircle, RefreshCw, AlertTriangle, Layers, 
  Trash2, Settings, X, Plus, Check, Maximize2, Minimize2, 
  Clock, Calendar, AlertCircle, Sliders, Info, FolderPlus 
} from 'lucide-react';
import { CronogramaHeader } from './CronogramaHeader';
import { motion, AnimatePresence } from 'motion/react';
import {
  format,
  addDays,
  addWeeks,
  addMonths,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isSameMonth,
  isSameYear,
  min,
  max,
  parse,
  isValid,
  isBefore,
  isAfter,
  isWeekend,
  isSameDay,
  getDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { formatFinancial } from '../utils';

interface Predecessor {
  id: number;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag: number;
}

interface Atividade {
  id: number;
  nome: string;
  descricao: string;
  data_inicio_prevista: string;
  data_fim_prevista: string;
  duracao_dias: number;
  progresso: number;
  predecessor_ids?: number[];
  predecessors?: Predecessor[];
  predecessores_texto?: string;
  item_numero?: string | null;
  orcamento_item_id?: number | null;
  etapa_id?: number | null;
  etapa_nome?: string | null;
  recurso?: string | null;
  data_inicio_real?: string | null;
  data_fim_real?: string | null;
  data_inicio_base?: string | null;
  data_fim_base?: string | null;
  is_marco?: boolean;
  produtividade?: number | null;
  quantidade_equipe?: number | null;
}

interface CronogramaConfig {
  workingDays: number[];
  holidays: string[];
  recessPeriods: { start: string, end: string }[];
}

interface OrcamentoItem {
  id: string | number;
  item: string;
  descricao: string;
  tipo: string;
}

type ViewMode = 'day' | 'week' | 'month';

const parseDate = (dateString: string | null | undefined) => {
  if (!dateString || typeof dateString !== 'string') return new Date(0);
  return parse(dateString, 'yyyy-MM-dd', new Date());
};

import { useDragScroll } from '../hooks/useDragScroll';

export const CronogramaView = ({ obraId, orcamento }: { obraId: string | number, orcamento?: OrcamentoItem[] }) => {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const hasBaseline = atividades.some(a => !!a.data_inicio_base);
  const [orcamentoItens, setOrcamentoItens] = useState<OrcamentoItem[]>(orcamento || []);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
  const [cronogramaConfig, setCronogramaConfig] = useState<CronogramaConfig>({
    workingDays: [1, 2, 3, 4, 5],
    holidays: [],
    recessPeriods: []
  });
  const [newHoliday, setNewHoliday] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [hoveredRowId, setHoveredRowId] = useState<number | string | null>(null);
  const [hoveredRowType, setHoveredRowType] = useState<'stage' | 'activity' | null>(null);
  const [hoveredRowData, setHoveredRowData] = useState<any>(null);
  const [bubblePos, setBubblePos] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [obraData, setObraData] = useState<any>(null);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [criticalPathAtividades, setCriticalPathAtividades] = useState<Set<number>>(new Set());
  const [medicaoItens, setMedicaoItens] = useState<any[]>([]);

  const fetchMedicaoItens = () => {
    fetch(`/api/obras/${obraId}/medicao-itens-flat`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setMedicaoItens(data);
        }
      })
      .catch(err => console.error("Error fetching medicao items:", err));
  };

  const toggleCriticalPath = async () => {
    if (!showCriticalPath) {
        try {
          const response = await fetch(`/api/obras/${obraId}/caminho-critico`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          setCriticalPathAtividades(new Set(data.map((a: any) => a.id)));
        } catch (err) {
          console.error("Error fetching critical path:", err);
        }
    } else {
        setCriticalPathAtividades(new Set());
    }
    setShowCriticalPath(!showCriticalPath);
  };

  const isWorkingDay = (date: Date) => {
    const day = getDay(date);
    if (!cronogramaConfig.workingDays.includes(day)) return false;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    if (cronogramaConfig.holidays.includes(dateStr)) return false;
    
    for (const period of cronogramaConfig.recessPeriods) {
      if (period.start && period.end) {
        const start = parse(period.start, 'yyyy-MM-dd', new Date());
        const end = parse(period.end, 'yyyy-MM-dd', new Date());
        if (isValid(start) && isValid(end)) {
          // Check if date is within [start, end] inclusive
          if (!isBefore(date, start) && !isAfter(date, end)) return false;
        }
      }
    }
    
    return true;
  };

  const addWorkingDays = (startDate: Date, days: number) => {
    let result = new Date(startDate);
    // Se a data de início não for dia útil, move para o próximo dia útil
    while (!isWorkingDay(result)) {
      result = addDays(result, 1);
    }
    
    if (days <= 1) return result;
    
    let addedDays = 1; // O dia de início conta como o primeiro dia
    let safety = 0;
    while (addedDays < days && safety < 1000) {
      result = addDays(result, 1);
      if (isWorkingDay(result)) {
        addedDays++;
      }
      safety++;
    }
    return result;
  };

  const countWorkingDays = (startDate: Date, endDate: Date) => {
    if (!isValid(startDate) || !isValid(endDate)) return 0;
    if (isBefore(endDate, startDate)) return 0;

    let count = 0;
    let current = new Date(startDate);
    while (!isAfter(current, endDate)) {
      if (isWorkingDay(current)) {
        count++;
      }
      current = addDays(current, 1);
    }
    return count;
  };

  const getNextWorkingDay = (date: Date) => {
    let next = addDays(date, 1);
    while (!isWorkingDay(next)) {
      next = addDays(next, 1);
    }
    return next;
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedSection, setFocusedSection] = useState<'table' | 'chart'>('table');
  const [leftPaneWidth, setLeftPaneWidth] = useState(Math.max(600, window.innerWidth * 0.50));
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const rawWidth = e.clientX - containerRect.left;
      
      // Snap points based on exact column boundaries (cumulative widths)
      // [Item+Ativ(400), +Dur(500), +Ini(600), +Fim(700), +Base(800), +Prog(860), +Rec(960), +Resp(1060), +Outro(1200), +Marco(1275)]
      const snapPoints = [400, 500, 600, 700, 800, 860, 960, 1060, 1200, 1275];
      
      // Find the absolute nearest snap point to the current mouse position
      let nearestSnap = snapPoints.reduce((prev, curr) => 
        Math.abs(curr - rawWidth) < Math.abs(prev - rawWidth) ? curr : prev
      );

      // Enforce container boundaries
      const maxAllowedWidth = Math.min(1275, containerRect.width - 100);
      
      // if the nearest snap is beyond the container, find the highest possible snap point
      if (nearestSnap > maxAllowedWidth) {
        nearestSnap = [...snapPoints].reverse().find(p => p <= maxAllowedWidth) || 400;
      }

      setLeftPaneWidth(nearestSnap);
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      // Optional: change body cursor while resizing
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // Inline editing state
  const [isAdding, setIsAdding] = useState(false);
  const [addingToStage, setAddingToStage] = useState<number | string | null>(null);
  const [addingAfterId, setAddingAfterId] = useState<number | string | null>(null);
  const [addingAfterType, setAddingAfterType] = useState<'stage' | 'activity' | null>(null);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isApplyingBaseline, setIsApplyingBaseline] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const updatePendingRef = useRef<Record<string | number, boolean>>({});
  const [showBaselineSuccess, setShowBaselineSuccess] = useState(false);
  const [showClearBaselineConfirm, setShowClearBaselineConfirm] = useState(false);

  // Auto-dismiss notifications
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (showBaselineSuccess) {
      const timer = setTimeout(() => setShowBaselineSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showBaselineSuccess]);

  const scrollToDate = (date: Date) => {
    if (timelineRef.current && columns.length > 0) {
      const scrollContainer = timelineRef.current;
      const totalWidth = scrollContainer.scrollWidth;
      
      const targetIndex = columns.findIndex(d => {
        if (viewMode === 'day') return isSameDay(d, date);
        if (viewMode === 'week') return isSameDay(startOfWeek(d), startOfWeek(date));
        if (viewMode === 'month') return isSameMonth(d, date) && isSameYear(d, date);
        return false;
      });

      if (targetIndex !== -1) {
        const scrollLeft = (targetIndex / columns.length) * totalWidth;
        scrollContainer.scrollTo({
          left: scrollLeft - scrollContainer.clientWidth / 2,
          behavior: 'smooth'
        });
      }
    }
  };

  const scrollToToday = () => {
    scrollToDate(new Date());
  };

  const handlePrint = () => {
    window.print();
  };
  
  const [editForm, setEditForm] = useState<Partial<Omit<Atividade, 'duracao_dias' | 'progresso'> & { 
    duracao_dias: number | string | null; 
    progresso: number | string | null;
    item?: string;
  }>>({
    nome: '',
    item_numero: '',
    data_inicio_prevista: '',
    data_fim_prevista: '',
    duracao_dias: '',
    progresso: '',
    predecessor_ids: [],
    predecessores_texto: '',
    orcamento_item_id: null,
    etapa_id: null,
    recurso: '',
    data_inicio_real: '',
    data_fim_real: '',
    data_inicio_base: '',
    data_fim_base: '',
    is_marco: false
  });

  const editFormRef = useRef(editForm);
  useEffect(() => {
    editFormRef.current = editForm;
  }, [editForm]);

  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add('cronograma-fullscreen');
    } else {
      document.body.classList.remove('cronograma-fullscreen');
    }
    return () => document.body.classList.remove('cronograma-fullscreen');
  }, [isFullscreen]);

  const getPredecessoresTexto = (ids: number[]) => {
    return ids
      .map(id => atividades.find(a => a.id === id)?.item_numero)
      .filter(Boolean)
      .join('; ');
  };

  const parsePredecessor = (token: string): Predecessor | null => {
    const match = token.match(/^([0-9.]+)(FS|SS|FF|SF)?([+-]\d+[dD]?)?$/i);
    if (!match) return null;

    const [_, item, typeRaw, lagRaw] = match;
    let found = atividades.find(a => a.item_numero?.trim().toLowerCase() === item.toLowerCase());
    if (!found) {
        found = atividades.find(a => a.id.toString() === item);
    }
    if (!found) return null;

    const type = (typeRaw?.toUpperCase() || 'FS') as 'FS' | 'SS' | 'FF' | 'SF';
    const lag = lagRaw ? parseInt(lagRaw.replace(/[dD]/, ''), 10) : 0;

    return { id: found.id, type, lag };
  };

  const resolvePredecessores = (texto: string, currentId?: number | string) => {
    if (!texto) return { ids: [], predecessors: [] };
    
    const normalized = texto
      .replace(/\s*(FS|SS|FF|SF)\s*/gi, '$1')
      .replace(/\s*\+\s*/g, '+')
      .replace(/\s*-\s*/g, '-');

    const tokens = normalized.split(/[;, ]+/).map(s => s.trim()).filter(Boolean);
    const predecessors: Predecessor[] = [];
    
    tokens.forEach(token => {
        const pred = parsePredecessor(token);
        if (pred && (!currentId || pred.id.toString() !== currentId.toString())) {
            predecessors.push(pred);
        }
    });

    return {
        ids: predecessors.map(p => p.id),
        predecessors
    };
  };

  const getNextItem = (tipo: 'etapa' | 'atividade', etapaId: number | string | null) => {
    return '';
  };

  const fetchOrcamentoItens = () => {
    fetch(`/api/obras/${obraId}/orcamento`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          // Flatten budget items from stages if necessary, or just use the list if it's flat
          // The API returns a list of items with their stage info
          setOrcamentoItens(data);
        }
      })
      .catch(err => console.error("Error fetching orcamento items:", err));
  };

  const fetchAtividades = () => {
    return fetch(`/api/obras/${obraId}/cronograma`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setAtividades(data);
        } else {
          setAtividades([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching atividades:", err);
        setAtividades([]);
        setLoading(false);
      });
  };

  const handleAddStage = async () => {
    const nome = prompt("Nome da nova etapa:");
    if (!nome) return;
    
    // Find highest item number for stages
    const stages = orcamentoItens.filter(i => i.tipo === 'etapa');
    const maxItem = stages.length > 0 
      ? Math.max(...stages.map(s => parseInt(s.item) || 0))
      : 0;
    const nextItem = (maxItem + 1).toString();

    try {
      const res = await fetch(`/api/obras/${obraId}/orcamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: nextItem,
          descricao: nome,
          tipo: 'etapa',
          unidade: 'un',
          quantidade: 1,
          valor_unitario: 0
        })
      });
      if (res.ok) {
        fetchOrcamentoItens();
      } else {
        const data = await res.json();
        setError(data.message || data.error || "Erro ao adicionar etapa");
      }
    } catch (err: any) {
      setError(err.message || "Erro de conexão ao adicionar etapa");
    }
  };

  const fetchCronogramaConfig = () => {
    fetch(`/api/obras/${obraId}/cronograma-config`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data && data.workingDays) {
          setCronogramaConfig(data);
        }
      })
      .catch(err => console.error("Error fetching cronograma config:", err));
  };

  const fetchObra = () => {
    return fetch(`/api/obras/${obraId}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setObraData(data);
      })
      .catch(err => console.error("Error fetching obra:", err));
  };

  const handleCreateBaseline = async () => {
    setIsApplyingBaseline(true);
    try {
      const res = await fetch(`/api/obras/${obraId}/cronograma/baseline`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchAtividades();
        setShowBaselineSuccess(true);
        setTimeout(() => setShowBaselineSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Error creating baseline:", err);
    } finally {
      setIsApplyingBaseline(false);
    }
  };

  const handleClearBaseline = async () => {
    setIsApplyingBaseline(true);
    try {
      const res = await fetch(`/api/obras/${obraId}/cronograma/baseline/clear`, {
        method: 'POST'
      });
      if (res.ok) {
        setShowClearBaselineConfirm(false);
        setSuccessMessage("Linha de base removida com sucesso!");
        fetchAtividades();
      }
    } catch (error) {
      console.error("Error clearing baseline:", error);
    } finally {
      setIsApplyingBaseline(false);
    }
  };

  const handleUpdateObraExecutionStart = async (date: string) => {
    if (!date) return;
    
    const selectedDate = new Date(date + 'T12:00:00');
    
    // Optimistic update
    if (obraData) {
      setObraData({ ...obraData, data_inicio_real: date });
    }
    
    try {
      const res = await fetch(`/api/obras/${obraId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data_inicio_real: date })
      });
      if (res.ok) {
        // Trigger resequence to shift planned dates based on new execution start
        await fetch(`/api/obras/${obraId}/cronograma/resequence`, { method: 'POST' });
        fetchObra();
        fetchAtividades();
        scrollToDate(selectedDate);
      }
    } catch (err) {
      console.error("Error updating execution start:", err);
    }
  };

  useEffect(() => {
    if (orcamento && orcamento.length > 0) {
      setOrcamentoItens(orcamento);
    }
  }, [orcamento]);

  useEffect(() => {
    fetchAtividades();
    fetchObra();
    if (!orcamento || orcamento.length === 0) {
      fetchOrcamentoItens();
    }
    fetchCronogramaConfig();
    fetchMedicaoItens();
  }, [obraId]);

  const itemValuesMap = useMemo(() => {
    const map: Record<string | number, number> = {};
    orcamentoItens.forEach(oi => {
      const cleanId = String(oi.id).replace('item-', '').replace('etapa-', '');
      map[cleanId] = (oi as any).total || 0;
    });
    return map;
  }, [orcamentoItens]);

  const monthlySummary = useMemo(() => {
    const planned: Record<string | number, Record<string, { valor: number, isSimulated?: boolean }>> = {};
    const medicao: Record<string | number, Record<string, { valor: number }>> = {};
    const projectPlanned: Record<string, { valor: number, isSimulated?: boolean }> = {};
    const projectMedicao: Record<string, { valor: number }> = {};
    
    // Auxiliar para denominadores (Totais por Etapa e Projeto)
    const stageTotals: Record<string | number, number> = {};
    let projectTotal = 0;

    // 1. Calcular Denominadores Reais (Pesos Totais) com rateio de valores entre atividades vinculadas ao mesmo item
    const totalDurationPerBudgetItem: Record<string, number> = {};
    atividades.forEach(atv => {
      const cleanId = atv.orcamento_item_id ? String(atv.orcamento_item_id).replace('item-', '').replace('etapa-', '') : null;
      if (cleanId && (itemValuesMap[cleanId] || 0) > 0) {
        totalDurationPerBudgetItem[cleanId] = (totalDurationPerBudgetItem[cleanId] || 0) + (atv.duracao_dias || 1);
      }
    });

    atividades.forEach(atv => {
      const cleanId = atv.orcamento_item_id ? String(atv.orcamento_item_id).replace('item-', '').replace('etapa-', '') : null;
      const itemTotalValue = cleanId ? (itemValuesMap[cleanId] || 0) : 0;
      
      let weight = 0;
      if (itemTotalValue > 0 && cleanId) {
        // Se o item tem valor orçado, rateia entre as atividades que o compartilham proporcionalmente à duração
        const activityDuration = atv.duracao_dias || 1;
        const totalItemDuration = totalDurationPerBudgetItem[cleanId] || 1;
        weight = (activityDuration / totalItemDuration) * itemTotalValue;
      } else {
        // Se não tem valor, usa a duração como peso (fall-back)
        weight = atv.duracao_dias || 1;
      }
      
      const stageId = atv.etapa_id || 0;
      stageTotals[stageId] = (stageTotals[stageId] || 0) + weight;
      projectTotal += weight;
    });

    // 2. MEDIÇÃO (Actual)
    medicaoItens.forEach(it => {
      const date = parseDate(it.data_medicao);
      if (!isValid(date)) return;
      const monthKey = format(date, 'yyyy-MM');
      const itemValor = (it.quantidade_medida || 0) * (it.custo_unitario_aplicado || 0) * (1 + (it.bdi || 0) / 100);
      
      const stageId = it.etapa_id;
      if (stageId !== undefined && stageId !== null) {
        if (!medicao[stageId]) medicao[stageId] = {};
        if (!medicao[stageId][monthKey]) medicao[stageId][monthKey] = { valor: 0 };
        medicao[stageId][monthKey].valor += itemValor;
      }
      if (!projectMedicao[monthKey]) projectMedicao[monthKey] = { valor: 0 };
      projectMedicao[monthKey].valor += itemValor;
    });

    // 3. PLANEJADO (Planned) - Distribuído proporcionalmente usando o weight rateado
    atividades.forEach(atv => {
      if (!atv.data_inicio_prevista || !atv.data_fim_prevista) return;
      const start = parseDate(atv.data_inicio_prevista);
      const end = parseDate(atv.data_fim_prevista);
      if (!isValid(start) || !isValid(end)) return;

      const cleanId = atv.orcamento_item_id ? String(atv.orcamento_item_id).replace('item-', '').replace('etapa-', '') : null;
      const itemTotalValue = cleanId ? (itemValuesMap[cleanId] || 0) : 0;
      
      let weight = 0;
      if (itemTotalValue > 0 && cleanId) {
        const activityDuration = atv.duracao_dias || 1;
        const totalItemDuration = totalDurationPerBudgetItem[cleanId] || 1;
        weight = (activityDuration / totalItemDuration) * itemTotalValue;
      } else {
        weight = atv.duracao_dias || 1;
      }

      const totalWorkingDays = countWorkingDays(start, end) || 1;
      const dailyWeight = weight / totalWorkingDays;
      const isSimulated = itemTotalValue === 0;
      
      let current = new Date(start);
      while (!isAfter(current, end)) {
        if (isWorkingDay(current)) {
          const monthKey = format(current, 'yyyy-MM');
          const stageId = atv.etapa_id || 0;

          if (!planned[stageId]) planned[stageId] = {};
          if (!planned[stageId][monthKey]) planned[stageId][monthKey] = { valor: 0, isSimulated };
          planned[stageId][monthKey].valor += dailyWeight;

          if (!projectPlanned[monthKey]) projectPlanned[monthKey] = { valor: 0, isSimulated };
          projectPlanned[monthKey].valor += dailyWeight;
        }
        current = addDays(current, 1);
      }
    });
    
    return { medicao, planned, projectMedicao, projectPlanned, stageTotals, projectTotal };
  }, [medicaoItens, atividades, orcamentoItens, cronogramaConfig, itemValuesMap]);

  const handleConvertStageToActivity = async (stageId: number | string, stageData: any) => {
    if (hasBaseline) return;
    
    try {
      const res = await fetch(`/api/obras/${obraId}/cronograma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: stageData.nome,
          item_numero: stageData.item,
          etapa_id: stageId,
          data_inicio_prevista: format(new Date(), 'yyyy-MM-dd'),
          data_fim_prevista: format(addWorkingDays(new Date(), 1), 'yyyy-MM-dd'),
          duracao_dias: 1,
          progresso: 0,
          orcamento_item_id: stageId
        })
      });
      
      if (res.ok) {
        fetchAtividades();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveNew = async () => {
    const currentForm = editFormRef.current;
    if (!currentForm.nome) {
      setIsAdding(false);
      return;
    }

    // Atualização otimista: adiciona à lista local antes do servidor responder
    const tempId = Date.now();
    setAtividades(prev => [...prev, {
      ...currentForm,
      id: tempId,
      obra_id: Number(obraId),
      duracao_dias: currentForm.duracao_dias === "" ? 0 : Number(currentForm.duracao_dias),
      progresso: currentForm.progresso === "" ? 0 : Number(currentForm.progresso),
      predecessor_ids: resolvePredecessores(currentForm.predecessores_texto || '').ids,
      predecessors: resolvePredecessores(currentForm.predecessores_texto || '').predecessors
    } as Atividade]);

    // Fecha a edição imediatamente para feedback visual
    setEditingId(null);
    setEditingField(null);
    setIsAdding(false);

    try {
      const resolvedPreds = resolvePredecessores(currentForm.predecessores_texto || '');
      const res = await fetch(`/api/obras/${obraId}/cronograma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: currentForm.nome,
          item_numero: currentForm.item_numero || null,
          data_inicio_prevista: currentForm.data_inicio_prevista || null,
          data_fim_prevista: currentForm.data_fim_prevista || null,
          descricao: '',
          duracao_dias: (currentForm.duracao_dias !== undefined && currentForm.duracao_dias !== "") ? currentForm.duracao_dias : null,
          progresso: (currentForm.progresso !== undefined && currentForm.progresso !== "") ? currentForm.progresso : null,
          predecessor_ids: resolvedPreds.ids,
          predecessors: resolvedPreds.predecessors,
          predecessores_texto: currentForm.predecessores_texto || '',
          orcamento_item_id: currentForm.orcamento_item_id || null,
          etapa_id: currentForm.etapa_id || null,
          recurso: currentForm.recurso || null,
          data_inicio_real: currentForm.data_inicio_real || null,
          data_fim_real: currentForm.data_fim_real || null,
          data_inicio_base: currentForm.data_inicio_base || null,
          data_fim_base: currentForm.data_fim_base || null,
          is_marco: currentForm.is_marco || false
        })
      });
      if (res.ok) {
        // Já fechamos o modo de edição e fizemos update otimista
        
        await fetch(`/api/obras/${obraId}/cronograma/resequence`, { method: 'POST' });
        await fetchAtividades();
        setEditForm({ 
          nome: '', 
          item_numero: '',
          data_inicio_prevista: '', 
          data_fim_prevista: '', 
          duracao_dias: '', 
          progresso: '',
          predecessor_ids: [], 
          predecessores_texto: '',
          orcamento_item_id: null, 
          etapa_id: null,
          recurso: '',
          data_inicio_real: '',
          data_fim_real: ''
        });
      } else {
        const errorData = await res.json();
        setError("Erro ao salvar atividade: " + errorData.message);
      }
    } catch (error) {
      console.error("Error saving atividade:", error);
    }
  };

  const handleUpdateEtapa = async (id: number | string) => {
    const currentForm = editFormRef.current;
    
    // Fecha a edição imediatamente para feedback visual rápido
    setEditingId(null);
    setEditingField(null);

    if (!currentForm.nome || updatePendingRef.current[`etapa-${id}`]) {
      return;
    }

    // Atualização otimista do orçamento para as etapas
    setOrcamentoItens(prev => prev.map(item => String(item.id) === String(id) ? {
      ...item,
      descricao: currentForm.nome,
      item: currentForm.item || item.item
    } : item));
    
    updatePendingRef.current[`etapa-${id}`] = true;
    setIsUpdating(true);
    
    try {
      const res = await fetch(`/api/obras/${obraId}/orcamento/etapa-${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'etapa',
          descricao: currentForm.nome,
          item: currentForm.item
        })
      });

      if (res.ok) {
        // Já fechamos o modo de edição no início da função e fizemos update otimista
        
        // Trigger resequence
        await fetch(`/api/obras/${obraId}/cronograma/resequence`, { method: 'POST' });
        
        await fetchAtividades();
      } else {
        const errorData = await res.json();
        setError("Erro ao salvar etapa: " + errorData.message);
      }
    } catch (error) {
      console.error("Error updating etapa:", error);
    } finally {
      delete updatePendingRef.current[`etapa-${id}`];
      setIsUpdating(false);
    }
  };

  const handleBlur = (e: React.FocusEvent, id: number | string) => {
    const related = e.relatedTarget as HTMLElement;
    const rowClass = `edit-row-${id}`;
    if (related && related.closest(`.${rowClass}`)) {
      return; // Do nothing, user is tabbing to the next field in the same row
    }
    handleUpdate(id, true);
  };

  const handleUpdate = async (id: number | string, fromBlur = false) => {
    // Se já estamos salvando esse ID, apenas fechamos a UI e retornamos
    if (updatePendingRef.current[id]) {
      setEditingId(null);
      setEditingField(null);
      return;
    }

    const currentForm = editFormRef.current;
    if (!currentForm.nome) {
      setEditingId(null);
      setEditingField(null);
      return;
    }

    // Atualização otimista: evita que o valor "volte" visualmente enquanto o servidor processa
    const optimisticPredecessorIds = resolvePredecessores(currentForm.predecessores_texto || '', id);
    setAtividades(prev => prev.map(atv => String(atv.id) === String(id) ? {
      ...atv,
      nome: currentForm.nome,
      item_numero: currentForm.item_numero,
      data_inicio_prevista: currentForm.data_inicio_prevista,
      data_fim_prevista: currentForm.data_fim_prevista,
      duracao_dias: currentForm.duracao_dias === "" ? 0 : Number(currentForm.duracao_dias),
      progresso: currentForm.progresso === "" ? 0 : Number(currentForm.progresso),
      predecessores_texto: currentForm.predecessores_texto,
      predecessor_ids: optimisticPredecessorIds.ids,
      predecessors: optimisticPredecessorIds.predecessors,
      recurso: currentForm.recurso,
      data_inicio_real: currentForm.data_inicio_real,
      data_fim_real: currentForm.data_fim_real,
      is_marco: currentForm.is_marco,
      produtividade: currentForm.produtividade,
      quantidade_equipe: currentForm.quantidade_equipe
    } as Atividade : atv));

    // Fecha a edição imediatamente para feedback instantâneo
    setEditingId(null);
    setEditingField(null);

    updatePendingRef.current[id] = true;
    setIsUpdating(true);
    
    try {
      const resolvedPreds = resolvePredecessores(currentForm.predecessores_texto || '', id);
      const res = await fetch(`/api/obras/${obraId}/cronograma/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: currentForm.nome,
          item_numero: currentForm.item_numero || null,
          data_inicio_prevista: currentForm.data_inicio_prevista || null,
          data_fim_prevista: currentForm.data_fim_prevista || null,
          descricao: currentForm.descricao || '',
          duracao_dias: (currentForm.duracao_dias !== undefined && currentForm.duracao_dias !== "") ? currentForm.duracao_dias : null,
          progresso: (currentForm.progresso !== undefined && currentForm.progresso !== "") ? currentForm.progresso : null,
          predecessor_ids: resolvedPreds.ids,
          predecessors: resolvedPreds.predecessors,
          predecessores_texto: currentForm.predecessores_texto || '',
          orcamento_item_id: currentForm.orcamento_item_id || null,
          etapa_id: currentForm.etapa_id || null,
          recurso: currentForm.recurso || null,
          data_inicio_real: currentForm.data_inicio_real || null,
          data_fim_real: currentForm.data_fim_real || null,
          data_inicio_base: currentForm.data_inicio_base || null,
          data_fim_base: currentForm.data_fim_base || null,
          is_marco: currentForm.is_marco || false,
          produtividade: currentForm.produtividade || 0,
          quantidade_equipe: currentForm.quantidade_equipe || 0
        })
      });
      if (res.ok) {
        // Já fechamos o modo de edição no início da função e fizemos update otimista
        
        await fetch(`/api/obras/${obraId}/cronograma/resequence`, { method: 'POST' });
        await fetchAtividades();
      } else {
        const errorData = await res.json();
        setError("Erro ao atualizar atividade: " + errorData.message);
      }
    } catch (error) {
      console.error("Error updating atividade:", error);
    } finally {
      delete updatePendingRef.current[id];
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: number | string) => {
    try {
      const res = await fetch(`/api/obras/${obraId}/cronograma/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDeleteConfirmId(null);
        setSuccessMessage("Item excluído com sucesso!");
        
        // Trigger resequence
        await fetch(`/api/obras/${obraId}/cronograma/resequence`, { method: 'POST' });
        
        await fetchAtividades();
      } else {
        const errorData = await res.json();
        setError("Erro ao excluir atividade: " + errorData.message);
      }
    } catch (error) {
      console.error("Error deleting atividade:", error);
      setError("Erro de conexão ao excluir atividade.");
    }
  };

  const toggleMarco = async (atv: Atividade) => {
    try {
      const res = await fetch(`/api/obras/${obraId}/cronograma/${atv.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...atv,
          is_marco: !atv.is_marco
        })
      });
      if (res.ok) {
        fetchAtividades();
      }
    } catch (error) {
      console.error("Erro ao alternar marco:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, id?: number | string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      
      if (isAdding) {
        handleSaveNew();
        return;
      }

      const targetId = id || editingId;
      if (targetId) {
        handleUpdate(targetId);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setEditingId(null);
      setEditingField(null);
      setIsAdding(false);
    }
  };

  const startEdit = (atv: Atividade, field: string) => {
    setIsAdding(false);
    if (editingId === atv.id) {
      setEditingField(field);
      return;
    }
    if (editingId && editingId !== atv.id) {
        handleUpdate(editingId, true);
    }
    setEditingId(atv.id);
    setEditingField(field);
    setEditForm({
      ...atv,
      predecessores_texto: atv.predecessores_texto || getPredecessoresTexto(atv.predecessor_ids || []),
      data_inicio_prevista: atv.data_inicio_prevista ? atv.data_inicio_prevista.split('T')[0] : '',
      data_fim_prevista: atv.data_fim_prevista ? atv.data_fim_prevista.split('T')[0] : '',
      data_inicio_real: atv.data_inicio_real ? atv.data_inicio_real.split('T')[0] : '',
      data_fim_real: atv.data_fim_real ? atv.data_fim_real.split('T')[0] : '',
      data_inicio_base: atv.data_inicio_base ? atv.data_inicio_base.split('T')[0] : '',
      data_fim_base: atv.data_fim_base ? atv.data_fim_base.split('T')[0] : ''
    });
  };

  const startAdding = (etapaId?: number, stageItemStr?: string) => {
    setEditingId(null);
    setEditingField('nome');
    setAddingAfterId(etapaId || null);
    setAddingAfterType('stage');
    
    let nextItemNumero = '';
    if (etapaId) {
      // Find the stage item number from orcamentoItens or use the provided one
      const stageItem = stageItemStr || orcamentoItens.find(item => {
        const rawId = item.id;
        const id = typeof rawId === 'string' ? parseInt(rawId.replace('etapa-', '')) : rawId;
        return id === etapaId && item.tipo === 'etapa';
      })?.item || '';

      if (stageItem) {
        // Base item number (e.g., "1.0" -> "1", "1.1" -> "1.1", "2" -> "2")
        const baseItem = stageItem.toString().replace(/\.0$/, '');
        
        const stageAtividades = atividades.filter(a => a.etapa_id === etapaId);
        if (stageAtividades.length > 0) {
          // Find the highest sub-item number
          const subItems = stageAtividades
            .map(a => {
              const parts = (a.item_numero || '').split('.');
              return parseInt(parts[parts.length - 1]);
            })
            .filter(n => !isNaN(n));
          
          const maxSub = subItems.length > 0 ? Math.max(...subItems) : 0;
          nextItemNumero = `${baseItem}.${maxSub + 1}`;
        } else {
          nextItemNumero = `${baseItem}.1`;
        }
      }
    }

    const baseDate = obraData?.data_inicio_real ? new Date(obraData.data_inicio_real + 'T12:00:00') : new Date();
    const start = isWorkingDay(baseDate) ? baseDate : getNextWorkingDay(baseDate);
    const end = addWorkingDays(start, 1);

    setEditForm({ 
      nome: '', 
      item_numero: nextItemNumero, 
      data_inicio_prevista: format(start, 'yyyy-MM-dd'), 
      data_fim_prevista: format(end, 'yyyy-MM-dd'), 
      duracao_dias: 1, 
      progresso: 0,
      predecessor_ids: [], 
      predecessores_texto: '',
      orcamento_item_id: null, 
      etapa_id: etapaId || null, 
      recurso: '',
      data_inicio_real: '',
      data_fim_real: ''
    });
    setIsAdding(true);
  };


  const handlePredecessoresTextoChange = (texto: string) => {
    const newPreds = resolvePredecessores(texto, editingId || undefined);
    
    let newDataInicio = editForm.data_inicio_prevista;
    let newDataFim = editForm.data_fim_prevista;

    if (newPreds.ids.length > 0) {
      const preds = atividades.filter(a => newPreds.ids.includes(a.id));
      const latestPredFim = max(preds.map(p => parseDate(p.data_fim_prevista)).filter(isValid));
      
      if (isValid(latestPredFim)) {
        const inicio = getNextWorkingDay(latestPredFim);
        newDataInicio = format(inicio, 'yyyy-MM-dd');
        
        if (editForm.duracao_dias !== undefined && editForm.duracao_dias !== "") {
          const fim = addWorkingDays(inicio, Number(editForm.duracao_dias));
          newDataFim = format(fim, 'yyyy-MM-dd');
        }
      }
    }

    setEditForm({
      ...editForm,
      predecessores_texto: texto,
      predecessor_ids: newPreds.ids,
      predecessors: newPreds.predecessors,
      data_inicio_prevista: newDataInicio,
      data_fim_prevista: newDataFim
    });
  };

  const handlePredecessorChange = (predId: number, checked: boolean) => {
    const currentPreds = editForm.predecessor_ids || [];
    const newPreds = checked 
      ? [...currentPreds, predId]
      : currentPreds.filter(id => id !== predId);
    
    let newDataInicio = editForm.data_inicio_prevista;
    let newDataFim = editForm.data_fim_prevista;

    if (newPreds.length > 0) {
      const preds = atividades.filter(a => newPreds.includes(a.id));
      const latestPredFim = max(preds.map(p => parseDate(p.data_fim_prevista)).filter(isValid));
      
      if (isValid(latestPredFim)) {
        const inicio = getNextWorkingDay(latestPredFim);
        newDataInicio = format(inicio, 'yyyy-MM-dd');
        
        if (editForm.duracao_dias !== undefined && editForm.duracao_dias !== "") {
          const fim = addWorkingDays(inicio, Number(editForm.duracao_dias));
          newDataFim = format(fim, 'yyyy-MM-dd');
        }
      }
    }

    setEditForm({
      ...editForm,
      predecessor_ids: newPreds,
      predecessores_texto: getPredecessoresTexto(newPreds),
      data_inicio_prevista: newDataInicio,
      data_fim_prevista: newDataFim
    });
  };

  const handleDuracaoChange = (dias: number | string) => {
    setEditForm(prev => {
      let newDataFim = prev.data_fim_prevista;
      if (prev.data_inicio_prevista) {
        const inicio = parseDate(prev.data_inicio_prevista);
        if (isValid(inicio)) {
          // Se dias for 0, o fim é igual ao início
          const numDias = dias === "" ? 1 : Number(dias);
          const fim = numDias === 0 ? inicio : addWorkingDays(inicio, numDias);
          newDataFim = format(fim, 'yyyy-MM-dd');
        }
      }
      const next = {
        ...prev,
        duracao_dias: dias,
        data_fim_prevista: newDataFim,
        is_marco: dias === 0 || dias === "0"
      };
      editFormRef.current = next;
      return next;
    });
  };

  const handleDataInicioChange = (dateStr: string) => {
    let inicio = parseDate(dateStr);
    if (isValid(inicio)) {
      setEditForm(prev => {
        let newDataFim = prev.data_fim_prevista;
        if (prev.duracao_dias !== undefined && prev.duracao_dias !== null && prev.duracao_dias !== "") {
          const numDuracao = Number(prev.duracao_dias);
          const fim = numDuracao === 0 ? inicio : addWorkingDays(inicio, numDuracao);
          newDataFim = format(fim, 'yyyy-MM-dd');
        }
        const next = {
          ...prev,
          data_inicio_prevista: dateStr,
          data_fim_prevista: newDataFim
        };
        editFormRef.current = next;
        return next;
      });
    } else {
      setEditForm(prev => {
        const next = { ...prev, data_inicio_prevista: dateStr };
        editFormRef.current = next;
        return next;
      });
    }
  };

  const handleMarcoChange = (checked: boolean) => {
    setEditForm(prev => {
      let novaDuracao = prev.duracao_dias !== undefined ? prev.duracao_dias : 1;
      let newDataFim = prev.data_fim_prevista;
      
      if (checked) {
        novaDuracao = 0;
        if (prev.data_inicio_prevista) {
          newDataFim = prev.data_inicio_prevista;
        }
      } else if (novaDuracao === 0) {
        novaDuracao = 1;
        if (prev.data_inicio_prevista) {
          const inicio = parseDate(prev.data_inicio_prevista);
          if (isValid(inicio)) {
            newDataFim = format(addWorkingDays(inicio, 1), 'yyyy-MM-dd');
          }
        }
      }
      
      const next = {
        ...prev,
        is_marco: checked,
        duracao_dias: novaDuracao,
        data_fim_prevista: newDataFim
      };
      editFormRef.current = next;
      return next;
    });
  };

  const handleDataFimChange = (dateStr: string) => {
    let fim = parseDate(dateStr);
    if (isValid(fim)) {
      setEditForm(prev => {
        let newDuracao = prev.duracao_dias;
        if (prev.data_inicio_prevista) {
          const inicio = parseDate(prev.data_inicio_prevista);
          if (isValid(inicio)) {
            if (isSameDay(inicio, fim)) {
              newDuracao = prev.duracao_dias === 0 ? 0 : 1;
            } else {
              newDuracao = countWorkingDays(inicio, fim);
            }
          }
        }
        const next = {
          ...prev,
          data_fim_prevista: dateStr,
          duracao_dias: newDuracao,
          is_marco: newDuracao === 0
        };
        editFormRef.current = next;
        return next;
      });
    } else {
      setEditForm(prev => {
        const next = { ...prev, data_fim_prevista: dateStr };
        editFormRef.current = next;
        return next;
      });
    }
  };

  // --- Gantt Logic ---
  
  // 1. Determine overall project start and end dates
  const { projectStart, projectEnd } = useMemo(() => {
      let today = new Date();
      today.setHours(0, 0, 0, 0);
      const threeDaysAgo = addDays(today, -3);
  
      let minDate = threeDaysAgo;
      let maxDate = endOfMonth(addMonths(startOfMonth(today), 2)); // Default 3 months
  
      const allAtividades = [...atividades];
      if (editingId) {
        const editingAtv = allAtividades.find(a => a.id === editingId);
        if (editingAtv) {
          const updated = {
            ...editingAtv,
            ...editForm
          } as any as Atividade;
          const idx = allAtividades.findIndex(a => a.id === editingId);
          allAtividades[idx] = updated;
        }
      } else if (isAdding && editForm.data_inicio_prevista && editForm.data_fim_prevista) {
         allAtividades.push({
           id: -1,
           ...editForm
         } as any);
      }
  
      if (allAtividades.length > 0) {
        const startDates: Date[] = [];
        const endDates: Date[] = [];
        
        allAtividades.forEach(a => {
          [a.data_inicio_prevista, a.data_inicio_real, a.data_inicio_base].forEach(dStr => {
            if (dStr) {
              const d = parseDate(dStr);
              if (isValid(d)) startDates.push(d);
            }
          });
          [a.data_fim_prevista, a.data_fim_real, a.data_fim_base].forEach(dStr => {
            if (dStr) {
              const d = parseDate(dStr);
              if (isValid(d)) endDates.push(d);
            }
          });
        });
  
        if (startDates.length > 0 && endDates.length > 0) {
          const actualMin = min(startDates);
          const actualMax = max(endDates);
          
          minDate = isBefore(actualMin, threeDaysAgo) ? actualMin : threeDaysAgo;
          const minEnd = endOfMonth(addMonths(startOfMonth(minDate), 2));
          maxDate = isAfter(actualMax, minEnd) ? actualMax : minEnd;
        }
      }
  
      if (viewMode === 'day') {
        maxDate = addDays(maxDate, 5); // Add some padding days
      } else if (viewMode === 'week') {
        minDate = startOfMonth(minDate);
        maxDate = endOfMonth(addMonths(maxDate, 1));
      } else {
        minDate = startOfMonth(minDate);
        maxDate = endOfMonth(addMonths(maxDate, 6));
      }
  
      return { projectStart: minDate, projectEnd: maxDate };
    }, [atividades, viewMode, editingId, isAdding, editForm, obraData]);

  const taskListRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const taskListDragScroll = useDragScroll(taskListRef);
  const timelineDragScroll = useDragScroll(timelineRef);

  const isScrollingRef = useRef<string | null>(null);

  const handleTaskListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isScrollingRef.current === 'timeline') return;
    isScrollingRef.current = 'tasklist';
    const scrollTop = e.currentTarget.scrollTop;
    requestAnimationFrame(() => {
      if (timelineRef.current) {
        timelineRef.current.scrollTop = scrollTop;
      }
      setTimeout(() => { isScrollingRef.current = null; }, 50);
    });
  };

  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isScrollingRef.current === 'tasklist') return;
    isScrollingRef.current = 'timeline';
    const scrollTop = e.currentTarget.scrollTop;
    requestAnimationFrame(() => {
      if (taskListRef.current) {
        taskListRef.current.scrollTop = scrollTop;
      }
      setTimeout(() => { isScrollingRef.current = null; }, 50);
    });
  };

    const { allRows, taskRowMap, projectSummaryData } = useMemo(() => {
      // Create a unified list of activities that includes current edits for real-time aggregation
      let currentAtividades = atividades.map(a => {
        if (editingId && a.id === editingId) {
          return { ...a, ...editForm } as Atividade;
        }
        return a;
      });

      // Also include the item being added for real-time summary updates
      if (isAdding && editForm.data_inicio_prevista && editForm.data_fim_prevista) {
        currentAtividades.push({
          id: -999, // Unique dummy ID for the adding item
          ...editForm,
          atividade: editForm.nome || 'Nova Atividade',
          nome: editForm.nome || 'Nova Atividade'
        } as any as Atividade);
      }

      const sortCodes = (a: string, b: string) => {
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        const cleanA = a.replace(/[^0-9.]/g, '');
        const cleanB = b.replace(/[^0-9.]/g, '');
        const aParts = cleanA.split('.').map(p => parseInt(p, 10) || 0);
        const bParts = cleanB.split('.').map(p => parseInt(p, 10) || 0);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aP = aParts[i] || 0;
          const bP = bParts[i] || 0;
          if (aP !== bP) return aP - bP;
        }
        return 0;
      };

      let rows: { type: 'stage' | 'activity', id: number | string, item: string, data: any }[] = [];
      const addedStages = new Set<number | string>();
      const addedActivities = new Set<number | string>();
      
      // Helper to calculate stage aggregations with weight splitting
      const totalDurationPerBudgetItem: Record<string, number> = {};
      currentAtividades.forEach(atv => {
        const cleanId = atv.orcamento_item_id ? String(atv.orcamento_item_id).replace('item-', '').replace('etapa-', '') : null;
        if (cleanId && (itemValuesMap[cleanId] || 0) > 0) {
          totalDurationPerBudgetItem[cleanId] = (totalDurationPerBudgetItem[cleanId] || 0) + (atv.duracao_dias || 1);
        }
      });

      const getStageAggregations = (stageId: number | string, stageItem: string) => {
        const trimmedStageItem = (stageItem || '').trim();
        const baseItem = (trimmedStageItem || "").toString().replace(/\.0$/, '');
        
        const childAtvs = currentAtividades.filter(a => {
          // Match by explicit stage ID
          if (a.etapa_id === stageId) return true;
          
          // Match by item number prefix (e.g., "1.1" is a child of "1")
          if (a.item_numero && baseItem) {
            const aItem = a.item_numero.trim();
            return aItem === baseItem || aItem.startsWith(baseItem + '.');
          }
          return false;
        });
        
        let minInicioPrev: Date | null = null;
        let maxFimPrev: Date | null = null;
        let minInicioReal: Date | null = null;
        let maxFimReal: Date | null = null;
        let minInicioBase: Date | null = null;
        let maxFimBase: Date | null = null;
        let minCurrentInicio: Date | null = null;
        let maxCurrentFim: Date | null = null;
        let totalProgressoPonderado = 0;
        let totalValorEtapa = 0;

        childAtvs.forEach(a => {
          const pInicio = a.data_inicio_prevista ? parseDate(a.data_inicio_prevista) : null;
          const pFim = a.data_fim_prevista ? parseDate(a.data_fim_prevista) : null;
          const rInicio = a.data_inicio_real ? parseDate(a.data_inicio_real) : null;
          const rFim = a.data_fim_real ? parseDate(a.data_fim_real) : null;
          const bInicio = a.data_inicio_base ? parseDate(a.data_inicio_base) : null;
          const bFim = a.data_fim_base ? parseDate(a.data_fim_base) : null;

          if (pInicio && isValid(pInicio)) {
            if (!minInicioPrev || pInicio < minInicioPrev) minInicioPrev = pInicio;
          }
          if (pFim && isValid(pFim)) {
            if (!maxFimPrev || pFim > maxFimPrev) maxFimPrev = pFim;
          }
          if (rInicio && isValid(rInicio)) {
            if (!minInicioReal || rInicio < minInicioReal) minInicioReal = rInicio;
          }
          if (rFim && isValid(rFim)) {
            if (!maxFimReal || rFim > maxFimReal) maxFimReal = rFim;
          }
          if (bInicio && isValid(bInicio)) {
            if (!minInicioBase || bInicio < minInicioBase) minInicioBase = bInicio;
          }
          if (bFim && isValid(bFim)) {
            if (!maxFimBase || bFim > maxFimBase) maxFimBase = bFim;
          }

          // Calculate current range for this child activity (Real or Planned)
          const cInicio = (rInicio && isValid(rInicio)) ? rInicio : pInicio;
          const cFim = (rFim && isValid(rFim)) ? rFim : pFim;

          if (cInicio && isValid(cInicio)) {
            if (!minCurrentInicio || cInicio < minCurrentInicio) minCurrentInicio = cInicio;
          }
          if (cFim && isValid(cFim)) {
            if (!maxCurrentFim || cFim > maxCurrentFim) maxCurrentFim = cFim;
          }

          const cleanId = a.orcamento_item_id ? String(a.orcamento_item_id).replace('item-', '').replace('etapa-', '') : null;
          const itemTotalValue = cleanId ? (itemValuesMap[cleanId] || 0) : 0;
          
          let weight = 0;
          if (itemTotalValue > 0 && cleanId) {
            const activityDuration = a.duracao_dias || 1;
            const totalItemDuration = totalDurationPerBudgetItem[cleanId] || 1;
            weight = (activityDuration / totalItemDuration) * itemTotalValue;
          } else {
            weight = a.duracao_dias || 1;
          }

          totalProgressoPonderado += (a.progresso || 0) * weight;
          totalValorEtapa += weight;
        });

        const weightedProgresso = totalValorEtapa > 0 ? Math.round(totalProgressoPonderado / totalValorEtapa) : 0;
        const duracaoDias = (minInicioPrev && maxFimPrev) ? countWorkingDays(minInicioPrev, maxFimPrev) : 0;

        return {
          data_inicio_prevista: minInicioPrev ? format(minInicioPrev, 'yyyy-MM-dd') : null,
          data_fim_prevista: maxFimPrev ? format(maxFimPrev, 'yyyy-MM-dd') : null,
          data_inicio_real: minInicioReal ? format(minInicioReal, 'yyyy-MM-dd') : null,
          data_fim_real: maxFimReal ? format(maxFimReal, 'yyyy-MM-dd') : null,
          data_inicio_base: minInicioBase ? format(minInicioBase, 'yyyy-MM-dd') : null,
          data_fim_base: maxFimBase ? format(maxFimBase, 'yyyy-MM-dd') : null,
          data_inicio_atual: minCurrentInicio ? format(minCurrentInicio, 'yyyy-MM-dd') : null,
          data_fim_atual: maxCurrentFim ? format(maxCurrentFim, 'yyyy-MM-dd') : null,
          duracao_dias: duracaoDias,
          progresso: weightedProgresso
        };
      };

      const getProjectAggregations = () => {
        let minInicioPrev: Date | null = null;
        let maxFimPrev: Date | null = null;
        let minInicioReal: Date | null = null;
        let maxFimReal: Date | null = null;
        let minInicioBase: Date | null = null;
        let maxFimBase: Date | null = null;
        let minCurrentInicio: Date | null = null;
        let maxCurrentFim: Date | null = null;
        let totalProgressoPonderado = 0;
        let totalValorProjeto = 0;

        currentAtividades.forEach(a => {
          const pInicio = a.data_inicio_prevista ? parseDate(a.data_inicio_prevista) : null;
          const pFim = a.data_fim_prevista ? parseDate(a.data_fim_prevista) : null;
          const rInicio = a.data_inicio_real ? parseDate(a.data_inicio_real) : null;
          const rFim = a.data_fim_real ? parseDate(a.data_fim_real) : null;
          const bInicio = a.data_inicio_base ? parseDate(a.data_inicio_base) : null;
          const bFim = a.data_fim_base ? parseDate(a.data_fim_base) : null;

          if (pInicio && isValid(pInicio)) {
            if (!minInicioPrev || pInicio < minInicioPrev) minInicioPrev = pInicio;
          }
          if (pFim && isValid(pFim)) {
            if (!maxFimPrev || pFim > maxFimPrev) maxFimPrev = pFim;
          }
          if (rInicio && isValid(rInicio)) {
            if (!minInicioReal || rInicio < minInicioReal) minInicioReal = rInicio;
          }
          if (rFim && isValid(rFim)) {
            if (!maxFimReal || rFim > maxFimReal) maxFimReal = rFim;
          }
          if (bInicio && isValid(bInicio)) {
            if (!minInicioBase || bInicio < minInicioBase) minInicioBase = bInicio;
          }
          if (bFim && isValid(bFim)) {
            if (!maxFimBase || bFim > maxFimBase) maxFimBase = bFim;
          }

          // Calculate current range for this activity (Real or Planned)
          const cInicio = (rInicio && isValid(rInicio)) ? rInicio : pInicio;
          const cFim = (rFim && isValid(rFim)) ? rFim : pFim;

          if (cInicio && isValid(cInicio)) {
            if (!minCurrentInicio || cInicio < minCurrentInicio) minCurrentInicio = cInicio;
          }
          if (cFim && isValid(cFim)) {
            if (!maxCurrentFim || cFim > maxCurrentFim) maxCurrentFim = cFim;
          }
          
          const cleanId = a.orcamento_item_id ? String(a.orcamento_item_id).replace('item-', '').replace('etapa-', '') : null;
          const itemTotalValue = cleanId ? (itemValuesMap[cleanId] || 0) : 0;
          
          let weight = 0;
          if (itemTotalValue > 0 && cleanId) {
            const activityDuration = a.duracao_dias || 1;
            const totalItemDuration = totalDurationPerBudgetItem[cleanId] || 1;
            weight = (activityDuration / totalItemDuration) * itemTotalValue;
          } else {
            weight = a.duracao_dias || 1;
          }

          totalProgressoPonderado += (a.progresso || 0) * weight;
          totalValorProjeto += weight;
        });

        const weightedProgresso = totalValorProjeto > 0 ? Math.round(totalProgressoPonderado / totalValorProjeto) : 0;
        const duracaoDias = (minInicioPrev && maxFimPrev) ? countWorkingDays(minInicioPrev, maxFimPrev) : 0;

        return {
          data_inicio_prevista: minInicioPrev ? format(minInicioPrev, 'yyyy-MM-dd') : null,
          data_fim_prevista: maxFimPrev ? format(maxFimPrev, 'yyyy-MM-dd') : null,
          data_inicio_real: obraData?.data_inicio_real || (minInicioReal ? format(minInicioReal, 'yyyy-MM-dd') : null),
          data_fim_real: maxFimReal ? format(maxFimReal, 'yyyy-MM-dd') : null,
          data_inicio_base: minInicioBase ? format(minInicioBase, 'yyyy-MM-dd') : null,
          data_fim_base: maxFimBase ? format(maxFimBase, 'yyyy-MM-dd') : null,
          data_inicio_atual: minCurrentInicio ? format(minCurrentInicio, 'yyyy-MM-dd') : null,
          data_fim_atual: maxCurrentFim ? format(maxCurrentFim, 'yyyy-MM-dd') : null,
          duracao_dias: duracaoDias,
          progresso: weightedProgresso
        };
      };

      // 1. Collect all stages from budget
      orcamentoItens.forEach(item => {
        if (item.tipo === 'etapa') {
          const rawId = item.id;
          let etapaId: number | string | null = null;
          if (typeof rawId === 'number') etapaId = rawId;
          else if (typeof rawId === 'string' && rawId) {
            if (rawId.startsWith('etapa-')) {
              etapaId = parseInt(rawId.replace('etapa-', ''), 10);
            } else {
              const match = rawId.match(/\d+/);
              if (match) etapaId = parseInt(match[0], 10);
              else etapaId = rawId;
            }
          }
          
          const itemNum = (item.item || '').trim();
          
          if (etapaId !== null && !addedStages.has(etapaId)) {
            addedStages.add(etapaId);
            
            const aggs = getStageAggregations(etapaId, itemNum);
            rows.push({
              type: 'stage',
              id: etapaId,
              item: itemNum,
              data: {
                nome: (item.descricao || `Etapa ${etapaId}`).toUpperCase(),
                item: itemNum,
                id: etapaId,
                valor: (item as any).total || 0,
                ...aggs
              }
            });
          }
        }
      });

      // 2. Add all activities
      currentAtividades.forEach(atv => {
        if (!addedActivities.has(atv.id) && atv.id !== -999) {
          addedActivities.add(atv.id);
          rows.push({
            type: 'activity',
            id: atv.id,
            item: (atv.item_numero || '').trim(),
            data: atv
          });
        }
      });

      // 3. Handle activities without stages or stages not in budget
      currentAtividades.forEach(atv => {
        if (atv.etapa_id && !addedStages.has(atv.etapa_id)) {
          let inferredItem = '';
          if (atv.item_numero && atv.item_numero.includes('.')) {
            inferredItem = atv.item_numero.split('.').slice(0, -1).join('.');
          }
          
          // Only add stage if no activity exists with the same item number
          const hasActivity = currentAtividades.some(a => a.item_numero?.trim() === inferredItem.trim());
          
          addedStages.add(atv.etapa_id);
          
          const aggs = getStageAggregations(atv.etapa_id, inferredItem);
          rows.push({
            type: 'stage',
            id: atv.etapa_id,
            item: inferredItem.trim(),
            data: {
              nome: (atv.etapa_nome || `Etapa ${atv.etapa_id}`).toUpperCase(),
              item: inferredItem.trim(),
              id: atv.etapa_id,
              ...aggs
            }
          });
        }
      });

      // 4. Sort everything by code
      rows.sort((a, b) => {
        const res = sortCodes(a.item, b.item);
        if (res !== 0) return res;
        if (a.type === 'stage' && b.type === 'activity') return -1;
        if (a.type === 'activity' && b.type === 'stage') return 1;
        return 0;
      });

      // Filter rows for month view: display only stages (resumo)
      if (viewMode === 'month') {
        rows = rows.filter(r => r.type === 'stage');
      }

      // 5. Build final list with adding rows and map task IDs
      const finalRows: any[] = [];
      const map: Record<string, number> = {};
      
      // Calculate Project Summary Data
      const projectAggs = getProjectAggregations();
      const totalOrcado = orcamentoItens.reduce((sum, item) => {
          if (item.tipo === 'item' || (item.id && String(item.id).startsWith('item-'))) {
              return sum + ((item as any).total || 0);
          }
          return sum;
      }, 0);
      
      const projectSummaryData = {
          nome: (obraData?.nome || 'RESUMO GERAL').toUpperCase(),
          item: '0',
          valor: obraData?.valor_total || totalOrcado || 0,
          ...projectAggs
      };

      // Project Summary is now strictly for the Header
      map['project-summary'] = -1;
      
      let currentRow = 0;

      rows.forEach((row, index) => {
        currentRow++;
        finalRows.push(row);
        if (row.type === 'activity') {
          map[`activity-${row.id}`] = currentRow - 1;
        } else if (row.type === 'stage') {
          map[`stage-${row.id}`] = currentRow - 1;
        }

        if (isAdding && addingAfterId === row.id && addingAfterType === row.type) {
          finalRows.push({ 
            type: 'adding', 
            id: 'adding', 
            item: editForm.item_numero || '', 
            data: { ...editForm, id: -999, nome: editForm.nome || 'Nova Atividade' } 
          });
          currentRow++;
        }
      });

      if (isAdding && !addingAfterId) {
        finalRows.push({ 
          type: 'adding', 
          id: 'adding', 
          item: editForm.item_numero || '', 
          data: { ...editForm, id: -999, nome: editForm.nome || 'Nova Atividade' } 
        });
        currentRow++;
      }

      return { allRows: finalRows, taskRowMap: map, projectSummaryData };
    }, [atividades, orcamentoItens, isAdding, editForm, addingAfterId, addingAfterType, obraData, viewMode, editingId, itemValuesMap]);


  // 2. Generate columns based on viewMode
  const columns = useMemo(() => {
    let allDays: Date[] = [];
    if (viewMode === 'day') {
      allDays = eachDayOfInterval({ start: projectStart, end: projectEnd });
      // Do not filter out non-working days anymore, as requested by the user
      return allDays;
    } else if (viewMode === 'week') {
      return eachWeekOfInterval({ start: projectStart, end: projectEnd }, { weekStartsOn: 0 });
    } else {
      return eachMonthOfInterval({ start: projectStart, end: projectEnd });
    }
  }, [projectStart, projectEnd, viewMode, cronogramaConfig]);

  useEffect(() => {
    if (timelineRef.current && columns.length > 0 && !hasInitialScrolled) {
      const today = new Date();
      let scrollLeft = 0;
      
      const scrollContainer = timelineRef.current;
      const totalWidth = scrollContainer.scrollWidth;
      
      if (viewMode === 'day') {
        const todayIndex = columns.findIndex(d => isSameDay(d, today));
        if (todayIndex !== -1) {
          scrollLeft = (todayIndex / columns.length) * totalWidth;
        } else {
          scrollLeft = totalWidth / 2;
        }
      } else {
        scrollLeft = totalWidth / 2;
      }
      
      scrollContainer.scrollTo({
        left: scrollLeft - scrollContainer.clientWidth / 2,
        behavior: 'auto'
      });
      setHasInitialScrolled(true);
    }
  }, [columns, hasInitialScrolled, viewMode]);

  const todayLine = useMemo(() => {
    const today = new Date();
    if (isBefore(today, projectStart) || isAfter(today, projectEnd)) return null;
    
    if (viewMode === 'day') {
      const todayIndex = columns.findIndex(d => isSameDay(d, today));
      if (todayIndex === -1) {
        // Se hoje não for dia útil, mostra a linha no início do próximo dia útil
        const nextIndex = columns.findIndex(d => isAfter(d, today));
        if (nextIndex === -1) return null;
        return (nextIndex / columns.length) * 100;
      }
      return (todayIndex / columns.length) * 100;
    }

    const totalDuration = differenceInDays(projectEnd, projectStart) + 1;
    const todayOffset = differenceInDays(today, projectStart);
    return (todayOffset / totalDuration) * 100;
  }, [projectStart, projectEnd, columns, viewMode]);

  const todayColumnIndex = useMemo(() => {
    const today = new Date();
    if (isBefore(today, projectStart) || isAfter(today, projectEnd)) return -1;
    if (viewMode === 'day') {
      return columns.findIndex(d => isSameDay(d, today));
    } else if (viewMode === 'week') {
      return columns.findIndex(d => isSameDay(startOfWeek(d, { weekStartsOn: 1 }), startOfWeek(today, { weekStartsOn: 1 })));
    } else if (viewMode === 'month') {
      return columns.findIndex(d => isSameMonth(d, today) && isSameYear(d, today));
    }
    return -1;
  }, [projectStart, projectEnd, columns, viewMode]);

  // 3. Generate Headers (Top and Bottom)
  const headers = useMemo(() => {
    const topHeaders: { label: string; colSpan: number }[] = [];
    
    if (columns.length === 0) return { topHeaders: [], bottomHeaders: [] };

    if (viewMode === 'day') {
      // Group by Month
      let currentMonth = columns[0];
      let colSpan = 0;
      columns.forEach((col, index) => {
        if (isSameMonth(col, currentMonth)) {
          colSpan++;
        } else {
          topHeaders.push({ label: format(currentMonth, 'MMMM yyyy', { locale: ptBR }), colSpan });
          currentMonth = col;
          colSpan = 1;
        }
        if (index === columns.length - 1) {
          topHeaders.push({ label: format(currentMonth, 'MMMM yyyy', { locale: ptBR }), colSpan });
        }
      });
    } else if (viewMode === 'week') {
      // Group by Month
      let currentMonth = columns[0];
      let colSpan = 0;
      columns.forEach((col, index) => {
        if (isSameMonth(col, currentMonth)) {
          colSpan++;
        } else {
          topHeaders.push({ label: format(currentMonth, 'MMMM yyyy', { locale: ptBR }), colSpan });
          currentMonth = col;
          colSpan = 1;
        }
        if (index === columns.length - 1) {
          topHeaders.push({ label: format(currentMonth, 'MMMM yyyy', { locale: ptBR }), colSpan });
        }
      });
    } else if (viewMode === 'month') {
      // Group by Year
      let currentYear = columns[0];
      let colSpan = 0;
      columns.forEach((col, index) => {
        if (isSameYear(col, currentYear)) {
          colSpan++;
        } else {
          topHeaders.push({ label: format(currentYear, 'yyyy', { locale: ptBR }), colSpan });
          currentYear = col;
          colSpan = 1;
        }
        if (index === columns.length - 1) {
          topHeaders.push({ label: format(currentYear, 'yyyy', { locale: ptBR }), colSpan });
        }
      });
    }

    return { topHeaders, bottomHeaders: columns };
  }, [columns, viewMode]);

  // Calculate position and width for a task bar
  const getTaskStyle = (taskStart: string | Date | undefined, taskEnd: string | Date | undefined) => {
    if (!taskStart || !taskEnd) return { display: 'none' };
    
    const start = typeof taskStart === 'string' ? parseDate(taskStart) : taskStart;
    const end = typeof taskEnd === 'string' ? parseDate(taskEnd) : taskEnd;
    
    if (!isValid(start) || !isValid(end)) return { display: 'none' };

    // Clamping helper for week/month/day
    const clampToColumns = (s: Date, e: Date, totalUnits: number, getUnitIndex: (d: Date) => number, isContinuous = false) => {
      let startIndex = getUnitIndex(s);
      let endIndex = getUnitIndex(e);

      if (isContinuous) {
          // Precise fractional calculation for weeks/months
          const chartStart = columns[0].getTime();
          // Adjust chartEnd based on viewMode
          let chartEnd;
          if (viewMode === 'week') chartEnd = addDays(columns[columns.length - 1], 7).getTime();
          else if (viewMode === 'month') chartEnd = endOfMonth(columns[columns.length - 1]).getTime();
          else chartEnd = addDays(columns[columns.length - 1], 1).getTime();

          const totalMs = chartEnd - chartStart;
          const sMs = s.getTime();
          const eMs = e.getTime();

          if (sMs > chartEnd || eMs < chartStart) return { display: 'none' };

          const left = Math.max(0, ((sMs - chartStart) / totalMs) * 100);
          const width = Math.min(100 - left, ((eMs - Math.max(sMs, chartStart)) / totalMs) * 100);

          return { left: `${left}%`, width: `${width}%`, display: 'block' };
      } else {
          // Discrete calculation for Working Days
          if (startIndex === -1) {
            if (isBefore(s, columns[0])) startIndex = 0;
            else startIndex = columns.findIndex(d => isAfter(d, s));
          }
          
          if (endIndex === -1) {
            if (isAfter(e, columns[columns.length - 1])) endIndex = columns.length - 1;
            else {
              for (let i = columns.length - 1; i >= 0; i--) {
                if (isBefore(columns[i], e) || isSameDay(columns[i], e)) {
                  endIndex = i;
                  break;
                }
              }
            }
          }

          if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) return { display: 'none' };

          const left = (startIndex / columns.length) * 100;
          const width = ((endIndex - startIndex + 1) / columns.length) * 100;

          return { left: `${left}%`, width: `${width}%`, display: 'block' };
      }
    };

    if (viewMode === 'day') {
      return clampToColumns(start, end, columns.length, (d) => columns.findIndex(col => isSameDay(col, d)), false);
    } else {
      return clampToColumns(start, end, columns.length, () => -1, true);
    }
  };

  // --- Cálculo da Linha de Base Histograma (Conexão Contínua) ---
  const baselineConnectLine = useMemo(() => {
    const segments: string[] = [];
    allRows.forEach((row, idx) => {
      let data = null;
      let y = idx * 40;
      
      if (row.type === 'stage') {
        data = row.data;
        y += 28; // stage baseline y
      } else if (row.type === 'activity') {
        data = row.data;
        y += 30; // activity baseline y
      }
      
      if (data && data.data_inicio_base && data.data_fim_base) {
        const style = getTaskStyle(data.data_inicio_base, data.data_fim_base) as any;
        if (style.display !== 'none') {
          const left = parseFloat(style.left as string);
          const width = parseFloat(style.width as string);
          const xStart = left;
          const xEnd = left + width;
          
          if (segments.length === 0) {
            segments.push(`M ${xStart}% ${y}`);
          } else {
            // Histograma/Staircase logic: 
            // 1. Linha vertical do Y anterior para o Y atual na posição do fim da barra anterior
            // 2. Linha horizontal do fim da barra anterior para o início da barra atual
            const lastPart = segments[segments.length - 1];
            const lastXEnd = lastPart.split(' ')[1];
            segments.push(`L ${lastXEnd} ${y}`); 
            segments.push(`L ${xStart}% ${y}`);
          }
          segments.push(`L ${xEnd}% ${y}`);
        }
      }
    });
    return segments.length > 0 ? segments.join(' ') : null;
  }, [allRows, columns, viewMode, projectStart, projectEnd]);

  if (loading) return <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest">Carregando cronograma...</div>;

  return (
    <div className="flex flex-col">
      <div className={`flex flex-col transition-all duration-300 ${isFullscreen ? 'fixed top-0 bottom-0 right-0 z-[55] bg-white p-0 gap-0 overflow-y-auto' : 'bg-transparent gap-4'}`}
        style={isFullscreen ? { left: 'var(--sidebar-width, 208px)' } : {}}
      >
        <div className={`flex flex-col flex-1 ${isFullscreen ? 'pt-6 pb-6 pr-6' : ''}`}>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 flex items-center gap-2 text-xs font-bold font-sans">
            <AlertTriangle size={14} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              <X size={14} />
            </button>
          </div>
        )}

        <CronogramaHeader 
          obraData={obraData}
          handleUpdateObraExecutionStart={handleUpdateObraExecutionStart}
          handlePrint={handlePrint}
          scrollToToday={scrollToToday}
          hasBaseline={hasBaseline}
          handleCreateBaseline={handleCreateBaseline}
          isApplyingBaseline={isApplyingBaseline}
          handleClearBaseline={handleClearBaseline}
          showBaselineSuccess={showBaselineSuccess}
          showClearBaselineConfirm={showClearBaselineConfirm}
          setShowClearBaselineConfirm={setShowClearBaselineConfirm}
          onSettingsClick={() => setIsConfigOpen(true)}
          showCriticalPath={showCriticalPath}
          toggleCriticalPath={toggleCriticalPath}
          viewMode={viewMode}
          setViewMode={setViewMode}
          isFullscreen={isFullscreen}
          setIsFullscreen={setIsFullscreen}
        />

        <AnimatePresence>
          {showBaselineSuccess && (
            <motion.div 
              key="baseline-success-alert"
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="fixed bottom-8 right-8 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[2500]"
            >
              <CheckCircle size={20} />
              <span className="font-bold">Linha de base aplicada com sucesso!</span>
            </motion.div>
          )}

          {successMessage && (
            <motion.div 
              key="success-toast"
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="fixed bottom-8 right-8 bg-slate-800 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[2500]"
            >
              {successMessage.includes('excluído') ? (
                <Trash2 size={20} className="text-red-400" />
              ) : (
                <CheckCircle size={20} className="text-emerald-400" />
              )}
              <span className="font-bold">{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

      <div className="px-5 py-2.5 bg-white rounded-2xl border border-slate-200 flex flex-wrap items-center gap-x-8 gap-y-2 text-[10px] font-black uppercase tracking-widest text-slate-400 shadow-sm">
        {atividades.some((a) => a.data_inicio_base) && (
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-1.5 bg-slate-300 rounded-full opacity-60"></div>
            <span>Linha de Base (Original)</span>
          </div>
        )}
        {atividades.some((a) => a.data_inicio_base) && (
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-3 bg-emerald-600 rounded-sm"></div>
            <span>Real (Execução)</span>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-2 border border-indigo-300 bg-indigo-50/50 rounded-sm"></div>
          <span>Planejado (Reprogramado)</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-3 bg-red-600 rounded-sm"></div>
          <span>Atraso</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 border border-indigo-300 rotate-45"></div>
          <span>Marco Previsto</span>
        </div>
        {/* Focus Navigation Shortcuts */}
        <div className="flex items-center gap-1.5 ml-auto border-l border-slate-200 pl-8 h-full py-1">
          <span className="text-[9px] text-slate-500 mr-1">Otimizar:</span>
          <button 
            onClick={() => setLeftPaneWidth(1275)}
            className="px-2 py-1 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-500 transition-all border border-slate-200 flex items-center gap-1.5"
            title="Focar na Tabela"
          >
            <Maximize2 size={10} />
            Tabela
          </button>
          <button 
            onClick={() => setLeftPaneWidth(Math.max(600, (containerRef.current?.offsetWidth || 1200) * 0.5))}
            className="px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all border border-slate-200"
            title="Visão Equilibrada"
          >
            Original
          </button>
          <button 
            onClick={() => setLeftPaneWidth(400)}
            className="px-2 py-1 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-500 transition-all border border-slate-200 flex items-center gap-1.5"
            title="Focar no Gráfico"
          >
            Gráfico
            <Maximize2 size={10} />
          </button>
        </div>
      </div>

      {/* Gantt Chart Container */}
      <div 
        ref={containerRef}
        className="bg-white flex flex-col flex-1 rounded-2xl border border-slate-200 shadow-sm mt-4 overflow-hidden relative" 
      >
        <div className="flex flex-row flex-1 overflow-hidden custom-scrollbar">
          {/* Left Pane: Task List */}
          <div 
            ref={taskListRef}
            onMouseDown={(e) => {
              setFocusedSection('table');
              taskListDragScroll.onMouseDown(e);
            }}
            onMouseMove={taskListDragScroll.onMouseMove}
            onMouseUp={taskListDragScroll.onMouseUp}
            onMouseLeave={taskListDragScroll.onMouseLeave}
            onScroll={handleTaskListScroll}
            className={`flex-shrink-0 bg-white overflow-auto gantt-scroll-container custom-scrollbar border-r border-slate-200 transition-shadow duration-300 relative z-20 ${
              focusedSection === 'table' ? 'shadow-[4px_0_12px_-2px_rgba(79,70,229,0.2)]' : 'shadow-[2px_0_8px_-2px_rgba(0,0,0,0.1)]'
            }`} 
            style={{ width: `${leftPaneWidth}px`, height: '100%' }}
          >
            <div className="w-[1275px] max-w-[1275px] min-w-min relative">
                {/* Header structure: Row 1 Labels, Row 2 Project Summary */}
                <div className="h-16 border-b border-slate-200 sticky top-0 z-50 w-full flex flex-col bg-slate-800">
                  {/* Row 1: Labels */}
                  <div className="h-8 border-b border-slate-700/30 flex w-full text-[10px] font-bold text-white uppercase tracking-wider items-center">
                    <div className="w-[100px] flex-shrink-0 text-center sticky left-0 bg-slate-800 z-[70] flex items-center justify-center border-r border-slate-700/50 h-full">Item</div>
                    <div className="w-[300px] flex-shrink-0 text-left sticky left-[100px] bg-slate-800 z-[70] shadow-[4px_0_4px_-2px_rgba(0,0,0,0.3)] flex items-center px-3 border-r border-slate-700/50 h-full">Atividade</div>
                    <div className="flex items-center h-full">
                      <div className="w-[100px] flex-shrink-0 text-center px-1 border-r border-slate-700/50 h-full flex items-center justify-center">Duração</div>
                      <div className="w-[100px] flex-shrink-0 text-center px-1 border-r border-slate-700/50 h-full flex items-center justify-center">Início</div>
                      <div className="w-[100px] flex-shrink-0 text-center px-1 border-r border-slate-700/50 h-full flex items-center justify-center">Fim</div>
                      <div className="w-[100px] flex-shrink-0 text-center px-1 border-r border-slate-700/50 h-full flex items-center justify-center">Pred.</div>
                      <div className="w-[60px] flex-shrink-0 text-center px-1 font-bold border-r border-slate-700/50 h-full flex items-center justify-center">%</div>
                      <div className="w-[100px] flex-shrink-0 text-center px-1 border-r border-slate-700/50 h-full flex items-center justify-center">Início Real</div>
                      <div className="w-[100px] flex-shrink-0 text-center px-1 border-r border-slate-700/50 h-full flex items-center justify-center">Término Real</div>
                      <div className="w-[140px] flex-shrink-0 text-center px-1 border-r border-slate-700/50 h-full flex items-center justify-center">Recurso</div>
                      <div className="w-[75px] flex-shrink-0 text-center px-1 uppercase tracking-tighter border-r border-slate-700/50 h-full flex items-center justify-center">Marco</div>
                    </div>
                  </div>

                  {/* Row 2: Project Summary Aligned with Sub-Header */}
                  <div className="h-8 flex w-full text-[11px] font-black text-white items-center bg-slate-900/95 backdrop-blur-sm border-b border-white/5">
                    <div className="w-[100px] flex-shrink-0 text-center sticky left-0 bg-slate-900 z-[70] flex items-center justify-center border-r border-white/10 h-full text-emerald-500">0</div>
                    <div className="w-[300px] flex-shrink-0 text-left sticky left-[100px] bg-slate-900 z-[70] shadow-[4px_0_4px_-2px_rgba(0,0,0,0.5)] flex items-center px-3 border-r border-white/10 h-full truncate text-emerald-50">
                      {projectSummaryData.nome}
                    </div>
                    <div className="flex items-center h-full">
                       <div className="w-[100px] flex-shrink-0 text-center px-1 border-r border-white/5 h-full flex items-center justify-center text-slate-300">{projectSummaryData.duracao_dias}</div>
                       <div className="w-[100px] flex-shrink-0 text-center px-1 border-r border-white/5 h-full flex items-center justify-center text-slate-300 font-bold">{projectSummaryData.data_inicio_prevista ? format(parseDate(projectSummaryData.data_inicio_prevista), 'dd/MM/yyyy') : '-'}</div>
                       <div className="w-[100px] flex-shrink-0 text-center px-1 border-r border-white/5 h-full flex items-center justify-center text-slate-300 font-bold">{projectSummaryData.data_fim_prevista ? format(parseDate(projectSummaryData.data_fim_prevista), 'dd/MM/yyyy') : '-'}</div>
                       <div className="w-[100px] flex-shrink-0 text-center px-1 border-r border-white/5 h-full flex items-center justify-center text-slate-500 font-normal">-</div>
                       <div className="w-[60px] flex-shrink-0 text-center px-1 border-r border-white/5 h-full flex items-center justify-center font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">{projectSummaryData.progresso}%</div>
                       <div className="w-[100px] flex-shrink-0 text-center px-1 border-r border-white/5 h-full flex items-center justify-center text-slate-500 font-normal">-</div>
                       <div className="w-[100px] flex-shrink-0 text-center px-1 border-r border-white/5 h-full flex items-center justify-center text-slate-500 font-normal">-</div>
                       <div className="w-[140px] flex-shrink-0 text-center px-1 border-r border-white/5 h-full flex items-center justify-center text-slate-500 font-normal">-</div>
                       <div className="w-[75px] flex-shrink-0 text-center px-1 h-full flex items-center justify-center text-slate-500 font-normal">-</div>
                    </div>
                  </div>
                </div>
              
              <div className="relative" style={{ height: allRows.length * 40 }}>
                {allRows.map((row, idx) => {
                  const rowTop = idx * 40;
                  const isStage = row.type === 'stage' || row.type === 'summary';
                  const isSummary = row.type === 'summary';
                  const isAddingRow = row.type === 'adding';
                  const d = row.data as any;
                  const fontClass = isStage ? (isSummary ? 'font-black bg-slate-100 text-slate-900 border-b-2 border-slate-300' : 'font-bold bg-slate-50') : 'bg-white hover:bg-slate-50 transition-colors';
                  
                  const isEditing = (editingId === d.id && !isStage && !isAddingRow) || isAddingRow;
                  const isEditingStage = (editingId === d.id && isStage && !isSummary);

                  return (
                    <div 
                      key={`left-row-${isAddingRow ? 'adding' : d.id}-${idx}`}
                      onMouseEnter={(e) => {
                        if (!isResizing && !editingId && !isAdding) {
                          setHoveredRowId(isAddingRow ? 'adding' : d.id);
                          setHoveredRowType(row.type);
                          setHoveredRowData(d);
                          
                          // Balloon is fixed horizontally to the start of the item column
                          if (containerRef.current) {
                            const rect = containerRef.current.getBoundingClientRect();
                            const rowRect = e.currentTarget.getBoundingClientRect();
                            setBubblePos({
                               x: rect.left, 
                               y: rowRect.top + rowRect.height / 2
                            });
                          }
                        }
                      }}
                      onMouseMove={(e) => {
                         if (hoveredRowId !== null && !editingId && containerRef.current) {
                            const rect = containerRef.current.getBoundingClientRect();
                            const rowRect = e.currentTarget.getBoundingClientRect();
                            setBubblePos({
                               x: rect.left,
                               y: rowRect.top + rowRect.height / 2
                            });
                         }
                      }}
                      onMouseLeave={() => setHoveredRowId(null)}
                      className={`absolute left-0 right-0 h-10 border-b border-slate-200 flex items-center w-full text-[11px] ${fontClass} ${isStage ? 'bg-slate-200' : ''} ${isAddingRow ? 'bg-indigo-50/50' : ''}`}
                      style={{ top: rowTop }}
                    >
                      <div className={`w-[100px] h-full flex-shrink-0 text-center sticky left-0 z-40 flex items-center justify-center p-1 ${isStage ? 'bg-slate-200 font-bold' : 'bg-white'} ${isAddingRow ? 'bg-indigo-50/50' : ''}`}>
                        {isAddingRow ? (
                          <span className="text-indigo-600 font-bold">{editForm.item_numero}</span>
                        ) : (
                          d.item_numero || row.item
                        )}
                      </div>
                      
                      <div 
                        onClick={() => {
                          if (isSummary) return;
                          if (isStage) {
                            setEditingId(d.id);
                            setEditingField('nome');
                            setEditForm({ ...d });
                          } else {
                            startEdit(d, 'nome');
                          }
                        }}
                        className={`w-[300px] h-full flex-shrink-0 text-left sticky left-[100px] z-40 shadow-[4px_0_4px_-2px_rgba(0,0,0,0.1)] flex items-center px-3 cursor-text ${isStage ? 'bg-slate-200 font-bold uppercase tracking-tight' : 'bg-white'} ${isAddingRow ? 'bg-indigo-50/50' : ''}`}
                      >
                        {(isEditing || isEditingStage) ? (
                          <input
                            className="w-full text-[11px] px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 font-normal outline-none bg-white font-sans text-slate-800"
                            value={editForm.nome || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, nome: e.target.value }))}
                            onKeyDown={(e) => handleKeyDown(e, d.id)}
                            onBlur={() => (isEditingStage ? handleUpdateEtapa(d.id) : handleUpdate(d.id, true))}
                            autoFocus={editingField === 'nome'}
                            placeholder={isStage ? "Nome da Etapa" : "Nome da Atividade"}
                          />
                        ) : (
                          <span className="truncate">{d.nome || d.atividade}</span>
                        )}
                      </div>

                      <div className="flex items-center h-full">
                        <div className="w-[100px] flex-shrink-0 text-center px-1 h-full flex items-center justify-center cursor-pointer" onClick={() => !isStage && startEdit(d, 'duracao')}>
                          {isEditing ? (
                              <input
                                  type="number"
                                  className="w-full text-center text-[11px] px-1 py-1 border border-indigo-300 rounded focus:outline-none font-normal"
                                  value={editForm.duracao_dias !== undefined ? editForm.duracao_dias : ''}
                                  onChange={(e) => handleDuracaoChange(e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, d.id)}
                                  onBlur={() => handleUpdate(d.id, true)}
                                  autoFocus={editingField === 'duracao'}
                              />
                          ) : (
                             <span className="truncate">{d.duracao_dias}</span>
                          )}
                        </div>

                        <div className="w-[100px] flex-shrink-0 text-center px-1 h-full flex items-center justify-center cursor-pointer" onClick={() => !isStage && startEdit(d, 'inicio')}>
                          {isEditing ? (
                              <input
                                  type="date"
                                  className="w-full text-center text-[10px] px-0.5 py-1 border border-indigo-300 rounded focus:outline-none font-normal"
                                  value={editForm.data_inicio_prevista || ''}
                                  onChange={(e) => handleDataInicioChange(e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, d.id)}
                                  onBlur={() => handleUpdate(d.id, true)}
                                  autoFocus={editingField === 'inicio'}
                              />
                          ) : (
                             <span className="truncate">{d.data_inicio_prevista ? format(parseDate(d.data_inicio_prevista), 'dd/MM/yyyy') : ''}</span>
                          )}
                        </div>

                        <div className="w-[100px] flex-shrink-0 text-center px-1 h-full flex items-center justify-center cursor-pointer" onClick={() => !isStage && startEdit(d, 'fim')}>
                           {isEditing ? (
                              <input
                                  type="date"
                                  className="w-full text-center text-[10px] px-0.5 py-1 border border-indigo-300 rounded focus:outline-none font-normal disabled:bg-slate-100 disabled:text-slate-500"
                                  value={editForm.data_fim_prevista || ''}
                                  onChange={(e) => handleDataFimChange(e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, d.id)}
                                  onBlur={() => handleUpdate(d.id, true)}
                                  autoFocus={editingField === 'fim'}
                                  disabled={(!editForm.is_marco && editForm.duracao_dias !== "" && editForm.duracao_dias !== undefined && editForm.duracao_dias !== 0)}
                              />
                          ) : (
                             <span className="truncate">{d.data_fim_prevista ? format(parseDate(d.data_fim_prevista), 'dd/MM/yyyy') : ''}</span>
                          )}
                        </div>

                        <div className="w-[100px] flex-shrink-0 text-center px-1 h-full flex items-center justify-center cursor-pointer" onClick={() => !isStage && startEdit(d, 'pred')}>
                           {isEditing ? (
                              <input
                                  className="w-full text-center text-[11px] px-1 py-1 border border-indigo-300 rounded focus:outline-none font-normal"
                                  value={editForm.predecessores_texto || ''}
                                  onChange={(e) => handlePredecessoresTextoChange(e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, d.id)}
                                  onBlur={() => handleUpdate(d.id, true)}
                                  autoFocus={editingField === 'pred'}
                                  placeholder="Ex: 2FS+3"
                              />
                           ) : (
                              <span className="truncate">{d.predecessores_texto || ''}</span>
                           )}
                        </div>

                        <div className="w-[60px] flex-shrink-0 text-center px-1 font-bold text-slate-500 h-full flex items-center justify-center cursor-pointer" onClick={() => !isStage && startEdit(d, 'progresso')}>
                           {isEditing ? (
                              <input
                                  type="number"
                                  className="w-full text-center text-[11px] px-1 py-1 border border-indigo-300 rounded focus:outline-none font-normal"
                                  value={editForm.progresso !== undefined ? editForm.progresso : ''}
                                  onChange={(e) => setEditForm(prev => ({...prev, progresso: parseFloat(e.target.value) || 0 }))}
                                  onKeyDown={(e) => handleKeyDown(e, d.id)}
                                  onBlur={() => handleUpdate(d.id, true)}
                                  autoFocus={editingField === 'progresso'}
                              />
                           ) : (
                              <span className="truncate">{(d.progresso != null ? `${d.progresso}%` : '0%')}</span>
                           )}
                        </div>
                        
                        <div className="w-[100px] flex-shrink-0 text-center px-1 h-full flex items-center justify-center cursor-pointer" onClick={() => !isStage && startEdit(d, 'inicioreal')}>
                           {isEditing ? (
                              <input
                                  type="date"
                                  className="w-full text-center text-[10px] px-0.5 py-1 border border-indigo-300 rounded focus:outline-none font-normal"
                                  value={editForm.data_inicio_real || ''}
                                  onChange={(e) => setEditForm(prev => ({...prev, data_inicio_real: e.target.value }))}
                                  onKeyDown={(e) => handleKeyDown(e, d.id)}
                                  onBlur={() => handleUpdate(d.id, true)}
                                  autoFocus={editingField === 'inicioreal'}
                              />
                           ) : (
                              <span className="truncate">{d.data_inicio_real ? format(parseDate(d.data_inicio_real), 'dd/MM/yyyy') : ''}</span>
                           )}
                        </div>

                        <div className="w-[100px] flex-shrink-0 text-center px-1 h-full flex items-center justify-center cursor-pointer" onClick={() => !isStage && startEdit(d, 'fimreal')}>
                           {isEditing ? (
                              <input
                                  type="date"
                                  className="w-full text-center text-[10px] px-0.5 py-1 border border-indigo-300 rounded focus:outline-none font-normal"
                                  value={editForm.data_fim_real || ''}
                                  onChange={(e) => setEditForm(prev => ({...prev, data_fim_real: e.target.value }))}
                                  onKeyDown={(e) => handleKeyDown(e, d.id)}
                                  onBlur={() => handleUpdate(d.id, true)}
                                  autoFocus={editingField === 'fimreal'}
                              />
                           ) : (
                              <span className="truncate">{d.data_fim_real ? format(parseDate(d.data_fim_real), 'dd/MM/yyyy') : ''}</span>
                           )}
                        </div>

                        <div className="w-[140px] flex-shrink-0 text-center px-1 text-slate-500 h-full flex items-center justify-center cursor-pointer" onClick={() => !isStage && startEdit(d, 'recurso')}>
                           {isEditing ? (
                              <input
                                  className="w-full text-center text-[11px] px-1 py-1 border border-indigo-300 rounded focus:outline-none font-normal text-slate-800"
                                  value={editForm.recurso || ''}
                                  onChange={(e) => setEditForm(prev => ({...prev, recurso: e.target.value }))}
                                  onKeyDown={(e) => handleKeyDown(e, d.id)}
                                  onBlur={() => handleUpdate(d.id, true)}
                                  autoFocus={editingField === 'recurso'}
                                  placeholder="Recurso principal"
                              />
                           ) : (
                              <span className="truncate">{d.recurso || ''}</span>
                           )}
                        </div>
                        
                        <div className="w-[75px] flex-shrink-0 text-center px-1 font-bold text-orange-500 h-full flex items-center justify-center cursor-pointer" onClick={() => !isStage && startEdit(d, 'marco')}>
                           {isEditing ? (
                              <select
                                  className="w-full text-center text-[11px] px-1 py-1 border border-indigo-300 rounded focus:outline-none font-normal text-slate-800 bg-white"
                                  value={editForm.is_marco ? 'true' : 'false'}
                                  onChange={(e) => handleMarcoChange(e.target.value === 'true')}
                                  onKeyDown={(e) => handleKeyDown(e, d.id)}
                                  onBlur={() => handleUpdate(d.id, true)}
                                  autoFocus={editingField === 'marco'}
                              >
                                <option value="false">Não</option>
                                <option value="true">Sim</option>
                              </select>
                           ) : (
                              <span className="truncate">{d.is_marco ? 'Sim' : ''}</span>
                           )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Resizable Divider */}
          <div 
            className={`w-1 group flex-shrink-0 cursor-col-resize transition-colors relative z-[60] ${isResizing ? 'bg-indigo-500' : 'bg-slate-200 hover:bg-indigo-400'}`}
            onMouseDown={startResizing}
          >
            {/* Interaction area extension */}
            <div className="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize z-10" />
            
            {/* Visual indicator handle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 items-center z-20">
              <div className="w-0.5 h-0.5 rounded-full bg-slate-400 group-hover:bg-white" />
              <div className="w-0.5 h-0.5 rounded-full bg-slate-400 group-hover:bg-white" />
              <div className="w-0.5 h-0.5 rounded-full bg-slate-400 group-hover:bg-white" />
            </div>
          </div>
          
          {/* Right Pane: Timeline */}
          <div 
            ref={timelineRef}
            onMouseDown={(e) => {
              setFocusedSection('chart');
              timelineDragScroll.onMouseDown(e);
            }}
            onMouseMove={timelineDragScroll.onMouseMove}
            onMouseUp={timelineDragScroll.onMouseUp}
            onMouseLeave={timelineDragScroll.onMouseLeave}
            onScroll={handleTimelineScroll}
            className={`flex-1 relative bg-slate-50 overflow-auto gantt-scroll-container custom-scrollbar h-full transition-shadow duration-300 ${
              focusedSection === 'chart' ? 'shadow-[inset_4px_0_12px_-2px_rgba(79,70,229,0.1)]' : ''
            }`}
          >
            <div className="relative" style={{ width: columns.length > 0 ? `${columns.length * (viewMode === 'day' ? 40 : viewMode === 'week' ? 60 : 80)}px` : '100%' }}>
              <div className="h-16 border-b border-slate-200 sticky top-0 z-50 bg-slate-50 w-full flex flex-col">
                <div className="h-8 border-b border-slate-700/30 bg-slate-800 flex items-center w-full z-[51]">
                  {headers.topHeaders.map((header, idx) => (
                    <div 
                      key={`top-${idx}`} 
                      className="h-full border-r border-slate-700/50 flex items-center justify-center text-[10px] uppercase font-bold tracking-widest text-[#94a3b8] flex-shrink-0"
                      style={{ width: `${(header.colSpan / columns.length) * 100}%` }}
                    >
                      {header.label}
                    </div>
                  ))}
                </div>
                <div className="h-8 border-b border-slate-700/30 bg-slate-900 flex items-center w-full z-[51]">
                  {headers.bottomHeaders.map((col, idx) => (
                    <div 
                      key={`bottom-${idx}`} 
                      className="h-full border-r border-slate-700/50 flex flex-col items-center justify-center text-[10px] font-bold text-white relative shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] pt-0.5 flex-shrink-0 overflow-hidden"
                      style={{ width: `${(1 / columns.length) * 100}%` }}
                    >
                      {viewMode === 'day' ? format(col, 'd') : viewMode === 'week' ? `S${format(col, 'w')}` : format(col, 'MMM', { locale: ptBR })}
                      {viewMode === 'day' && <span className="text-[8px] text-slate-400 font-medium">{format(col, 'eeeee', { locale: ptBR })}</span>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative" style={{ height: allRows.length * 40 }}>
                {/* Non-working days highlight */}
                {viewMode === 'day' && columns.map((col, idx) => (
                  !isWorkingDay(col) ? (
                      <div 
                        key={`non-working-${idx}`}
                        className="absolute top-0 bottom-0 pointer-events-none bg-slate-400/40 z-[2]"
                        style={{ 
                          left: `${(idx / columns.length) * 100}%`, 
                          width: `${(1 / columns.length) * 100}%`
                        }}
                      />
                  ) : null
                ))}

              {/* Today Column Highlight (Solid) */}
              {todayColumnIndex !== -1 && (
                <div 
                  className="absolute top-0 bottom-0 z-30 pointer-events-none"
                  style={{ 
                    left: `${(todayColumnIndex / columns.length) * 100}%`, 
                    width: `${(1 / columns.length) * 100}%`,
                    backgroundColor: 'rgba(234, 179, 8, 0.25)', /* bg-yellow-500/25 */
                    borderLeft: '1px solid rgba(234, 179, 8, 0.6)',
                    borderRight: '1px solid rgba(234, 179, 8, 0.6)'
                  }}
                />
              )}

              {/* Dependency Lines */}
              <svg className="absolute inset-0 pointer-events-none z-20" style={{ width: '100%', height: allRows.length * 40 }}>
                <defs>
                  <marker
                    id="arrowhead-gray"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                  </marker>
                  <marker
                    id="arrowhead-blue"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#2563eb" />
                  </marker>
                  <marker
                    id="arrowhead-emerald"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#059669" />
                  </marker>
                  <marker
                    id="arrowhead-red"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
                  </marker>
                  <marker
                    id="arrowhead-black"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#1e293b" />
                  </marker>
                  <marker
                    id="arrowhead-indigo"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#4f46e5" />
                  </marker>
                  <marker
                    id="arrowhead-amber"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#d97706" />
                  </marker>
                </defs>
                
                {/* Linha de Base Histograma (Conexão Contínua) */}
                {baselineConnectLine && (
                  <path 
                    d={baselineConnectLine}
                    fill="none" 
                    stroke="#d97706" 
                    strokeWidth="1.5" 
                    strokeOpacity="0.4"
                    strokeDasharray="4 2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {viewMode !== 'month' && atividades.map((atv, idx) => {
                  const predText = atv.predecessores_texto || "";
                  const predecessors = atv.predecessors || [];
                  
                  // Use parsed predecessors from the activity object or parse from text if empty
                  let activePredecessors = predecessors;
                  if (activePredecessors.length === 0 && predText.trim() !== "") {
                    activePredecessors = resolvePredecessores(predText, atv.id).predecessors;
                  }

                  if (activePredecessors.length === 0 || !atv.data_inicio_prevista) return null;
                  
                  const dpLines = activePredecessors.map((p, pIdx) => {
                    const predId = p.id;
                    const predTypeRel = p.type || 'FS';
                    const lag = p.lag || 0;

                    // Find row for the predecessor (can be stage or activity)
                    let predRowRaw = taskRowMap[`activity-${predId}`];
                    let predType: 'activity' | 'stage' = 'activity';
                    
                    if (predRowRaw === undefined) {
                      predRowRaw = taskRowMap[`stage-${predId}`];
                      predType = 'stage';
                    }

                    const atvRowRaw = taskRowMap[`activity-${atv.id}`];

                    if (predRowRaw === undefined || atvRowRaw === undefined) return null;
                    
                    const predRow = predRowRaw;
                    const atvRow = atvRowRaw;
                    
                    const predRowObj = allRows[predRowRaw];
                    const pred = predRowObj?.data;
                    if (!pred || (!pred.data_fim_prevista && !pred.data_inicio_prevista)) return null;
                    
                    const isPredStage = predType === 'stage';
                    const plannedArrowColor = atv.data_inicio_base ? "#b45309" : (isPredStage ? "#1e293b" : "#6366f1");
                    const plannedMarker = atv.data_inicio_base ? "url(#arrowhead-amber)" : (isPredStage ? "url(#arrowhead-black)" : "url(#arrowhead-indigo)");

                    // --- PLANNED DEPENDENCY ---
                    const predPlannedStyle = getTaskStyle(pred.data_inicio_prevista, pred.data_fim_prevista) as any;
                    const atvPlannedStyle = getTaskStyle(atv.data_inicio_prevista, atv.data_fim_prevista) as any;
                    
                    let plannedLine = null;
                    if (predPlannedStyle.display !== 'none' && atvPlannedStyle.display !== 'none') {
                      const pLeft = parseFloat(predPlannedStyle.left as string);
                      const pWidth = parseFloat(predPlannedStyle.width as string);
                      const aLeft = parseFloat(atvPlannedStyle.left as string);
                      const aWidth = parseFloat(atvPlannedStyle.width as string);
                      
                      // Calculate sX and eX based on dependency type
                      let sX, eX;
                      if (predTypeRel === 'FS') { sX = pLeft + pWidth; eX = aLeft; }
                      else if (predTypeRel === 'SS') { sX = pLeft; eX = aLeft; }
                      else if (predTypeRel === 'FF') { sX = pLeft + pWidth; eX = aLeft + aWidth; }
                      else if (predTypeRel === 'SF') { sX = pLeft; eX = aLeft + aWidth; }
                      else { sX = pLeft + pWidth; eX = aLeft; }

                      const startX = `${sX}%`;
                      const endX = `${eX}%`;
                      
                      // Offset vertical center based on type
                      let startY = predRow * 40 + (isPredStage ? 16 : 15);
                      const endY = atvRow > predRow ? (atvRow * 40 + 9) : (atvRow * 40 + 21);
                      
                      const isBackward = eX < sX - 0.01;
                      
                      if (!isBackward) {
                        plannedLine = (
                          <g key={`dep-plan-${atv.id}-${predId}-${pIdx}`}>
                            <line x1={startX} y1={startY} x2={endX} y2={startY} stroke={plannedArrowColor} strokeWidth="1.2" />
                            <line x1={endX} y1={startY} x2={endX} y2={endY} stroke={plannedArrowColor} strokeWidth="1.2" markerEnd={plannedMarker} />
                          </g>
                        );
                      } else {
                        const midY = startY + (atvRow >= predRow ? 20 : -20);
                        const startStubX = `${sX + 0.2}%`;
                        const finalTargetY = atvRow > predRow ? atvRow * 40 + 9 : atvRow * 40 + 21;
                        
                        plannedLine = (
                          <g key={`dep-plan-${atv.id}-${predId}-${pIdx}`}>
                            <line x1={startX} y1={startY} x2={startStubX} y2={startY} stroke="#ef4444" strokeWidth="1.2" strokeDasharray="4 2" />
                            <line x1={startStubX} y1={startY} x2={startStubX} y2={midY} stroke="#ef4444" strokeWidth="1.2" strokeDasharray="4 2" />
                            <line x1={startStubX} y1={midY} x2={endX} y2={midY} stroke="#ef4444" strokeWidth="1.2" strokeDasharray="4 2" />
                            <line x1={endX} y1={midY} x2={endX} y2={finalTargetY} stroke="#ef4444" strokeWidth="1.2" strokeDasharray="4 2" markerEnd="url(#arrowhead-red)" />
                          </g>
                        );
                      }
                    }


                    // --- ACTUAL DEPENDENCY ---
                    let actualLine = null;
                    if (atv.data_inicio_base && pred.data_inicio_real && atv.data_inicio_real) {
                      const predStyle = getTaskStyle(pred.data_inicio_real, pred.data_fim_real || pred.data_inicio_real) as any;
                      const atvStyle = getTaskStyle(atv.data_inicio_real, atv.data_fim_real || atv.data_inicio_real) as any;
                      
                      if (predStyle.display !== 'none' && atvStyle.display !== 'none') {
                        const pLeft = parseFloat(predStyle.left as string);
                        const pWidth = parseFloat(predStyle.width as string);
                        const aLeft = parseFloat(atvStyle.left as string);
                        const aWidth = parseFloat(atvStyle.width as string);

                        let sX, eX;
                        if (predTypeRel === 'FS') { sX = pLeft + pWidth; eX = aLeft; }
                        else if (predTypeRel === 'SS') { sX = pLeft; eX = aLeft; }
                        else if (predTypeRel === 'FF') { sX = pLeft + pWidth; eX = aLeft + aWidth; }
                        else if (predTypeRel === 'SF') { sX = pLeft; eX = aLeft + aWidth; }
                        else { sX = pLeft + pWidth; eX = aLeft; }

                        const startX = `${sX}%`;
                        const endX = `${eX}%`;
                        const startY = predRow * 40 + (isPredStage ? 16 : 15);
                        const endY = atvRow > predRow ? (atvRow * 40 + 9) : (atvRow * 40 + 21);

                        const isBackward = eX < (sX - 0.01);
                        
                        if (!isBackward) {
                          actualLine = (
                            <g key={`dep-act-${atv.id}-${predId}-${pIdx}`}>
                              <line x1={startX} y1={startY} x2={endX} y2={startY} stroke="#d97706" strokeWidth="1.2" />
                              <line x1={endX} y1={startY} x2={endX} y2={endY} stroke="#d97706" strokeWidth="1.2" markerEnd="url(#arrowhead-amber)" />
                            </g>
                          );
                        } else {
                          const midY = startY + (atvRow >= predRow ? 20 : -20);
                          const startStubX = `${sX + 0.2}%`;
                          const finalTargetY = atvRow > predRow ? atvRow * 40 + 9 : atvRow * 40 + 19;
                          
                          actualLine = (
                            <g key={`dep-act-${atv.id}-${predId}-${pIdx}`}>
                              <line x1={startX} y1={startY} x2={startStubX} y2={startY} stroke="#ef4444" strokeWidth="1.2" strokeDasharray="4 2" />
                              <line x1={startStubX} y1={startY} x2={startStubX} y2={midY} stroke="#ef4444" strokeWidth="1.2" strokeDasharray="4 2" />
                              <line x1={startStubX} y1={midY} x2={endX} y2={midY} stroke="#ef4444" strokeWidth="1.2" strokeDasharray="4 2" />
                              <line x1={endX} y1={midY} x2={endX} y2={finalTargetY} stroke="#ef4444" strokeWidth="1.2" strokeDasharray="4 2" markerEnd="url(#arrowhead-red)" />
                            </g>
                          );
                        }
                      }
                    }

                    return (
                      <React.Fragment key={`dep-group-${atv.id}-${predId}-${pIdx}`}>
                        {plannedLine}
                        {actualLine}

                        {/* --- BASELINE DEPENDENCY (GRAY SOLID) --- */}
                        {pred.data_inicio_base && atv.data_inicio_base && (
                          (() => {
                            const predBaseStyle = getTaskStyle(pred.data_inicio_base, pred.data_fim_base) as any;
                            const atvBaseStyle = getTaskStyle(atv.data_inicio_base, atv.data_fim_base) as any;
                            
                            if (predBaseStyle.display === 'none' || atvBaseStyle.display === 'none') return null;

                            const pLeft = parseFloat(predBaseStyle.left as string);
                            const pWidth = parseFloat(predBaseStyle.width as string);
                            const aLeft = parseFloat(atvBaseStyle.left as string);
                            const aWidth = parseFloat(atvBaseStyle.width as string);
                            
                            const predTypeRel = atv.predecessors?.find(p => p.id === pred.id)?.type || 'FS';
                            const lag = atv.predecessors?.find(p => p.id === pred.id)?.lag || 0;

                            let sX, eX;
                            if (predTypeRel === 'FS') { sX = pLeft + pWidth; eX = aLeft; }
                            else if (predTypeRel === 'SS') { sX = pLeft; eX = aLeft; }
                            else if (predTypeRel === 'FF') { sX = pLeft + pWidth; eX = aLeft + aWidth; }
                            else { sX = pLeft; eX = aLeft + aWidth; }

                            const startY = predRowRaw * 40 + (isPredStage ? 28 : 30);
                            const isAtvStage = allRows[atvRowRaw]?.type === 'stage';
                            const endY = atvRowRaw * 40 + (isAtvStage ? 28 : 30);

                            const isBackward = eX < sX - 0.01;

                            return !isBackward ? (
                                <g key={`dep-base-${atv.id}-${predId}-${pIdx}`}>
                                    <line x1={`${sX}%`} y1={startY} x2={`${eX}%`} y2={startY} stroke="#94a3b8" strokeWidth="1.5" />
                                    <line x1={`${eX}%`} y1={startY} x2={`${eX}%`} y2={endY} stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrowhead-gray)" />
                                </g>
                            ) : null;
                          })()
                        )}
                        {actualLine}
                      </React.Fragment>
                    );
                  });
                  return <React.Fragment key={`dep-atv-${atv.id}-${idx}`}>{dpLines}</React.Fragment>;
                })}
              </svg>

              {/* Task Rows */}
              {allRows.map((row, idx) => {
                const rowTop = idx * 40;
                const isStage = row.type === 'stage' || row.type === 'summary';

                const isActivityOrAdding = row.type === 'activity' || row.type === 'adding';

                if (row.type === 'stage' || row.type === 'summary') {
                  const stageData = row.data;
                  const isProjectSummary = row.type === 'summary';
                  const currentInicio = stageData.data_inicio_atual || stageData.data_inicio_real || stageData.data_inicio_prevista;
                  const currentFim = stageData.data_fim_atual || stageData.data_fim_real || stageData.data_fim_prevista;
                  
                  const currentStyle = currentInicio && currentFim ? getTaskStyle(currentInicio, currentFim) : { display: 'none' } as any;
                  
                  return (
                    <div 
                      key={`gantt-stage-${row.id}-${idx}`} 
                      className={`absolute border-b border-slate-200 ${isStage ? 'bg-slate-200/50' : ''} ${row.id === 0 ? 'bg-amber-50/10' : ''}`} 
                      style={{ top: rowTop, left: 0, right: 0, height: '40px' }}
                    >
                      {viewMode === 'month' ? (
                        <div className="flex h-full w-full pointer-events-none">
                          {columns.map((col, colIdx) => {
                            const monthKey = format(col, 'yyyy-MM');
                            const medVal = isProjectSummary ? monthlySummary.projectMedicao[monthKey]?.valor || 0 : monthlySummary.medicao[row.id]?.[monthKey]?.valor || 0;
                            const planVal = isProjectSummary ? monthlySummary.projectPlanned[monthKey]?.valor || 0 : monthlySummary.planned[row.id]?.[monthKey]?.valor || 0;
                            const monthWidth = (1 / columns.length) * 100;
                            
                            if (medVal === 0 && planVal === 0) return <div key={colIdx} style={{ width: `${monthWidth}%` }} className="border-r border-slate-200/30" />;
                            
                            // Denominator logic: use the specific value from budget if available, otherwise sum of activities
                            const budgetValue = isProjectSummary ? projectSummaryData.valor : (stageData.valor || monthlySummary.stageTotals[row.id]);
                            const totalStageVal = budgetValue || 1;
                            
                            const medPercTotal = medVal > 0 ? (medVal / totalStageVal) * 100 : 0;
                            const planPercTotal = planVal > 0 ? (planVal / totalStageVal) * 100 : 0;

                            return (
                              <div key={colIdx} style={{ width: `${monthWidth}%` }} className="relative h-full flex items-center px-1 border-r border-slate-200/30">
                                <div className="bg-slate-100 h-9 w-full rounded flex flex-col items-center justify-center overflow-hidden border border-slate-200 relative">
                                  {/* Fundo planejado (Barra de fundo sutil) */}
                                  <div 
                                    className="absolute inset-x-0 bottom-0 bg-slate-400/20"
                                    style={{ height: planPercTotal > 0 ? '100%' : '0%' }}
                                  />
                                  
                                  {/* Barra Principal (Executada) */}
                                  <div 
                                    className="absolute inset-x-0 bottom-0 bg-emerald-600/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                                    style={{ height: medPercTotal > 0 ? '100%' : '0%' }}
                                  />

                                  <div className="relative z-10 flex flex-col items-center">
                                    <span className={`text-[9px] font-black whitespace-nowrap leading-none ${medPercTotal > 0 ? 'text-emerald-900' : 'text-slate-800'}`}>
                                      {planPercTotal > 0 && medPercTotal === 0 ? planPercTotal.toFixed(1) : (medPercTotal > 0 ? medPercTotal.toFixed(1) : '0.0')}%
                                    </span>
                                    {medVal > 0 || planVal > 0 ? (
                                      <span className={`text-[7px] font-bold whitespace-nowrap mt-0.5 leading-none opacity-80 ${medPercTotal > 0 ? 'text-emerald-950' : 'text-slate-500'}`}>
                                        {medVal > 0 ? formatFinancial(medVal) : formatFinancial(planVal)}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <>
                          {/* Current Stage Bar: Thin slate bar with pointy ends */}
                          {currentInicio && currentFim && currentStyle.display !== 'none' && (
                            <div 
                              className={`absolute -translate-y-1/2 rounded-sm z-30 flex items-center shadow-md overflow-visible h-4 ${
                                isProjectSummary ? 'bg-black border border-slate-700' :
                                stageData.data_inicio_base ? 'bg-amber-800' : 'bg-slate-800'
                              }`}
                              style={{ ...currentStyle, top: '20px' }}
                            >
                              {/* Progress fill for stage */}
                              <div 
                                className={`absolute top-0 left-0 h-full opacity-80 rounded-l-sm ${
                                  isProjectSummary ? 'bg-emerald-500' :
                                  stageData.data_inicio_base ? 'bg-amber-400' : 'bg-indigo-500'
                                }`}
                                style={{ width: `${stageData.progresso || 0}%` }}
                              />
                              {/* Percentage text */}
                              <div className="absolute inset-x-0 inset-y-0 flex items-center px-1 overflow-visible">
                                <span className="font-bold text-white drop-shadow-md whitespace-nowrap z-20 text-[8px]">
                                  {stageData.progresso || 0}%
                                </span>
                              </div>
                              
                              {/* Pointy ends for stage bar (hidden for summary) */}
                              {!isProjectSummary && (
                                <>
                                  <div className={`absolute -left-px -bottom-1.5 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent ${
                                    stageData.data_inicio_base ? 'border-t-amber-800' : 'border-t-slate-800'
                                  } z-20`}></div>
                                  <div className={`absolute -right-px -bottom-1.5 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent ${
                                    stageData.data_inicio_base ? 'border-t-amber-800' : 'border-t-slate-800'
                                  } z-20`}></div>
                                </>
                              )}
                            </div>
                          )}

                          {/* Baseline Stage Bar (Gray outline) */}
                          {stageData.data_inicio_base && stageData.data_fim_base && (
                            <div 
                              className="absolute -translate-y-1/2 h-2 border border-slate-500 bg-slate-400 rounded-sm z-0 opacity-80"
                              style={{ ...(getTaskStyle(stageData.data_inicio_base, stageData.data_fim_base) as any), top: '28px' }}
                            >
                              <div className="absolute -left-px -bottom-1 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-slate-500"></div>
                              <div className="absolute -right-px -bottom-1 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-slate-500"></div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                }
                
                if (isActivityOrAdding) {
                  const atv = row.data as Atividade;
                  const isAddingRow = row.type === 'adding';
                  const isEditing = (atv && atv.id === editingId) || isAddingRow;
                  
                  const plannedInicio = isEditing ? (editForm.data_inicio_prevista || atv?.data_inicio_prevista) : atv?.data_inicio_prevista;
                  const plannedFim = isEditing ? (editForm.data_fim_prevista || atv?.data_fim_prevista) : atv?.data_fim_prevista;
                  const isMilestone = isEditing ? !!editForm.is_marco : !!atv?.is_marco;
                  const duracaoDias = isEditing ? (editForm.duracao_dias !== undefined && editForm.duracao_dias !== "" ? editForm.duracao_dias : atv?.duracao_dias) : atv?.duracao_dias;

                  let currentInicio = isEditing ? (editForm.data_inicio_real || atv?.data_inicio_real) : atv?.data_inicio_real;
                  if (!currentInicio) currentInicio = plannedInicio;
                  
                  let currentFim = isEditing ? (editForm.data_fim_real || atv?.data_fim_real) : atv?.data_fim_real;
                  
                  if (!currentFim && currentInicio && duracaoDias !== undefined && duracaoDias !== null) {
                    const startRealDate = parseDate(currentInicio);
                    if (isValid(startRealDate)) {
                      currentFim = duracaoDias === 0 || duracaoDias === "0" ? currentInicio : format(addWorkingDays(startRealDate, Number(duracaoDias)), 'yyyy-MM-dd');
                    }
                  }
                  if (!currentFim) currentFim = plannedFim;
                  
                  const hasBaseline = !!atv.data_inicio_base;
                  const plannedStyle = (plannedInicio && plannedFim && duracaoDias !== null) ? getTaskStyle(plannedInicio, plannedFim) : { display: 'none' } as any;
                  const currentStyle = (currentInicio && currentFim && duracaoDias !== null) ? getTaskStyle(currentInicio, currentFim) : { display: 'none' } as any;
                  const baselineStyle = (atv.data_inicio_base && atv.data_fim_base) 
                    ? getTaskStyle(atv.data_inicio_base, atv.data_fim_base) as any
                    : { display: 'none' } as any;
                  
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isDelayed = currentFim && isBefore(parseDate(currentFim), today) && (atv.progresso || 0) < 100;

                  // Calculate Variance (Desvio) in days
                  let desvio = 0;
                  if (atv.data_fim_base && plannedFim) {
                    desvio = differenceInDays(parseDate(plannedFim), parseDate(atv.data_fim_base));
                  }

                  return (
                    <div 
                      key={isAddingRow ? "gantt-adding-row" : `gantt-row-${atv.id}-${idx}`} 
                      className={`absolute border-b flex items-center transition-colors ${
                        isAddingRow ? 'bg-blue-50/40 border-blue-100' : 'border-slate-100/50 group hover:bg-slate-50/30'
                      }`} 
                      style={{ top: rowTop, left: 0, right: 0, height: '40px' }}
                    >
                      {/* Action Buttons (Sticky at the start of graph area during edit or adding) */}
                      {isEditing && (
                        <div className={`sticky left-0 z-50 h-full flex items-center gap-1 px-2 border-r mr-1 backdrop-blur-[2px] ${
                          isAddingRow ? 'bg-blue-100/60 border-blue-200/30' : 'bg-white/60 border-indigo-100/30'
                        }`}>
                          <button 
                            onMouseDown={(e) => {
                              e.preventDefault();
                              isAddingRow ? handleSaveNew() : handleUpdate(atv.id);
                            }}
                            className="p-1 bg-emerald-500/20 text-emerald-600 rounded-md hover:bg-emerald-500/40 transition-all"
                            title="Salvar"
                          >
                            <Check size={12} />
                          </button>
                          <button 
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (isAddingRow) {
                                setIsAdding(false);
                              } else {
                                setEditingId(null);
                                setEditingField(null);
                              }
                            }}
                            className="p-1 bg-slate-400/20 text-slate-500 rounded-md hover:bg-slate-400/40 transition-all"
                            title="Cancelar"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}

                      {/* 1. Baseline Bar (Bottom) */}
                      {hasBaseline && baselineStyle.display !== 'none' && (
                        <div 
                          className="absolute -translate-y-1/2 h-2 rounded-full border border-slate-500 bg-slate-400 z-0 opacity-80"
                          style={{ ...baselineStyle, top: '30px' }}
                          title={`Linha de Base: ${format(parseDate(atv.data_inicio_base), 'dd/MM/yyyy')} a ${format(parseDate(atv.data_fim_base), 'dd/MM/yyyy')}`}
                        />
                      )}

                      {/* 2. Current/Planned Bar (Top) */}
                      {plannedStyle.display !== 'none' && (
                        isMilestone ? (
                          <div 
                            className={`absolute -translate-y-1/2 w-4 h-4 rotate-45 border-2 border-white shadow-sm z-10 cursor-pointer ${
                              hasBaseline ? 'bg-amber-500' : isAddingRow ? 'bg-blue-600' : 'bg-indigo-500'
                            }`}
                            style={{ left: plannedStyle.left, top: '15px' }}
                            title={`${atv.nome} (Marco)`}
                            onClick={() => !isAddingRow && startEdit(atv, 'nome')}
                          />
                        ) : (
                          <div 
                            className={`absolute -translate-y-1/2 h-3 rounded-sm border shadow-sm overflow-hidden group-hover:shadow-lg transition-all cursor-pointer z-10 ${
                              isAddingRow 
                                ? 'bg-blue-600 border-blue-700' 
                                : showCriticalPath && criticalPathAtividades.has(atv.id)
                                  ? 'bg-red-600 border-red-700'
                                  : !hasBaseline 
                                    ? 'bg-indigo-600 border-indigo-700' 
                                    : isDelayed ? 'bg-red-600 border-red-700' : 'bg-amber-600 border-amber-700'
                            }`}
                            style={{ ...plannedStyle, top: '15px' }}
                            onClick={() => !isAddingRow && startEdit(atv, 'inicio_real')}
                          >
                            {/* Progress Fill */}
                            <div 
                              className={`absolute top-0 left-0 h-full ${
                                isAddingRow ? 'bg-blue-400' : showCriticalPath && criticalPathAtividades.has(atv.id) ? 'bg-red-400' : !hasBaseline ? 'bg-indigo-400' : isDelayed ? 'bg-red-400' : 'bg-amber-400'
                              }`}
                              style={{ width: `${atv.progresso || 0}%` }}
                            />
                          </div>
                        )
                      )}

                      {/* Label next to bar */}
                      <div className="absolute left-full ml-2 flex items-center h-full pointer-events-none">
                        <span className={`text-[9px] font-bold whitespace-nowrap ${isAddingRow ? 'text-blue-500' : 'text-slate-400'}`}>
                          {atv.nome} 
                          {showCriticalPath && criticalPathAtividades.has(atv.id) && (
                            <span className="text-red-600 ml-1 font-black uppercase text-[7px] bg-red-50 px-1 rounded border border-red-200">Crítico</span>
                          )}
                          {desvio > 0 && <span className="text-red-500 ml-1">+{desvio}d</span>}
                          {desvio < 0 && <span className="text-emerald-500 ml-1">{desvio}d</span>}
                        </span>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
            {/* Spacer to allow scrolling past the last row */}
            <div style={{ height: '400px' }} />
          </div>
        </div>
      </div>
    </div>
    
    <AnimatePresence>
        {isConfigOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              key="config-modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 my-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4 text-indigo-600">
                  <div className="p-3 bg-indigo-50 rounded-xl">
                    <Sliders size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800">Configurações Avançadas</h3>
                    <p className="text-slate-500 text-sm">Gerencie dias úteis, feriados e recessos do projeto</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsConfigOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                {/* Working Days */}
                <section>
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Calendar size={14} /> Dias Úteis da Semana
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => (
                      <button
                        key={day}
                        onClick={() => {
                          const newWorkingDays = cronogramaConfig.workingDays.includes(index)
                            ? cronogramaConfig.workingDays.filter(d => d !== index)
                            : [...cronogramaConfig.workingDays, index].sort();
                          setCronogramaConfig({ ...cronogramaConfig, workingDays: newWorkingDays });
                        }}
                        className={`px-4 py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                          cronogramaConfig.workingDays.includes(index)
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Holidays */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Clock size={14} /> Feriados Específicos
                    </h4>
                    <div className="flex items-center gap-2">
                      <input 
                        type="date" 
                        value={newHoliday}
                        onChange={(e) => setNewHoliday(e.target.value)}
                        className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                      <button 
                        onClick={() => {
                          if (newHoliday && /^\d{4}-\d{2}-\d{2}$/.test(newHoliday)) {
                            if (!cronogramaConfig.holidays.includes(newHoliday)) {
                              setCronogramaConfig({
                                ...cronogramaConfig,
                                holidays: [...cronogramaConfig.holidays, newHoliday].sort()
                              });
                              setNewHoliday('');
                            }
                          }
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                      >
                        <Plus size={12} /> Adicionar
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 min-h-[60px] flex flex-wrap gap-2">
                    {cronogramaConfig.holidays.length === 0 ? (
                      <p className="text-slate-400 text-xs italic">Nenhum feriado adicionado</p>
                    ) : (
                      cronogramaConfig.holidays.map((date, idx) => (
                        <div key={`${date}-${idx}`} className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-medium text-slate-600 shadow-sm">
                          {format(parseDate(date), 'dd/MM/yyyy')}
                          <button 
                            onClick={() => setCronogramaConfig({
                              ...cronogramaConfig,
                              holidays: cronogramaConfig.holidays.filter((_, i) => i !== idx)
                            })}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* Recess Periods */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Clock size={14} /> Períodos de Recesso / Férias Coletivas
                    </h4>
                    <button 
                      onClick={() => {
                        setCronogramaConfig(prev => ({
                          ...prev,
                          recessPeriods: [...prev.recessPeriods, { start: '', end: '' }]
                        }));
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus size={12} /> Adicionar Período
                    </button>
                  </div>
                  <div className="space-y-3">
                    {cronogramaConfig.recessPeriods.length === 0 ? (
                      <div className="bg-slate-50 rounded-xl p-4 min-h-[60px] flex items-center justify-center">
                        <p className="text-slate-400 text-xs italic">Nenhum período de recesso definido</p>
                      </div>
                    ) : (
                      cronogramaConfig.recessPeriods.map((period, index) => (
                        <div key={index} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase">Início</label>
                              <input 
                                type="date" 
                                value={period.start}
                                onChange={(e) => {
                                  const newPeriods = [...cronogramaConfig.recessPeriods];
                                  newPeriods[index] = { ...newPeriods[index], start: e.target.value };
                                  setCronogramaConfig({ ...cronogramaConfig, recessPeriods: newPeriods });
                                }}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase">Fim</label>
                              <input 
                                type="date" 
                                value={period.end}
                                onChange={(e) => {
                                  const newPeriods = [...cronogramaConfig.recessPeriods];
                                  newPeriods[index] = { ...newPeriods[index], end: e.target.value };
                                  setCronogramaConfig({ ...cronogramaConfig, recessPeriods: newPeriods });
                                }}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              const newPeriods = cronogramaConfig.recessPeriods.filter((_, i) => i !== index);
                              setCronogramaConfig({ ...cronogramaConfig, recessPeriods: newPeriods });
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all mt-4"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>

              <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <Info size={14} />
                  <span>As alterações afetarão o cálculo de duração e datas automaticamente.</span>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsConfigOpen(false)}
                    className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/obras/${obraId}/cronograma-config`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(cronogramaConfig)
                        });
                        if (res.ok) {
                          setIsConfigOpen(false);
                          // Refresh activities to apply new calendar logic
                          fetchAtividades();
                        }
                      } catch (err) {
                        console.error("Error saving config:", err);
                      }
                    }}
                    className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                  >
                    Salvar Configurações
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Floating Action Bubble */}
      <AnimatePresence>
        {hoveredRowId !== null && hoveredRowId !== 'project-summary' && (
          <motion.div
            key="hover-bubble"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="fixed z-[9999] bg-white rounded-full shadow-2xl border border-slate-200 px-4 py-2 flex items-center gap-4 pointer-events-auto"
            style={{ 
              left: `${bubblePos.x}px`, 
              top: `${bubblePos.y}px`,
              transform: 'translateY(-50%)'
            }}
            onMouseEnter={() => setHoveredRowId(hoveredRowId)}
            onMouseLeave={() => setHoveredRowId(null)}
          >
            {hoveredRowType === 'stage' && (
              <>
                <button 
                  onClick={() => {
                    if (hasBaseline) return;
                    const stageItem = hoveredRowData.item || hoveredRowData.item_numero || String(hoveredRowId);
                    const baseItem = stageItem.toString().replace(/\.0$/, '');
                    
                    const stageAtividades = atividades.filter(a => a.etapa_id === hoveredRowId);
                    let nextItem = `${baseItem}.1`;
                    if (stageAtividades.length > 0) {
                      const subItems = stageAtividades
                        .map(a => {
                          const parts = (a.item_numero || '').split('.');
                          return parseInt(parts[parts.length - 1], 10);
                        })
                        .filter(n => !isNaN(n));
                      if (subItems.length > 0) {
                        const maxChildItem = Math.max(...subItems);
                        nextItem = `${baseItem}.${maxChildItem + 1}`;
                      }
                    }

                    setAddingToStage(hoveredRowId);
                    setAddingAfterId(hoveredRowId);
                    setAddingAfterType('stage');
                    setEditingField('nome');
                    setEditForm({
                      item_numero: nextItem,
                      nome: '',
                      data_inicio_prevista: format(new Date(), 'yyyy-MM-dd'),
                      data_fim_prevista: format(addWorkingDays(new Date(), 1), 'yyyy-MM-dd'),
                      duracao_dias: 1,
                      progresso: 0,
                      predecessores_texto: '',
                      orcamento_item_id: null,
                      etapa_id: hoveredRowId as number,
                      recurso: '',
                      data_inicio_real: '',
                      data_fim_real: '',
                      is_marco: false
                    });
                    setIsAdding(true);
                  }}
                  disabled={hasBaseline}
                  className={`text-[10px] font-black transition-colors flex items-center gap-1 px-2 py-1 rounded ${
                    hasBaseline 
                      ? 'text-slate-300 bg-slate-50 cursor-not-allowed' 
                      : 'text-emerald-600 hover:text-emerald-800 bg-emerald-50'
                  }`}
                  title={hasBaseline ? "Remova a Linha de Base para adicionar atividades" : "Nova Atividade"}
                >
                  <Plus size={12} /> NOVA ATV
                </button>
                <div className="w-px h-4 bg-slate-200" />
                <button 
                  onClick={() => setDeleteConfirmId(hoveredRowId)}
                  className="text-[10px] font-black text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                  title="Excluir Etapa"
                >
                  <Trash2 size={12} /> EXCLUIR
                </button>
              </>
            )}

            {hoveredRowType === 'activity' && (
              <>
                <button 
                  onClick={() => {
                    if (hasBaseline) return;
                    const stageId = hoveredRowData.etapa_id;
                    const activityItem = hoveredRowData.item_numero || String(hoveredRowId);
                    const parts = activityItem.split('.');
                    const lastPart = parseInt(parts[parts.length - 1], 10) || 0;
                    parts[parts.length - 1] = (lastPart + 1).toString();
                    const nextItem = parts.join('.');
                    
                    setAddingToStage(stageId);
                    setAddingAfterId(hoveredRowId);
                    setAddingAfterType('activity');
                    setEditingField('nome');
                    setEditForm({
                      item_numero: nextItem,
                      nome: '',
                      data_inicio_prevista: format(new Date(), 'yyyy-MM-dd'),
                      data_fim_prevista: format(addWorkingDays(new Date(), 1), 'yyyy-MM-dd'),
                      duracao_dias: 1,
                      progresso: 0,
                      predecessores_texto: '',
                      orcamento_item_id: null,
                      etapa_id: stageId,
                      recurso: '',
                      data_inicio_real: '',
                      data_fim_real: '',
                      is_marco: false
                    });
                    setIsAdding(true);
                  }}
                  disabled={hasBaseline}
                  className={`text-[10px] font-black transition-colors flex items-center gap-1 px-2 py-1 rounded ${
                    hasBaseline 
                      ? 'text-slate-300 bg-slate-50 cursor-not-allowed' 
                      : 'text-emerald-600 hover:text-emerald-800 bg-emerald-50'
                  }`}
                  title={hasBaseline ? "Remova a Linha de Base para adicionar atividades" : "Nova Atividade"}
                >
                  <Plus size={12} /> NOVA ATV
                </button>
                <div className="w-px h-4 bg-slate-200" />
                <button 
                  onClick={() => !hoveredRowData.data_inicio_base && setDeleteConfirmId(hoveredRowId)}
                  disabled={!!hoveredRowData.data_inicio_base}
                  className={`text-[10px] font-black flex items-center gap-1 transition-colors ${
                    !!hoveredRowData.data_inicio_base ? 'text-slate-300' : 'text-red-500 hover:text-red-700 bg-red-50'
                  } px-2 py-1 rounded`}
                  title="Excluir"
                >
                  <Trash2 size={12} /> EXCLUIR
                </button>
                <div className="w-px h-4 bg-slate-200" />
              </>
            )}
            
            {hoveredRowType === 'activity' && (
              <>
                <button 
                  onClick={() => {
                    setEditingId(hoveredRowId);
                    setEditForm({
                      ...hoveredRowData,
                      predecessores_texto: hoveredRowData.predecessores_texto || getPredecessoresTexto(hoveredRowData.predecessor_ids || [])
                    });
                  }}
                  className="text-[10px] font-black text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-1"
                  title="Edição"
                >
                  <Settings size={14} /> EDIÇÃO
                </button>
              </>
            )}
          </motion.div>
        )}
        </AnimatePresence>

        <AnimatePresence>
          {deleteConfirmId && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2001] flex items-center justify-center p-4">
              <motion.div 
                key="delete-modal"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 border border-slate-100"
              >
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900 text-center uppercase tracking-widest mb-2">Excluir Item?</h3>
                <p className="text-slate-500 text-center text-sm mb-8">Esta ação é irreversível e removerá todos os dados vinculados a este item do cronograma.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-6 py-3 border-2 border-slate-100 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => handleDelete(deleteConfirmId)}
                    className="px-6 py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                  >
                    Sim, Excluir
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
    </div>
    </div>
    </div>
);
};

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Download, 
  Upload, 
  Trash2, 
  Edit2, 
  X, 
  Layers,
  AlertTriangle,
  RefreshCw,
  Loader2,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Composicao } from '../types';
import { Button } from './UIComponents';
import AutocompleteDropdown from './AutocompleteDropdown';
import { formatCode, truncateToTwo, formatCurrency, formatDateRef, BRAZILIAN_STATES, getCurrentRefDate } from '../utils';

interface ComposicoesMgmtViewProps {
  onSelectComposicao?: (id: number, estado: string, dataRef: string) => void;
  isAdmin: boolean;
  isMaster: boolean;
}

const ComposicoesMgmtView = ({ onSelectComposicao, isAdmin, isMaster }: ComposicoesMgmtViewProps) => {
  const [composicoes, setComposicoes] = useState<Composicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filterEstado, setFilterEstado] = useState(() => localStorage.getItem('composicoesMgmtFilterEstado') || 'Todos');
  const [filterData, setFilterData] = useState(() => localStorage.getItem('composicoesMgmtFilterData') || 'Todos');
  const [availableEstados, setAvailableEstados] = useState<string[]>(['Todos']);
  const [availableDatas, setAvailableDatas] = useState<string[]>(['Todos']);
  const [availableBancos, setAvailableBancos] = useState<string[]>(['Todos']);
  const [availableTipos, setAvailableTipos] = useState<string[]>(['Todos']);
  const [filterBanco, setFilterBanco] = useState('Todos');
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [searchCodigo, setSearchCodigo] = useState(() => localStorage.getItem('composicoesMgmtSearchCodigo') || '');
  const [searchDescricao, setSearchDescricao] = useState(() => localStorage.getItem('composicoesMgmtSearchDescricao') || '');
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('composicoesMgmtCurrentPage');
    return saved ? parseInt(saved, 10) : 1;
  });
  const itemsPerPage = 200;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingCompId, setEditingCompId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'bulk', id?: number } | null>(null);
  const [importModalStep, setImportModalStep] = useState<'select_file' | 'mapping' | 'loading' | 'report' | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedUf, setSelectedUf] = useState('Todos');
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importData, setImportData] = useState<any[][] | null>(null);
  const [importStartRow, setImportStartRow] = useState<number>(2);
  const [importEndRow, setImportEndRow] = useState<number | ''>('');
  const [missingItemsReport, setMissingItemsReport] = useState<{ codigo: string, tipo: string, base: string, descricao: string }[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [sortByPrice, setSortByPrice] = useState<'none' | 'asc' | 'desc'>('none');
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const REQUIRED_FIELDS = [
    { key: 'base', label: 'Base Composição (ex: SINAPI)' },
    { key: 'data_referencia', label: 'Data Ref.' },
    { key: 'codigo_composicao', label: 'Cód. Composição' },
    { key: 'descricao', label: 'Descrição Composição' },
    { key: 'unidade', label: 'Unidade' },
    { key: 'tipo', label: 'Categoria' },
    { key: 'base_item', label: 'Base Item (opcional)' },
    { key: 'codigo_item', label: 'Cód. Item' },
    { key: 'descricao_item', label: 'Descrição do Item' },
    { key: 'tipo_item', label: 'Tipo Item' },
    { key: 'coeficiente', label: 'Coeficiente' }
  ];

  const [importType, setImportType] = useState<'unified' | 'cadastro' | 'items'>('unified');
  const [newComp, setNewComp] = useState({
    base: 'PRÓPRIA',
    codigo_composicao: '',
    descricao: '',
    tipo: '',
    unidade: ''
  });

  const parseImportDate = (value: any) => {
    if (!value) return null;
    
    const str = String(value).trim();
    
    // Check if it's a date string first
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
    if (str.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [d, m, y] = str.split('/');
      return `${y}-${m}-${d}`;
    }
    if (str.match(/^\d{2}\/\d{4}$/)) {
      const [m, y] = str.split('/');
      return `${y}-${m}-01`;
    }
    if (str.match(/^\d{4}-\d{2}$/)) {
      return `${str}-01`;
    }

    // Se for número, trata como data serial do Excel
    if (typeof value === 'number' || (str !== '' && !isNaN(Number(str)))) {
      const numValue = Number(str);
      // Data base do Excel: 30 de dezembro de 1899
      const date = new Date(Math.round((numValue - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    
    // Try parsing as a standard date
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }

    return null;
  };

  const parseNumber = (val: any) => {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'number') return val;
    
    let str = String(val).trim();
    if (str === '') return null;
    
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // Brazilian format: 1.234,56
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      // US format: 1,234.56
      str = str.replace(/,/g, '');
    } else if (lastComma !== -1) {
      // Only comma: 1,50
      str = str.replace(',', '.');
    }
    
    // Remove anything else that's not a digit, dot or minus
    str = str.replace(/[^\d.-]/g, '');
    
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  };

  const fetchFilterOptions = async (currentFilters?: { banco?: string, estado?: string, tipo?: string, data?: string }) => {
    try {
      const b = currentFilters?.banco || filterBanco;
      const e = currentFilters?.estado || filterEstado;
      const t = currentFilters?.tipo || filterTipo;
      const d = currentFilters?.data || filterData;

      // Convert MM/YYYY to YYYY-MM-DD for API
      let apiData = d;
      if (d && d.match(/^\d{2}\/\d{4}$/)) {
        const [month, year] = d.split('/');
        apiData = `${year}-${month}-01`;
      }

      const [estadosRes, datasRes, bancosRes, tiposRes] = await Promise.all([
        fetch(`/api/composicoes/estados?base=${b}&data_referencia=${apiData}&tipo=${t}`),
        fetch(`/api/composicoes/datas?base=${b}&estado=${e}&tipo=${t}`),
        fetch(`/api/composicoes/bancos?estado=${e}&data_referencia=${apiData}&tipo=${t}`),
        fetch(`/api/composicoes/tipos?base=${b}&estado=${e}&data_referencia=${apiData}`)
      ]);
      
      if (estadosRes.ok) {
        const text = await estadosRes.text();
        try {
          const estados = JSON.parse(text);
          setAvailableEstados(estados.length > 0 ? ['Todos', ...estados] : ['Todos']);
        } catch (e) {
          console.error("Error parsing estados JSON:", e);
        }
      }
      
      if (datasRes.ok) {
        const text = await datasRes.text();
        try {
          const datas: string[] = JSON.parse(text);
          if (datas && datas.length > 0) {
            // Format dates to MM/YYYY
            const formattedDatas = datas.map((d: string) => {
              if (d && d.length >= 7) {
                return `${d.substring(5, 7)}/${d.substring(0, 4)}`;
              }
              return d;
            });
            const uniqueDatas = Array.from(new Set(formattedDatas));
            setAvailableDatas(['Todos', ...uniqueDatas]);
            
            // Se o filtro atual for 'Todos' ou estiver vazio, e tivermos dados, 
            // define a data mais recente (primeira da lista DESC) como padrão
            const savedData = localStorage.getItem('composicoesMgmtFilterData');
            if ((!savedData || savedData === 'Todos') && uniqueDatas.length > 0 && filterData === 'Todos') {
              setFilterData(uniqueDatas[0]);
            }
          } else {
            setAvailableDatas(['Todos']);
            if (filterData !== 'Todos') setFilterData('Todos');
          }
        } catch (e) {
          console.error("Error parsing datas JSON:", e);
        }
      }

      if (bancosRes.ok) {
        const bancos = await bancosRes.json();
        setAvailableBancos(['Todos', ...bancos]);
      }

      if (tiposRes.ok) {
        const tipos = await tiposRes.json();
        setAvailableTipos(['Todos', ...tipos]);
      }
    } catch (err) {
      console.error("Error fetching filter options:", err);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, [filterBanco, filterEstado, filterTipo]);

  const fetchComposicoes = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchCodigo) params.append('codigo', searchCodigo);
    if (searchDescricao) params.append('descricao', searchDescricao);
    if (filterEstado !== 'Todos') params.append('estado', filterEstado);
    if (filterData !== 'Todos' && filterData !== '') params.append('data_referencia', filterData);
    if (filterBanco !== 'Todos') params.append('base', filterBanco);
    if (filterTipo !== 'Todos') params.append('tipo', filterTipo);

    fetch(`/api/composicoes?${params.toString()}`)
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
          setComposicoes(data);
          
          const totalP = Math.ceil(data.length / itemsPerPage);
          if (currentPage > totalP && totalP > 0) {
            setCurrentPage(totalP);
          }
        } else {
          setComposicoes([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching composicoes:", err);
        setComposicoes([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchComposicoes();
    }, 300);
    return () => clearTimeout(timer);
  }, [filterEstado, filterData, filterBanco, filterTipo, searchCodigo, searchDescricao]);

  useEffect(() => {
    localStorage.setItem('composicoesMgmtSearchCodigo', searchCodigo);
  }, [searchCodigo]);

  useEffect(() => {
    localStorage.setItem('composicoesMgmtSearchDescricao', searchDescricao);
  }, [searchDescricao]);

  useEffect(() => {
    localStorage.setItem('composicoesMgmtCurrentPage', currentPage.toString());
    const scrollArea = document.getElementById('main-scroll-area');
    if (scrollArea) scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem('composicoesMgmtFilterEstado', filterEstado);
  }, [filterEstado]);

  useEffect(() => {
    localStorage.setItem('composicoesMgmtFilterData', filterData);
  }, [filterData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingCompId ? `/api/composicoes/${editingCompId}` : '/api/composicoes';
    const method = editingCompId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newComp)
      });
      if (res.ok) {
        setShowModal(false);
        fetchComposicoes();
        setToast({ message: 'Composição salva com sucesso!', type: 'success' });
      } else {
        const errorText = await res.text();
        let errorMsg = errorText;
        try {
          const error = JSON.parse(errorText);
          errorMsg = error.message || errorText;
        } catch (e) {}
        setToast({ message: `Erro ao salvar: ${errorMsg}`, type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: `Erro de conexão: ${err.message}`, type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/composicoes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchComposicoes();
      setToast({ message: 'Composição excluída com sucesso!', type: 'success' });
    } else {
      setToast({ message: 'Erro ao excluir composição.', type: 'error' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await fetch('/api/composicoes/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        setSelectedIds([]);
        setDeleteConfirm(null);
        fetchComposicoes();
        setToast({ message: `${selectedIds.length} composições excluídas com sucesso!`, type: 'success' });
      } else {
        setToast({ message: 'Erro ao excluir composições em lote.', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Erro de conexão.', type: 'error' });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedComposicoes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedComposicoes.map((c: any) => c.id_composicao));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(composicoes);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Composicoes");
    XLSX.writeFile(wb, "composicoes.xlsx");
  };

  const handleRecalculateAll = async () => {
    if (!window.confirm("Deseja recalcular os preços de TODAS as composições? Isso pode levar alguns segundos dependendo do volume de dados.")) {
      return;
    }

    setIsRecalculating(true);
    try {
      const response = await fetch('/api/composicoes/recalculate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          estado: filterEstado === 'Todos' ? 'DF' : filterEstado,
          data_referencia: (filterData === 'Todos' || filterData === '') ? getCurrentRefDate() : filterData
        })
      });

      if (response.ok) {
        setToast({ message: 'Todas as composições foram recalculadas!', type: 'success' });
        fetchComposicoes();
      } else {
        const err = await response.json();
        setToast({ message: `Erro ao recalcular: ${err.message}`, type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: 'Erro de conexão.', type: 'error' });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleRecalculateZeros = async () => {
    if (!window.confirm("Deseja recalcular apenas os preços zerados das composições?")) {
      return;
    }

    setIsRecalculating(true);
    try {
      const response = await fetch('/api/composicoes/recalculate-zeros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          estado: filterEstado === 'Todos' ? 'DF' : filterEstado,
          data_referencia: (filterData === 'Todos' || filterData === '') ? getCurrentRefDate() : filterData
        })
      });

      if (response.ok) {
        setToast({ message: 'Composições zeradas foram recalculadas!', type: 'success' });
        fetchComposicoes();
      } else {
        const err = await response.json();
        setToast({ message: `Erro ao recalcular: ${err.message}`, type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: 'Erro de conexão.', type: 'error' });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleImportClick = () => {
    setImportType('unified');
    setImportModalStep('select_file');
    setSelectedFile(null);
    setImportLogs([]);
    setImportProgress(0);
    setColumnMapping({});
    setImportData(null);
    setImportStartRow(2);
    setImportEndRow('');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleContinueToMapping = () => {
    if (!selectedFile) return;
    setImportModalStep('mapping');
    
    const fileName = selectedFile.name.toLowerCase();
    if (fileName.endsWith('.csv')) {
      Papa.parse(selectedFile, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          setImportData(results.data as any[][]);
        },
        error: (error) => {
          console.error('CSV parse error:', error);
          setToast({ message: 'Erro ao processar o arquivo CSV.', type: 'error' });
          setImportModalStep(null);
        }
      });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          setImportData(json as any[][]);
        } catch (error) {
          console.error('Excel parse error:', error);
          setToast({ message: 'Erro ao processar o arquivo Excel.', type: 'error' });
          setImportModalStep(null);
        }
      };
      reader.onerror = () => {
        setToast({ message: 'Erro ao ler o arquivo.', type: 'error' });
        setImportModalStep(null);
      };
      reader.readAsBinaryString(selectedFile);
    } else {
      setToast({ message: 'Formato de arquivo não suportado.', type: 'error' });
      setImportModalStep(null);
    }
  };

  const letterToIndex = (letter: string) => {
    if (!letter) return -1;
    let index = 0;
    const upper = letter.toUpperCase().trim();
    for (let i = 0; i < upper.length; i++) {
      index = index * 26 + (upper.charCodeAt(i) - 64);
    }
    return index - 1;
  };

  const processImport = async () => {
    if (!importData) return;
    setImportModalStep('loading');
    setImportLogs(['Iniciando importação...']);
    setImportProgress(0);
    
    // Pular a primeira linha (cabeçalho) ou usar as linhas definidas
    const startIdx = Math.max(0, importStartRow - 1);
    const endIdx = importEndRow ? Math.min(importData.length, Number(importEndRow)) : importData.length;
    
    const dataToImport = importData.slice(startIdx, endIdx);
    const total = dataToImport.length;
    
    setImportLogs(prev => [...prev, `Arquivo carregado com ${total} linhas.`]);
    
    const fieldsToMap = importType === 'unified' ? REQUIRED_FIELDS : (importType === 'cadastro' ? [
      { key: 'base', label: 'Banco' },
      { key: 'codigo_composicao', label: 'Código' },
      { key: 'descricao', label: 'Descrição' },
      { key: 'unidade', label: 'Unidade' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'data_referencia', label: 'Data Base' },
      { key: 'valor_nao_desonerado', label: 'Valor Não Desonerado' },
      { key: 'valor_desonerado', label: 'Valor Desonerado' }
    ] : [
      { key: 'base', label: 'Base da Composição' },
      { key: 'codigo_composicao', label: 'Código da Composição' },
      { key: 'codigo_insumo', label: 'Código do Insumo' },
      { key: 'coeficiente', label: 'Coeficiente (Consumo)' }
    ]);

    let lastCodigo: string | null = null;
    let lastBase: string | null = null;
    let lastDescricao: string | null = null;
    let lastUnidade: string | null = null;
    let lastTipo: string | null = null;
    let lastDataRef: string | null = null;

    const mappedData = dataToImport.map(row => {
      const newRow: any = {};
      fieldsToMap.forEach(field => {
        const letter = columnMapping[field.key];
        if (letter) {
          const index = letterToIndex(letter);
          let val = index >= 0 ? row[index] : null;
          if (['codigo_composicao', 'codigo_item', 'base', 'base_item'].includes(field.key) && val !== null && val !== undefined) {
            val = String(val).trim();
          } else if (field.key === 'data_referencia' && val) {
            val = parseImportDate(val);
          } else if (['coeficiente', 'valor_desonerado', 'valor_nao_desonerado'].includes(field.key) && val !== null) {
            val = parseNumber(val);
          } else if (typeof val === 'string') {
            val = val.trim();
          }
          newRow[field.key] = val;
        } else {
          newRow[field.key] = null;
        }
      });

      // Preenchimento automático para linhas de itens (quando a composição está em branco)
      if (importType === 'unified' || importType === 'items') {
        if (newRow.codigo_composicao && String(newRow.codigo_composicao).trim() !== '') {
          lastCodigo = newRow.codigo_composicao;
          lastBase = newRow.base;
          lastDescricao = newRow.descricao;
          lastUnidade = newRow.unidade;
          if (newRow.tipo && String(newRow.tipo).trim() !== '') lastTipo = newRow.tipo;
          lastDataRef = newRow.data_referencia;
        } else if (lastCodigo) {
          newRow.codigo_composicao = lastCodigo;
          if (!newRow.base) newRow.base = lastBase;
          if (!newRow.descricao) newRow.descricao = lastDescricao;
          if (!newRow.unidade) newRow.unidade = lastUnidade;
          if (!newRow.tipo) newRow.tipo = lastTipo;
          if (!newRow.data_referencia) newRow.data_referencia = lastDataRef;
        }
      }

      return newRow;
    }).filter(row => {
      const isValid = row.codigo_composicao !== null && row.codigo_composicao !== undefined && String(row.codigo_composicao).trim() !== '';
      if (!isValid) {
        console.log('Linha descartada no filtro:', row);
      }
      return isValid;
    });

    setImportLogs(prev => [...prev, `${mappedData.length} linhas válidas encontradas.`]);

    // Agrupar por composição para garantir que todos os itens de uma composição fiquem no mesmo lote
    const rowsByComp = new Map<string, any[]>();
    mappedData.forEach(row => {
      const key = `${row.base || 'SINAPI'}|${row.codigo_composicao}`;
      if (!rowsByComp.has(key)) {
        rowsByComp.set(key, []);
      }
      rowsByComp.get(key)!.push(row);
    });

    const batches: any[][] = [];
    let currentBatch: any[] = [];
    const batchSize = 250; // Aumentado para 250 linhas por lote

    for (const [key, rows] of rowsByComp.entries()) {
      if (currentBatch.length + rows.length > batchSize && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
      }
      currentBatch.push(...rows);
    }
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    let successCount = 0;
    let errorCount = 0;
    let allMissingItems: any[] = [];

    const endpoint = importType === 'unified' ? '/api/composicoes/unified/bulk' : (importType === 'cadastro' ? '/api/composicoes/bulk' : '/api/composicoes/items/bulk');
    const payloadKey = importType === 'unified' ? 'data' : (importType === 'cadastro' ? 'composicoes' : 'items');

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [payloadKey]: batch, estado: selectedUf })
        });
        
        const resultText = await res.text();
        let result: any = { message: resultText, errors: [], error: null, missingItems: [] };
        try {
          result = JSON.parse(resultText);
        } catch (e) {}
        
        if (res.ok) {
          successCount += batch.length;
          setImportLogs(prev => [...prev, `Lote ${i + 1}/${batches.length} processado: ${result.message}`]);
          if (result.errors && result.errors.length > 0) {
            setImportLogs(prev => [...prev, ...result.errors.map((err: string) => `Aviso: ${err}`)]);
          }
          if (result.missingItems && result.missingItems.length > 0) {
            allMissingItems = [...allMissingItems, ...result.missingItems];
          }
        } else {
          errorCount += batch.length;
          setImportLogs(prev => [...prev, `Falha no Lote ${i + 1}/${batches.length}: ${result.message || 'Erro desconhecido'}`]);
          if (result.error) setImportLogs(prev => [...prev, `Detalhe: ${result.error}`]);
        }
      } catch (err: any) {
        errorCount += batch.length;
        setImportLogs(prev => [...prev, `Falha de conexão no lote ${i + 1}/${batches.length}: ${err.message}`]);
      }
      
      setImportProgress(Math.round(((i + 1) / batches.length) * 100));
    }

    setImportLogs(prev => [...prev, 'Recalculando composições associadas...']);
    try {
      await fetch('/api/composicoes/recalculate-all', { method: 'POST' });
      setImportLogs(prev => [...prev, 'Composições recalculadas com sucesso.']);
    } catch (e) {
      setImportLogs(prev => [...prev, 'Erro ao recalcular composições.']);
    }

    setMissingItemsReport(allMissingItems);

    setImportLogs(prev => [...prev, 'Importação concluída!', `Sucesso: ${successCount}`, `Erros: ${errorCount}`, `Itens faltando: ${allMissingItems.length}`]);
    fetchComposicoes();
    fetchFilterOptions();
    
    if (allMissingItems.length > 0 || errorCount > 0) {
      setImportModalStep('report');
    } else {
      setTimeout(() => {
        setImportModalStep(null);
        setSelectedFile(null);
        setImportData(null);
        setImportProgress(0);
        setImportLogs([]);
      }, 3000);
    }
  };

  const openCreateModal = () => {
    setEditingCompId(null);
    setNewComp({
      base: 'PRÓPRIA',
      codigo_composicao: '',
      descricao: '',
      tipo: '',
      unidade: ''
    });
    setShowModal(true);
  };

  const openEditModal = (comp: Composicao) => {
    setEditingCompId(comp.id_composicao);
    setNewComp({
      base: comp.base || 'PRÓPRIA',
      codigo_composicao: comp.codigo_composicao,
      descricao: comp.descricao,
      tipo: comp.tipo || '',
      unidade: comp.unidade
    });
    setShowModal(true);
  };

  const filteredComposicoes = (composicoes || []).filter(c => {
    if (!c) return false;
    const matchCodigo = String(c.codigo_composicao || '').toLowerCase().includes(searchCodigo.toLowerCase());
    const matchDescricao = (c.descricao || '').toLowerCase().includes(searchDescricao.toLowerCase());
    const matchEstado = filterEstado === 'Todos' || c.estado === filterEstado;
    const formattedDate = formatDateRef(c.data_referencia);
    const matchData = (filterData === 'Todos' || filterData === '') || formattedDate === filterData;
    
    return matchCodigo && matchDescricao && matchEstado && matchData;
  }).sort((a, b) => {
    if (sortByPrice === 'none') return 0;
    const priceA = a.valor_desonerado || 0;
    const priceB = b.valor_desonerado || 0;
    return sortByPrice === 'asc' ? priceA - priceB : priceB - priceA;
  });

  const totalPages = Math.max(1, Math.ceil(filteredComposicoes.length / itemsPerPage));
  const paginatedComposicoes = filteredComposicoes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderPagination = () => {
    if (totalPages <= 1) return (
      <div className="flex items-center justify-between px-1 py-4 mb-2">
        <div className="text-[13px] text-slate-500">
          Mostrando <span className="font-bold text-slate-900">1</span> a <span className="font-bold text-slate-900">{filteredComposicoes.length}</span> de <span className="font-bold text-slate-900">{filteredComposicoes.length}</span>
        </div>
      </div>
    );
    
    const maxVisiblePages = 3;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Final check to ensure startPage is not less than 1
    startPage = Math.max(1, startPage);

    return (
      <div className="flex items-center justify-between px-1 py-4 mb-2">
        <div className="text-[13px] text-slate-500">
          Mostrando <span className="font-bold text-slate-900">{((currentPage - 1) * itemsPerPage) + 1}</span> a <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredComposicoes.length)}</span> de <span className="font-bold text-slate-900">{filteredComposicoes.length}</span>
        </div>
        <div className="flex items-center bg-white border border-slate-100 rounded-2xl p-1.5 shadow-sm">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 text-[13px] font-bold text-slate-900 hover:bg-slate-50 rounded-xl disabled:text-slate-300 disabled:cursor-not-allowed transition-all"
          >
            Anterior
          </button>
          
          <div className="flex gap-2 px-2">
            {Array.from({ length: endPage - startPage + 1 }).map((_, i) => {
              const page = startPage + i;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 flex items-center justify-center rounded-xl text-[13px] font-bold transition-all ${currentPage === page ? 'bg-[#0f172a] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {page}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 text-[13px] font-bold text-slate-900 hover:bg-slate-50 rounded-xl disabled:text-slate-300 disabled:cursor-not-allowed transition-all"
          >
            Próximo
          </button>
        </div>
      </div>
    );
  };

  const uniqueEstados = availableEstados;
  const uniqueDatas = availableDatas;
  const uniqueBancos = availableBancos;
  const uniqueTipos = availableTipos;

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-lg border flex items-center gap-3 z-50 ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <div className="font-medium">{toast.message}</div>
          <button onClick={() => setToast(null)} className="opacity-50 hover:opacity-100"><X size={16} /></button>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">COMPOSIÇÃO</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Gestão administrativa da base de dados de recursos de composição.</p>
          </div>
          
           <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {isMaster && (
              <Button variant="secondary" onClick={handleExport}>
                <Download size={16} /> Exportar
              </Button>
            )}
            {(!isMaster || isAdmin) && (
              <>
                {selectedIds.length > 0 && (
                  <Button 
                    variant="primary" 
                    className="bg-red-600 hover:bg-red-700 text-white border-transparent"
                    onClick={() => setDeleteConfirm({ type: 'bulk' })}
                  >
                    <Trash2 size={16} /> Excluir ({selectedIds.length})
                  </Button>
                )}
                
                {isMaster && (
                  <Button variant="secondary" onClick={handleImportClick}>
                    <Upload size={16} /> Importar
                  </Button>
                )}
                
                {!isMaster && (
                  <Button variant="primary" onClick={openCreateModal}>
                    <Plus size={16} /> Nova Composição
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Filtros Modernizados */}
        <div className="bg-white border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden mb-4">
          <div className="p-5">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input 
                    type="text" 
                    placeholder="Código..." 
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                    value={searchCodigo}
                    onChange={e => {
                      setSearchCodigo(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                <div className="flex-1 relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input 
                    type="text" 
                    placeholder="Descrição..." 
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                    value={searchDescricao}
                    onChange={e => {
                      setSearchDescricao(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Banco:</span>
                    <select 
                      className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                      value={filterBanco}
                      onChange={e => {
                        setFilterBanco(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      {uniqueBancos.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tipo:</span>
                    <select 
                      className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                      value={filterTipo}
                      onChange={e => {
                        setFilterTipo(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      {uniqueTipos.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">UF:</span>
                    <select 
                      className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                      value={filterEstado}
                      onChange={e => {
                        setFilterEstado(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      {uniqueEstados.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Data:</span>
                    <select 
                      className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                      value={filterData}
                      onChange={e => {
                        setFilterData(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="Todos">Todas</option>
                      {availableDatas.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Preço:</span>
                    <select 
                      className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                      value={sortByPrice}
                      onChange={e => setSortByPrice(e.target.value as any)}
                    >
                      <option value="none">Padrão</option>
                      <option value="asc">Menor Preço</option>
                      <option value="desc">Maior Preço</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

        {renderPagination()}

        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm budget-table-container">
          <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="bg-white border-b border-slate-200/60">
                  {(!isMaster || isAdmin) && (
                    <th className="px-3 py-1.5 w-10">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedIds.length === paginatedComposicoes.length && paginatedComposicoes.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th className="px-3 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest">Banco</th>
                  <th className="px-3 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest">Data Base</th>
                  <th className="px-3 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest">Código</th>
                  <th className="px-3 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest">Descrição</th>
                  <th className="px-3 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest">Unidade</th>
                  <th className="px-3 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest">Categoria</th>
                  <th className="px-3 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Valor Não Deson.</th>
                  <th className="px-3 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Valor Deson.</th>
                  {(!isMaster || isAdmin) && <th className="px-3 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={isAdmin ? 10 : 8} className="px-4 py-8 text-center text-slate-400 text-xs">Carregando composições...</td></tr>
                ) : paginatedComposicoes.length > 0 ? paginatedComposicoes.map((comp, idx) => (
                  <React.Fragment key={`${comp.id_composicao}-${idx}`}>
                    <tr className="hover:bg-slate-50/80 transition-colors group">
                      {(!isMaster || isAdmin) && (
                        <td className="px-3 py-1.5">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={selectedIds.includes(comp.id_composicao)}
                            onChange={() => toggleSelectOne(comp.id_composicao)}
                          />
                        </td>
                      )}
                      <td className="px-3 py-1.5">
                        <div className="text-[13px] font-medium text-slate-700 uppercase">{comp.base || 'SINAPI'}</div>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="text-[13px] font-medium text-slate-700">
                          {formatDateRef(comp.data_referencia)}
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <button 
                          onClick={() => onSelectComposicao && onSelectComposicao(comp.id_composicao, filterEstado, filterData)}
                          className="text-[13px] font-medium text-slate-900 hover:underline transition-all text-left"
                        >
                          {formatCode(comp.codigo_composicao)}
                        </button>
                      </td>
                      <td className="px-3 py-1.5 relative group/desc">
                      <button 
                        onClick={() => onSelectComposicao && onSelectComposicao(comp.id_composicao, filterEstado, filterData)}
                        className="text-[13px] font-medium text-slate-900 hover:underline transition-all text-left w-full"
                      >
                          {comp.descricao}
                        </button>
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 hidden group-hover/desc:block z-[100] bg-white border border-slate-200 shadow-xl p-3 rounded-lg text-[13px] text-slate-900 min-w-[400px] max-w-[600px] whitespace-normal break-words pointer-events-none">
                          {comp.descricao}
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="text-[13px] font-medium text-slate-700 uppercase">{comp.unidade}</div>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="text-[13px] font-medium text-slate-700 uppercase">{comp.categoria || comp.tipo || '-'}</div>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="text-[13px] font-bold text-slate-900">
                          {comp.valor_nao_desonerado ? formatCurrency(comp.valor_nao_desonerado) : 'R$ 0,00'}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="text-[13px] font-bold text-slate-900">
                          {comp.valor_desonerado ? formatCurrency(comp.valor_desonerado) : 'R$ 0,00'}
                        </div>
                      </td>
                      {(!isMaster || isAdmin) && (
                        <td className="px-3 py-1.5 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {onSelectComposicao && (
                              <button 
                                onClick={() => onSelectComposicao(comp.id_composicao, filterEstado, filterData)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Ver Detalhes"
                              >
                                <Layers size={15} />
                              </button>
                            )}
                            {comp.base === 'PRÓPRIA' ? (
                              <>
                                <button 
                                  onClick={() => openEditModal(comp)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 size={15} />
                                </button>
                              </>
                            ) : (
                              <div className="p-1.5 text-slate-300 cursor-not-allowed" title="Bases oficiais não podem ser editadas">
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  </React.Fragment>
                )) : (
                  <tr><td colSpan={isAdmin ? 10 : 8} className="px-5 py-10 text-center text-slate-400 text-xs">Nenhuma composição encontrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>

        {renderPagination()}

      {/* Modals */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
          >
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">
                {editingCompId ? 'Editar Composição' : 'Nova Composição'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Base</label>
                  <input 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newComp.base}
                    onChange={e => setNewComp({...newComp, base: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Categoria</label>
                  <input 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newComp.tipo}
                    onChange={e => setNewComp({...newComp, tipo: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Código</label>
                  <input 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newComp.codigo_composicao}
                    onChange={e => setNewComp({...newComp, codigo_composicao: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Unidade</label>
                  <input 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newComp.unidade}
                    onChange={e => setNewComp({...newComp, unidade: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Descrição</label>
                <textarea 
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                  value={newComp.descricao}
                  onChange={e => setNewComp({...newComp, descricao: e.target.value})}
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
                <Button variant="primary" type="submit">Salvar Recurso</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 text-center"
          >
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Confirmar Exclusão</h3>
            <p className="text-slate-500 mb-6">
              {deleteConfirm.type === 'bulk' 
                ? `Tem certeza que deseja excluir as ${selectedIds.length} composições selecionadas?` 
                : 'Tem certeza que deseja excluir esta composição?'}
              <br/>Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              <Button 
                variant="danger" 
                onClick={() => {
                  if (deleteConfirm.type === 'bulk') {
                    handleBulkDelete();
                  } else if (deleteConfirm.id) {
                    handleDelete(deleteConfirm.id);
                    setDeleteConfirm(null);
                  }
                }}
              >
                Sim, Excluir
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {importModalStep && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className={`bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] w-full ${importModalStep === 'mapping' ? 'max-w-2xl' : importModalStep === 'report' ? 'max-w-4xl' : 'max-w-md'}`}
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                  {importModalStep === 'select_file' ? 'Importar Composições' : 
                   importModalStep === 'mapping' ? 'Mapeamento de Colunas' : 'Processando Importação'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {importModalStep === 'select_file' ? 'Selecione o arquivo CSV ou Excel.' : 
                   importModalStep === 'mapping' ? 'Digite a letra da coluna (ex: A, B, C) para cada campo.' : 'Aguarde a conclusão do processo.'}
                </p>
              </div>
              {importModalStep !== 'loading' && (
                <button onClick={() => setImportModalStep(null)} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors">
                  <X size={20} />
                </button>
              )}
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {importModalStep === 'select_file' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Importação</label>
                    <select
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      value={importType}
                      onChange={(e) => setImportType(e.target.value as any)}
                    >
                      <option value="unified">Unificada (Composições + Itens - Analítico)</option>
                      <option value="cadastro">Apenas Composições (Sintético)</option>
                      <option value="items">Apenas Itens das Composições</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Estado (UF)</label>
                    <select
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      value={selectedUf}
                      onChange={(e) => setSelectedUf(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {BRAZILIAN_STATES.map(uf => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Arquivo</label>
                    <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-slate-50 hover:border-indigo-400 transition-all group">
                      <input 
                        type="file" 
                        onChange={handleFileSelect} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                        accept=".csv,.xlsx,.xls"
                      />
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Upload size={28} />
                        </div>
                        <div>
                          <p className="text-base font-bold text-slate-700">Clique ou arraste a planilha aqui</p>
                          <p className="text-sm text-slate-500 mt-1">Suporta arquivos .CSV, .XLS e .XLSX</p>
                        </div>
                      </div>
                    </div>
                    {selectedFile && (
                      <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                          <FileSpreadsheet size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-emerald-800 truncate">{selectedFile.name}</p>
                          <p className="text-xs text-emerald-600">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {importModalStep === 'mapping' && (
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                    <h3 className="text-sm font-bold text-indigo-900 mb-3">Intervalo de Leitura</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-indigo-700 mb-1">Linha Inicial</label>
                        <input
                          type="number"
                          min="1"
                          className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          value={importStartRow}
                          onChange={(e) => setImportStartRow(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <p className="text-[10px] text-indigo-500 mt-1">Ignora cabeçalhos antes desta linha.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-indigo-700 mb-1">Linha Final (Opcional)</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Ex: 100"
                          className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          value={importEndRow}
                          onChange={(e) => setImportEndRow(e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : '')}
                        />
                        <p className="text-[10px] text-indigo-500 mt-1">Deixe em branco para ler até o fim.</p>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-800 mb-1 mt-4">Colunas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(importType === 'unified' ? REQUIRED_FIELDS : (importType === 'cadastro' ? [
                      { key: 'base', label: 'Banco' },
                      { key: 'data_referencia', label: 'Data Base' },
                      { key: 'codigo_composicao', label: 'Código' },
                      { key: 'descricao', label: 'Descrição' },
                      { key: 'unidade', label: 'Unidade' },
                      { key: 'tipo', label: 'Categoria' },
                      { key: 'valor_nao_desonerado', label: 'V. Não Deson.' },
                      { key: 'valor_desonerado', label: 'V. Deson.' }
                    ] : [
                      { key: 'base', label: 'Base da Comp.' },
                      { key: 'codigo_composicao', label: 'Cód. Comp.' },
                      { key: 'codigo_insumo', label: 'Cód. Insumo' },
                      { key: 'coeficiente', label: 'Coef.' }
                    ])).map(field => (
                      <div key={field.key} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm hover:border-indigo-200 transition-all group">
                        <label className="text-xs font-bold text-slate-700 truncate mr-2">{field.label}</label>
                        <div className="relative flex items-center shrink-0">
                          <input 
                            type="text" 
                            placeholder="A"
                            maxLength={2}
                            className="w-12 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-center font-bold uppercase text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            value={columnMapping[field.key] || ''}
                            onChange={(e) => setColumnMapping({...columnMapping, [field.key]: e.target.value.toUpperCase()})}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importModalStep === 'loading' && (
                <div className="space-y-6 py-4 flex flex-col items-center justify-center text-center">
                  <div className="relative w-24 h-24 mb-2">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                      <circle 
                        cx="50" cy="50" r="45" fill="none" stroke="#4f46e5" strokeWidth="8" 
                        strokeDasharray={`${2 * Math.PI * 45}`} 
                        strokeDashoffset={`${2 * Math.PI * 45 * (1 - importProgress / 100)}`} 
                        className="transition-all duration-500 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {importProgress < 100 ? (
                        <span className="text-xl font-black text-indigo-600">{importProgress}%</span>
                      ) : (
                        <CheckCircle2 className="text-emerald-500" size={40} />
                      )}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-800 mb-1">
                    {importProgress < 100 ? 'Processando dados...' : 'Importação concluída!'}
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">
                    {importProgress < 100 ? 'Por favor, não feche esta janela.' : 'Todos os itens foram processados.'}
                  </p>
                  
                  <div className="w-full bg-slate-900 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs text-left shadow-inner">
                    {importLogs.map((log, i) => (
                      <div key={i} className={`mb-1.5 flex items-start gap-2 ${log.toLowerCase().includes('erro') || log.toLowerCase().includes('falha') || log.toLowerCase().includes('aviso') ? 'text-rose-400' : 'text-emerald-400'}`}>
                        <span className="opacity-50 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                        <span>{log}</span>
                      </div>
                    ))}
                    {importProgress === 100 && (
                      <div className="mt-4 pt-2 border-t border-slate-700 text-indigo-300 font-bold">
                        {'>'} Processo finalizado. Você já pode concluir a importação.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {importModalStep === 'report' && (
                <div className="space-y-4 py-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h3 className="text-amber-800 font-bold mb-2 flex items-center gap-2">
                      <AlertTriangle size={18} />
                      Itens Não Encontrados na API
                    </h3>
                    <p className="text-amber-700 text-sm mb-4">
                      Os seguintes itens foram referenciados na importação, mas não existiam na base de dados. Eles foram criados automaticamente com descrições genéricas.
                    </p>
                    <div className="bg-white border border-amber-100 rounded-lg shadow-inner overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-1.5 font-semibold text-slate-600">Base</th>
                            <th className="px-3 py-1.5 font-semibold text-slate-600">Código</th>
                            <th className="px-3 py-1.5 font-semibold text-slate-600">Tipo</th>
                            <th className="px-3 py-1.5 font-semibold text-slate-600">Descrição Atribuída</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {missingItemsReport.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-3 py-1.5 text-slate-600">{item.base}</td>
                              <td className="px-3 py-1.5 font-mono text-slate-800">{item.codigo}</td>
                              <td className="px-3 py-1.5 text-slate-600">{item.tipo}</td>
                              <td className="px-3 py-1.5 text-slate-500 italic">{item.descricao}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              {importModalStep === 'select_file' && (
                <>
                  <Button variant="secondary" onClick={() => setImportModalStep(null)}>Cancelar</Button>
                  <Button variant="primary" onClick={handleContinueToMapping} disabled={!selectedFile}>
                    Continuar
                  </Button>
                </>
              )}
              {importModalStep === 'mapping' && (
                <>
                  <Button variant="secondary" onClick={() => setImportModalStep(null)}>Cancelar</Button>
                  <Button variant="primary" onClick={processImport}>
                    Importar {importData ? importData.length - 1 : ''} {importType === 'unified' ? 'Composições' : 'Itens'}
                  </Button>
                </>
              )}
              {importModalStep === 'loading' && (
                <Button 
                  variant="primary" 
                  className="px-8"
                  onClick={() => {
                    setImportModalStep(null);
                    fetchComposicoes();
                  }}
                  disabled={importProgress < 100}
                >
                  Concluir
                </Button>
              )}
              {importModalStep === 'report' && (
                <Button 
                  variant="primary" 
                  className="px-8"
                  onClick={() => {
                    setImportModalStep(null);
                    setMissingItemsReport([]);
                    fetchComposicoes();
                  }}
                >
                  Fechar Relatório
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ComposicoesMgmtView;

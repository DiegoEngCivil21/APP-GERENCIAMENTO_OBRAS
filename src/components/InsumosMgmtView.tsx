import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Download, 
  Upload, 
  Trash2, 
  Edit2, 
  X, 
  ChevronDown,
  Loader2,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Insumo } from '../types';
import { Button } from './UIComponents';
import { formatDateRef, truncateToTwo, BRAZILIAN_STATES, getCurrentRefDate } from '../utils';

interface InsumosMgmtViewProps {
  isAdmin: boolean;
  isMaster: boolean;
}

const InsumosMgmtView = ({ isAdmin, isMaster }: InsumosMgmtViewProps) => {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchCodigo, setSearchCodigo] = useState(() => localStorage.getItem('insumosMgmtSearchCodigo') || '');
  const [searchDescricao, setSearchDescricao] = useState(() => localStorage.getItem('insumosMgmtSearchDescricao') || '');
  const [sortBy, setSortBy] = useState('descricao');
  const [filterTipo, setFilterTipo] = useState(() => localStorage.getItem('insumosMgmtFilterTipo') || 'Todos');
  const [filterBanco, setFilterBanco] = useState(() => localStorage.getItem('insumosMgmtFilterBanco') || 'Todos');
  const [filterEstado, setFilterEstado] = useState(() => localStorage.getItem('insumosMgmtFilterEstado') || 'Todos');
  const [filterData, setFilterData] = useState(() => localStorage.getItem('insumosMgmtFilterData') || 'Todos');
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('insumosMgmtCurrentPage');
    return saved ? parseInt(saved, 10) : 1;
  });
  const itemsPerPage = 200;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingInsumoId, setEditingInsumoId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'bulk', id?: number } | null>(null);
  const [importModalStep, setImportModalStep] = useState<'select_file' | 'mapping' | 'loading' | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedUf, setSelectedUf] = useState('Todos');
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importData, setImportData] = useState<any[][] | null>(null);
  const [importStartRow, setImportStartRow] = useState<number>(2);
  const [importEndRow, setImportEndRow] = useState<number | ''>('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [availableBancos, setAvailableBancos] = useState<string[]>(['Todos']);
  const [availableEstados, setAvailableEstados] = useState<string[]>(['Todos']);
  const [availableTipos, setAvailableTipos] = useState<string[]>(['Todos']);
  const [availableDatas, setAvailableDatas] = useState<string[]>(['Todos']);

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

      const [bancosRes, estadosRes, tiposRes, datasRes] = await Promise.all([
        fetch(`/api/insumos/bancos?estado=${e}&data_referencia=${apiData}&tipo=${t}`),
        fetch(`/api/insumos/estados?base=${b}&data_referencia=${apiData}&tipo=${t}`),
        fetch(`/api/insumos/tipos?base=${b}&estado=${e}&data_referencia=${apiData}`),
        fetch(`/api/insumos/datas?base=${b}&estado=${e}&tipo=${t}`)
      ]);

      if (bancosRes.ok) {
        const bancos = await bancosRes.json();
        setAvailableBancos(['Todos', ...bancos]);
      }
      if (estadosRes.ok) {
        const estados = await estadosRes.json();
        setAvailableEstados(['Todos', ...estados]);
      }
      if (tiposRes.ok) {
        const tipos = await tiposRes.json();
        setAvailableTipos(['Todos', ...tipos]);
      }
      if (datasRes.ok) {
        const datas = await datasRes.json();
        if (datas && datas.length > 0) {
          const formattedDatas = datas.map((d: string) => {
            if (d && d.length >= 7) return `${d.substring(5, 7)}/${d.substring(0, 4)}`;
            return d;
          });
          const uniqueDatas = Array.from(new Set(formattedDatas)) as string[];
          setAvailableDatas(['Todos', ...uniqueDatas]);
          
          // Se o filtro atual for 'Todos' ou estiver vazio, e tivermos dados, 
          // define a data mais recente (primeira da lista DESC) como padrão
          const savedData = localStorage.getItem('insumosMgmtFilterData');
          if ((!savedData || savedData === 'Todos') && uniqueDatas.length > 0 && filterData === 'Todos') {
            setFilterData(uniqueDatas[0]);
          }
        } else {
          setAvailableDatas(['Todos']);
          if (filterData !== 'Todos') setFilterData('Todos');
        }
      }
    } catch (err) {
      console.error("Error fetching filter options:", err);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, [filterBanco, filterEstado, filterTipo]); // Re-fetch options when filters change

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const REQUIRED_FIELDS = [
    { key: 'base', label: 'Base/Banco' },
    { key: 'codigo', label: 'Código' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'unidade', label: 'Unidade' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'data_referencia', label: 'Data de Referência' },
    { key: 'valor_nao_desonerado', label: 'Valor Não Desonerado' },
    { key: 'valor_desonerado', label: 'Valor Desonerado' },
  ];

  const [newInsumo, setNewInsumo] = useState({
    base: 'PRÓPRIO',
    codigo: '',
    descricao: '',
    unidade: '',
    tipo: 'Material',
    estado: 'DF',
    data_referencia: getCurrentRefDate(),
    valor_nao_desonerado: 0,
    valor_desonerado: 0
  });

  const fetchInsumos = () => {
    setLoading(true);
    const params = new URLSearchParams();
    // We only send search/filter params to the server if the backend supports it.
    // Based on the current implementation, it seems it does.
    if (searchCodigo) params.append('codigo', searchCodigo);
    if (searchDescricao) params.append('descricao', searchDescricao);
    if (filterBanco !== 'Todos') params.append('base', filterBanco);
    if (filterEstado !== 'Todos') params.append('estado', filterEstado);
    if (filterTipo !== 'Todos') params.append('tipo', filterTipo);
    if (filterData !== 'Todos') params.append('data_referencia', filterData);

    fetch(`/api/insumos?${params.toString()}&_=${Date.now()}`)
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
          setInsumos(data);
        } else {
          setInsumos([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching insumos:", err);
        setInsumos([]);
        setLoading(false);
      });
  };

  const openCreateModal = () => {
    setEditingInsumoId(null);
    setNewInsumo({
      base: 'PRÓPRIO',
      codigo: '',
      descricao: '',
      unidade: '',
      tipo: 'Material',
      estado: 'DF',
      data_referencia: getCurrentRefDate(),
      valor_nao_desonerado: 0,
      valor_desonerado: 0
    });
    setShowModal(true);
  };

  const openEditModal = (insumo: Insumo) => {
    setEditingInsumoId(insumo.id_insumo);
    setNewInsumo({
      base: insumo.base,
      codigo: insumo.codigo,
      descricao: insumo.descricao,
      unidade: insumo.unidade,
      tipo: insumo.tipo,
      estado: insumo.estado || 'DF',
      data_referencia: insumo.data_referencia || '',
      valor_nao_desonerado: insumo.valor_nao_desonerado || 0,
      valor_desonerado: insumo.valor_desonerado || 0
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingInsumoId ? `/api/insumos/${editingInsumoId}` : '/api/insumos';
    const method = editingInsumoId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInsumo)
      });
      if (res.ok) {
        setShowModal(false);
        fetchInsumos();
        fetchFilterOptions();
        setToast({ message: 'Insumo salvo com sucesso!', type: 'success' });
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

  useEffect(() => {
    localStorage.setItem('insumosMgmtSearchCodigo', searchCodigo);
  }, [searchCodigo]);

  useEffect(() => {
    localStorage.setItem('insumosMgmtSearchDescricao', searchDescricao);
  }, [searchDescricao]);

  useEffect(() => {
    localStorage.setItem('insumosMgmtCurrentPage', currentPage.toString());
    const scrollArea = document.getElementById('main-scroll-area');
    if (scrollArea) scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem('insumosMgmtFilterTipo', filterTipo);
  }, [filterTipo]);

  useEffect(() => {
    localStorage.setItem('insumosMgmtFilterBanco', filterBanco);
  }, [filterBanco]);

  useEffect(() => {
    localStorage.setItem('insumosMgmtFilterEstado', filterEstado);
  }, [filterEstado]);

  useEffect(() => {
    localStorage.setItem('insumosMgmtFilterData', filterData);
  }, [filterData]);

  useEffect(() => {
    fetchInsumos();
    
    // Check for quick action trigger
    if (localStorage.getItem('openNewInsumoModal') === 'true') {
      localStorage.removeItem('openNewInsumoModal');
      openCreateModal();
    }
  }, [searchCodigo, searchDescricao, filterBanco, filterEstado, filterTipo, filterData]);

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(insumos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Insumos");
    XLSX.writeFile(wb, "insumos_gestao.xlsx");
  };

  const handleImportClick = () => {
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

  const parseImportDate = (value: any) => {
    if (!value) return null;
    
    const str = String(value).trim();
    
    // Check if it's a date string first
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
    if (str.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [d, m, y] = str.split('/');
      return `${y}-${m}-${d}`;
    }
    if (str.match(/^\d{2}-\d{2}-\d{4}$/)) {
      const [d, m, y] = str.split('-');
      return `${y}-${m}-${d}`;
    }
    if (str.match(/^\d{2}\/\d{4}$/)) {
      const [m, y] = str.split('/');
      return `${y}-${m}-01`;
    }
    if (str.match(/^\d{2}-\d{4}$/)) {
      const [m, y] = str.split('-');
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

  const processImport = async () => {
    if (!importData) return;
    setImportModalStep('loading');
    setImportLogs(['Iniciando importação...']);
    setImportProgress(0);
    
    // Pular a primeira linha (cabeçalho) ou usar as linhas definidas
    const startIdx = Math.max(0, importStartRow - 1);
    const endIdx = importEndRow ? Math.min(importData.length, Number(importEndRow)) : importData.length;
    
    const dataToImport = importData.slice(startIdx, endIdx).filter(row => {
      // Verifica se a linha não é o cabeçalho repetido ou linha vazia
      const codigo = row[letterToIndex(columnMapping['codigo'])];
      return codigo && codigo !== 'Código' && codigo !== 'codigo';
    });
    const total = dataToImport.length;
    
    setImportLogs(prev => [...prev, `Arquivo carregado com ${total} linhas.`]);
    
    const mappedData = dataToImport.map(row => {
      const newRow: any = { estado: selectedUf };
      REQUIRED_FIELDS.forEach(field => {
        const letter = columnMapping[field.key];
        if (letter) {
          const index = letterToIndex(letter);
          let val = index >= 0 ? row[index] : null;
          
          if (field.key === 'codigo' && val === undefined) {
             console.log(`Erro mapeamento: Campo ${field.key} (coluna ${letter}, index ${index}) não encontrado na linha:`, row);
          }

          if (['codigo', 'banco', 'base'].includes(field.key) && val !== null && val !== undefined) {
            val = String(val).trim();
          } else if (field.key === 'data_referencia' && val) {
            val = parseImportDate(val);
          } else if (['valor_desonerado', 'valor_nao_desonerado'].includes(field.key) && val !== null) {
            val = parseNumber(val);
          } else if (typeof val === 'string') {
            val = val.trim();
          }
          newRow[field.key] = val;
        } else {
          newRow[field.key] = null;
        }
      });
      return newRow;
    });

    setImportLogs(prev => [...prev, 'Dados mapeados. Enviando para o servidor...']);
    console.log("Dados mapeados para importação (detalhado):", JSON.stringify(mappedData.slice(0, 5), null, 2));

    try {
      const chunkSize = 500;
      const totalChunks = Math.ceil(mappedData.length / chunkSize);
      
      let hasErrors = false;
      for (let i = 0; i < totalChunks; i++) {
        const chunk = mappedData.slice(i * chunkSize, (i + 1) * chunkSize);
        
        try {
          const response = await fetch('/api/insumos/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chunk),
          });

          if (!response.ok) {
            const error = await response.json();
            setImportLogs(prev => [...prev, `Erro no lote ${i + 1}: ${error.message || 'Erro desconhecido'}`]);
            hasErrors = true;
          } else {
            setImportLogs(prev => [...prev, `Lote ${i + 1}/${totalChunks} importado com sucesso. (${chunk.length} itens)`]);
          }
        } catch (err: any) {
          setImportLogs(prev => [...prev, `Falha de conexão no lote ${i + 1}: ${err.message}`]);
          hasErrors = true;
        }

        const progress = Math.round(((i + 1) / totalChunks) * 100);
        setImportProgress(progress);
      }

      setImportLogs(prev => [...prev, 'Recalculando composições associadas...']);
      try {
        await fetch('/api/composicoes/recalculate-all', { method: 'POST' });
        setImportLogs(prev => [...prev, 'Composições recalculadas com sucesso.']);
      } catch (e) {
        setImportLogs(prev => [...prev, 'Erro ao recalcular composições.']);
      }

      setImportLogs(prev => [...prev, hasErrors ? 'Importação concluída com alguns erros.' : 'Importação concluída com sucesso!']);
      setTimeout(() => {
        setImportModalStep(null);
        setToast({ message: hasErrors ? 'Importação concluída com alertas.' : 'Insumos importados com sucesso!', type: hasErrors ? 'error' : 'success' });
        fetchInsumos();
        fetchFilterOptions();
      }, 3000);
    } catch (err: any) {
      console.error('Import error:', err);
      setImportLogs(prev => [...prev, `Erro fatal: ${err.message || 'Erro ao conectar com o servidor.'}`]);
      setTimeout(() => setImportModalStep(null), 3000);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/insumos/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchInsumos();
        setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
        setToast({ message: 'Insumo excluído com sucesso!', type: 'success' });
      } else {
        console.error('Erro ao excluir insumo');
        setToast({ message: 'Erro ao excluir insumo.', type: 'error' });
      }
    } catch (err) {
      console.error('Delete error:', err);
      setToast({ message: 'Erro de conexão.', type: 'error' });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    try {
      const response = await fetch('/api/insumos/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (response.ok) {
        setSelectedIds([]);
        fetchInsumos();
        setToast({ message: `${selectedIds.length} insumos excluídos com sucesso!`, type: 'success' });
      } else {
        console.error('Erro ao excluir insumos');
        setToast({ message: 'Erro ao excluir insumos em lote.', type: 'error' });
      }
    } catch (err) {
      console.error('Bulk delete error:', err);
      setToast({ message: 'Erro de conexão.', type: 'error' });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedInsumos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedInsumos.map(i => i.id_insumo));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const uniqueBancos = availableBancos;
  const uniqueEstados = availableEstados;
  const uniqueDatas = availableDatas;
  const uniqueTipos = availableTipos;

  const filteredInsumos = (insumos || []).filter(i => {
    const matchCodigo = String(i.codigo || '').toLowerCase().includes(searchCodigo.toLowerCase());
    const matchDescricao = (i.descricao || '').toLowerCase().includes(searchDescricao.toLowerCase());
    const matchBanco = filterBanco === 'Todos' || i.base === filterBanco;
    const matchEstado = filterEstado === 'Todos' || i.estado === filterEstado;
    const matchTipo = filterTipo === 'Todos' || i.tipo === filterTipo;
    const matchData = filterData === 'Todos' || formatDateRef(i.data_referencia) === filterData;
    
    return matchCodigo && matchDescricao && matchBanco && matchEstado && matchTipo && matchData;
  }).sort((a, b) => {
    if (sortBy === 'descricao') return a.descricao.localeCompare(b.descricao);
    if (sortBy === 'codigo') return a.codigo.localeCompare(b.codigo);
    if (sortBy === 'valor_desc') return b.valor_desonerado - a.valor_desonerado;
    if (sortBy === 'valor_asc') return a.valor_desonerado - b.valor_desonerado;
    return 0;
  });

  const totalPages = Math.ceil(filteredInsumos.length / itemsPerPage);
  const paginatedInsumos = filteredInsumos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderPagination = () => {
    if (loading || filteredInsumos.length === 0) return null;

    let startPage = Math.max(1, currentPage - 1);
    let endPage = Math.min(totalPages, startPage + 2);
    
    if (endPage - startPage < 2) {
      startPage = Math.max(1, endPage - 2);
    }

    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex justify-between items-center py-2 px-1">
        <div className="text-[12px] text-slate-500 font-medium">
          Mostrando <span className="text-slate-900 font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="text-slate-900 font-bold">{Math.min(currentPage * itemsPerPage, filteredInsumos.length)}</span> de <span className="text-slate-900 font-bold">{filteredInsumos.length}</span>
        </div>
        <div className="flex gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <Button 
            variant="outline"
            size="sm"
            className="border-none shadow-none"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </Button>
          <div className="flex items-center gap-1">
            {pages.map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`min-w-[32px] h-8 text-[12px] font-bold rounded-lg transition-all ${
                  currentPage === page 
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-200' 
                    : 'text-slate-500 bg-transparent hover:bg-slate-50'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
          <Button 
            variant="outline"
            size="sm"
            className="border-none shadow-none"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Próximo
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">INSUMO</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Gestão administrativa da base de dados de insumos.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {isAdmin && selectedIds.length > 0 && (
              <Button 
                variant="primary" 
                className="bg-red-600 hover:bg-red-700 text-white border-transparent"
                onClick={() => setDeleteConfirm({ type: 'bulk' })}
              >
                <Trash2 size={16} /> Excluir ({selectedIds.length})
              </Button>
            )}
            {isMaster && (
              <Button variant="secondary" onClick={handleExport}>
                <Download size={16} /> Exportar
              </Button>
            )}
            {isMaster && (
              <Button variant="secondary" onClick={handleImportClick}>
                <Upload size={16} /> Importar
              </Button>
            )}
            {!isMaster && (
              <Button variant="primary" onClick={openCreateModal}>
                <Plus size={16} /> Novo Insumo
              </Button>
            )}
          </div>
        </div>

        {/* Filtros Modernizados */}
        <div className="bg-white border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-4">
              <div className="lg:col-span-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Código..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={searchCodigo}
                  onChange={(e) => {
                    setSearchCodigo(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Descrição..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={searchDescricao}
                  onChange={(e) => {
                    setSearchDescricao(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              
              <div className="relative">
                <select 
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none transition-all"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="descricao">Ordenar: Descrição</option>
                  <option value="codigo">Ordenar: Código</option>
                  <option value="valor_desc">Ordenar: Maior Valor</option>
                  <option value="valor_asc">Ordenar: Menor Valor</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>

              <div className="relative">
                <select 
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none transition-all"
                  value={filterBanco}
                  onChange={(e) => {
                    setFilterBanco(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="Todos">Banco: Todos</option>
                  {uniqueBancos.filter(b => b !== 'Todos').map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>

              <div className="relative">
                <select 
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none transition-all"
                  value={filterEstado}
                  onChange={(e) => {
                    setFilterEstado(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  {uniqueEstados.map(e => <option key={e} value={e}>UF: {e}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>

              <div className="relative">
                <select 
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none transition-all"
                  value={filterTipo}
                  onChange={(e) => {
                    setFilterTipo(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="Todos">Tipo: Todos</option>
                  {uniqueTipos.filter(t => t !== 'Todos').map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>

              <div className="relative">
                <select 
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none transition-all"
                  value={filterData}
                  onChange={(e) => {
                    setFilterData(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  {uniqueDatas.map(d => <option key={d} value={d}>Data: {d}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">
                {editingInsumoId ? 'Editar Insumo' : 'Novo Insumo'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Base/Banco</label>
                  <input 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newInsumo.base}
                    onChange={e => setNewInsumo({...newInsumo, base: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Data de Referência</label>
                  <input 
                    type="month"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newInsumo.data_referencia && typeof newInsumo.data_referencia === 'string' ? newInsumo.data_referencia.substring(0, 7) : ''}
                    onChange={e => setNewInsumo({...newInsumo, data_referencia: e.target.value ? `${e.target.value}-01` : ''})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Código {newInsumo.base === 'PRÓPRIO' && '(Opcional)'}</label>
                  <input 
                    required={newInsumo.base !== 'PRÓPRIO'}
                    placeholder={newInsumo.base === 'PRÓPRIO' ? 'Auto-gerado se vazio' : ''}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newInsumo.codigo}
                    onChange={e => setNewInsumo({...newInsumo, codigo: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Descrição</label>
                  <input 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newInsumo.descricao}
                    onChange={e => setNewInsumo({...newInsumo, descricao: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Unidade</label>
                  <input 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newInsumo.unidade}
                    onChange={e => setNewInsumo({...newInsumo, unidade: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Tipo</label>
                  <input 
                    list="tipos"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newInsumo.tipo}
                    onChange={e => setNewInsumo({...newInsumo, tipo: e.target.value})}
                  />
                  <datalist id="tipos">
                    <option value="Material" />
                    <option value="Mão de Obra" />
                    <option value="Equipamento" />
                    <option value="Encargos" />
                    {uniqueTipos.filter(t => t !== 'Todos' && t !== 'Material' && t !== 'Mão de Obra' && t !== 'Equipamento' && t !== 'Encargos').map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Estado (UF)</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                    value={newInsumo.estado}
                    onChange={e => setNewInsumo({...newInsumo, estado: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    {BRAZILIAN_STATES.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Valor Não Desonerado</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newInsumo.valor_nao_desonerado}
                    onChange={e => setNewInsumo({...newInsumo, valor_nao_desonerado: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Valor Desonerado</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newInsumo.valor_desonerado}
                    onChange={e => setNewInsumo({...newInsumo, valor_desonerado: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
                <Button variant="primary" type="submit">Salvar Insumo</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {renderPagination()}

      <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="bg-slate-50 border-b border-slate-200/60">
              <th className="px-3 py-1.5 w-10">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={selectedIds.length === paginatedInsumos.length && paginatedInsumos.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Banco</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Código</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Descrição</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Unidade</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Tipo</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Data Base</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Valor Não Deson.</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Valor Deson.</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400 text-xs">Carregando insumos...</td></tr>
            ) : paginatedInsumos.length > 0 ? paginatedInsumos.map((insumo, idx) => (
              <tr 
                key={`${insumo.id_insumo}-${idx}`} 
                className="hover:bg-slate-50/80 transition-colors group"
              >
                <td className="px-3 py-1.5">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={selectedIds.includes(insumo.id_insumo)}
                    onChange={() => toggleSelectOne(insumo.id_insumo)}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <div className="text-[13px] font-medium text-slate-700">{insumo.base}</div>
                </td>
                <td className="px-3 py-1.5">
                  <div className="text-[13px] font-medium text-slate-700">{String(insumo.codigo).replace(/\.\d+$/, '')}</div>
                </td>
                <td className="px-3 py-1.5 relative group/desc">
                  <div className="text-[13px] font-medium text-slate-700">{insumo.descricao}</div>
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 hidden group-hover/desc:block z-[100] bg-white border border-slate-200 shadow-xl p-3 rounded-lg text-[13px] text-slate-900 min-w-[400px] max-w-[600px] whitespace-normal break-words pointer-events-none">
                    {insumo.descricao}
                  </div>
                </td>
                <td className="px-3 py-1.5 text-[13px] font-medium text-slate-700">{insumo.unidade}</td>
                <td className="px-3 py-1.5 text-[13px] font-medium text-slate-700">
                  {insumo.tipo}
                </td>
                <td className="px-3 py-1.5 text-[13px] font-medium text-slate-700">
                  {insumo.data_referencia && typeof insumo.data_referencia === 'string' && insumo.data_referencia.length >= 7 
                    ? `${insumo.data_referencia.substring(5, 7)}/${insumo.data_referencia.substring(0, 4)}` 
                    : '-'}
                </td>
                <td className="px-3 py-1.5 text-[13px] font-medium text-slate-700 text-right">
                  {insumo.valor_nao_desonerado?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-3 py-1.5 text-[13px] font-medium text-slate-700 text-right">
                  {insumo.valor_desonerado?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {insumo.base === 'PRÓPRIO' && (!isMaster || isAdmin) ? (
                      <>
                        <button 
                          onClick={() => openEditModal(insumo)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                      </>
                    ) : (
                      <div className="p-1.5 text-slate-300 cursor-not-allowed" title={insumo.base !== 'PRÓPRIO' ? "Bases oficiais não podem ser editadas" : "Sem permissão de acesso"}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={10} className="px-5 py-10 text-center text-slate-400 text-xs">Nenhum insumo encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {renderPagination()}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
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
                ? `Tem certeza que deseja excluir os ${selectedIds.length} insumos selecionados?` 
                : 'Tem certeza que deseja excluir este insumo?'}
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

      {importModalStep === 'select_file' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Importar Insumos</h2>
                <p className="text-sm text-slate-500 mt-1">Selecione o arquivo CSV ou Excel.</p>
              </div>
              <button onClick={() => setImportModalStep(null)} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-6">
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
              </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setImportModalStep(null)}>Cancelar</Button>
              <Button variant="primary" onClick={handleContinueToMapping} disabled={!selectedFile}>
                Continuar
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {importModalStep === 'mapping' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Mapeamento de Colunas</h2>
                <p className="text-sm text-slate-500 mt-1">Digite a letra da coluna da planilha (ex: A, B, C) para cada campo.</p>
              </div>
              <button onClick={() => setImportModalStep(null)} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
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

              <h3 className="text-sm font-bold text-slate-800 mb-3">Colunas</h3>
              <div className="grid grid-cols-2 gap-3">
                {REQUIRED_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-3 p-2 rounded-lg border border-slate-200 bg-slate-50/50">
                    <div className="w-1/2">
                      <label className="text-xs font-bold text-slate-700 truncate block" title={field.label}>{field.label}</label>
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Ex: A"
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all uppercase"
                        value={columnMapping[field.key] || ''}
                        onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.key]: e.target.value.toUpperCase() }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setImportModalStep(null)}>Cancelar</Button>
              <Button variant="primary" onClick={processImport}>
                Importar {importData ? importData.length - 1 : 0} Insumos
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {importModalStep === 'loading' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-8 flex flex-col items-center justify-center text-center">
              <div className="relative w-24 h-24 mb-6">
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
              
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {importProgress < 100 ? 'Processando dados...' : 'Importação concluída!'}
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                {importProgress < 100 ? 'Por favor, não feche esta janela.' : 'Todos os itens foram processados.'}
              </p>

              <div className="w-full bg-slate-900 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs text-left shadow-inner">
                {importLogs.map((log, i) => (
                  <div key={i} className={`mb-1.5 flex items-start gap-2 ${log.toLowerCase().includes('erro') || log.toLowerCase().includes('aviso') ? 'text-rose-400' : 'text-emerald-400'}`}>
                    <span className="opacity-50 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                    <span>{log}</span>
                  </div>
                ))}
                {importProgress === 100 && (
                  <div className="mt-4 pt-2 border-t border-slate-700 text-indigo-300 font-bold">
                    {'>'} Processo finalizado. Você já pode fechar esta janela.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-[100]">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }}
            className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm font-medium text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}
          >
            {toast.message}
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default InsumosMgmtView;

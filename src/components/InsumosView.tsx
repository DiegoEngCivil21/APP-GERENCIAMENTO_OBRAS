import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Download, 
  Upload, 
  Trash2, 
  Edit2, 
  X, 
  ChevronDown 
} from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Insumo } from '../types';
import { Button } from './UIComponents';
import { formatCode, truncateToTwo, BRAZILIAN_STATES, getCurrentRefDate } from '../utils';

const InsumosView = ({ isAdmin, isMaster }: { isAdmin: boolean, isMaster: boolean }) => {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('insumosSearchTerm') || '');
  const [sortBy, setSortBy] = useState('descricao');
  const [filterTipo, setFilterTipo] = useState(() => localStorage.getItem('insumosFilterTipo') || 'Todos');
  const [filterBanco, setFilterBanco] = useState(() => localStorage.getItem('insumosFilterBanco') || 'Todos');
  const [filterEstado, setFilterEstado] = useState(() => localStorage.getItem('insumosFilterEstado') || 'Todos');
  const [filterData, setFilterData] = useState(() => localStorage.getItem('insumosFilterData') || 'Todos');
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('insumosCurrentPage');
    return saved ? parseInt(saved, 10) : 1;
  });
  const itemsPerPage = 200;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingInsumoId, setEditingInsumoId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'bulk', id?: number } | null>(null);
  const [importModalStep, setImportModalStep] = useState<'select_file' | 'mapping' | 'loading' | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedUf, setSelectedUf] = useState('DF');
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importData, setImportData] = useState<any[][] | null>(null);
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
          const savedData = localStorage.getItem('insumosFilterData');
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
  }, [filterBanco, filterEstado, filterTipo]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const REQUIRED_FIELDS = [
    { key: 'base', label: 'Base/Banco (ex: SINAPI)' },
    { key: 'codigo', label: 'Código' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'unidade', label: 'Unidade' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'data_referencia', label: 'Data Base' },
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
    if (searchTerm) params.append('search', searchTerm);
    if (filterEstado !== 'Todos') params.append('estado', filterEstado);
    if (filterData !== 'Todos') params.append('data_referencia', filterData);
    if (filterBanco !== 'Todos') params.append('base', filterBanco);
    if (filterTipo !== 'Todos') params.append('tipo', filterTipo);
    
    fetch(`/api/insumos?${params.toString()}`)
      .then(async res => {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new Error(`Invalid JSON: ${text.substring(0, 20)}...`);
        }
      })
      .then(data => {
        console.log("Data received from /api/insumos:", data);
        if (Array.isArray(data)) {
          setInsumos(data);
          
          const totalP = Math.ceil(data.length / itemsPerPage);
          if (currentPage > totalP && totalP > 0) {
            setCurrentPage(totalP);
          }
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
      valor_nao_desonerado: insumo.valor_nao_desonerado,
      valor_desonerado: insumo.valor_desonerado
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingInsumoId ? `/api/insumos/${editingInsumoId}` : '/api/insumos';
    const method = editingInsumoId ? 'PUT' : 'POST';

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
  };

  useEffect(() => {
    localStorage.setItem('insumosSearchTerm', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem('insumosCurrentPage', currentPage.toString());
    const scrollArea = document.getElementById('main-scroll-area');
    if (scrollArea) scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem('insumosFilterTipo', filterTipo);
  }, [filterTipo]);

  useEffect(() => {
    localStorage.setItem('insumosFilterBanco', filterBanco);
  }, [filterBanco]);

  useEffect(() => {
    localStorage.setItem('insumosFilterEstado', filterEstado);
  }, [filterEstado]);

  useEffect(() => {
    localStorage.setItem('insumosFilterData', filterData);
  }, [filterData]);

  useEffect(() => {
    fetchInsumos();
  }, [searchTerm, filterEstado, filterData, filterBanco, sortBy, currentPage]);

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(insumos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Insumos");
    XLSX.writeFile(wb, "insumos.xlsx");
  };

  const handleImportClick = () => {
    setImportModalStep('select_file');
    setSelectedFile(null);
    setImportLogs([]);
    setImportProgress(0);
    setColumnMapping({});
    setImportData(null);
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
    if (typeof value === 'number') {
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    const str = String(value).trim();
    if (str.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [d, m, y] = str.split('/');
      return `${y}-${m}-${d}`;
    }
    if (str.match(/^\d{2}\/\d{4}$/)) {
      const [m, y] = str.split('/');
      return `${y}-${m}-01`;
    }
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return str;
    }
    if (str.match(/^\d{4}-\d{2}$/)) {
      return `${str}-01`;
    }
    return str;
  };

  const parseNumber = (val: any) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    
    let str = String(val).trim();
    
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
    return isNaN(num) ? 0 : num;
  };

  const processImport = async () => {
    if (!importData) return;
    setImportModalStep('loading');
    setImportLogs(['Iniciando importação...']);
    setImportProgress(0);
    
    // Pular a primeira linha (cabeçalho)
    const dataToImport = importData.slice(1);
    const total = dataToImport.length;
    
    setImportLogs(prev => [...prev, `Arquivo carregado com ${total} linhas.`]);
    
    const mappedData = dataToImport.map(row => {
      const newRow: any = { uf: selectedUf };
      REQUIRED_FIELDS.forEach(field => {
        const letter = columnMapping[field.key];
        if (letter) {
          const index = letterToIndex(letter);
          let val = index >= 0 ? row[index] : null;
          if (field.key === 'data_referencia' && val) {
            val = parseImportDate(val);
          }
          if (['valor_desonerado', 'valor_nao_desonerado'].includes(field.key) && val !== null) {
            val = parseNumber(val);
          }
          newRow[field.key] = val;
        } else {
          newRow[field.key] = null;
        }
      });
      return newRow;
    });

    setImportLogs(prev => [...prev, 'Dados mapeados. Enviando para o servidor...']);

    try {
      const chunkSize = 500;
      const totalChunks = Math.ceil(mappedData.length / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const chunk = mappedData.slice(i * chunkSize, (i + 1) * chunkSize);
        
        const response = await fetch('/api/insumos/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Erro desconhecido na importação');
        }

        const progress = Math.round(((i + 1) / totalChunks) * 100);
        setImportProgress(progress);
        setImportLogs(prev => [...prev, `Lote ${i + 1}/${totalChunks} importado com sucesso. (${chunk.length} itens)`]);
      }

      setImportLogs(prev => [...prev, 'Recalculando composições associadas...']);
      try {
        await fetch('/api/composicoes/recalculate-all', { method: 'POST' });
        setImportLogs(prev => [...prev, 'Composições recalculadas com sucesso.']);
      } catch (e) {
        setImportLogs(prev => [...prev, 'Erro ao recalcular composições.']);
      }

      setImportLogs(prev => [...prev, 'Importação concluída com sucesso!']);
      setTimeout(() => {
        setImportModalStep(null);
        setToast({ message: 'Insumos importados com sucesso!', type: 'success' });
        fetchInsumos();
        fetchFilterOptions();
      }, 2000);
    } catch (err: any) {
      console.error('Import error:', err);
      setImportLogs(prev => [...prev, `Erro: ${err.message || 'Erro ao conectar com o servidor.'}`]);
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
      } else {
        console.error('Erro ao excluir insumo');
      }
    } catch (err) {
      console.error('Delete error:', err);
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
      } else {
        console.error('Erro ao excluir insumos');
      }
    } catch (err) {
      console.error('Bulk delete error:', err);
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
    if (!i) return false;
    const matchSearch = (i.descricao || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || String(i.codigo || '').includes(searchTerm || '');
    const matchBanco = filterBanco === 'Todos' || i.base === filterBanco;
    const matchEstado = filterEstado === 'Todos' || (i.estado || i.uf) === filterEstado;
    const matchTipo = filterTipo === 'Todos' || (i.tipo && i.tipo.toLowerCase() === filterTipo.toLowerCase());
    const matchData = filterData === 'Todos' || (i.data_referencia && typeof i.data_referencia === 'string' && i.data_referencia.length >= 7 && `${i.data_referencia.substring(5, 7)}/${i.data_referencia.substring(0, 4)}` === filterData);
    
    return matchSearch && matchBanco && matchEstado && matchTipo && matchData;
  }).sort((a, b) => {
    const descA = (a.descricao || '').toLowerCase();
    const descB = (b.descricao || '').toLowerCase();
    const codA = (a.codigo || '').toLowerCase();
    const codB = (b.codigo || '').toLowerCase();

    if (sortBy === 'descricao') return descA.localeCompare(descB);
    if (sortBy === 'codigo') return codA.localeCompare(codB);
    if (sortBy === 'valor_desc') return (b.valor_desonerado || 0) - (a.valor_desonerado || 0);
    if (sortBy === 'valor_asc') return (a.valor_desonerado || 0) - (b.valor_desonerado || 0);
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
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Insumo</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Base de dados padronizada para orçamentos.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {selectedIds.length > 0 && isAdmin && (
              <Button 
                variant="primary" 
                className="bg-red-600 hover:bg-red-700 text-white border-transparent"
                onClick={() => setDeleteConfirm({ type: 'bulk' })}
              >
                <Trash2 size={16} /> Excluir ({selectedIds.length})
              </Button>
            )}
            {isAdmin && (
              <>
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
                <Button variant="primary" onClick={openCreateModal}>
                  <Plus size={16} /> Novo Insumo
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filtros Modernizados */}
        <div className="bg-white border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar por descrição ou código..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
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
                  <option value="Todos">UF: Todos</option>
                  {uniqueEstados.filter(e => e !== 'Todos').map(e => <option key={e} value={e}>{e}</option>)}
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
                  <option value="Todos">Data: Todos</option>
                  {uniqueDatas.filter(d => d !== 'Todos').map(d => <option key={d} value={d}>{d}</option>)}
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
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Base</label>
                  <input 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newInsumo.base}
                    onChange={e => setNewInsumo({...newInsumo, base: e.target.value})}
                  />
                </div>
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
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Estado (UF)</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                    value={newInsumo.estado}
                    onChange={e => setNewInsumo({...newInsumo, estado: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    {BRAZILIAN_STATES.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Tipo</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newInsumo.tipo}
                    onChange={e => setNewInsumo({...newInsumo, tipo: e.target.value})}
                  >
                    <option>Material</option>
                    <option>Mão de Obra</option>
                    <option>Equipamento</option>
                    <option>Encargos</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Data Base</label>
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
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Valor Não Desonerado</label>
                  <input 
                    type="number"
                    step="0.01"
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

      <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-sm overflow-x-auto budget-table-container">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-indigo-50 border-b border-indigo-100">
              {isAdmin && (
                <th className="px-3 py-1.5 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={selectedIds.length === paginatedInsumos.length && paginatedInsumos.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              <th className="px-3 py-1.5 text-[11px] font-bold text-indigo-900 uppercase tracking-widest">Banco</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-indigo-900 uppercase tracking-widest">Código</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-indigo-900 uppercase tracking-widest">Descrição</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-indigo-900 uppercase tracking-widest">Unidade</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-indigo-900 uppercase tracking-widest">Tipo</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-indigo-900 uppercase tracking-widest">Data Base</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-indigo-900 uppercase tracking-widest text-right">Valor Não Deson.</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-indigo-900 uppercase tracking-widest text-right">Valor Deson.</th>
              {isAdmin && <th className="px-3 py-1.5 text-[11px] font-bold text-indigo-900 uppercase tracking-widest text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400 text-xs">Carregando insumos...</td></tr>
            ) : paginatedInsumos.length > 0 ? paginatedInsumos.map((insumo, idx) => (
              <tr 
                key={`${insumo.id_insumo}-${idx}`} 
                className="hover:bg-slate-50/80 transition-colors group"
              >
                {isAdmin && (
                  <td className="px-3 py-1.5">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedIds.includes(insumo.id_insumo)}
                      onChange={() => toggleSelectOne(insumo.id_insumo)}
                    />
                  </td>
                )}
                <td className="px-3 py-1.5">
                  <div className="text-[13px] font-medium text-slate-700">{insumo.base}</div>
                </td>
                <td className="px-3 py-1.5">
                  <div className="text-[13px] font-medium text-slate-700">{formatCode(insumo.codigo)}</div>
                </td>
                <td className="px-3 py-1.5">
                  <div className="text-[13px] font-medium text-slate-700">{insumo.descricao?.replace(/^[\d\.]+\s*/, '')}</div>
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
                <td className="px-3 py-1.5 text-right text-[13px] font-medium text-slate-700">
                  R$ {insumo.valor_nao_desonerado ? truncateToTwo(insumo.valor_nao_desonerado).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
                </td>
                <td className="px-3 py-1.5 text-right text-[13px] font-medium text-slate-700">
                  R$ {insumo.valor_desonerado ? truncateToTwo(insumo.valor_desonerado).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
                </td>
                {isAdmin && (
                  <td className="px-3 py-1.5 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {insumo.base === 'PRÓPRIA' ? (
                        <>
                          <button 
                            onClick={() => openEditModal(insumo)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 transition-all"
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirm({ type: 'single', id: insumo.id_insumo })}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <div className="p-1.5 text-slate-300 cursor-not-allowed" title="Bases oficiais não podem ser editadas">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </div>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            )) : (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400 text-xs">Nenhum insumo encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {renderPagination()}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl w-full max-sm shadow-2xl overflow-hidden p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Confirmar Exclusão</h3>
            <p className="text-slate-500 text-sm mb-6">
              {deleteConfirm.type === 'bulk' 
                ? `Tem certeza que deseja excluir os ${selectedIds.length} insumos selecionados?` 
                : 'Tem certeza que deseja excluir este insumo?'}
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              <Button 
                variant="primary" 
                className="bg-red-600 hover:bg-red-700 text-white border-transparent"
                onClick={() => {
                  if (deleteConfirm.type === 'bulk') {
                    handleBulkDelete();
                  } else if (deleteConfirm.id) {
                    handleDelete(deleteConfirm.id);
                  }
                }}
              >
                Excluir
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
            
            <div className="p-6 space-y-4">
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
                <input 
                  type="file" 
                  onChange={handleFileSelect} 
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" 
                  accept=".csv,.xlsx,.xls"
                />
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
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Importando...</h2>
              </div>
            </div>
            
            <div className="p-6">
              <div className="w-full bg-slate-200 rounded-full h-2.5 mb-4">
                <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${importProgress}%` }}></div>
              </div>
              <div className="bg-slate-900 text-emerald-400 p-4 rounded-lg font-mono text-xs h-48 overflow-y-auto flex flex-col gap-1">
                {importLogs.map((log, i) => (
                  <div key={i}>{'>'} {log}</div>
                ))}
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

export default InsumosView;

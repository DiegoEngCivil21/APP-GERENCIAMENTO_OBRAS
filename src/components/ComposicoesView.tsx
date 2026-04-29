import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Download, 
  Upload, 
  Trash2, 
  Edit2, 
  X, 
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Composicao } from '../types';
import { Button } from './UIComponents';
import AutocompleteDropdown from './AutocompleteDropdown';
import { formatCode, truncateToTwo, formatCurrency, formatDateRef, BRAZILIAN_STATES } from '../utils';

const ComposicoesView = ({ isAdmin, isMaster, onSelectComposicao }: { isAdmin: boolean, isMaster: boolean, onSelectComposicao?: (id: number, uf: string, dataRef: string) => void }) => {
  const [composicoes, setComposicoes] = useState<Composicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filterEstado, setFilterEstado] = useState(() => localStorage.getItem('composicoesFilterEstado') || '');
  const [filterData, setFilterData] = useState(() => localStorage.getItem('composicoesFilterData') || '');
  const [filterBanco, setFilterBanco] = useState(() => localStorage.getItem('composicoesFilterBanco') || '');
  const [filterCategoria, setFilterCategoria] = useState(() => localStorage.getItem('composicoesFilterCategoria') || '');
  const [availableEstados, setAvailableEstados] = useState<string[]>([]);
  const [availableDatas, setAvailableDatas] = useState<string[]>([]);
  const [availableBancos, setAvailableBancos] = useState<string[]>([]);
  const [availableCategorias, setAvailableCategorias] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('composicoesSearchTerm') || '');
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('composicoesCurrentPage');
    return saved ? parseInt(saved, 10) : 1;
  });
  const itemsPerPage = 200;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingCompId, setEditingCompId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'bulk', id?: number } | null>(null);
  const [importModalStep, setImportModalStep] = useState<'select_file' | 'mapping' | 'loading' | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedUf, setSelectedUf] = useState('DF');
  const [dataReferencia, setDataReferencia] = useState('10/2025');
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importData, setImportData] = useState<any[][] | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [sortByPrice, setSortByPrice] = useState<'none' | 'asc' | 'desc'>('none');

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const REQUIRED_FIELDS = [
    { key: 'base', label: 'Base' },
    { key: 'codigo_composicao', label: 'Código' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'tipo', label: 'Categoria' },
    { key: 'unidade', label: 'Unidade' },
    { key: 'valor_nao_desonerado', label: 'Valor Não Desonerado' },
    { key: 'valor_desonerado', label: 'Valor Desonerado' },
    { key: 'data_referencia', label: 'Data Referência' }
  ];

  const REQUIRED_FIELDS_ITEMS = [
    { key: 'base', label: 'Base da Composição' },
    { key: 'codigo_composicao', label: 'Código da Composição' },
    { key: 'codigo_insumo', label: 'Código do Insumo' },
    { key: 'coeficiente', label: 'Coeficiente (Consumo)' }
  ];

  const [importType, setImportType] = useState<'cadastro' | 'items'>('cadastro');
  const [newComp, setNewComp] = useState({
    base: 'PRÓPRIA',
    codigo_composicao: '',
    descricao: '',
    tipo: 'Composição',
    unidade: ''
  });

  const parseImportDate = (value: any) => {
    if (!value) return null;
    if (typeof value === 'number') {
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${m}/${y}`;
    }
    const str = String(value).trim();
    if (str.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [d, m, y] = str.split('/');
      return `${m}/${y}`;
    }
    if (str.match(/^\d{2}\/\d{4}$/)) {
      return str;
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

  const fetchComposicoes = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (filterEstado) params.append('estado', filterEstado);
    if (filterData) params.append('data_referencia', filterData);
    if (filterBanco) params.append('base', filterBanco);
    if (filterCategoria) params.append('tipo', filterCategoria);

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

  const fetchFilterOptions = async () => {
    try {
      const [estadosRes, datasRes, bancosRes, tiposRes] = await Promise.all([
        fetch('/api/composicoes/estados'),
        fetch('/api/composicoes/datas'),
        fetch('/api/composicoes/bancos'),
        fetch('/api/composicoes/tipos')
      ]);
      
      if (estadosRes.ok) {
        const estados = await estadosRes.json();
        setAvailableEstados(estados);
      }
      
      if (datasRes.ok) {
        const datas: string[] = await datasRes.json();
        if (datas && datas.length > 0) {
          const formattedDatas = datas.map((d: string) => {
            if (d && d.length >= 7) return `${d.substring(5, 7)}/${d.substring(0, 4)}`;
            return d;
          });
          const uniqueDatas = Array.from(new Set(formattedDatas));
          setAvailableDatas(uniqueDatas);
          
          // Se o filtro atual for vazio, define a data mais recente como padrão
          const savedData = localStorage.getItem('composicoesFilterData');
          if (!savedData && uniqueDatas.length > 0) {
            setFilterData(uniqueDatas[0]);
          }
        } else {
          setAvailableDatas([]);
          setFilterData('');
        }
      }
      
      if (bancosRes.ok) {
        const bancos = await bancosRes.json();
        setAvailableBancos(bancos);
      }

      if (tiposRes.ok) {
        const tipos = await tiposRes.json();
        setAvailableCategorias(tipos);
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchComposicoes();
    
    if (localStorage.getItem('openNewComposicaoModal') === 'true') {
      localStorage.removeItem('openNewComposicaoModal');
      openCreateModal();
    }
  }, [filterEstado, filterData, filterBanco, filterCategoria, searchTerm]);

  useEffect(() => {
    localStorage.setItem('composicoesSearchTerm', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem('composicoesCurrentPage', currentPage.toString());
    const scrollArea = document.getElementById('main-scroll-area');
    if (scrollArea) scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem('composicoesFilterEstado', filterEstado);
  }, [filterEstado]);

  useEffect(() => {
    localStorage.setItem('composicoesFilterData', filterData);
  }, [filterData]);

  useEffect(() => {
    localStorage.setItem('composicoesFilterBanco', filterBanco);
  }, [filterBanco]);

  useEffect(() => {
    localStorage.setItem('composicoesFilterCategoria', filterCategoria);
  }, [filterCategoria]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingCompId ? `/api/composicoes/${editingCompId}` : '/api/composicoes';
    const method = editingCompId ? 'PUT' : 'POST';

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

  const processImport = async () => {
    if (!importData) return;
    
    // Validation: Check if UF and Data Referência are provided
    if (!selectedUf || !dataReferencia) {
      setToast({ message: 'UF e Data Referência são obrigatórios!', type: 'error' });
      return;
    }

    setImportModalStep('loading');
    setImportLogs(['Iniciando importação...']);
    setImportProgress(0);
    
    const dataToImport = importData.slice(1);
    const total = dataToImport.length;
    
    setImportLogs(prev => [...prev, `Arquivo carregado com ${total} linhas.`]);
    
    const mappedData = dataToImport.map(row => {
      // Use column mapping for data_referencia if available, otherwise fallback
      const dataRefCol = columnMapping['data_referencia'];
      const dataRefIndex = dataRefCol ? letterToIndex(dataRefCol) : -1;
      const dataRefFromCol = dataRefIndex >= 0 && row[dataRefIndex] ? parseImportDate(row[dataRefIndex]) : dataReferencia;
      const newRow: any = { estado: selectedUf, data_referencia: dataRefFromCol };
      
      REQUIRED_FIELDS.forEach(field => {
        if (field.key === 'data_referencia') return; // Handled separately
        
        const letter = columnMapping[field.key];
        if (letter) {
          const index = letterToIndex(letter);
          let val = index >= 0 ? row[index] : null;
          
          if (['coeficiente', 'valor_desonerado', 'valor_nao_desonerado'].includes(field.key) && val !== null) {
            val = parseNumber(val);
          }
          newRow[field.key] = val;
        }
      });
      return newRow;
    }).filter(row => {
      return row.codigo_composicao && row.descricao;
    });

    setImportLogs(prev => [...prev, `${mappedData.length} linhas válidas encontradas.`]);

    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;

    const endpoint = '/api/composicoes/bulk';
    const payloadKey = 'composicoes';

    for (let i = 0; i < mappedData.length; i += batchSize) {
      const batch = mappedData.slice(i, i + batchSize);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [payloadKey]: batch })
        });
        
        if (res.ok) {
          successCount += batch.length;
          setImportLogs(prev => [...prev, `Lote ${Math.floor(i/batchSize) + 1} importado com sucesso.`]);
        } else {
          errorCount += batch.length;
          setImportLogs(prev => [...prev, `Erro ao importar lote ${Math.floor(i/batchSize) + 1}.`]);
        }
      } catch (err) {
        errorCount += batch.length;
        setImportLogs(prev => [...prev, `Falha de conexão no lote ${Math.floor(i/batchSize) + 1}.`]);
      }
      
      setImportProgress(Math.round(((i + batch.length) / mappedData.length) * 100));
    }

    setImportLogs(prev => [...prev, 'Recalculando composições associadas...']);
    try {
      await fetch('/api/composicoes/recalculate-all', { method: 'POST' });
      setImportLogs(prev => [...prev, 'Composições recalculadas com sucesso.']);
    } catch (e) {
      setImportLogs(prev => [...prev, 'Erro ao recalcular composições.']);
    }

    setImportLogs(prev => [...prev, 'Importação concluída!', `Sucesso: ${successCount}`, `Erros: ${errorCount}`]);
    fetchComposicoes();
    
    setTimeout(() => {
      setImportModalStep(null);
      setSelectedFile(null);
      setImportData(null);
      setImportProgress(0);
      setImportLogs([]);
    }, 3000);
  };

  const openCreateModal = () => {
    setEditingCompId(null);
    setNewComp({
      base: 'PRÓPRIA',
      codigo_composicao: '',
      descricao: '',
      tipo: 'Composição',
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
      tipo: comp.tipo || 'Composição',
      unidade: comp.unidade
    });
    setShowModal(true);
  };

  const filteredComposicoes = (composicoes || []).filter(c => {
    if (!c) return false;
    const matchSearch = (c.descricao || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || String(c.codigo_composicao || '').includes(searchTerm || '');
    return matchSearch;
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
    if (totalPages <= 1) return null;
    
    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm mt-4">
        <div className="text-sm text-slate-500">
          Mostrando <span className="font-medium text-slate-900">{((currentPage - 1) * itemsPerPage) + 1}</span> a <span className="font-medium text-slate-900">{Math.min(currentPage * itemsPerPage, filteredComposicoes.length)}</span> de <span className="font-medium text-slate-900">{filteredComposicoes.length}</span> resultados
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          
          {startPage > 1 && (
            <>
              <button onClick={() => setCurrentPage(1)} className="px-3 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">1</button>
              {startPage > 2 && <span className="px-2 py-1 text-slate-400">...</span>}
            </>
          )}
          
          {Array.from({ length: endPage - startPage + 1 }).map((_, i) => {
            const page = startPage + i;
            return (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 rounded-md border ${currentPage === page ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {page}
              </button>
            );
          })}
          
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="px-2 py-1 text-slate-400">...</span>}
              <button onClick={() => setCurrentPage(totalPages)} className="px-3 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">{totalPages}</button>
            </>
          )}
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Próxima
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-lg border flex items-center gap-3 z-50 ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <div className="font-medium">{toast.message}</div>
          <button onClick={() => setToast(null)} className="opacity-50 hover:opacity-100"><X size={16} /></button>
        </div>
      )}

      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">COMPOSIÇÃO</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Agrupamentos hierárquicos de insumos e subcomposições.</p>
          </div>
          
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
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
                <Plus size={16} /> Nova Composição
              </Button>
            </div>
          )}
        </div>

        {/* Filtros Modernizados */}
        <div className="bg-white border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
          <div className="p-5">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Pesquisar por código ou descrição..." 
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              
              <div className="flex flex-wrap gap-3">
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
                    {availableEstados.map(estado => <option key={String(estado)} value={String(estado)}>{String(estado)}</option>)}
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
                    {availableDatas.map(d => (
                      <option key={String(d)} value={String(d)}>
                        {String(d)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Banco:</span>
                  <select 
                    className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                    value={filterBanco}
                    onChange={e => setFilterBanco(e.target.value)}
                  >
                    {availableBancos.map(b => <option key={String(b)} value={String(b)}>{String(b)}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Categoria:</span>
                  <select 
                    className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                    value={filterCategoria}
                    onChange={e => setFilterCategoria(e.target.value)}
                  >
                    {availableCategorias.map(t => <option key={String(t)} value={String(t)}>{String(t)}</option>)}
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
      </div>

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
                    checked={selectedIds.length === paginatedComposicoes.length && paginatedComposicoes.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              <th className="px-3 py-1.5 text-[11px] font-bold text-indigo-900 uppercase tracking-widest">Base</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-indigo-900 uppercase tracking-widest">Data</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-indigo-900 uppercase tracking-widest">Código</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-indigo-900 uppercase tracking-widest">Descrição</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-indigo-900 uppercase tracking-widest">Categoria</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Unidade</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Valor Não Desonerado</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Valor Desonerado</th>
              <th className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={11} className="px-5 py-10 text-center text-slate-400 text-xs">Carregando composições...</td></tr>
            ) : paginatedComposicoes.length > 0 ? paginatedComposicoes.map((comp, idx) => (
              <React.Fragment key={`${comp.id_composicao}-${idx}`}>
                <tr className="hover:bg-slate-50/80 transition-colors group">
                  {isAdmin && (
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
                    <div className="text-[13px] font-medium text-slate-700">{comp.base || 'SINAPI'}</div>
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
                      {comp.descricao?.replace(/^[\d\.]+\s*/, '')}
                    </button>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="text-[13px] font-medium text-slate-700">{comp.tipo || 'Composição'}</div>
                  </td>
                  <td className="px-3 py-1.5 text-[13px] font-medium text-slate-700">{comp.unidade}</td>
                  <td className="px-3 py-1.5 text-right text-[13px] font-medium text-slate-700">
                    {comp.valor_nao_desonerado ? formatCurrency(comp.valor_nao_desonerado) : '-'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-[13px] font-medium text-slate-700">
                    {comp.valor_desonerado ? formatCurrency(comp.valor_desonerado) : '-'}
                  </td>
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
                      {isAdmin && (
                        <>
                          {comp.base === 'PRÓPRIA' ? (
                            <>
                              <button 
                                onClick={() => openEditModal(comp)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button 
                                onClick={() => setDeleteConfirm({ type: 'single', id: comp.id_composicao })}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          ) : (
                            <div className="p-1.5 text-slate-300 cursor-not-allowed" title="Bases oficiais não podem ser editadas">
                              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              </React.Fragment>
            )) : (
              <tr><td colSpan={isAdmin ? 10 : 9} className="px-5 py-10 text-center text-slate-400 text-xs">Nenhuma composição encontrada.</td></tr>
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Importar Composições</h3>
              {importModalStep !== 'loading' && (
                <button onClick={() => setImportModalStep(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              )}
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {importModalStep === 'select_file' && (
                <div className="space-y-4">
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
                    <label className="block text-sm font-bold text-slate-700 mb-2">Data de Referência (MM/YYYY)</label>
                    <input 
                      type="text"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      value={dataReferencia}
                      onChange={(e) => setDataReferencia(e.target.value)}
                    />
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
              )}

              {importModalStep === 'mapping' && (
                <div className="space-y-6">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800">
                    <p className="font-bold mb-1">Mapeamento de Colunas</p>
                    <p>Informe a letra da coluna do Excel/CSV correspondente a cada campo do sistema.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {REQUIRED_FIELDS.map(field => (
                      <div key={field.key} className="flex items-center gap-3 p-2 rounded-lg border border-slate-200 bg-slate-50/50">
                        <label className="flex-1 text-sm font-medium text-slate-700">{field.label}</label>
                        <input 
                          type="text" 
                          placeholder="Ex: A"
                          maxLength={2}
                          className="w-16 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-center font-bold uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={columnMapping[field.key] || ''}
                          onChange={(e) => setColumnMapping({...columnMapping, [field.key]: e.target.value.toUpperCase()})}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importModalStep === 'loading' && (
                <div className="space-y-6 py-8">
                  <div className="text-center space-y-2">
                    <div className="text-4xl font-black text-indigo-600">{importProgress}%</div>
                    <p className="text-slate-500 font-medium">Processando importação...</p>
                  </div>
                  
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                      style={{ width: `${importProgress}%` }}
                    ></div>
                  </div>
                  
                  <div className="bg-slate-900 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs text-emerald-400 space-y-1">
                    {importLogs.map((log, i) => (
                      <div key={i}>{'>'} {log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
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
                  <Button variant="primary" onClick={processImport}>Iniciar Importação</Button>
                </>
              )}
              {importModalStep === 'loading' && (
                <Button 
                  variant="primary" 
                  onClick={() => {
                    setImportModalStep(null);
                    fetchComposicoes();
                  }}
                  disabled={importProgress < 100}
                >
                  Concluir
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ComposicoesView;

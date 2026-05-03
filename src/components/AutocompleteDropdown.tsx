import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Plus } from 'lucide-react';

interface AutocompleteDropdownProps {
  type: 'insumo' | 'composicao';
  onSelect: (item: any) => void;
  placeholder?: string;
  codigo?: string;
  descricao?: string;
  base?: string;
  showInput?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  inputClassName?: string;
  dropdownClassName?: string;
  dropdownStyle?: React.CSSProperties;
  hideIcon?: boolean;
  autoFocus?: boolean;
  desonerado?: boolean;
  bases?: string[];
  estado?: string;
  dataReferencia?: string;
}

const AutocompleteDropdown = React.forwardRef<HTMLInputElement, AutocompleteDropdownProps>(({ 
  type, onSelect, placeholder, codigo, descricao, base, 
  showInput = true, value, onChange, inputClassName, dropdownClassName, dropdownStyle, hideIcon, 
  autoFocus, desonerado = true, bases = [], estado = 'DF', dataReferencia = '2026-04-01'
}, ref) => {
  console.log('AutocompleteDropdown rendered', { type, value, showInput });
  const [internalQuery, setInternalQuery] = useState('');
  const query = value !== undefined ? value : internalQuery;
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [dropdownWidth, setDropdownWidth] = useState<number | string>(dropdownStyle?.width || '1150px');
  const [dropdownLeft, setDropdownLeft] = useState<number | string>(dropdownStyle?.left || 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const ignoreNextOpen = useRef(false);

  useEffect(() => {
    if (isOpen && selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.autocomplete-item');
      if (items[selectedIndex]) {
        (items[selectedIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);

  useEffect(() => {
    const tableContainer = containerRef.current?.closest('.budget-table-container');
    const updatePos = () => {
      if (tableContainer && containerRef.current) {
        const tableRect = tableContainer.getBoundingClientRect();
        const containerRect = containerRef.current!.getBoundingClientRect();
        setDropdownWidth(tableRect.width);
        setDropdownLeft(tableRect.left - containerRect.left);
      } else {
        // Fallback responsivo quando não está em uma tabela de orçamento
        const availableWidth = window.innerWidth - 40;
        const width = Math.min(1200, availableWidth);
        setDropdownWidth(width);
        setDropdownLeft('50%');
      }
    };

    updatePos();
    const observer = tableContainer ? new ResizeObserver(updatePos) : null;
    if (observer && tableContainer) observer.observe(tableContainer);
    window.addEventListener('resize', updatePos);
    
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updatePos);
    };
  }, [dropdownStyle?.width, dropdownStyle?.left]);

  const handleQueryChange = (newQuery: string) => {
    if (onChange) {
      onChange(newQuery);
    } else {
      setInternalQuery(newQuery);
    }
    // Only open if there's actually a change that warrants searching
    setIsOpen(true);
  };

  useEffect(() => {
    // Only open if showInput is true and we have query, 
    // or if the search actually returned something and we are focused.
    // Removed the force-open when showInput is false to prevent "white screen" issues on click.
    if (showInput && (codigo || descricao)) {
      if (containerRef.current?.contains(document.activeElement)) {
        setIsOpen(true);
      }
    }
  }, [codigo, descricao, showInput]);

  useEffect(() => {
    const checkIsTriggerInput = (target: Node | null) => {
      if (!target) return false;
      const el = target as HTMLElement;
      if (el.tagName === 'INPUT') {
        const placeholder = el.getAttribute('placeholder') || '';
        if (placeholder === 'Código' || placeholder.includes('Descrição')) {
          const myRow = containerRef.current?.closest('tr');
          const targetRow = el.closest('tr');
          if (myRow && targetRow && myRow === targetRow) {
            return true;
          }
          if (!myRow) return true;
        }
      }
      return false;
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (!showInput && checkIsTriggerInput(event.target as Node)) {
          return;
        }
        setIsOpen(false);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (!showInput && checkIsTriggerInput(event.target as Node)) {
          return;
        }
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [showInput]);

  useEffect(() => {
      if (value === undefined) {
      setInternalQuery('');
    }
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  }, [type]);

  useEffect(() => {
    // If the query matches the description of a selected item exactly, don't open by default
    if (query.length < 2 && !codigo && !descricao) {
      setResults(prev => prev.length === 0 ? prev : []);
      return;
    }

    const endpoint = type === 'insumo' ? '/api/insumos' : '/api/composicoes';
    const params = new URLSearchParams();
    if (query) params.append('search', query);
    if (codigo) params.append('codigo', codigo);
    if (descricao) params.append('descricao', descricao);
    if (estado) params.append('estado', estado);
    if (dataReferencia) params.append('data_referencia', dataReferencia);
    
    if (base) {
      params.append('base', base);
    } else if (bases && bases.length > 0) {
      params.append('bases', bases.join(','));
    }

    fetch(`${endpoint}?${params.toString()}`)
      .then(async res => {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          return json;
        } catch (e) {
          throw new Error(`Invalid JSON: ${text.substring(0, 20)}...`);
        }
      })
      .then(data => {
        if (Array.isArray(data)) {
          let filtered = data;
          if (bases && bases.length > 0) {
            filtered = data.filter(item => bases.map(b => b.toLowerCase()).includes(item.base?.toLowerCase() || ''));
          }
          const newResults = filtered.slice(0, 100);
          setResults(prev => {
            const next = JSON.stringify(prev) === JSON.stringify(newResults) ? prev : newResults;
            return next;
          });
          
            // Don't auto-open if it's the exact same as current query and we just selected something
          if (ignoreNextOpen.current) {
            setIsOpen(false);
            setSelectedIndex(-1);
            ignoreNextOpen.current = false;
          } else if (!showInput || containerRef.current?.contains(document.activeElement)) {
            // Only open if query is not exactly one of the results (meaning it might be already selected)
            const exactMatch = newResults.find(r => (type === 'insumo' ? r.codigo : r.codigo_composicao) === query || r.descricao === query);
            if (!exactMatch) {
                setIsOpen(true);
                setSelectedIndex(-1);
            }
          }
        }
      })
      .catch(err => console.error(`Error fetching autocomplete for ${endpoint}:`, err));
  }, [query, type, codigo, descricao, base, bases, estado, dataReferencia]);

  useEffect(() => {
    const handleDocumentKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.min(prev + 1, results.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          e.preventDefault();
          e.stopPropagation();
          const item = results[selectedIndex];
          const price = desonerado 
            ? (item.valor_desonerado !== null && item.valor_desonerado !== undefined ? Number(item.valor_desonerado) : (Number(item.preco_unitario) || 0)) 
            : (item.valor_nao_desonerado !== null && item.valor_nao_desonerado !== undefined ? Number(item.valor_nao_desonerado) : (Number(item.preco_unitario) || 0));
          
          ignoreNextOpen.current = true;
          onSelect({
            ...item,
            preco_unitario: price
          });
          if (value === undefined) {
            setInternalQuery('');
          }
          setIsOpen(false);
          setSelectedIndex(-1);
        } else if (selectedIndex === results.length || selectedIndex === -1) {
          if (query) {
            e.preventDefault();
            e.stopPropagation();
            ignoreNextOpen.current = true;
            onSelect({ 
              isNew: true, 
              descricao: query,
              tipo: type,
              base: 'PRÓPRIO'
            });
            setIsOpen(false);
            setSelectedIndex(-1);
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('keydown', handleDocumentKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleDocumentKeyDown, { capture: true });
  }, [isOpen, results, query, selectedIndex, type, desonerado, value, onSelect]);

  return (
    <div ref={containerRef} onClick={(e) => e.stopPropagation()}>
      {showInput && (
        <div className="relative">
          {!hideIcon && <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />}
          <input
            ref={ref}
            type="text"
            autoFocus={autoFocus}
            className={inputClassName || `w-full ${hideIcon ? 'px-4' : 'pl-9 pr-4'} py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none`}
            placeholder={placeholder || `Buscar ${type}...`}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => {
                // Only open on focus if there's enough query or it's empty
                if (query.length > 0) {
                   setIsOpen(true);
                }
            }}
            onBlur={() => {
              // Delay closing to allow clicking on results
              setTimeout(() => {
                if (!containerRef.current?.contains(document.activeElement)) {
                  setIsOpen(false);
                }
              }, 50);
            }}
          />
        </div>
      )}

      {isOpen && results.length > 0 && (
        <div 
          className="absolute top-full z-[100] bg-white shadow-2xl border border-slate-300 flex flex-col overflow-hidden rounded-b-lg"
          style={{ 
            ...dropdownStyle, 
            left: dropdownLeft, 
            width: dropdownWidth, 
            minWidth: dropdownWidth, 
            transform: dropdownLeft === '50%' ? 'translateX(-50%)' : 'none' 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Table Header */}
          <div className="bg-[#333333] text-white py-2 px-2 grid grid-cols-[70px_100px_1fr_50px_80px_100px] text-[11px] font-bold uppercase tracking-wider">
            <div className="text-center">BASE</div>
            <div className="text-left">CÓDIGO</div>
            <div className="text-left">DESCRIÇÃO</div>
            <div className="text-center">UN</div>
            <div className="text-center">DATA</div>
            <div className="text-right">VALOR</div>
          </div>

          {/* Results List */}
          <div ref={listRef} className="max-h-[400px] overflow-y-auto divide-y divide-slate-100">
            {results.map((item, idx) => {
              const price = desonerado 
                ? (item.valor_desonerado !== null && item.valor_desonerado !== undefined ? Number(item.valor_desonerado) : (Number(item.preco_unitario) || 0)) 
                : (item.valor_nao_desonerado !== null && item.valor_nao_desonerado !== undefined ? Number(item.valor_nao_desonerado) : (Number(item.preco_unitario) || 0));
              const dateStr = item.data_referencia ? `${item.data_referencia.substring(5, 7)}/${item.data_referencia.substring(0, 4)}` : '-';
              return (
                <button
                  key={`${type}-${type === 'insumo' ? item.id_insumo : item.id_composicao}-${idx}`}
                  className={`autocomplete-item w-full text-left py-2 px-2 transition-colors grid grid-cols-[70px_100px_1fr_50px_80px_100px] items-center group border-b border-slate-100 ${idx === selectedIndex ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-slate-50'}`}
                  onClick={() => {
                    ignoreNextOpen.current = true;
                    onSelect({
                      ...item,
                      preco_unitario: price
                    });
                    if (value === undefined) {
                      setInternalQuery('');
                    }
                    setIsOpen(false);
                    setSelectedIndex(-1);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className={`text-[11px] text-center font-bold ${idx === selectedIndex ? 'text-indigo-600' : 'text-slate-500'}`}>{item.base || '-'}</div>
                  <div className={`text-[12px] font-medium ${idx === selectedIndex ? 'text-indigo-800' : 'text-slate-600'}`}>{type === 'insumo' ? item.codigo : item.codigo_composicao}</div>
                  <div className={`text-[12px] pr-4 truncate ${idx === selectedIndex ? 'text-indigo-900 font-medium' : 'text-slate-800'}`} title={item.descricao}>{item.descricao?.replace(/^[\d\.]+\s*/, '')}</div>
                  <div className={`text-[11px] text-center ${idx === selectedIndex ? 'text-indigo-600' : 'text-slate-500'}`}>{item.unidade}</div>
                  <div className={`text-[11px] text-center ${idx === selectedIndex ? 'text-indigo-600' : 'text-slate-500'}`}>{dateStr}</div>
                  <div className={`text-[12px] text-right font-semibold ${idx === selectedIndex ? 'text-indigo-900' : 'text-slate-900'}`}>{price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </button>
              );
            })}
            
            <button
              className={`autocomplete-item w-full text-left px-4 py-3 text-[11px] font-bold flex items-center justify-center gap-2 transition-colors ${selectedIndex === results.length ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 hover:bg-indigo-50 text-indigo-600'}`}
              onClick={() => {
                ignoreNextOpen.current = true;
                onSelect({ 
                  isNew: true, 
                  descricao: query,
                  tipo: type,
                  base: 'PRÓPRIO'
                });
                setIsOpen(false);
                setSelectedIndex(-1);
              }}
              onMouseEnter={() => setSelectedIndex(results.length)}
            >
              <Plus size={14} />
              <span>CRIAR NOVO {type.toUpperCase()} COM ESTA DESCRIÇÃO: "{query}"</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default AutocompleteDropdown;

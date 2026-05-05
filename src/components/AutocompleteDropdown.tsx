import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Plus } from 'lucide-react';

interface AutocompleteDropdownProps {
  type: 'insumo' | 'composicao' | 'both';
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
  const [internalQuery, setInternalQuery] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const skipNextSearchRef = useRef(false);
  const query = value !== undefined ? value : internalQuery;
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [justSelected, setJustSelected] = useState(false);
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
    setJustSelected(false);
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
    if (showInput && (codigo || descricao) && !justSelected) {
      const isMyInputFocused = containerRef.current?.querySelector('input') === document.activeElement;
      if (isMyInputFocused) {
        setIsOpen(true);
      }
    }
  }, [codigo, descricao, showInput, justSelected]);

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

    const searchAction = async () => {
      if (skipNextSearchRef.current) {
        skipNextSearchRef.current = false;
        return;
      }
      const endpoints: { url: string, type: 'insumo' | 'composicao' }[] = [];
      if (type === 'insumo' || type === 'both') endpoints.push({ url: '/api/insumos', type: 'insumo' });
      if (type === 'composicao' || type === 'both') endpoints.push({ url: '/api/composicoes', type: 'composicao' });

      try {
        const promiseResults = await Promise.all(endpoints.map(async (e) => {
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

          const res = await fetch(`${e.url}?${params.toString()}`);
          const data = await res.json();
          if (Array.isArray(data)) {
             return data.map(item => ({ ...item, itemType: e.type }));
          }
          return [];
        }));

        let combined = promiseResults.flat();
        
        if (bases && bases.length > 0) {
          combined = combined.filter(item => bases.map(b => b.toLowerCase()).includes(item.base?.toLowerCase() || ''));
        }

        // Sort by search relevance (simplified: exact match first, then starts with, then includes)
        const q = query.toLowerCase();
        combined.sort((a, b) => {
           const aDesc = (a.descricao || '').toLowerCase();
           const bDesc = (b.descricao || '').toLowerCase();
           const aMatch = aDesc === q;
           const bMatch = bDesc === q;
           if (aMatch && !bMatch) return -1;
           if (!aMatch && bMatch) return 1;
           
           const aStart = aDesc.startsWith(q);
           const bStart = bDesc.startsWith(q);
           if (aStart && !bStart) return -1;
           if (!aStart && bStart) return 1;
           
           return aDesc.localeCompare(bDesc);
        });

        const newResults = combined.slice(0, 100);
        setResults(prev => {
          const next = JSON.stringify(prev) === JSON.stringify(newResults) ? prev : newResults;
          return next;
        });
        
        // Don't auto-open if it's the exact same as current query and we just selected something
        const isMyInputFocused = containerRef.current?.querySelector('input') === document.activeElement;

        if (ignoreNextOpen.current || justSelected) {
          setIsOpen(false);
          setSelectedIndex(-1);
          ignoreNextOpen.current = false;
        } else if (!showInput || isMyInputFocused) {
          // Only open if the input is actually focused to prevent it from popping up while editing other fields (like quantity)
          const cleanQuery = query.toLowerCase().trim();
          const exactMatch = newResults.find(r => {
              const rCodigo = (r.itemType === 'insumo' ? r.codigo : r.codigo_composicao)?.toString().toLowerCase();
              const rDesc = r.descricao?.replace(/^[\d\.]+\s*/, '').toLowerCase().trim();
              return rCodigo === cleanQuery || rDesc === cleanQuery || r.descricao?.toLowerCase().trim() === cleanQuery;
          });
          if (!exactMatch) {
              setIsOpen(true);
              setSelectedIndex(-1);
          }
        }
      } catch (err) {
        console.error(`Error fetching unified autocomplete:`, err);
      }
    };

    searchAction();
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
          setJustSelected(true);
          onSelect({
            ...item,
            preco_unitario: price,
            type: item.itemType
          });
          if (value === undefined) {
            setInternalQuery(item.descricao || '');
          }
          setIsOpen(false);
          setSelectedIndex(-1);
        } else if (selectedIndex === results.length || selectedIndex === -1) {
          if (query) {
            e.preventDefault();
            e.stopPropagation();
            ignoreNextOpen.current = true;
            setJustSelected(true);
            onSelect({ 
              isNew: true, 
              descricao: query,
              tipo: type === 'both' ? 'insumo' : type,
              base: 'PRÓPRIO',
              type: type === 'both' ? 'insumo' : type
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
            placeholder={placeholder || `Buscar ${type === 'both' ? 'item' : type}...`}
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
                if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
                  setIsOpen(false);
                }
              }, 300);
            }}
          />
        </div>
      )}

      {isOpen && results.length > 0 && (
        <div 
          className="absolute top-full z-[100] bg-white shadow-2xl border border-slate-300 flex flex-col overflow-hidden rounded-b-lg scrollbar-thin"
          style={{ 
            ...dropdownStyle, 
            left: dropdownLeft, 
            width: dropdownWidth, 
            minWidth: dropdownWidth, 
            transform: dropdownLeft === '50%' ? (dropdownStyle?.transform || 'translateX(-50%)') : 'none' 
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            // Prevent blur when clicking anywhere inside the dropdown
            e.preventDefault();
          }}
        >
          {/* Table Header */}
          <div className="bg-[#333333] text-white py-2.5 px-3 grid grid-cols-[30px_90px_120px_1fr_50px_80px_110px] text-[10px] font-black uppercase tracking-widest border-b border-slate-600">
            <div className="text-center">TIPO</div>
            <div className="text-center border-l border-slate-600">BANCO</div>
            <div className="text-left border-l border-slate-600 pl-3">CÓDIGO</div>
            <div className="text-left border-l border-slate-600 pl-3">DESCRIÇÃO</div>
            <div className="text-center border-l border-slate-600">UN</div>
            <div className="text-center border-l border-slate-600">DATA REF.</div>
            <div className="text-right border-l border-slate-600 pr-2">VALOR UNIT.</div>
          </div>

          {/* Results List */}
          <div ref={listRef} className="max-h-[450px] overflow-y-auto divide-y divide-slate-100 bg-white">
            {results.map((item, idx) => {
              const price = desonerado 
                ? (item.valor_desonerado !== null && item.valor_desonerado !== undefined ? Number(item.valor_desonerado) : (Number(item.preco_unitario) || 0)) 
                : (item.valor_nao_desonerado !== null && item.valor_nao_desonerado !== undefined ? Number(item.valor_nao_desonerado) : (Number(item.preco_unitario) || 0));
              const dateStr = item.data_referencia ? `${item.data_referencia.substring(5, 7)}/${item.data_referencia.substring(0, 4)}` : '-';
              const isComp = item.itemType === 'composicao';
              return (
                <button
                  key={`${item.itemType}-${isComp ? item.id_composicao : item.id_insumo}-${idx}`}
                  className={`autocomplete-item w-full text-left py-2.5 px-3 transition-all grid grid-cols-[30px_90px_120px_1fr_50px_80px_110px] items-center group ${idx === selectedIndex ? 'bg-indigo-50/80' : 'hover:bg-slate-50'}`}
                  onMouseDown={(e) => {
                    // Use onMouseDown for selection to beat the onBlur event and handle immediately
                    e.preventDefault();
                    e.stopPropagation();
                    
                    skipNextSearchRef.current = true;
                    ignoreNextOpen.current = true;
                    setJustSelected(true);
                    onSelect({
                      ...item,
                      preco_unitario: price,
                      type: item.itemType,
                      codigo: isComp ? item.codigo_composicao : item.codigo // Ensure consistent field name for selection
                    });
                    setInternalQuery(item.descricao || '');
                    setIsOpen(false);
                    setSelectedIndex(-1);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect({
                      ...item,
                      preco_unitario: price,
                      type: item.itemType,
                      codigo: isComp ? item.codigo_composicao : item.codigo
                    });
                    setInternalQuery(item.descricao || '');
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="text-center">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-black shadow-sm ${isComp ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                      {isComp ? 'C' : 'I'}
                    </span>
                  </div>
                  <div className={`text-[11px] text-center font-black tracking-wider ${idx === selectedIndex ? 'text-indigo-600' : 'text-slate-500'}`}>
                    <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">{item.base || '-'}</span>
                  </div>
                  <div className={`text-[13px] font-black pl-3 ${idx === selectedIndex ? 'text-indigo-800' : 'text-slate-700'}`}>
                    {isComp ? item.codigo_composicao : item.codigo}
                  </div>
                  <div className={`text-[12px] pl-3 pr-4 truncate leading-tight ${idx === selectedIndex ? 'text-indigo-900 font-medium' : 'text-slate-800'}`} title={item.descricao}>
                    {item.descricao?.replace(/^[\d\.]+\s*/, '')}
                  </div>
                  <div className={`text-[11px] text-center font-bold ${idx === selectedIndex ? 'text-indigo-600' : 'text-slate-500'}`}>
                    {item.unidade}
                  </div>
                  <div className={`text-[11px] text-center font-medium ${idx === selectedIndex ? 'text-indigo-600' : 'text-slate-500'}`}>
                    {dateStr}
                  </div>
                  <div className={`text-[13px] text-right font-black font-mono pr-2 ${idx === selectedIndex ? 'text-indigo-900' : 'text-slate-900'}`}>
                    {price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </button>
              );
            })}
            
            <button
              className={`autocomplete-item w-full text-left px-4 py-3 text-[11px] font-bold flex items-center justify-center gap-2 transition-colors ${selectedIndex === results.length ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 hover:bg-indigo-50 text-indigo-600'}`}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                
                ignoreNextOpen.current = true;
                setJustSelected(true);
                onSelect({ 
                  isNew: true, 
                  descricao: query,
                  tipo: type === 'both' ? 'insumo' : type,
                  base: 'PRÓPRIO',
                  type: type === 'both' ? 'insumo' : type
                });
                setIsOpen(false);
                setSelectedIndex(-1);
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect({ 
                  isNew: true, 
                  descricao: query,
                  tipo: type === 'both' ? 'insumo' : type,
                  base: 'PRÓPRIO',
                  type: type === 'both' ? 'insumo' : type
                });
                setIsOpen(false);
              }}
              onMouseEnter={() => setSelectedIndex(results.length)}
            >
              <Plus size={14} />
              <span>CRIAR NOVO {type === 'both' ? 'ITEM' : type.toUpperCase()} COM ESTA DESCRIÇÃO: "{query}"</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default AutocompleteDropdown;

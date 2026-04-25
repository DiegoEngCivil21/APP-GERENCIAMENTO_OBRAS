import React, { useState } from 'react';
import { Search } from 'lucide-react';
import AutocompleteDropdown from './AutocompleteDropdown';

interface SearchDialogProps {
  type: 'insumo' | 'composicao';
  onSelect: (item: any) => void;
}

export const SearchDialog = ({ type, onSelect }: SearchDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 hover:bg-blue-100 rounded text-blue-600 transition-colors"
        title={`Buscar ${type}`}
      >
        <Search size={14} />
      </button>
      
      {isOpen && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-[110]"
          onClick={(e) => e.stopPropagation()}
        >
          <AutocompleteDropdown 
            type={type}
            onSelect={(item) => {
              onSelect(item);
              setIsOpen(false);
            }}
            autoFocus
          />
        </div>
      )}
    </div>
  );
};

export default SearchDialog;

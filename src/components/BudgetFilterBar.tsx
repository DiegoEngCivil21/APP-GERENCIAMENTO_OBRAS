import React from 'react';
import { ShieldCheck, X } from 'lucide-react';

interface BudgetFilterBarProps {
  encargos: { desonerado: boolean; estado: string; dataReferencia: string };
  setEncargos: React.Dispatch<React.SetStateAction<any>>;
  setBancosAtivos: React.Dispatch<React.SetStateAction<any[]>>;
}

export const BudgetFilterBar: React.FC<BudgetFilterBarProps> = ({ 
  encargos, 
  setEncargos, 
  setBancosAtivos
}) => {
  return (
    <div className="flex items-center justify-between w-full bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Desoneração:</span>
          <button 
            onClick={() => setEncargos((prev: any) => ({ ...prev, desonerado: !prev.desonerado }))}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider transition-all ${
              encargos.desonerado ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-200 text-slate-500'
            }`}
          >
            {encargos.desonerado ? <ShieldCheck size={10} /> : <X size={10} />}
            {encargos.desonerado ? 'Desonerado' : 'Não Desonerado'}
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado:</span>
          <select 
            value={encargos.estado}
            onChange={(e) => setEncargos((prev: any) => ({ ...prev, estado: e.target.value }))}
            className="bg-transparent font-bold text-[10px] text-[#003366] outline-none cursor-pointer"
          >
            {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Referência:</span>
          <input 
            type="month"
            value={encargos.dataReferencia}
            onChange={(e) => {
              const newDate = e.target.value;
              setEncargos((prev: any) => ({ ...prev, dataReferencia: newDate }));
              setBancosAtivos((prev: any[]) => prev.map(b => {
                if (!b.active) return b;
                const matchingDate = b.available_dates?.find((d: string) => d.startsWith(newDate));
                if (matchingDate) {
                  return { ...b, data_referencia: matchingDate };
                }
                return { ...b, data_referencia: `${newDate}-01` };
              }));
            }}
            className="bg-transparent font-bold text-[10px] text-[#003366] outline-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

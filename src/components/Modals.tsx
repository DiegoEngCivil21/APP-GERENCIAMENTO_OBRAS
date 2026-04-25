import React from 'react';
import { motion } from 'motion/react';
import { X, Percent, Database, ShieldCheck } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: any;
  children: React.ReactNode;
  onSave: () => void;
}

const BaseModal = ({ isOpen, onClose, title, icon: Icon, children, onSave }: ModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#003366] rounded-xl text-white">
              <Icon size={20} />
            </div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        
        <div className="p-8">
          {children}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-white transition-all">
            Cancelar
          </button>
          <button onClick={onSave} className="px-8 py-2.5 bg-[#003366] text-white rounded-xl font-bold hover:bg-[#002244] transition-all shadow-lg shadow-[#003366]/20">
            Salvar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export const BdiModal = ({ isOpen, onClose, bdiConfig, onChange }: any) => (
  <BaseModal isOpen={isOpen} onClose={onClose} title="Configuração de BDI" icon={Percent} onSave={onClose}>
    <div className="space-y-6">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Formulário de configuração das porcentagens dos Benefícios e Despesas Indiretas</p>
      
      <div className="space-y-3">
        <label className="text-sm font-bold text-slate-700">O BDI DEVE INCIDIR SOBRE:</label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="radio" 
              name="incidencia"
              className="w-4 h-4 text-[#003366]"
              checked={bdiConfig.incidencia === 'unitario'}
              onChange={() => onChange({ ...bdiConfig, incidencia: 'unitario' })}
            />
            <span className="text-sm text-slate-600">O preço unitário da composição (Método de cálculo <strong>recomendado</strong> pelo TCU)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="radio" 
              name="incidencia"
              className="w-4 h-4 text-[#003366]"
              checked={bdiConfig.incidencia === 'final'}
              onChange={() => onChange({ ...bdiConfig, incidencia: 'final' })}
            />
            <span className="text-sm text-slate-600">O preço final do orçamento</span>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">PORCENTAGEM DE BDI PADRÃO</label>
        <input 
          type="number"
          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-2xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-[#003366]/20 transition-all"
          value={bdiConfig.porcentagem}
          onChange={(e) => onChange({ ...bdiConfig, porcentagem: parseFloat(e.target.value) })}
        />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-bold text-slate-700">BDI ÚNICO OU DETALHADO</label>
        <div className="flex gap-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="radio" 
              name="tipo"
              className="w-4 h-4 text-[#003366]"
              checked={bdiConfig.tipo === 'unico'}
              onChange={() => onChange({ ...bdiConfig, tipo: 'unico' })}
            />
            <span className="text-sm text-slate-600">Único</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="radio" 
              name="tipo"
              className="w-4 h-4 text-[#003366]"
              checked={bdiConfig.tipo === 'detalhado'}
              onChange={() => onChange({ ...bdiConfig, tipo: 'detalhado' })}
            />
            <span className="text-sm text-slate-600">Detalhado por tipo Insumo (não recomendável)</span>
          </label>
        </div>
      </div>
    </div>
  </BaseModal>
);

export const BancosModal = ({ isOpen, onClose, bancos, onToggle, onDateChange, onUpdateModeChange, updateMode }: any) => {
  const [showConfig, setShowConfig] = React.useState(false);

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Configurações de Bancos e Dados" icon={Database} onSave={onClose}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-700">Configurações do Orçamento</p>
            <p className="text-xs text-slate-500">
              Gerencie as bases de dados, datas de referência e modos de atualização.
            </p>
          </div>
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all"
          >
            {showConfig ? 'Voltar aos Bancos' : 'Configurações'}
          </button>
        </div>

        {showConfig ? (
          <div className="space-y-4">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">Modo de Atualização</h4>
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="radio" 
                name="updateMode"
                className="w-4 h-4 text-[#003366]"
                checked={updateMode === 'estrutura'}
                onChange={() => onUpdateModeChange('estrutura')}
              />
              <span className="text-sm text-slate-600">Atualizar Estrutura das Composições</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="radio" 
                name="updateMode"
                className="w-4 h-4 text-[#003366]"
                checked={updateMode === 'precos'}
                onChange={() => onUpdateModeChange('precos')}
              />
              <span className="text-sm text-slate-600">Atualizar somente os Preços dos insumos</span>
            </label>
          </div>
        ) : (
          <div className="border-t border-slate-100 pt-6">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 text-center">Bases Nacionais</h4>
            <div className="space-y-2">
              {bancos.map((banco: any) => (
                <div key={banco.id} className={`p-4 rounded-xl ${banco.active ? 'bg-green-50' : 'bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        className="w-4 h-4 text-[#003366]"
                        checked={banco.active}
                        onChange={() => onToggle(banco.id)}
                      />
                      <span className="font-bold text-slate-700 text-sm">{banco.id.toUpperCase()}</span>
                    </label>
                    
                    {banco.active && (
                      <select 
                        className="w-40 p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none"
                        value={banco.data_referencia || ''}
                        onChange={(e) => onDateChange(banco.id, e.target.value)}
                      >
                        <option value="">Selecione a data</option>
                        {banco.available_dates && banco.available_dates.length > 0 ? (
                          banco.available_dates.map((date: string) => {
                            const d = new Date(date);
                            const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
                            const year = d.getUTCFullYear();
                            return <option key={date} value={date}>{month}/{year}</option>;
                          })
                        ) : (
                          <option disabled>Nenhuma data disponível</option>
                        )}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  );
};

export const EncargosModal = ({ isOpen, onClose, encargos, onChange }: any) => (
  <BaseModal isOpen={isOpen} onClose={onClose} title="Encargos Sociais" icon={ShieldCheck} onSave={onClose}>
    <div className="space-y-6">
      <div className="flex gap-4 p-1 bg-slate-100 rounded-2xl">
        <button 
          onClick={() => onChange({ ...encargos, desonerado: true })}
          className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${encargos.desonerado ? 'bg-white text-[#003366] shadow-sm' : 'text-slate-400'}`}
        >
          Desonerado
        </button>
        <button 
          onClick={() => onChange({ ...encargos, desonerado: false })}
          className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${!encargos.desonerado ? 'bg-white text-[#003366] shadow-sm' : 'text-slate-400'}`}
        >
          Não Desonerado
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Horista (%)</label>
          <input 
            type="number"
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-900 outline-none"
            value={encargos.horista}
            onChange={(e) => onChange({ ...encargos, horista: parseFloat(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Mensalista (%)</label>
          <input 
            type="number"
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-900 outline-none"
            value={encargos.mensalista}
            onChange={(e) => onChange({ ...encargos, mensalista: parseFloat(e.target.value) })}
          />
        </div>
      </div>
    </div>
  </BaseModal>
);

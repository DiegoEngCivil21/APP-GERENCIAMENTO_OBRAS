import React, { useEffect, useState } from 'react';
import { Plus, Search, MapPin, Calendar, ArrowRight, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StatusBadge } from '../components/UIComponents';
import { api } from '../services/api';
import { Obra } from '../types/index';

export const ObrasList = ({ onSelectObra }: { onSelectObra: (id: string | number) => void }) => {
  const [obras, setObras] = useState<Obra[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | number | null>(null);
  const [newObra, setNewObra] = useState<Partial<Obra>>({
    nome: '',
    cliente: '',
    status: 'Em Planejamento',
    data_inicio: new Date().toISOString().split('T')[0],
    localizacao: '',
    uf: 'DF',
    desonerado: 0,
    data_referencia: '2024-01',
    bancos_ativos: '["sinapi"]'
  });

  const fetchObras = () => {
    api.getObras().then(setObras);
  };

  useEffect(() => {
    fetchObras();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createObra(newObra);
      setShowModal(false);
      setNewObra({
        nome: '',
        cliente: '',
        status: 'Em Planejamento',
        data_inicio: new Date().toISOString().split('T')[0],
        localizacao: '',
        uf: 'DF',
        desonerado: 0,
        data_referencia: '2024-01',
        bancos_ativos: '["sinapi"]'
      });
      fetchObras();
    } catch (error) {
      console.error('Error creating obra:', error);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteModal) return;
    try {
      await api.deleteObra(showDeleteModal);
      setShowDeleteModal(null);
      fetchObras();
    } catch (error) {
      console.error('Error deleting obra:', error);
    }
  };

  const filteredObras = obras.filter(o => 
    (o.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (o.cliente || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Buscar por obra ou cliente..."
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] transition-all font-bold text-slate-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-[#003366] text-white px-8 py-3.5 rounded-2xl font-black flex items-center gap-2 hover:bg-[#002244] transition-all shadow-lg shadow-[#003366]/20 uppercase tracking-widest text-xs"
        >
          <Plus size={18} /> Nova Obra
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredObras.map((obra, idx) => (
          <motion.div 
            key={`${obra.id}-${idx}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => onSelectObra(obra.id)}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#003366] opacity-[0.02] rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-slate-300 group-hover:bg-[#003366] group-hover:text-white transition-all duration-500 text-xl uppercase">
                {(obra.nome || '').substring(0, 2)}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={obra.status} />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteModal(obra.id);
                  }}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <div className="space-y-4 relative z-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight group-hover:text-[#003366] transition-colors">{obra.nome}</h3>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">{obra.cliente}</p>
              </div>
              
              {obra.descricao && (
                <p className="text-sm text-slate-500 line-clamp-2 mt-2 leading-relaxed" title={obra.descricao}>
                  {obra.descricao}
                </p>
              )}
              
              <div className="pt-4 border-t border-slate-50 space-y-3">
                <div className="flex items-center gap-3 text-slate-500">
                  <MapPin size={16} className="text-slate-300" />
                  <span className="text-xs font-bold uppercase tracking-tight">{obra.uf ? `${obra.uf} - ` : ''}{obra.localizacao || 'Localização não informada'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <Calendar size={16} className="text-slate-300" />
                  <span className="text-xs font-bold uppercase tracking-tight">Início: {new Date(obra.data_inicio).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={`user-avatar-${obra.id}-${i}`} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">
                      U{i}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-xs font-black text-[#003366] uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                  Detalhes <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Nova Obra</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              
              <form onSubmit={handleCreate} className="p-8 space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome da Obra</label>
                    <input 
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] font-bold text-slate-700"
                      value={newObra.nome}
                      onChange={(e) => setNewObra({...newObra, nome: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</label>
                    <input 
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] font-bold text-slate-700"
                      value={newObra.cliente}
                      onChange={(e) => setNewObra({...newObra, cliente: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</label>
                    <textarea 
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] font-bold text-slate-700 resize-none"
                      value={newObra.descricao || ''}
                      onChange={(e) => setNewObra({...newObra, descricao: e.target.value})}
                      placeholder="Descreva a obra detalhadamente..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Início</label>
                      <input 
                        required
                        type="date"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] font-bold text-slate-700"
                        value={newObra.data_inicio}
                        onChange={(e) => setNewObra({...newObra, data_inicio: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UF</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] font-bold text-slate-700"
                        value={newObra.uf}
                        onChange={(e) => setNewObra({...newObra, uf: e.target.value})}
                      >
                        {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Localização</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] font-bold text-slate-700"
                      value={newObra.localizacao}
                      onChange={(e) => setNewObra({...newObra, localizacao: e.target.value})}
                    />
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <input 
                      type="checkbox"
                      id="desonerado"
                      className="w-5 h-5 rounded border-slate-300 text-[#003366] focus:ring-[#003366]"
                      checked={newObra.desonerado === 1}
                      onChange={(e) => setNewObra({...newObra, desonerado: e.target.checked ? 1 : 0})}
                    />
                    <label htmlFor="desonerado" className="text-xs font-black text-slate-600 uppercase tracking-widest cursor-pointer">Desonerado (SINAPI)</label>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 rounded-2xl font-black text-slate-400 uppercase tracking-widest text-xs hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-[#003366] text-white px-4 py-2 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#002244] transition-all shadow-lg shadow-[#003366]/20"
                  >
                    Criar Obra
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} className="text-red-500" />
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Excluir Obra</h2>
              <p className="text-sm font-bold text-slate-500 mb-8">Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita.</p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDeleteModal(null)}
                  className="flex-1 px-4 py-2 rounded-2xl font-black text-slate-400 uppercase tracking-widest text-xs hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 bg-red-500 text-white px-4 py-2 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  MapPin, 
  Calendar, 
  ChevronRight, 
  Edit2, 
  Trash2 
} from 'lucide-react';
import { motion } from 'motion/react';
import { Obra } from '../types';
import { Button } from './UIComponents';
import { formatFinancial, BRAZILIAN_STATES } from '../utils';

interface ObrasViewProps {
  onSelectObra: (id: string | number) => void;
}

const ObrasView = ({ onSelectObra }: ObrasViewProps) => {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('obrasSearchTerm') || '');
  const [newObra, setNewObra] = useState({ 
    nome: '', 
    cliente: '', 
    descricao: '', 
    valor_total: 0, 
    status: 'Em Planejamento', 
    data_inicio: '', 
    data_fim_prevista: '',
    uf: '',
    endereco: '',
    localizacao: '',
    desonerado: 1,
    data_referencia: '2024-01',
    bancos_ativos: '["sinapi"]'
  });
  const [editingObraId, setEditingObraId] = useState<string | number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | number | null>(null);

  const fetchObras = () => {
    setLoading(true);
    fetch('/api/obras')
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
          setObras(data);
        } else {
          setObras([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching obras:", err);
        setObras([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchObras();
  }, []);

  useEffect(() => {
    localStorage.setItem('obrasSearchTerm', searchTerm);
  }, [searchTerm]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingObraId) {
      const res = await fetch(`/api/obras/${editingObraId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newObra)
      });
      if (res.ok) {
        setShowModal(false);
        setEditingObraId(null);
        setNewObra({ nome: '', cliente: '', descricao: '', valor_total: 0, status: 'Em Planejamento', data_inicio: '', data_fim_prevista: '', uf: '', endereco: '', localizacao: '', desonerado: 1, data_referencia: '2024-01', bancos_ativos: '["sinapi"]' });
        fetchObras();
      }
    } else {
      const res = await fetch('/api/obras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newObra,
          data_inicio: newObra.data_inicio || new Date().toISOString().split('T')[0],
          valor_total: newObra.valor_total || 0
        })
      });
      if (res.ok) {
        setShowModal(false);
        setNewObra({ nome: '', cliente: '', descricao: '', valor_total: 0, status: 'Em Planejamento', data_inicio: '', data_fim_prevista: '', uf: '', endereco: '', localizacao: '', desonerado: 1, data_referencia: '2024-01', bancos_ativos: '["sinapi"]' });
        fetchObras();
      }
    }
  };

  const handleEditClick = async (obra: Obra) => {
    setEditingObraId(obra.id);
    try {
      const res = await fetch(`/api/obras/${obra.id}`);
      const data = await res.json();
      setNewObra({
        nome: data.nome,
        cliente: data.cliente,
        descricao: data.descricao || '',
        valor_total: data.valor_total || 0,
        status: data.status,
        data_inicio: data.data_inicio,
        data_fim_prevista: data.data_fim_prevista || '',
        uf: data.uf || '',
        endereco: data.endereco || '',
        localizacao: data.localizacao || '',
        desonerado: data.desonerado ?? 1,
        data_referencia: data.data_referencia || '2024-01',
        bancos_ativos: data.bancos_ativos || '["sinapi"]'
      });
      setShowModal(true);
    } catch (err) {
      console.error('Error fetching obra details:', err);
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      const response = await fetch(`/api/obras/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchObras();
      } else {
        console.error('Erro ao excluir obra');
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleUpdateStatus = async (id: string | number, status: string) => {
    try {
      const response = await fetch(`/api/obras/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        fetchObras();
      }
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  const filteredObras = (obras || []).filter(o => 
    o && (
      (o.nome || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
      (o.cliente || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    )
  );

  return (
    <div className="space-y-7">
      <div className="space-y-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Obra</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Gerencie todos os seus projetos</p>
        </div>

        <div className="flex justify-between items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input 
              type="text" 
              placeholder="Buscar obra..." 
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 w-80 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            variant="primary"
            icon={Plus}
            onClick={() => {
              setEditingObraId(null);
              setNewObra({ 
                nome: '', 
                cliente: '', 
                descricao: '', 
                valor_total: 0, 
                status: 'Em Planejamento', 
                data_inicio: '', 
                uf: '', 
                endereco: '', 
                localizacao: '', 
                data_fim_prevista: '',
                desonerado: 1,
                data_referencia: '2024-01',
                bancos_ativos: '["sinapi"]'
              });
              setShowModal(true);
            }}
          >
            Nova Obra
          </Button>
        </div>
      </div>

      <ObrasList 
        onSelectObra={onSelectObra} 
        obras={filteredObras} 
        loading={loading} 
        onEditObra={handleEditClick}
        onDeleteObra={setDeleteConfirm}
        onUpdateStatus={handleUpdateStatus}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 w-full max-w-2xl shadow-2xl"
          >
            <h3 className="text-xl font-bold text-slate-900 mb-6">
              {editingObraId ? 'Editar Obra' : 'Cadastrar Nova Obra'}
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome da Obra</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newObra.nome}
                  onChange={e => setNewObra({...newObra, nome: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cliente</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newObra.cliente}
                  onChange={e => setNewObra({...newObra, cliente: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Descrição</label>
                <textarea 
                  rows={4}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newObra.descricao}
                  onChange={e => setNewObra({...newObra, descricao: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Endereço</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newObra.endereco}
                  onChange={e => setNewObra({...newObra, endereco: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Localização (Cidade/Ref)</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newObra.localizacao}
                  onChange={e => setNewObra({...newObra, localizacao: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Valor Orçado (R$)</label>
                <input 
                  readOnly
                  type="text" 
                  className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl outline-none cursor-not-allowed"
                  value={newObra.valor_total ? `R$ ${newObra.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00'}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data Início</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newObra.data_inicio}
                    onChange={e => setNewObra({...newObra, data_inicio: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data Referência (Base)</label>
                  <input 
                    type="month" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newObra.data_referencia ? newObra.data_referencia.substring(0, 7) : ''}
                    onChange={e => setNewObra({...newObra, data_referencia: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data Fim Prevista</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newObra.data_fim_prevista}
                  onChange={e => setNewObra({...newObra, data_fim_prevista: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">UF da Obra</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newObra.uf}
                    onChange={e => setNewObra({...newObra, uf: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    {BRAZILIAN_STATES.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Status</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newObra.status}
                    onChange={e => setNewObra({...newObra, status: e.target.value})}
                  >
                    <option>Em Planejamento</option>
                    <option>Em Andamento</option>
                    <option>Paralisada</option>
                    <option>Concluída</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowModal(false);
                    setEditingObraId(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="primary"
                  className="flex-1"
                  type="submit"
                >
                  {editingObraId ? 'Atualizar' : 'Salvar'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
          >
            <h3 className="text-xl font-bold text-slate-900 mb-4">Confirmar Exclusão</h3>
            <p className="text-slate-600 mb-8">
              Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita e removerá todos os dados associados.
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancelar
              </Button>
              <Button 
                variant="danger"
                className="flex-1"
                onClick={() => handleDelete(deleteConfirm)}
              >
                Excluir
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const ObrasList = ({ 
  onSelectObra, 
  obras, 
  loading,
  onEditObra,
  onDeleteObra,
  onUpdateStatus
}: { 
  onSelectObra: (id: string | number) => void, 
  obras: Obra[], 
  loading: boolean,
  onEditObra?: (obra: Obra) => void,
  onDeleteObra?: (id: string | number) => void,
  onUpdateStatus?: (id: string | number, status: string) => void
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
      {loading ? (
        <div className="col-span-full py-12 text-center text-slate-500">Carregando obras...</div>
      ) : (Array.isArray(obras) ? obras : []).map((obra, idx) => (
        <div 
          key={`${obra.id}-${idx}`} 
          className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group relative"
        >
          <div className="h-1.5 bg-[#111827]/80" />
          <div className="p-6 cursor-pointer" onClick={() => onSelectObra(obra.id)}>
            <div className="flex justify-between items-center">
              <select 
                className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  obra.status === 'Em Andamento' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                }`}
                value={obra.status}
                onChange={(e) => onUpdateStatus?.(obra.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
              >
                <option>Em Planejamento</option>
                <option>Em Andamento</option>
                <option>Paralisada</option>
                <option>Concluída</option>
              </select>
              <span className="text-slate-400 text-[11px] font-mono font-medium">#000{obra.id}</span>
            </div>

            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-4 leading-tight group-hover:text-orange-500 transition-colors">
              {obra.nome}
            </h3>
            <p className="text-[14px] text-slate-500 mt-2 leading-relaxed">
              {obra.descricao}
            </p>
            
            <div className="my-6 border-t border-slate-100" />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-500 text-[13px] font-medium">
                <MapPin size={13} className="text-slate-400" />
                <span>{obra.uf ? `UF: ${obra.uf}` : 'Local não informado'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 text-[13px] font-medium">
                <Calendar size={13} className="text-slate-400" />
                <span>Início: {obra.data_inicio ? new Date(obra.data_inicio).toLocaleDateString('pt-BR') : 'Não informado'}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
              <div className="text-slate-900 font-black text-sm">
                R$ {formatFinancial(obra.valor_total || 0)}
              </div>
              <div className="text-slate-900 font-bold text-[13px] flex items-center gap-1 group-hover:gap-2 transition-all">
                Detalhes <ChevronRight size={13} strokeWidth={3} />
              </div>
            </div>
          </div>
          
          <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEditObra && (
              <button 
                onClick={(e) => { e.stopPropagation(); onEditObra(obra); }}
                className="p-2 bg-white rounded-full shadow-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Editar"
              >
                <Edit2 size={14} />
              </button>
            )}
            {onDeleteObra && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDeleteObra(obra.id); }}
                className="p-2 bg-white rounded-full shadow-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Excluir"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ObrasView;

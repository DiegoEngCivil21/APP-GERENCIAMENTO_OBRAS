import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Building2, Edit2, Trash2, X, Save, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { formatCpfCnpj, formatPhone } from '../utils';

export default function EmpresasMgmtView() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<any | null>(null);
  const [formData, setFormData] = useState({ 
    nome: '', 
    documento: '', 
    plano: 'Básico', 
    situacao: 'ATIVO',
    valor_mensalidade: 0,
    adm_nome: '',
    adm_email: '',
    adm_telefone: '',
    adm_senha: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false);
  const [selectedTenantPayments, setSelectedTenantPayments] = useState<any | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    valor: 0,
    data_pagamento: format(new Date(), 'yyyy-MM-dd'),
    mes_referencia: format(new Date(), 'yyyy-MM'),
    metodo_pagamento: 'PIX',
    status: 'pago'
  });

  const fetchEmpresas = async () => {
    try {
      const res = await fetch('/api/tenants');
      if (res.ok) {
        const data = await res.json();
        setEmpresas(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const openNewModal = () => {
    setEditingEmpresa(null);
    setFormData({ 
      nome: '', 
      documento: '', 
      plano: 'Básico', 
      situacao: 'ATIVO',
      valor_mensalidade: 0,
      adm_nome: '',
      adm_email: '',
      adm_telefone: '',
      adm_senha: ''
    });
    setErrorInfo(null);
    setIsModalOpen(true);
  };

  const openEditModal = (empresa: any) => {
    setEditingEmpresa(empresa);
    setFormData({ 
      nome: empresa.nome || '', 
      documento: empresa.documento || '',
      plano: empresa.plano || 'Básico',
      situacao: empresa.situacao || 'ATIVO',
      valor_mensalidade: empresa.valor_mensalidade || 0,
      adm_nome: empresa.adm_nome || '',
      adm_email: empresa.adm_email || '',
      adm_telefone: empresa.adm_telefone || '',
      adm_senha: ''
    });
    setErrorInfo(null);
    setIsModalOpen(true);
  };

  const openPaymentsModal = async (empresa: any) => {
    setSelectedTenantPayments(empresa);
    setPaymentFormData({
      valor: empresa.valor_mensalidade || 0,
      data_pagamento: format(new Date(), 'yyyy-MM-dd'),
      mes_referencia: format(new Date(), 'yyyy-MM'),
      metodo_pagamento: 'PIX',
      status: 'pago'
    });
    setIsPaymentsModalOpen(true);
    fetchPayments(empresa.id);
  };

  const fetchPayments = async (tenantId: number) => {
    try {
      const res = await fetch(`/api/payments?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...paymentFormData,
          tenant_id: selectedTenantPayments.id
        }),
      });
      if (res.ok) {
        fetchPayments(selectedTenantPayments.id);
        setIsAddingPayment(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePayment = async (id: number) => {
    if (confirm("Excluir registro de pagamento?")) {
      try {
        const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchPayments(selectedTenantPayments.id);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorInfo(null);

    const url = editingEmpresa ? `/api/tenants/${editingEmpresa.id}` : '/api/tenants';
    const method = editingEmpresa ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error ? `${errorData.message}: ${errorData.error}` : (errorData.message || 'Erro ao salvar empresa'));
      }

      await fetchEmpresas();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setErrorInfo(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pt-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
            <Building2 className="text-orange-500" />
            Empresas Clientes
          </h2>
          <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Gerencie os tenants do sistema</p>
        </div>
        <button 
          onClick={openNewModal}
          className="bg-[#1a2233] text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl shadow-slate-900/20"
        >
          <Plus size={16} /> Nova Empresa
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 font-bold uppercase tracking-widest">
              Carregando...
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome da Empresa</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Documento</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plano</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mensalidade</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Situação</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Criado em</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {empresas.map((empresa) => (
                  <tr key={empresa.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold text-slate-900">#{empresa.id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-black text-slate-700">{empresa.nome}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold text-slate-500">{empresa.documento || 'Não informado'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{empresa.plano || 'Básico'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold text-emerald-600">R$ {empresa.valor_mensalidade?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                        empresa.situacao === 'ATIVO' ? 'bg-green-100 text-green-700' :
                        empresa.situacao === 'INADIMPLENTE' ? 'bg-yellow-100 text-yellow-700' :
                        empresa.situacao === 'CANCELADO' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {empresa.situacao || 'ATIVO'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold text-slate-500">
                        {empresa.created_at ? format(new Date(empresa.created_at), 'dd/MM/yyyy') : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => openPaymentsModal(empresa)}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"
                          title="Gerenciar Pagamentos"
                        >
                          <DollarSign size={16} /> Pagamentos
                        </button>
                        <button 
                          onClick={() => openEditModal(empresa)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {empresas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 text-sm font-bold uppercase tracking-widest">
                      Nenhuma empresa cadastrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Building2 size={20} className="text-indigo-600" />
                  {editingEmpresa ? 'Editar Empresa' : 'Nova Empresa'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6">
                {errorInfo && (
                  <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium">
                    {errorInfo}
                  </div>
                )}
                
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                        Nome da Empresa *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="Ex: Construtora Silva"
                      />
                    </div>

                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                        Documento (CPF/CNPJ)
                      </label>
                      <input
                        type="text"
                        value={formData.documento}
                        onChange={(e) => setFormData({ ...formData, documento: formatCpfCnpj(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="00.000.000/0000-00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                        Plano Contratado
                      </label>
                      <select
                        value={formData.plano}
                        onChange={(e) => setFormData({ ...formData, plano: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="Básico">Básico</option>
                        <option value="Profissional">Profissional</option>
                        <option value="Enterprise">Enterprise</option>
                        <option value="Personalizado">Personalizado</option>
                      </select>
                    </div>

                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                        Valor Mensalidade (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.valor_mensalidade}
                        onChange={(e) => setFormData({ ...formData, valor_mensalidade: parseFloat(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                        Situação
                      </label>
                      <select
                        value={formData.situacao}
                        onChange={(e) => setFormData({ ...formData, situacao: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="ATIVO">Ativo</option>
                        <option value="INADIMPLENTE">Inadimplente</option>
                        <option value="CANCELADO">Cancelado</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 mt-2 border-t border-slate-100">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Dados do Administrador</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                          Nome do Responsável
                        </label>
                        <input
                          type="text"
                          value={formData.adm_nome}
                          onChange={(e) => setFormData({ ...formData, adm_nome: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="Nome Completo"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 md:col-span-1">
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Email
                          </label>
                          <input
                            type="email"
                            value={formData.adm_email}
                            onChange={(e) => setFormData({ ...formData, adm_email: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="email@empresa.com"
                          />
                        </div>
                        <div className="col-span-2 md:col-span-1">
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Telefone / WhatsApp
                          </label>
                          <input
                            type="text"
                            value={formData.adm_telefone}
                            onChange={(e) => setFormData({ ...formData, adm_telefone: formatPhone(e.target.value) })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                        <div className="col-span-2 mt-2">
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Senha de Acesso {editingEmpresa ? '(Opcional. Preencha para alterar)' : '*'}
                          </label>
                          <input
                            type="password"
                            value={formData.adm_senha}
                            onChange={(e) => setFormData({ ...formData, adm_senha: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="*************"
                            required={!editingEmpresa}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-70"
                  >
                    {isSaving ? (
                      <span className="animate-pulse">Salvando...</span>
                    ) : (
                      <>
                        <Save size={18} />
                        Salvar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPaymentsModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                <div>
                   <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <DollarSign size={20} className="text-emerald-600" />
                    Pagamentos: {selectedTenantPayments?.nome}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Histórico de mensalidades recebidas</p>
                </div>
                <button
                  onClick={() => setIsPaymentsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6">
                {!isAddingPayment ? (
                  <button 
                    onClick={() => setIsAddingPayment(true)}
                    className="mb-6 w-full py-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all border border-emerald-100"
                  >
                    <Plus size={16} /> Registrar Novo Recebimento
                  </button>
                ) : (
                  <form onSubmit={handleSavePayment} className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4">Novo Lançamento</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Valor (R$)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          required
                          value={paymentFormData.valor}
                          onChange={e => setPaymentFormData({...paymentFormData, valor: parseFloat(e.target.value)})}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Mês de Referência</label>
                        <input 
                          type="month" 
                          required
                          value={paymentFormData.mes_referencia}
                          onChange={e => setPaymentFormData({...paymentFormData, mes_referencia: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Data do Pagamento</label>
                        <input 
                          type="date" 
                          required
                          value={paymentFormData.data_pagamento}
                          onChange={e => setPaymentFormData({...paymentFormData, data_pagamento: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Método</label>
                        <select 
                          value={paymentFormData.metodo_pagamento}
                          onChange={e => setPaymentFormData({...paymentFormData, metodo_pagamento: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700"
                        >
                          <option value="PIX">PIX</option>
                          <option value="BOLETO">Boleto</option>
                          <option value="CARTÃO">Cartão</option>
                          <option value="TRANSFERÊNCIA">Transferência</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                      <button 
                        type="button" 
                        onClick={() => setIsAddingPayment(false)}
                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-600/20"
                      >
                        Confirmar Recebimento
                      </button>
                    </div>
                  </form>
                )}

                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Mês Ref.</th>
                        <th className="py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                        <th className="py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                        <th className="py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Método</th>
                        <th className="py-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {payments.map(p => (
                        <tr key={p.id} className="text-xs">
                          <td className="py-3 font-black text-slate-700">{p.mes_referencia}</td>
                          <td className="py-3 font-bold text-slate-500">{format(new Date(p.data_pagamento + 'T00:00:00'), 'dd/MM/yyyy')}</td>
                          <td className="py-3 font-black text-emerald-600">R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="py-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-600">{p.metodo_pagamento}</span></td>
                          <td className="py-3 text-right">
                            <button 
                              onClick={() => handleDeletePayment(p.id)}
                              className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {payments.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">Nenhum pagamento registrado</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

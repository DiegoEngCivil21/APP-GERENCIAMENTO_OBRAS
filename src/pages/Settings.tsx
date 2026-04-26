import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Users, 
  Shield, 
  CreditCard, 
  Trash2, 
  Plus, 
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  FileText,
  Zap,
  Layout,
  ChevronRight,
  Settings
} from 'lucide-react';
import { Button } from '../components/UIComponents';

interface User {
  id: number;
  nome: string;
  email: string;
  role: string;
  created_at: string;
}

interface Tenant {
  id: number;
  nome: string;
  documento: string;
  plano: string;
  limite_usuarios: number;
  assinatura_texto?: string;
  rodape_texto?: string;
  logo_url?: string;
  config_json?: string;
}

interface Signature {
  id: number;
  name: string;
  role: string;
  image_data: string;
  is_default: boolean;
}

export const SettingsView = ({ user }: { user: any }) => {
  const [activeSubTab, setActiveSubTab] = useState<'perfil' | 'empresa' | 'usuarios' | 'seguranca' | 'contas' | 'documentos' | 'workflows' | 'templates' | 'branding' | 'assinaturas' | 'global'>('perfil');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [showNewSignatureModal, setShowNewSignatureModal] = useState(false);
  const [newSignature, setNewSignature] = useState({ name: '', role: '', image_data: '', is_default: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // New user form
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ nome: '', email: '', password: '', role: 'orcamentista' });

  // Password change form
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '' });

  const isMaster = user?.role === 'admin_master';
  const isAdmin = isMaster || user?.role === 'admin_pj';

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const fetchData = async () => {
    if (activeSubTab === 'perfil' || activeSubTab === 'seguranca' || activeSubTab === 'contas') {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (activeSubTab === 'empresa' || activeSubTab === 'documentos') {
        const res = await fetch('/api/settings/tenant');
        if (res.ok) setTenant(await res.json());
      } else if (activeSubTab === 'usuarios') {
        const res = await fetch('/api/settings/users');
        if (res.ok) setUsers(await res.json());
      } else if (activeSubTab === 'workflows') {
        const res = await fetch('/api/settings/workflows');
        if (res.ok) setWorkflows(await res.json());
      } else if (activeSubTab === 'templates') {
        const res = await fetch('/api/settings/templates');
        if (res.ok) setTemplates(await res.json());
      } else if (activeSubTab === 'assinaturas') {
        const res = await fetch('/api/settings/signatures');
        if (res.ok) setSignatures(await res.json());
      } else if (activeSubTab === 'branding' || activeSubTab === 'global') {
        const res = await fetch('/api/settings/tenant');
        if (res.ok) setTenant(await res.json());
      }
    } catch (err) {
      console.error("Error fetching settings data:", err);
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { id: 'perfil', label: 'Meu Perfil', icon: Shield, roles: ['admin_master', 'admin_pj', 'orcamentista'] },
    { id: 'empresa', label: 'Minha Empresa', icon: Building2, roles: ['admin_master', 'admin_pj'] },
    { id: 'usuarios', label: 'Gestão de Equipe', icon: Users, roles: ['admin_master', 'admin_pj'] },
    { id: 'global', label: 'Configurações Globais', icon: Settings, roles: ['admin_master', 'admin_pj'] },
    { id: 'branding', label: 'Identidade Visual', icon: Layout, roles: ['admin_master', 'admin_pj'] },
    { id: 'assinaturas', label: 'Assinaturas & Selos', icon: Shield, roles: ['admin_master', 'admin_pj'] },
    { id: 'workflows', label: 'Regras & Fluxos', icon: Zap, roles: ['admin_master', 'admin_pj'] },
    { id: 'documentos', label: 'Ajuste de Documentos', icon: FileText, roles: ['admin_master', 'admin_pj'] },
    { id: 'templates', label: 'Modelos Visuais', icon: Layout, roles: ['admin_master', 'admin_pj'] },
    { id: 'seguranca', label: 'Segurança de Dados', icon: Shield, roles: ['admin_master'] },
    { id: 'contas', label: 'Contas & Clientes', icon: Building2, roles: ['admin_master'] },
  ].filter(item => item.roles.includes(user?.role));

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings/tenant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nome: tenant.nome, 
          documento: tenant.documento,
          assinatura_texto: tenant.assinatura_texto,
          rodape_texto: tenant.rodape_texto,
          logo_url: tenant.logo_url
        })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Dados da empresa atualizados!' });
      } else {
        setMessage({ type: 'error', text: 'Erro ao atualizar dados.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro de conexão.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(passwordData)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
        setShowPasswordModal(false);
        setPasswordData({ currentPassword: '', newPassword: '' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Erro ao alterar senha.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro de conexão.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Usuário criado com sucesso!' });
        setShowNewUserModal(false);
        setNewUser({ nome: '', email: '', password: '', role: 'orcamentista' });
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.message || 'Erro ao criar usuário.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro de conexão.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      const res = await fetch(`/api/settings/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Usuário excluído.' });
        fetchData();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.message || 'Erro ao excluir.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro de conexão.' });
    } finally {
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSaveBranding = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      const config = JSON.parse(tenant.config_json || '{}');
      const res = await fetch('/api/settings/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logo_url: tenant.logo_url,
          primary_color: config.branding?.primary_color || '#0f172a'
        })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Identidade visual salva com sucesso!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao salvar identidade visual.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSaveBudgetSettings = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      const config = JSON.parse(tenant.config_json || '{}');
      const res = await fetch('/api/settings/budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_bdi: config.budget?.default_bdi || 25,
          currency_symbol: config.budget?.currency_symbol || 'R$'
        })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Configurações globais salvas!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleCreateSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSignature)
      });
      if (res.ok) {
        setShowNewSignatureModal(false);
        setNewSignature({ name: '', role: '', image_data: '', is_default: false });
        fetchData();
        setMessage({ type: 'success', text: 'Assinatura criada com sucesso!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao criar assinatura.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDeleteSignature = async (id: number) => {
    if (!window.confirm('Deseja realmente excluir esta assinatura?')) return;
    try {
      const res = await fetch(`/api/settings/signatures/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
        setMessage({ type: 'success', text: 'Assinatura excluída!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao excluir assinatura.' });
    } finally {
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Configurações</h1>
        <p className="text-slate-500 font-medium mt-1">Gerencie seu perfil, empresa e permissões do sistema.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Menu */}
        <div className="w-full md:w-72 shrink-0">
          <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 p-4 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all text-sm ${
                  activeSubTab === item.id 
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <item.icon size={18} className={activeSubTab === item.id ? 'text-white' : 'text-slate-400'} />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {message && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}
            >
              {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              {message.text}
            </motion.div>
          )}

          <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden min-h-[500px]">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center h-full">
                <Loader2 size={40} className="animate-spin text-slate-300 mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando...</p>
              </div>
            ) : (
              <div className="p-8">
                {activeSubTab === 'perfil' && (
                  <div className="max-w-2xl">
                    <h2 className="text-xl font-black text-slate-900 mb-6">Meu Perfil</h2>
                    <div className="space-y-6">
                      <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-2xl font-black">
                          {user?.nome?.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900">{user?.nome}</h3>
                          <p className="text-slate-500 font-bold text-sm">{user?.email}</p>
                          <span className="inline-block mt-2 px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-600">
                            {user?.role === 'admin_master' ? 'Dono do Sistema' : (user?.role === 'admin_pj' ? 'Administrador PJ' : 'Orçamentista')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-6 border-2 border-slate-50 rounded-2xl">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Alterar Senha</h4>
                          <p className="text-slate-500 text-sm font-medium mb-4">Mantenha sua conta segura alterando sua senha periodicamente.</p>
                          <Button onClick={() => setShowPasswordModal(true)} className="w-full py-3 text-xs">Alterar Senha</Button>
                        </div>
                        <div className="p-6 border-2 border-slate-50 rounded-2xl">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Notificações</h4>
                          <p className="text-slate-500 text-sm font-medium mb-4">Configure como você deseja receber alertas do sistema.</p>
                          <Button className="w-full py-3 text-xs bg-slate-100 text-slate-600 hover:bg-slate-200">Configurar</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSubTab === 'empresa' && tenant && (
                  <form onSubmit={handleUpdateTenant} className="max-w-2xl">
                    <h2 className="text-xl font-black text-slate-900 mb-6">Dados da Empresa</h2>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nome da Empresa / Pessoa Jurídica</label>
                        <input 
                          type="text" 
                          value={tenant.nome}
                          onChange={e => setTenant({...tenant, nome: e.target.value})}
                          disabled={!isAdmin}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Documento (CNPJ/CPF)</label>
                        <input 
                          type="text" 
                          value={tenant.documento}
                          onChange={e => setTenant({...tenant, documento: e.target.value})}
                          disabled={!isAdmin}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                        />
                      </div>
                      {isAdmin && (
                        <div className="pt-4">
                          <Button 
                            type="submit" 
                            disabled={saving}
                            className="flex items-center gap-2"
                          >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            Salvar Alterações
                          </Button>
                        </div>
                      )}
                    </div>
                  </form>
                )}

                {activeSubTab === 'usuarios' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-black text-slate-900">Equipe</h2>
                      {isAdmin && (
                        <Button 
                          onClick={() => setShowNewUserModal(true)}
                          className="flex items-center gap-2 py-2 text-xs"
                        >
                          <UserPlus size={16} />
                          Novo Usuário
                        </Button>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome</th>
                            <th className="text-left py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mail</th>
                            <th className="text-left py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargo</th>
                            <th className="text-right py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map(u => (
                            <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 px-4 font-bold text-slate-900">{u.nome}</td>
                              <td className="py-4 px-4 text-slate-500 font-medium">{u.email}</td>
                              <td className="py-4 px-4">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${u.role === 'admin_master' || u.role === 'admin_pj' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                                  {u.role === 'admin_master' ? 'Master' : (u.role === 'admin_pj' ? 'Admin PJ' : 'Orçamentista')}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right">
                                {isAdmin && u.id !== user.id && (
                                  <button 
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeSubTab === 'documentos' && tenant && (
                  <form onSubmit={handleUpdateTenant} className="max-w-2xl">
                    <h2 className="text-xl font-black text-slate-900 mb-6">Ajuste de Documentos</h2>
                    <div className="space-y-6">
                      <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl flex gap-4 mb-4">
                        <FileText className="text-blue-600 shrink-0" size={24} />
                        <div>
                          <h4 className="text-sm font-black text-blue-900 uppercase tracking-tight">Configuração de Exportação</h4>
                          <p className="text-blue-700 text-xs font-medium mt-1">Configure como seus orçamentos e relatórios serão apresentados aos clientes.</p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Logo da Empresa (URL)</label>
                        <input 
                          type="text" 
                          value={tenant.logo_url || ''}
                          onChange={e => setTenant({...tenant, logo_url: e.target.value})}
                          placeholder="https://exemplo.com/logo.png"
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Texto de Assinatura</label>
                        <textarea 
                          value={tenant.assinatura_texto || ''}
                          onChange={e => setTenant({...tenant, assinatura_texto: e.target.value})}
                          placeholder="Ex: Eng. Diego - CREA 123456/D"
                          rows={3}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900 resize-none"
                        />
                        <p className="text-[10px] text-slate-400 mt-1 ml-1">Este texto aparecerá no campo de assinatura dos documentos exportados.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Rodapé dos Relatórios</label>
                        <input 
                          type="text" 
                          value={tenant.rodape_texto || ''}
                          onChange={e => setTenant({...tenant, rodape_texto: e.target.value})}
                          placeholder="Ex: Rua Exemplo, 123 - Contato: (11) 99999-9999"
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                        />
                      </div>

                      {isAdmin && (
                        <div className="pt-4">
                          <Button 
                            type="submit" 
                            disabled={saving}
                            className="flex items-center gap-2"
                          >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            Salvar Configurações
                          </Button>
                        </div>
                      )}
                    </div>
                  </form>
                )}

                {activeSubTab === 'global' && (
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">CONFIGURAÇÕES GLOBAIS</h2>
              <p className="text-slate-500 font-medium">Defina padrões para orçamentos e cálculos do sistema.</p>
            </div>
            <Button variant="primary" onClick={handleSaveBudgetSettings} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar Padrões
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <CreditCard size={20} className="text-indigo-600" />
                Padrões de Orçamento
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">BDI Padrão (%)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={JSON.parse(tenant?.config_json || '{}').budget?.default_bdi || 25}
                    onChange={e => {
                      const config = JSON.parse(tenant?.config_json || '{}');
                      const newConfig = { ...config, budget: { ...config.budget, default_bdi: parseFloat(e.target.value) } };
                      setTenant(tenant ? {...tenant, config_json: JSON.stringify(newConfig)} : null);
                    }}
                    className="w-full px-5 py-3 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Símbolo Monetário</label>
                  <input 
                    type="text" 
                    value={JSON.parse(tenant?.config_json || '{}').budget?.currency_symbol || 'R$'}
                    onChange={e => {
                      const config = JSON.parse(tenant?.config_json || '{}');
                      const newConfig = { ...config, budget: { ...config.budget, currency_symbol: e.target.value } };
                      setTenant(tenant ? {...tenant, config_json: JSON.stringify(newConfig)} : null);
                    }}
                    className="w-full px-5 py-3 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'branding' && (
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">IDENTIDADE VISUAL</h2>
              <p className="text-slate-500 font-medium">Personalize a aparência do sistema e dos seus documentos.</p>
            </div>
            <Button variant="primary" onClick={handleSaveBranding} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar Alterações
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Layout size={20} className="text-indigo-600" />
                Logotipo da Empresa
              </h3>
              
              <div className="flex flex-col items-center gap-6 p-8 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                {tenant?.logo_url ? (
                  <img src={tenant.logo_url} alt="Logo" className="max-h-32 object-contain" />
                ) : (
                  <div className="w-32 h-32 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400">
                    <Building2 size={48} />
                  </div>
                )}
                <div className="w-full">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">URL do Logotipo</label>
                  <input 
                    type="text" 
                    value={tenant?.logo_url || ''}
                    onChange={e => setTenant(tenant ? {...tenant, logo_url: e.target.value} : null)}
                    placeholder="https://exemplo.com/logo.png"
                    className="w-full px-5 py-3 bg-white border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900 shadow-sm"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Zap size={20} className="text-indigo-600" />
                Cores do Sistema
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Cor Primária</label>
                  <div className="flex gap-3">
                    <input 
                      type="color" 
                      value={JSON.parse(tenant?.config_json || '{}').branding?.primary_color || '#0f172a'}
                      onChange={e => {
                        const config = JSON.parse(tenant?.config_json || '{}');
                        const newConfig = { ...config, branding: { ...config.branding, primary_color: e.target.value } };
                        setTenant(tenant ? {...tenant, config_json: JSON.stringify(newConfig)} : null);
                      }}
                      className="h-12 w-20 p-1 bg-white border border-slate-200 rounded-xl cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={JSON.parse(tenant?.config_json || '{}').branding?.primary_color || '#0f172a'}
                      onChange={e => {
                        const config = JSON.parse(tenant?.config_json || '{}');
                        const newConfig = { ...config, branding: { ...config.branding, primary_color: e.target.value } };
                        setTenant(tenant ? {...tenant, config_json: JSON.stringify(newConfig)} : null);
                      }}
                      className="flex-1 px-5 py-3 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'assinaturas' && (
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">ASSINATURAS & SELOS</h2>
              <p className="text-slate-500 font-medium">Gerencie as assinaturas digitais dos responsáveis técnicos.</p>
            </div>
            <Button variant="primary" onClick={() => setShowNewSignatureModal(true)}>
              <Plus size={16} />
              Nova Assinatura
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {signatures.map(sig => (
              <div key={sig.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm group relative overflow-hidden">
                <div className="aspect-video bg-slate-50 rounded-2xl mb-4 flex items-center justify-center overflow-hidden border border-slate-100">
                  {sig.image_data ? (
                    <img src={sig.image_data} alt={sig.name} className="max-h-full object-contain" />
                  ) : (
                    <Shield size={48} className="text-slate-200" />
                  )}
                </div>
                <h4 className="font-black text-slate-900 uppercase tracking-tight">{sig.name}</h4>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{sig.role}</p>
                
                {sig.is_default && (
                  <div className="absolute top-4 right-4 bg-indigo-600 text-white p-1.5 rounded-full shadow-lg">
                    <CheckCircle2 size={12} />
                  </div>
                )}

                <button 
                  onClick={() => handleDeleteSignature(sig.id)}
                  className="absolute top-4 right-4 p-2 bg-red-50 text-red-600 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'workflows' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-900">Motor de Regras & Fluxos</h2>
                      <Button className="flex items-center gap-2 py-2 text-xs">
                        <Plus size={16} />
                        Nova Regra
                      </Button>
                    </div>

                    <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-3xl flex gap-4 mb-8">
                      <Zap className="text-indigo-600 shrink-0" size={24} />
                      <div>
                        <h4 className="text-sm font-black text-indigo-900 uppercase tracking-tight">Inteligência Operacional</h4>
                        <p className="text-indigo-700 text-xs font-medium mt-1">Defina gatilhos e ações automáticas para garantir que os processos da empresa sejam seguidos.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {workflows.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                          <Settings size={40} className="text-slate-300 mx-auto mb-4" />
                          <p className="text-slate-500 font-bold">Nenhuma regra ativa.</p>
                          <p className="text-slate-400 text-xs mt-1">Comece criando uma regra de aprovação ou validação.</p>
                        </div>
                      ) : (
                        workflows.map(w => (
                          <div key={w.id} className="p-5 bg-white border border-slate-100 rounded-2xl flex items-center justify-between hover:shadow-md transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                                <Zap size={20} />
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900">{w.nome}</h4>
                                <p className="text-xs text-slate-500 uppercase font-black tracking-widest">{w.tipo}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${w.ativo ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                {w.ativo ? 'Ativo' : 'Inativo'}
                              </span>
                              <ChevronRight size={18} className="text-slate-300" />
                            </div>
                          </div>
                        ))
                      )}

                      {/* Exemplo de regra pré-definida (visual apenas por enquanto) */}
                      <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between opacity-60">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-200 text-slate-400 rounded-xl flex items-center justify-center">
                            <Shield size={20} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-400">Aprovação de Orçamentos {'>'} R$ 50k</h4>
                            <p className="text-xs text-slate-400 uppercase font-black tracking-widest">Financeiro</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sugestão</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeSubTab === 'templates' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-black text-slate-900">Estúdio de Modelos Visuais</h2>
                      <Button className="flex items-center gap-2 py-2 text-xs">
                        <Plus size={16} />
                        Novo Modelo
                      </Button>
                    </div>

                    <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex gap-4 mb-8">
                      <Layout className="text-emerald-600 shrink-0" size={24} />
                      <div>
                        <h4 className="text-sm font-black text-emerald-900 uppercase tracking-tight">Identidade de Engenharia</h4>
                        <p className="text-emerald-700 text-xs font-medium mt-1">Crie layouts personalizados para suas propostas e relatórios usando variáveis inteligentes.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="group relative aspect-[3/4] bg-slate-50 rounded-3xl border-2 border-slate-100 overflow-hidden hover:border-slate-900 transition-all cursor-pointer">
                        <div className="absolute inset-0 p-6 flex flex-col justify-between">
                          <div className="flex justify-between items-start">
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                              <FileText size={20} className="text-slate-400" />
                            </div>
                            <span className="px-2 py-1 bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest rounded">Padrão</span>
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900">Orçamento Executivo</h4>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Tabela completa + Curva ABC</p>
                          </div>
                        </div>
                        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/5 transition-all"></div>
                      </div>

                      <div className="group relative aspect-[3/4] bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 overflow-hidden hover:border-slate-400 transition-all cursor-pointer flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                          <Plus size={24} className="text-slate-300" />
                        </div>
                        <h4 className="font-bold text-slate-400">Criar Novo Template</h4>
                        <p className="text-xs text-slate-400 mt-1">Arraste variáveis e monte seu layout exclusivo.</p>
                      </div>
                    </div>

                    <div className="mt-8 p-6 bg-slate-900 rounded-[32px] text-white">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Variáveis Disponíveis</h4>
                      <div className="flex flex-wrap gap-2">
                        {['{{nome_obra}}', '{{cliente}}', '{{valor_total}}', '{{data_extenso}}', '{{bdi_aplicado}}', '{{lista_insumos}}'].map(v => (
                          <code key={v} className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-mono text-emerald-400">{v}</code>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeSubTab === 'seguranca' && isMaster && (
                  <div className="max-w-2xl">
                    <h2 className="text-xl font-black text-slate-900 mb-6">Segurança de Dados</h2>
                    <div className="space-y-6">
                      <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl flex gap-4">
                        <Shield className="text-amber-600 shrink-0" size={24} />
                        <div>
                          <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Acesso Restrito ao Dono do Sistema</h4>
                          <p className="text-amber-700 text-xs font-medium mt-1">Estas configurações afetam a integridade e privacidade de todos os dados do sistema.</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl">
                          <div>
                            <h5 className="font-bold text-slate-900">Logs de Auditoria</h5>
                            <p className="text-xs text-slate-500">Rastrear todas as ações realizadas por administradores.</p>
                          </div>
                          <div className="w-12 h-6 bg-slate-200 rounded-full relative cursor-pointer">
                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl">
                          <div>
                            <h5 className="font-bold text-slate-900">Criptografia de Documentos</h5>
                            <p className="text-xs text-slate-500">Forçar criptografia em arquivos anexados.</p>
                          </div>
                          <div className="w-12 h-6 bg-indigo-600 rounded-full relative cursor-pointer">
                            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSubTab === 'contas' && isMaster && (
                  <div>
                    <h2 className="text-xl font-black text-slate-900 mb-6">Contas & Clientes (Master)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Empresas</p>
                        <p className="text-2xl font-black text-slate-900">12</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Usuários Ativos</p>
                        <p className="text-2xl font-black text-slate-900">84</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Receita Mensal</p>
                        <p className="text-2xl font-black text-emerald-600">R$ 14.200</p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 rounded-3xl p-8 text-center border-2 border-dashed border-slate-200">
                      <Building2 size={40} className="text-slate-300 mx-auto mb-4" />
                      <h4 className="text-slate-900 font-bold">Módulo de Gestão de Tenants</h4>
                      <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">
                        Aqui você poderá visualizar e gerenciar todas as empresas que utilizam o sistema, alterar planos e limites manualmente.
                      </p>
                      <Button className="mt-6 py-2 px-8 text-xs">Acessar Painel Master</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New User Modal */}
      {showNewUserModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-8">
              <h2 className="text-2xl font-black text-slate-900 mb-6">Novo Usuário</h2>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nome Completo</label>
                  <input 
                    type="text" 
                    required
                    value={newUser.nome}
                    onChange={e => setNewUser({...newUser, nome: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">E-mail</label>
                  <input 
                    type="email" 
                    required
                    value={newUser.email}
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Senha</label>
                  <input 
                    type="password" 
                    required
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Cargo</label>
                  <select 
                    value={newUser.role}
                    onChange={e => setNewUser({...newUser, role: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                  >
                    <option value="orcamentista">Orçamentista</option>
                    <option value="admin_pj">Administrador PJ</option>
                  </select>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowNewUserModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Criar
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* New Signature Modal */}
      {showNewSignatureModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-8">
              <h2 className="text-2xl font-black text-slate-900 mb-6">Nova Assinatura</h2>
              <form onSubmit={handleCreateSignature} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nome do Responsável</label>
                  <input 
                    type="text" 
                    required
                    value={newSignature.name}
                    onChange={e => setNewSignature({...newSignature, name: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Cargo / Título (ex: Eng. Civil)</label>
                  <input 
                    type="text" 
                    required
                    value={newSignature.role}
                    onChange={e => setNewSignature({...newSignature, role: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">URL da Imagem da Assinatura</label>
                  <input 
                    type="text" 
                    required
                    value={newSignature.image_data}
                    onChange={e => setNewSignature({...newSignature, image_data: e.target.value})}
                    placeholder="https://exemplo.com/assinatura.png"
                    className="w-full px-5 py-3 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                  />
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                  <input 
                    type="checkbox" 
                    id="is_default"
                    checked={newSignature.is_default}
                    onChange={e => setNewSignature({...newSignature, is_default: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="is_default" className="text-sm font-bold text-slate-700 cursor-pointer">Definir como padrão</label>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowNewSignatureModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Adicionar
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-900">Alterar Senha</h3>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Senha Atual</label>
                <input 
                  type="password"
                  required
                  value={passwordData.currentPassword}
                  onChange={e => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                  placeholder="Sua senha atual"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nova Senha</label>
                <input 
                  type="password"
                  required
                  value={passwordData.newPassword}
                  onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900"
                  placeholder="Sua nova senha"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all" onClick={() => setShowPasswordModal(false)}>Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200">
                  {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                  Salvar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

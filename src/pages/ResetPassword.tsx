import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, ArrowRight, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/UIComponents';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token de recuperação não encontrado.');
      setTimeout(() => navigate('/login'), 3000);
    }
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao redefinir senha.');
      }

      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      
      <div className="w-full max-w-md p-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 shadow-2xl"
        >
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-orange-500 shadow-lg mx-auto mb-6">
              <Lock size={32} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-wider mb-2">Redefinir Senha</h1>
            <p className="text-slate-400 text-sm font-medium">Crie uma nova senha segura para sua conta</p>
          </div>

          {success ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-10"
            >
              <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={48} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Sucesso!</h3>
              <p className="text-slate-400">Sua senha foi atualizada. Redirecionando para o login...</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Nova Senha</label>
                <input 
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50 transition-all font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar Nova Senha</label>
                <input 
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50 transition-all font-bold"
                />
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-400 text-sm"
                >
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </motion.div>
              )}

              <Button 
                type="submit"
                disabled={isLoading || !token}
                className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 group"
              >
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin mx-auto" />
                ) : (
                  <>
                    Salvar Nova Senha
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <button 
              onClick={() => navigate('/login')}
              className="text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
            >
              Voltar para o login
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

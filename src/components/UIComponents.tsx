import React, { useState, useRef, useEffect } from 'react';
import { LucideIcon, Bell, HelpCircle, User, Database, ChevronDown, FileText, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
export const Button = ({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  icon: Icon, 
  className = '', 
  iconClassName = '',
  ...props 
}: any) => {
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm border border-transparent',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm',
    outline: 'bg-transparent text-slate-600 border border-slate-200 hover:bg-slate-50',
    ghost: 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900',
    action: 'text-slate-900 border border-slate-200 hover:border-slate-400 hover:bg-slate-50 shadow-sm uppercase tracking-wide text-[11px]',
  };

  const sizes = {
    xs: 'px-2 py-1 text-[10px]',
    sm: 'px-3 py-1.5 text-[12px]',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const iconSize = size === 'xs' ? 12 : size === 'sm' ? 14 : 18;

  return (
    <button 
      className={`
        rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant as keyof typeof variants]} 
        ${sizes[size as keyof typeof sizes]}
        ${className}
      `}
      {...props}
    >
      {Icon && (
        <Icon 
          size={iconSize} 
          className={`${variant === 'secondary' ? 'text-indigo-600' : ''} ${iconClassName}`} 
        />
      )}
      {children}
    </button>
  );
};

export const TopToolbar = ({ onNavigate, user }: { onNavigate?: (tab: string) => void, user?: any }) => {
  const [isRecursosOpen, setIsRecursosOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRecursosOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-2xl shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400">
          <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-widest">Sistema Ativo</span>
        </div>
        
        <div className="h-6 w-[1px] bg-slate-200" />
        
        {user?.role !== 'admin_master' && (
          <>
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsRecursosOpen(!isRecursosOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all group ${
                  isRecursosOpen ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Database size={15} className={isRecursosOpen ? 'text-orange-500' : 'text-slate-400 group-hover:text-slate-900'} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Recursos</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${isRecursosOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isRecursosOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-1">
                      <button 
                        onClick={() => {
                          onNavigate?.('insumos');
                          setIsRecursosOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center gap-3 uppercase tracking-wider"
                      >
                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                        Recurso de Insumo
                      </button>
                      <button 
                        onClick={() => {
                          onNavigate?.('composicoes');
                          setIsRecursosOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center gap-3 uppercase tracking-wider"
                      >
                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                        Recurso de Composição
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => onNavigate?.('templates')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-slate-500 hover:bg-slate-100 hover:text-slate-900 group"
            >
              <FileText size={15} className="text-slate-400 group-hover:text-slate-900" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Templates</span>
            </button>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
      <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all relative shadow-sm hover:shadow-md bg-white/40 border border-transparent hover:border-slate-200">
        <Bell size={17} />
        <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-white" />
      </button>
      <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow-md bg-white/40 border border-transparent hover:border-slate-200">
        <HelpCircle size={17} />
      </button>
      <div className="h-6 w-[1px] bg-slate-200 mx-2" />
      <button className="flex items-center gap-3 pl-3 pr-1 py-1 hover:bg-white rounded-xl transition-all group shadow-sm hover:shadow-md bg-white/40 border border-transparent hover:border-slate-200">
        <div className="text-right hidden sm:block">
          <p className="text-[12px] font-black text-slate-900 uppercase leading-none">{user?.nome || 'Usuário'}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{user?.role === 'admin' ? 'Administrador' : 'Usuário'}</p>
        </div>
        <div className="w-[30px] h-[30px] bg-slate-900 rounded-lg flex items-center justify-center text-white group-hover:bg-orange-500 transition-colors">
          <User size={15} />
        </div>
      </button>
    </div>
  </div>
);
};

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  delay?: number;
}

export const MetricCard = ({ title, value, icon: Icon, color, delay = 0 }: MetricCardProps) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex items-center justify-between"
  >
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{title}</p>
      <h3 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h3>
    </div>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} bg-opacity-10`}>
      <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
    </div>
  </motion.div>
);

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed?: boolean;
}

export const SidebarItem = ({ icon: Icon, label, active, onClick, collapsed = false }: SidebarItemProps) => (
  <button 
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={`w-full flex items-center transition-all duration-300 group relative ${
      collapsed ? 'justify-center px-0 py-3 gap-0' : 'gap-2 px-4 py-3'
    } ${
      active 
        ? 'bg-[#2d3748]/50 text-white' 
        : 'text-slate-400 hover:text-white hover:bg-[#2d3748]/30'
    }`}
  >
    {active && (
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
    )}
    <Icon size={18} className={`${active ? 'text-amber-500' : 'text-slate-400 group-hover:text-white'} transition-colors`} />
    {!collapsed && <span className="text-[13px] font-bold tracking-tight">{label}</span>}
  </button>
);

export const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    'Em Andamento': 'bg-blue-50 text-blue-600 border-blue-100',
    'Em Planejamento': 'bg-indigo-50 text-indigo-600 border-indigo-100',
    'Concluída': 'bg-slate-50 text-slate-600 border-slate-100',
    'Atrasada': 'bg-rose-50 text-rose-600 border-rose-100',
  };
  
  return (
    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${colors[status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
      {status}
    </span>
  );
};

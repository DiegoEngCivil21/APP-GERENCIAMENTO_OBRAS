import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  HardHat, 
  Package, 
  TrendingUp, 
  Calendar, 
  Settings, 
  Menu, 
  Bell, 
  User,
  ChevronLeft,
  Hammer,
  LogOut,
  Plus
} from 'lucide-react';
import { motion } from 'motion/react';
import { SidebarItem } from './UIComponents';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Layout = ({ children, activeTab, setActiveTab }: LayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarCollapsed ? '80px' : '260px' }}
        className="fixed left-0 top-0 bottom-0 bg-[#1a2233] z-50 flex flex-col transition-all duration-300 shadow-xl"
      >
        <div className="p-6 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
            <Hammer className="text-[#1a2233]" size={22} fill="currentColor" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-[11px] font-black tracking-[0.2em] text-slate-400 uppercase">Gestão de Obras</span>
          )}
        </div>

        <nav className="flex-1 py-6">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            collapsed={sidebarCollapsed}
          />
          <SidebarItem 
            icon={HardHat} 
            label="Obras" 
            active={activeTab === 'obras'} 
            onClick={() => setActiveTab('obras')} 
            collapsed={sidebarCollapsed}
          />
          <SidebarItem 
            icon={Package} 
            label="Insumos" 
            active={activeTab === 'materiais'} 
            onClick={() => setActiveTab('materiais')} 
            collapsed={sidebarCollapsed}
          />
          <SidebarItem 
            icon={TrendingUp} 
            label="Recursos de Composição" 
            active={activeTab === 'composicoes'} 
            onClick={() => setActiveTab('composicoes')} 
            collapsed={sidebarCollapsed}
          />
        </nav>

        <div className="py-6 border-t border-slate-700/30">
          <SidebarItem 
            icon={Settings} 
            label="Configurações" 
            active={activeTab === 'config'} 
            onClick={() => setActiveTab('config')} 
            collapsed={sidebarCollapsed}
          />
          <SidebarItem 
            icon={LogOut} 
            label="Sair" 
            active={false} 
            onClick={() => {}} 
            collapsed={sidebarCollapsed}
          />
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-[260px]'} overflow-hidden`}>
        <header className="h-28 px-10 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-4xl font-black text-[#1a2233] tracking-tight uppercase">
              {activeTab === 'dashboard' ? 'Dashboard' : activeTab.replace('_', ' ')}
            </h1>
            <p className="text-sm font-medium text-slate-400 mt-1">
              {activeTab === 'dashboard' ? 'Visão geral da construtora' : `Gerenciamento de ${activeTab}`}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="bg-[#1a2233] text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-[#2d3748] transition-all shadow-lg shadow-[#1a2233]/20 text-xs uppercase tracking-widest">
              <Plus size={18} /> Nova Obra
            </button>
          </div>
        </header>

        <div className="px-10 flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
};

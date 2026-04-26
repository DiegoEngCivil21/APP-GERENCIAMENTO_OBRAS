import React from 'react';
import { Printer, Target, CheckCircle, RefreshCw, AlertTriangle, Settings } from 'lucide-react';

interface CronogramaHeaderProps {
  obraData: any;
  handleUpdateObraExecutionStart: (date: string) => void;
  handlePrint: () => void;
  scrollToToday: () => void;
  hasBaseline: boolean;
  handleCreateBaseline: () => void;
  isApplyingBaseline: boolean;
  handleClearBaseline: () => void;
  showBaselineSuccess: boolean;
  showClearBaselineConfirm: boolean;
  setShowClearBaselineConfirm: (show: boolean) => void;
  onSettingsClick: () => void;
  showCriticalPath: boolean;
  toggleCriticalPath: () => void;
  viewMode: 'day' | 'week' | 'month';
  setViewMode: (mode: 'day' | 'week' | 'month') => void;
  isFullscreen: boolean;
  setIsFullscreen: (full: boolean) => void;
}

export const CronogramaHeader: React.FC<CronogramaHeaderProps> = ({
  obraData,
  handleUpdateObraExecutionStart,
  handlePrint,
  scrollToToday,
  hasBaseline,
  handleCreateBaseline,
  isApplyingBaseline,
  handleClearBaseline,
  showBaselineSuccess,
  showClearBaselineConfirm,
  setShowClearBaselineConfirm,
  onSettingsClick,
  showCriticalPath,
  toggleCriticalPath,
  viewMode,
  setViewMode,
  isFullscreen,
  setIsFullscreen,
}) => {
  return (
    <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl mb-4">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-black text-slate-800 uppercase tracking-widest">Cronograma</h1>
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Início da Execução</span>
            <input 
              type="date"
              value={obraData?.data_inicio_real || ''}
              onChange={(e) => handleUpdateObraExecutionStart(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button
          onClick={toggleCriticalPath}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${showCriticalPath ? 'bg-red-100 text-red-700' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'} shadow-sm`}
          title="Caminho Crítico"
        >
          <AlertTriangle size={14} />
          Caminho Crítico
        </button>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button 
            onClick={() => setViewMode('day')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === 'day' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Dias
          </button>
          <button 
            onClick={() => setViewMode('week')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Semanas
          </button>
          <button 
            onClick={() => setViewMode('month')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Meses
          </button>
        </div>

        <button 
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-1.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
          title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={isFullscreen ? "M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" : "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"}></path></svg>
        </button>

        <div className="w-px h-6 bg-slate-200 mx-1"></div>

        <button 
          onClick={handlePrint}
          className="p-1.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
          title="Imprimir Cronograma"
        >
          <Printer size={16} />
        </button>

        <button 
          onClick={scrollToToday}
          className="p-1.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
          title="Ir para Hoje"
        >
          <Target size={16} />
        </button>

        <button 
          onClick={onSettingsClick}
          className="p-1.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
          title="Configurações do Cronograma"
        >
          <Settings size={16} />
        </button>

        {hasBaseline ? (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowClearBaselineConfirm(true)}
              className="px-4 py-2 text-white bg-amber-600 hover:bg-amber-700 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-md"
            >
              Limpar Linha Base
            </button>
          </div>
        ) : (
          <button 
            onClick={handleCreateBaseline}
            disabled={isApplyingBaseline}
            className={`px-4 py-2 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-md ${
              isApplyingBaseline ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
            }`}
          >
            {isApplyingBaseline ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {isApplyingBaseline ? 'Aplicando...' : 'Definir Linha Base'}
          </button>
        )}
      </div>

      {showClearBaselineConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Limpar Linha de Base?</h3>
            <p className="text-sm text-slate-600 mb-4">Isso removerá a linha de base atual e desbloqueará a edição de datas e durações.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowClearBaselineConfirm(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold">Cancelar</button>
              <button onClick={handleClearBaseline} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700">Limpar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

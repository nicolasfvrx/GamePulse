import React from 'react';
import { Radio, RefreshCw, Plus, Key, LogOut } from 'lucide-react';

interface NavbarProps {
  onRefresh: () => void;
  onOpenCreateBot: () => void;
  isRefreshing: boolean;
  onlineWorkersCount: number;
  onChangePasswordClick?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onRefresh,
  onOpenCreateBot,
  isRefreshing,
  onlineWorkersCount,
  onChangePasswordClick,
  onLogout,
}) => {
  return (
    <header className="border-b border-gaming-800 bg-gaming-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border border-emerald-500/40 flex items-center justify-center shadow-glow-green">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-white">
                Game<span className="text-emerald-400">Pulse</span>
              </span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">Réseau Décentralisé de Présence Discord & Query Steam A2S</p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center space-x-2.5">
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-gaming-850 border border-gaming-800 text-xs">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${onlineWorkersCount > 0 ? 'bg-emerald-400' : 'bg-red-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${onlineWorkersCount > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-slate-300">
              {onlineWorkersCount > 0 ? `${onlineWorkersCount} Worker(s) En Ligne` : 'Aucun Worker En Ligne'}
            </span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-gaming-850 hover:bg-gaming-800 border border-gaming-800 text-slate-300 hover:text-white transition-all disabled:opacity-50"
            title="Rafraîchir les données"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          {onChangePasswordClick && (
            <button
              onClick={onChangePasswordClick}
              className="p-2 rounded-lg bg-gaming-850 hover:bg-gaming-800 border border-gaming-800 text-slate-300 hover:text-amber-400 transition-colors"
              title="Changer le mot de passe"
            >
              <Key className="w-4 h-4" />
            </button>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 rounded-lg bg-gaming-850 hover:bg-gaming-800 border border-gaming-800 text-slate-300 hover:text-rose-400 transition-colors"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onOpenCreateBot}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs sm:text-sm transition-all shadow-glow-green transform hover:-translate-y-0.5 active:translate-y-0 ml-1"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Bot</span>
          </button>
        </div>
      </div>
    </header>
  );
};

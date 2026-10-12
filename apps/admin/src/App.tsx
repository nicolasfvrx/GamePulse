import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.js';
import { StatsOverview } from './components/StatsOverview.js';
import { WorkersList } from './components/WorkersList.js';
import { BotsTable } from './components/BotsTable.js';
import { BotModal } from './components/BotModal.js';
import { StatusHistoryModal } from './components/StatusHistoryModal.js';
import { LoginModal } from './components/LoginModal.js';
import { apiClient } from './api/client.js';
import type {
  OverviewStats,
  Worker,
  BotSanitized,
  CreateBotInput,
  UpdateBotInput,
} from '@gamepulse/shared';
import { Terminal, Key } from 'lucide-react';

export const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => apiClient.isAuthenticated());
  const [stats, setStats] = useState<OverviewStats>({
    total_workers: 0,
    online_workers: 0,
    total_bots: 0,
    active_bots: 0,
    online_servers: 0,
    total_players_tracked: 0,
  });
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [bots, setBots] = useState<BotSanitized[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal states
  const [isBotModalOpen, setIsBotModalOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<BotSanitized | null>(null);
  const [historyBot, setHistoryBot] = useState<BotSanitized | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [fetchedStats, fetchedWorkers, fetchedBots] = await Promise.all([
        apiClient.getOverviewStats(),
        apiClient.getWorkers(),
        apiClient.getBots(),
      ]);

      if (fetchedStats) setStats(fetchedStats);
      if (fetchedWorkers) setWorkers(fetchedWorkers);
      if (fetchedBots) setBots(fetchedBots);
    } catch (err) {
      console.error('Erreur chargement données:', err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto-refresh polling every 15s
    const timer = setInterval(() => {
      loadData(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [loadData]);

  const handleCreateOrUpdateBot = async (data: CreateBotInput | UpdateBotInput) => {
    if (editingBot) {
      await apiClient.updateBot(editingBot.id, data);
    } else {
      await apiClient.createBot(data as CreateBotInput);
    }
    await loadData();
  };

  const handleToggleBotStatus = async (bot: BotSanitized) => {
    const nextStatus = bot.status === 'active' ? 'paused' : 'active';
    await apiClient.updateBot(bot.id, { status: nextStatus });
    await loadData();
  };

  const handleDeleteBot = async (id: string) => {
    if (confirm('Confirmez-vous la suppression de ce bot ?')) {
      await apiClient.deleteBot(id);
      await loadData();
    }
  };

  const handleLogin = async (keyOrPassword: string): Promise<boolean> => {
    const success = await apiClient.login(keyOrPassword);
    if (success) {
      setIsLoggedIn(true);
      await loadData();
    }
    return success;
  };

  const handleLogout = () => {
    apiClient.logout();
    setIsLoggedIn(false);
  };

  const handleDeleteWorker = async (id: string) => {
    if (confirm('Confirmez-vous la suppression de ce worker de la liste ?')) {
      await apiClient.deleteWorker(id);
      await loadData();
    }
  };

  return (
    <div className="min-h-screen bg-gaming-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-black">
      {!isLoggedIn && <LoginModal onLogin={handleLogin} />}

      <Navbar
        onRefresh={() => loadData()}
        onOpenCreateBot={() => {
          setEditingBot(null);
          setIsBotModalOpen(true);
        }}
        onLogout={handleLogout}
        isRefreshing={isRefreshing}
        onlineWorkersCount={stats.online_workers}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner Quick Info */}
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-gaming-900 via-gaming-850 to-gaming-900 border border-gaming-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
              <Terminal className="w-4 h-4" />
              <span>Architecture Réseau Cloudflare D1 + Rust Tokio</span>
            </div>
            <p className="text-slate-300 text-sm">
              Les workers Rust interrogent les serveurs DayZ en UDP (protocole Valve A2S_INFO),
              maintiennent les sessions Discord Gateway et synchronisent leurs métriques en continu.
            </p>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-gaming-950 border border-gaming-800/80 text-xs font-mono text-slate-400 flex items-center space-x-2 shrink-0">
            <Key className="w-4 h-4 text-amber-400" />
            <span>Worker Secret: <code className="text-amber-300">X-Worker-Key</code></span>
          </div>
        </div>

        {/* Global KPI Stats */}
        <StatsOverview stats={stats} />

        {/* Workers Section */}
        <WorkersList
          workers={workers}
          onDeleteWorker={handleDeleteWorker}
        />

        {/* Bots & DayZ Servers Section */}
        <BotsTable
          bots={bots}
          onToggleStatus={handleToggleBotStatus}
          onEditBot={(bot) => {
            setEditingBot(bot);
            setIsBotModalOpen(true);
          }}
          onDeleteBot={handleDeleteBot}
          onViewHistory={(bot) => setHistoryBot(bot)}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-gaming-800 py-6 bg-gaming-950/80 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>GamePulse • Monorepo TypeScript & Rust</span>
          <div className="flex items-center space-x-4">
            <span className="hover:text-slate-400 transition-colors">Cloudflare Pages / D1</span>
            <span>•</span>
            <span className="hover:text-slate-400 transition-colors">Hono Framework</span>
            <span>•</span>
            <span className="hover:text-slate-400 transition-colors">Rust Tokio & Tungstenite</span>
            <span>•</span>
            <span className="hover:text-slate-400 transition-colors">Valve A2S_INFO</span>
          </div>
        </div>
      </footer>

      {/* Create / Edit Bot Modal */}
      <BotModal
        isOpen={isBotModalOpen}
        onClose={() => {
          setIsBotModalOpen(false);
          setEditingBot(null);
        }}
        onSubmit={handleCreateOrUpdateBot}
        initialBot={editingBot}
        workers={workers}
      />

      {/* History Logs Modal */}
      <StatusHistoryModal
        bot={historyBot}
        onClose={() => setHistoryBot(null)}
      />
    </div>
  );
};

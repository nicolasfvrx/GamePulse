import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.js';
import { StatsOverview } from './components/StatsOverview.js';
import { WorkersList } from './components/WorkersList.js';
import { BotsTable } from './components/BotsTable.js';
import { BotModal } from './components/BotModal.js';
import { WorkerModal } from './components/WorkerModal.js';
import { StatusHistoryModal } from './components/StatusHistoryModal.js';
import { LoginModal } from './components/LoginModal.js';
import { ChangePasswordModal } from './components/ChangePasswordModal.js';
import { SettingsModal } from './components/SettingsModal.js';
import { MapsModal } from './components/MapsModal.js';
import { apiClient } from './api/client.js';
import type {
  OverviewStats,
  Worker,
  CreateWorkerInput,
  CreateWorkerResponse,
  BotSanitized,
  CreateBotInput,
  UpdateBotInput,
} from '@gamepulse/shared';

export const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => apiClient.isAuthenticated());
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMapsOpen, setIsMapsOpen] = useState(false);

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
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<BotSanitized | null>(null);
  const [historyBot, setHistoryBot] = useState<BotSanitized | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!apiClient.isAuthenticated()) {
      setIsLoggedIn(false);
      return;
    }

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
      if (!apiClient.isAuthenticated()) {
        setIsLoggedIn(false);
      }
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadData();
      const timer = setInterval(() => {
        loadData(true);
      }, 15000);
      return () => clearInterval(timer);
    }
  }, [isLoggedIn, loadData]);

  const handleLogin = async (password: string): Promise<{ success: boolean; error?: string }> => {
    const res = await apiClient.login(password);
    if (res.success) {
      setIsLoggedIn(true);
      await loadData();
    }
    return res;
  };

  const handleLogout = async () => {
    await apiClient.logout();
    setIsLoggedIn(false);
  };

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

  const handleCreateWorker = async (input: CreateWorkerInput): Promise<CreateWorkerResponse | null> => {
    const res = await apiClient.createWorker(input);
    await loadData();
    return res;
  };

  const handleRegenerateWorkerKey = async (id: string) => {
    if (confirm('Voulez-vous générer une nouvelle clé pour ce worker ? L\'ancienne clé sera immédiatement invalidée.')) {
      await apiClient.regenerateWorkerKey(id);
      await loadData();
    }
  };

  const handleRevokeWorkerKey = async (id: string) => {
    if (confirm('Voulez-vous révoquer l\'accès de ce worker ? Il ne pourra plus communiquer avec l\'API tant qu\'une nouvelle clé n\'est pas générée.')) {
      await apiClient.revokeWorkerKey(id);
      await loadData();
    }
  };

  const handleDeleteWorker = async (id: string) => {
    if (confirm('Confirmez-vous la suppression de ce worker de la liste ?')) {
      await apiClient.deleteWorker(id);
      await loadData();
    }
  };

  return (
    <div className="min-h-screen bg-gaming-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* If not logged in, display the login modal */}
      {!isLoggedIn && (
        <LoginModal onLogin={handleLogin} />
      )}

      <Navbar
        onRefresh={() => loadData()}
        onOpenCreateBot={() => {
          setEditingBot(null);
          setIsBotModalOpen(true);
        }}
        isRefreshing={isRefreshing}
        onlineWorkersCount={stats.online_workers}
        onMapsClick={() => setIsMapsOpen(true)}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onChangePasswordClick={() => setIsChangePasswordOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Global KPI Stats */}
        <StatsOverview stats={stats} />

        {/* Workers Section */}
        <WorkersList
          workers={workers}
          onDeleteWorker={handleDeleteWorker}
          onOpenCreateWorker={() => setIsWorkerModalOpen(true)}
          onRegenerateKey={handleRegenerateWorkerKey}
          onRevokeKey={handleRevokeWorkerKey}
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
          <span>GamePulse • Réseau Distribué de Présence Discord</span>
          <div className="flex items-center space-x-4">
            <span>Cloudflare Pages & D1</span>
            <span>•</span>
            <span>Tokio Rust Worker</span>
            <span>•</span>
            <span>Valve A2S_INFO</span>
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

      {/* Create Worker Modal */}
      <WorkerModal
        isOpen={isWorkerModalOpen}
        onClose={() => setIsWorkerModalOpen(false)}
        onSubmit={handleCreateWorker}
      />

      {/* History Logs Modal */}
      <StatusHistoryModal
        bot={historyBot}
        onClose={() => setHistoryBot(null)}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        onChangePassword={apiClient.changePassword}
      />

      {/* CFTools Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onGetSettings={apiClient.getCFToolsSettings}
        onSaveSettings={apiClient.updateCFToolsSettings}
      />

      {/* Map Dictionary Modal */}
      <MapsModal
        isOpen={isMapsOpen}
        onClose={() => setIsMapsOpen(false)}
        onMapsUpdated={loadData}
      />
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Info, Bot } from 'lucide-react';
import type { BotSanitized, CreateBotInput, UpdateBotInput, Worker } from '@gamepulse/shared';

interface BotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateBotInput | UpdateBotInput) => Promise<void>;
  initialBot?: BotSanitized | null;
  workers: Worker[];
}

export const BotModal: React.FC<BotModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialBot,
  workers,
}) => {
  const [name, setName] = useState('');
  const [discordToken, setDiscordToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [discordClientId, setDiscordClientId] = useState('');
  const [serverIp, setServerIp] = useState('');
  const [serverQueryPort, setServerQueryPort] = useState(2305);
  const [serverGamePort, setServerGamePort] = useState<number | undefined>(2302);
  const [refreshIntervalSecs, setRefreshIntervalSecs] = useState(20);
  const [workerId, setWorkerId] = useState<string>('auto');
  const [activityFormat, setActivityFormat] = useState('Joue à DayZ - {map} [{players}/{max_players}]');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialBot) {
      setName(initialBot.name);
      setDiscordToken(''); // Leave empty unless modifying
      setDiscordClientId(initialBot.discord_client_id);
      setServerIp(botServerIp(initialBot.server_ip));
      setServerQueryPort(initialBot.server_query_port);
      setServerGamePort(initialBot.server_game_port ?? undefined);
      setRefreshIntervalSecs(initialBot.refresh_interval_secs);
      setWorkerId(initialBot.worker_id || 'auto');
      setActivityFormat(initialBot.activity_format || 'Joue à DayZ - {map} [{players}/{max_players}]');
    } else {
      setName('');
      setDiscordToken('');
      setDiscordClientId('');
      setServerIp('');
      setServerQueryPort(2305);
      setServerGamePort(2302);
      setRefreshIntervalSecs(20);
      setWorkerId('auto');
      setActivityFormat('Joue à DayZ - {map} [{players}/{max_players}]');
    }
    setError(null);
  }, [initialBot, isOpen]);

  const botServerIp = (ip: string) => ip;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Veuillez renseigner un nom pour le bot.');
      return;
    }
    if (!initialBot && !discordToken.trim()) {
      setError('Le token du bot Discord est requis.');
      return;
    }
    if (!discordClientId.trim()) {
      setError("L'ID client Discord est requis.");
      return;
    }
    if (!serverIp.trim()) {
      setError("L'adresse IP du serveur DayZ est requise.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        name,
        discord_token: discordToken,
        discord_client_id: discordClientId,
        server_ip: serverIp,
        server_query_port: Number(serverQueryPort),
        server_game_port: serverGamePort ? Number(serverGamePort) : null,
        refresh_interval_secs: Number(refreshIntervalSecs),
        worker_id: workerId === 'auto' ? null : workerId,
        activity_format: activityFormat,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-gaming-900 border border-gaming-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gaming-800 flex items-center justify-between bg-gaming-850">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {initialBot ? 'Modifier la configuration du bot' : 'Ajouter un bot Discord'}
              </h2>
              <p className="text-xs text-slate-400">Connexion Gateway Discord et interrogation Valve A2S</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-gaming-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Bot Name & Discord Client ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nom du Bot
              </label>
              <input
                type="text"
                required
                placeholder="ex: DayZ FR #1 Tracker"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gaming-850 border border-gaming-800 focus:border-emerald-500 focus:outline-none text-white text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Application Client ID
              </label>
              <input
                type="text"
                required
                placeholder="ex: 123456789012345678"
                value={discordClientId}
                onChange={(e) => setDiscordClientId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gaming-850 border border-gaming-800 focus:border-emerald-500 focus:outline-none text-white font-mono text-xs"
              />
            </div>
          </div>

          {/* Discord Bot Token */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Token du Bot Discord {initialBot && <span className="text-slate-500">(laisser vide pour ne pas modifier)</span>}
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                required={!initialBot}
                placeholder={initialBot ? '••••••••••••••••••••••••••••' : 'Collez le token du bot...'}
                value={discordToken}
                onChange={(e) => setDiscordToken(e.target.value)}
                className="w-full pl-3 pr-10 py-2 rounded-lg bg-gaming-850 border border-gaming-800 focus:border-emerald-500 focus:outline-none text-white font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Server IP & Ports */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                IP Serveur DayZ
              </label>
              <input
                type="text"
                required
                placeholder="51.178.65.12"
                value={serverIp}
                onChange={(e) => setServerIp(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gaming-850 border border-gaming-800 focus:border-emerald-500 focus:outline-none text-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Port Query A2S
              </label>
              <input
                type="number"
                required
                placeholder="2305"
                value={serverQueryPort}
                onChange={(e) => setServerQueryPort(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-gaming-850 border border-gaming-800 focus:border-emerald-500 focus:outline-none text-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Port Jeu (Optionnel)
              </label>
              <input
                type="number"
                placeholder="2302"
                value={serverGamePort ?? ''}
                onChange={(e) => setServerGamePort(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-lg bg-gaming-850 border border-gaming-800 focus:border-emerald-500 focus:outline-none text-white font-mono text-xs"
              />
            </div>
          </div>

          {/* Refresh interval & Worker assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Intervalle de Rafraîchissement
              </label>
              <select
                value={refreshIntervalSecs}
                onChange={(e) => setRefreshIntervalSecs(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-gaming-850 border border-gaming-800 focus:border-emerald-500 focus:outline-none text-white text-xs"
              >
                <option value={15}>15 secondes (Temps Réel)</option>
                <option value={20}>20 secondes (Recommandé)</option>
                <option value={30}>30 secondes</option>
                <option value={60}>60 secondes (Économique)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Assignation Worker Rust
              </label>
              <select
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gaming-850 border border-gaming-800 focus:border-emerald-500 focus:outline-none text-white text-xs"
              >
                <option value="auto">Auto (Tous les workers disponibles)</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.hostname})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Activity Presence Format */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Format de Présence Discord
            </label>
            <input
              type="text"
              required
              value={activityFormat}
              onChange={(e) => setActivityFormat(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gaming-850 border border-gaming-800 focus:border-emerald-500 focus:outline-none text-white font-mono text-xs"
            />
            <div className="mt-2 p-2.5 rounded-lg bg-gaming-850/60 border border-gaming-800/80 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center space-x-1 font-semibold text-slate-300">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>Variables dynamiques disponibles :</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-slate-400 font-mono">
                <span>{'{map}'} : Nom de la carte</span>
                <span>{'{players}'} : Joueurs en ligne</span>
                <span>{'{max_players}'} : Capacité maximale</span>
                <span>{'{server_name}'} : Nom Steam</span>
                <span>{'{ping}'} : Latence en ms</span>
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="pt-4 border-t border-gaming-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gaming-850 hover:bg-gaming-800 border border-gaming-800 text-slate-300 text-xs font-semibold transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-glow-green disabled:opacity-50"
            >
              {isSubmitting ? 'Enregistrement...' : initialBot ? 'Mettre à jour' : 'Créer le Bot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

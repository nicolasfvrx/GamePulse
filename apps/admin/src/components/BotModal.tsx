import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Info, Bot, Cloud, Server, MessageSquare } from 'lucide-react';
import type { BotSanitized, CreateBotInput, UpdateBotInput, Worker, QueryType } from '@gamepulse/shared';

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
  const [serverQueryPort, setServerQueryPort] = useState(2303);
  const [serverGamePort, setServerGamePort] = useState<number | undefined>(2302);
  const [refreshIntervalSecs, setRefreshIntervalSecs] = useState(20);
  const [workerId, setWorkerId] = useState<string>('auto');
  const [activityFormat, setActivityFormat] = useState('Joue à DayZ - {map} [{players}/{max_players}]{queue_suffix}');
  const [queryType, setQueryType] = useState<QueryType>('a2s');
  const [cftoolsServerId, setCftoolsServerId] = useState('');
  const [customStatusEnabled, setCustomStatusEnabled] = useState(false);
  const [customStatusText, setCustomStatusText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialBot) {
      setName(initialBot.name);
      setDiscordToken(''); // Leave empty unless modifying
      setDiscordClientId(initialBot.discord_client_id);
      setServerIp(initialBot.server_ip);
      setServerQueryPort(initialBot.server_query_port ?? 2303);
      setServerGamePort(initialBot.server_game_port ?? undefined);
      setRefreshIntervalSecs(initialBot.refresh_interval_secs);
      setWorkerId(initialBot.worker_id || 'auto');
      setActivityFormat(initialBot.activity_format || 'Joue à DayZ - {map} [{players}/{max_players}]{queue_suffix}');
      setQueryType(initialBot.query_type || 'a2s');
      setCftoolsServerId(initialBot.cftools_server_id || '');
      setCustomStatusEnabled(Boolean(initialBot.custom_status_enabled));
      setCustomStatusText(initialBot.custom_status_text || '');
    } else {
      setName('');
      setDiscordToken('');
      setDiscordClientId('');
      setServerIp('');
      setServerQueryPort(2303);
      setServerGamePort(2302);
      setRefreshIntervalSecs(20);
      setWorkerId('auto');
      setActivityFormat('Joue à DayZ - {map} [{players}/{max_players}]{queue_suffix}');
      setQueryType('a2s');
      setCftoolsServerId('');
      setCustomStatusEnabled(false);
      setCustomStatusText('');
    }
    setError(null);
  }, [initialBot, isOpen]);

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
    if (queryType === 'cftools' && !cftoolsServerId.trim()) {
      setError("Veuillez renseigner le Server API ID de CFTools Cloud.");
      return;
    }
    if (customStatusEnabled && !customStatusText.trim()) {
      setError("Veuillez renseigner le texte du statut personnalisé ou décocher l'option.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        name: name.trim(),
        discord_token: discordToken,
        discord_client_id: discordClientId.trim(),
        server_ip: serverIp.trim(),
        server_query_port: Number(serverQueryPort) || 2303,
        server_game_port: serverGamePort ? Number(serverGamePort) : null,
        refresh_interval_secs: Number(refreshIntervalSecs),
        worker_id: workerId === 'auto' ? null : workerId,
        activity_format: activityFormat.trim(),
        query_type: queryType,
        cftools_server_id: queryType === 'cftools' ? cftoolsServerId.trim() : null,
        custom_status_enabled: customStatusEnabled,
        custom_status_text: customStatusEnabled ? customStatusText.trim() : null,
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
              <p className="text-xs text-slate-400">Connexion Gateway Discord, A2S ou CFTools Cloud</p>
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
                placeholder="ex: DayZ Chernarus #1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gaming-850 border border-gaming-800 focus:border-emerald-500 focus:outline-none text-white text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Application Client ID Discord
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

          {/* Query Source Selection */}
          <div className="p-3.5 rounded-xl bg-gaming-850/60 border border-gaming-800 space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              Source d'interrogation du serveur
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQueryType('a2s')}
                className={`flex items-center space-x-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  queryType === 'a2s'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                    : 'bg-gaming-800 border-gaming-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Server className="w-4 h-4 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-bold">Steam A2S</div>
                  <div className="text-[10px] opacity-75">UDP Direct (Standard)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setQueryType('cftools')}
                className={`flex items-center space-x-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  queryType === 'cftools'
                    ? 'bg-sky-500/15 border-sky-500 text-sky-300'
                    : 'bg-gaming-800 border-gaming-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cloud className="w-4 h-4 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-bold">CFTools Cloud</div>
                  <div className="text-[10px] opacity-75">API & Queue / File d'attente</div>
                </div>
              </button>
            </div>

            {queryType === 'cftools' && (
              <div className="pt-2 border-t border-gaming-800/80">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Server API ID (CFTools)</span>
                  <span className="text-[10px] text-sky-400 font-normal">Requis pour CFTools Cloud</span>
                </label>
                <input
                  type="text"
                  required={queryType === 'cftools'}
                  placeholder="ex: c0ffee00-1234-5678-9abc-def012345678"
                  value={cftoolsServerId}
                  onChange={(e) => setCftoolsServerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gaming-850 border border-sky-500/40 focus:border-sky-500 focus:outline-none text-white font-mono text-xs"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Trouvez cet ID dans les paramètres API de votre serveur sur <a href="https://cftools.cloud" target="_blank" rel="noreferrer" className="text-sky-400 underline">cftools.cloud</a>.
                </p>
              </div>
            )}
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
                placeholder="2303"
                value={serverQueryPort}
                onChange={(e) => setServerQueryPort(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-gaming-850 border border-gaming-800 focus:border-emerald-500 focus:outline-none text-white font-mono text-xs"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Défaut: 2303 (jeu + 1)</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Port Jeu (Connexion)
              </label>
              <input
                type="number"
                placeholder="2302"
                value={serverGamePort ?? ''}
                onChange={(e) => setServerGamePort(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-lg bg-gaming-850 border border-gaming-800 focus:border-emerald-500 focus:outline-none text-white font-mono text-xs"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Défaut DayZ: 2302</span>
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

          {/* Custom Status Feature */}
          <div className="p-3.5 rounded-xl bg-gaming-850/60 border border-gaming-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customStatusEnabled}
                  onChange={(e) => setCustomStatusEnabled(e.target.checked)}
                  className="rounded border-gaming-700 bg-gaming-900 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <span className="flex items-center space-x-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span>Statut Personnalisé Fixe (Override)</span>
                </span>
              </label>
              {customStatusEnabled && (
                <span className="text-[10px] font-semibold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  Actif sur Discord
                </span>
              )}
            </div>

            {customStatusEnabled && (
              <div className="pt-2 border-t border-gaming-800/80 space-y-1.5">
                <input
                  type="text"
                  placeholder="ex: Le serveur ouvre bientôt ! 🚀"
                  value={customStatusText}
                  onChange={(e) => setCustomStatusText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gaming-850 border border-amber-500/40 focus:border-amber-500 focus:outline-none text-white text-xs"
                />
                <p className="text-[11px] text-slate-400">
                  Ce texte sera affiché en permanence comme activité Discord du bot (même si le serveur est redémarré ou hors ligne).
                </p>
              </div>
            )}
          </div>

          {/* Activity Presence Format */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Format de Présence Discord Dynamique
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
                <span className="text-sky-300">{'{queue}'} : File d'attente (CFTools)</span>
                <span className="text-sky-300">{'{queue_suffix}'} : (+X) automatique</span>
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

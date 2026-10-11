import React from 'react';
import {
  Bot as BotIcon,
  Server,
  Play,
  Pause,
  Edit2,
  Trash2,
  History,
  MapPin,
  Users,
  Wifi,
  Layers,
} from 'lucide-react';
import type { BotSanitized } from '@gamepulse/shared';
import { formatPresenceText } from '@gamepulse/shared';

interface BotsTableProps {
  bots: BotSanitized[];
  onToggleStatus: (bot: BotSanitized) => void;
  onEditBot: (bot: BotSanitized) => void;
  onDeleteBot: (id: string) => void;
  onViewHistory: (bot: BotSanitized) => void;
}

export const BotsTable: React.FC<BotsTableProps> = ({
  bots,
  onToggleStatus,
  onEditBot,
  onDeleteBot,
  onViewHistory,
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <BotIcon className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white tracking-wide">Bots & Serveurs Surveillés</h2>
          <span className="text-xs px-2 py-0.5 rounded bg-gaming-800 text-slate-400 border border-gaming-700">
            {bots.length}
          </span>
        </div>
      </div>

      {bots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gaming-800 p-8 text-center bg-gaming-900/50">
          <BotIcon className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
          <p className="text-slate-300 font-medium">Aucun bot configuré</p>
          <p className="text-slate-500 text-xs mt-1">
            Cliquez sur "Nouveau Bot" en haut à droite pour connecter un bot Discord à un serveur DayZ.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bots.map((bot) => {
            const isServerOnline = bot.last_status?.is_online;
            const presencePreview = formatPresenceText(bot.activity_format, bot.last_status);
            const playersPercent =
              bot.last_status && bot.last_status.max_players > 0
                ? Math.min(100, (bot.last_status.players_count / bot.last_status.max_players) * 100)
                : 0;

            return (
              <div
                key={bot.id}
                className="rounded-xl bg-gaming-900 border border-gaming-800 hover:border-gaming-700 p-5 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Bot Meta */}
                  <div className="space-y-2 lg:w-1/3">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-lg bg-gaming-850 border border-gaming-800 text-emerald-400">
                        <BotIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-white text-base">{bot.name}</h3>
                          <span
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                              bot.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-700/30 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {bot.status === 'active' ? 'Actif' : 'En pause'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center space-x-2">
                          <span>Client ID: {bot.discord_client_id}</span>
                          <span className="text-slate-600">•</span>
                          <span>Token: {bot.token_preview}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {/* Worker badge */}
                      <span className="inline-flex items-center space-x-1 text-xs px-2 py-0.5 rounded bg-gaming-850 text-slate-300 border border-gaming-800">
                        <Layers className="w-3 h-3 text-blue-400" />
                        <span>Worker: {bot.worker_id ? bot.worker_id : 'Auto (Tous)'}</span>
                      </span>

                      {/* Server IP:Port */}
                      <span className="inline-flex items-center space-x-1 text-xs px-2 py-0.5 rounded bg-gaming-850 text-slate-300 border border-gaming-800 font-mono">
                        <Server className="w-3 h-3 text-purple-400" />
                        <span>{bot.server_ip}:{bot.server_query_port}</span>
                      </span>

                      {/* Refresh interval */}
                      <span className="text-xs px-2 py-0.5 rounded bg-gaming-850 text-slate-400 border border-gaming-800">
                        Refresh: {bot.refresh_interval_secs}s
                      </span>
                    </div>
                  </div>

                  {/* Middle: DayZ Live Server Status */}
                  <div className="lg:w-2/5 rounded-lg bg-gaming-850/60 border border-gaming-800/80 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 truncate">
                        <span className={`h-2 w-2 rounded-full ${isServerOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {bot.last_status?.server_name || `${bot.server_ip}:${bot.server_query_port}`}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs">
                        {isServerOnline ? (
                          <span className="text-emerald-400 font-mono flex items-center space-x-1">
                            <Wifi className="w-3 h-3" />
                            <span>{bot.last_status?.ping_ms ?? 0}ms</span>
                          </span>
                        ) : (
                          <span className="text-rose-400">Hors ligne</span>
                        )}
                      </div>
                    </div>

                    {isServerOnline ? (
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                          <span className="flex items-center space-x-1">
                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                            <span className="font-medium text-slate-300">{bot.last_status?.map_name || 'Chernarus'}</span>
                          </span>
                          <span className="font-mono text-slate-200 flex items-center space-x-1">
                            <Users className="w-3.5 h-3.5 text-blue-400" />
                            <span>
                              {bot.last_status?.players_count ?? 0} / {bot.last_status?.max_players ?? 60} Joueurs
                            </span>
                          </span>
                        </div>
                        <div className="w-full bg-gaming-900 h-1.5 rounded-full overflow-hidden border border-gaming-800">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300"
                            style={{ width: `${playersPercent}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">
                        En attente de réponse au paquet UDP Valve A2S_INFO...
                      </p>
                    )}

                    {/* Rich Presence Preview Box */}
                    <div className="pt-2 border-t border-gaming-800/80 flex items-center space-x-2">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Présence:</span>
                      <span className="text-xs font-mono text-emerald-300 bg-gaming-900 px-2 py-0.5 rounded border border-emerald-500/20 truncate">
                        🎮 {presencePreview}
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center justify-end space-x-2 pt-2 lg:pt-0">
                    <button
                      onClick={() => onToggleStatus(bot)}
                      className={`p-2 rounded-lg border transition-all ${
                        bot.status === 'active'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                      title={bot.status === 'active' ? 'Mettre en pause' : 'Activer'}
                    >
                      {bot.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => onViewHistory(bot)}
                      className="p-2 rounded-lg bg-gaming-850 hover:bg-gaming-800 border border-gaming-800 text-slate-300 hover:text-white transition-all"
                      title="Historique des queries A2S"
                    >
                      <History className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onEditBot(bot)}
                      className="p-2 rounded-lg bg-gaming-850 hover:bg-gaming-800 border border-gaming-800 text-slate-300 hover:text-white transition-all"
                      title="Modifier la configuration"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onDeleteBot(bot.id)}
                      className="p-2 rounded-lg bg-gaming-850 hover:bg-rose-500/20 border border-gaming-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-all"
                      title="Supprimer ce bot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

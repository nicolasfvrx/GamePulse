import React, { useEffect, useState } from 'react';
import { X, History, AlertCircle } from 'lucide-react';
import type { BotSanitized, ServerStatusLog } from '@dayz-bot-network/shared';
import { apiClient } from '../api/client.js';

interface StatusHistoryModalProps {
  bot: BotSanitized | null;
  onClose: () => void;
}

export const StatusHistoryModal: React.FC<StatusHistoryModalProps> = ({ bot, onClose }) => {
  const [logs, setLogs] = useState<ServerStatusLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (bot) {
      setIsLoading(true);
      apiClient
        .getBotHistory(bot.id)
        .then((data) => setLogs(data))
        .finally(() => setIsLoading(false));
    }
  }, [bot]);

  if (!bot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-gaming-900 border border-gaming-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gaming-800 flex items-center justify-between bg-gaming-850">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Historique des Queries : {bot.name}
              </h2>
              <p className="text-xs text-slate-400">
                {bot.server_ip}:{bot.server_query_port} • Dernières mesures A2S_INFO
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-gaming-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Chargement des relevés historiques...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Aucun historique enregistré pour ce bot.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Visual mini bar preview */}
              <div className="p-4 rounded-xl bg-gaming-850 border border-gaming-800">
                <span className="text-xs font-semibold text-slate-300 block mb-2">
                  Activité récente des joueurs
                </span>
                <div className="flex items-end space-x-1.5 h-16 pt-2">
                  {logs.slice(0, 20).reverse().map((log, i) => {
                    const heightPercent = log.max_players > 0 ? (log.players_count / log.max_players) * 100 : 0;
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-gaming-800 rounded-t hover:bg-emerald-500 transition-colors relative group"
                        style={{ height: `${Math.max(10, heightPercent)}%` }}
                        title={`${log.players_count}/${log.max_players} joueurs à ${new Date(log.recorded_at).toLocaleTimeString()}`}
                      >
                        <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-gaming-950 text-[10px] text-white whitespace-nowrap z-10 border border-gaming-700">
                          {log.players_count} j. ({log.ping_ms}ms)
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Table of logs */}
              <div className="rounded-xl border border-gaming-800 overflow-hidden">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-gaming-850 text-slate-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5">Date / Heure</th>
                      <th className="px-4 py-2.5">Statut</th>
                      <th className="px-4 py-2.5">Carte</th>
                      <th className="px-4 py-2.5">Joueurs</th>
                      <th className="px-4 py-2.5">Ping</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gaming-800/60 bg-gaming-900/40">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gaming-850/40">
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">
                          {new Date(log.recorded_at).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-2.5">
                          {log.is_online ? (
                            <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              <span>En Ligne</span>
                            </span>
                          ) : (
                            <span className="text-rose-400 font-semibold flex items-center space-x-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Erreur</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">{log.map_name || 'Chernarus'}</td>
                        <td className="px-4 py-2.5 font-mono">
                          {log.players_count} / {log.max_players}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-400">
                          {log.ping_ms} ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

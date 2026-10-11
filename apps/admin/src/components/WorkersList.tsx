import React from 'react';
import { Cpu, HardDrive, Clock, Bot, Trash2, AlertTriangle, AlertCircle } from 'lucide-react';
import type { Worker } from '@gamepulse/shared';
import { formatUptime } from '@gamepulse/shared';

interface WorkersListProps {
  workers: Worker[];
  onDeleteWorker: (id: string) => void;
}

export const WorkersList: React.FC<WorkersListProps> = ({ workers, onDeleteWorker }) => {
  const getStatusBadge = (status: string, lastHeartbeat: string | null) => {
    const isRecentlyActive = lastHeartbeat && Date.now() - new Date(lastHeartbeat).getTime() < 60000;

    if (isRecentlyActive || status === 'online') {
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>En Ligne</span>
        </span>
      );
    }

    if (status === 'degraded') {
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="h-3 w-3" />
          <span>Dégradé</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
        <AlertCircle className="h-3 w-3" />
        <span>Hors Ligne</span>
      </span>
    );
  };

  const getCpuColor = (percent: number) => {
    if (percent < 50) return 'bg-emerald-500';
    if (percent < 80) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const formatLastHeartbeat = (iso: string | null) => {
    if (!iso) return 'Jamais';
    const diffSecs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (diffSecs < 60) return `il y a ${diffSecs}s`;
    if (diffSecs < 3600) return `il y a ${Math.floor(diffSecs / 60)}m`;
    return `il y a ${Math.floor(diffSecs / 3600)}h`;
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white tracking-wide">Workers Rust Actifs</h2>
          <span className="text-xs px-2 py-0.5 rounded bg-gaming-800 text-slate-400 border border-gaming-700">
            {workers.length}
          </span>
        </div>
      </div>

      {workers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gaming-800 p-8 text-center bg-gaming-900/50">
          <Cpu className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
          <p className="text-slate-300 font-medium">Aucun worker Rust enregistré</p>
          <p className="text-slate-500 text-xs mt-1">
            Lancez un démon worker Rust avec les variables d'environnement appropriées pour qu'il s'enregistre automatiquement.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((worker) => {
            const cpuPercent = Math.min(100, Math.max(0, worker.cpu_usage_percent));
            const ramPercent = worker.ram_total_mb > 0
              ? Math.min(100, (worker.ram_used_mb / worker.ram_total_mb) * 100)
              : 0;

            return (
              <div
                key={worker.id}
                className="rounded-xl bg-gaming-900 border border-gaming-800 hover:border-gaming-700 p-5 transition-all relative overflow-hidden group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
                        {worker.name}
                      </span>
                      <span className="text-xs text-slate-400 font-mono bg-gaming-850 px-1.5 py-0.5 rounded border border-gaming-800">
                        v{worker.version}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      Hôte: {worker.hostname}
                    </div>
                  </div>
                  <div>{getStatusBadge(worker.status, worker.last_heartbeat_at)}</div>
                </div>

                {/* Metrics */}
                <div className="space-y-3 mb-4 text-xs">
                  {/* CPU */}
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span className="flex items-center space-x-1">
                        <Cpu className="w-3.5 h-3.5" />
                        <span>CPU</span>
                      </span>
                      <span className="font-mono text-slate-200">{cpuPercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gaming-850 h-1.5 rounded-full overflow-hidden border border-gaming-800">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${getCpuColor(cpuPercent)}`}
                        style={{ width: `${cpuPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* RAM */}
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span className="flex items-center space-x-1">
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Mémoire RAM</span>
                      </span>
                      <span className="font-mono text-slate-200">
                        {Math.round(worker.ram_used_mb)} / {Math.round(worker.ram_total_mb)} Mo
                      </span>
                    </div>
                    <div className="w-full bg-gaming-850 h-1.5 rounded-full overflow-hidden border border-gaming-800">
                      <div
                        className="h-full bg-blue-500 transition-all duration-500 rounded-full"
                        style={{ width: `${ramPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="pt-3 border-t border-gaming-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center space-x-1" title="Bots gérés par ce worker">
                      <Bot className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-semibold text-slate-300">{worker.active_bots_count}</span>
                    </span>
                    <span className="flex items-center space-x-1" title="Uptime du démon">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <span>{formatUptime(worker.uptime_seconds)}</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-slate-400">
                      {formatLastHeartbeat(worker.last_heartbeat_at)}
                    </span>
                    <button
                      onClick={() => onDeleteWorker(worker.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Supprimer le worker"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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

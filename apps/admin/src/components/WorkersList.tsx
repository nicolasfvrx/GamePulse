import React, { useState } from 'react';
import {
  Cpu,
  HardDrive,
  Clock,
  Bot,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Plus,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Ban,
} from 'lucide-react';
import type { Worker } from '@gamepulse/shared';
import { formatUptime } from '@gamepulse/shared';

interface WorkersListProps {
  workers: Worker[];
  onDeleteWorker: (id: string) => void;
  onOpenCreateWorker: () => void;
  onRegenerateKey: (id: string) => void;
  onRevokeKey: (id: string) => void;
}

export const WorkersList: React.FC<WorkersListProps> = ({
  workers,
  onDeleteWorker,
  onOpenCreateWorker,
  onRegenerateKey,
  onRevokeKey,
}) => {
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleRevealKey = (id: string) => {
    setRevealedKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyKey = (id: string, key?: string) => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getStatusBadge = (status: string, lastHeartbeat: string | null, apiKey?: string) => {
    if (apiKey === 'revoked') {
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <Ban className="h-3 w-3" />
          <span>Clé Révoquée</span>
        </span>
      );
    }

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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white tracking-wide">Workers Rust Actifs</h2>
          <span className="text-xs px-2 py-0.5 rounded bg-gaming-800 text-slate-400 border border-gaming-700">
            {workers.length}
          </span>
        </div>

        <button
          onClick={onOpenCreateWorker}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gaming-850 hover:bg-gaming-800 border border-gaming-700 text-slate-200 hover:text-emerald-400 text-xs font-medium transition-all"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span>Nouveau Worker</span>
        </button>
      </div>

      {workers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gaming-800 p-8 text-center bg-gaming-900/50">
          <Cpu className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
          <p className="text-slate-300 font-medium">Aucun worker Rust enregistré</p>
          <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto">
            Cliquez sur &laquo; Nouveau Worker &raquo; ci-dessus pour générer une clé d'accès sécurisée et lancer un démon sur votre machine ou VPS.
          </p>
          <button
            onClick={onOpenCreateWorker}
            className="mt-4 inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold shadow-glow-green transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un Worker</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((worker) => {
            const cpuPercent = Math.min(100, Math.max(0, worker.cpu_usage_percent));
            const ramPercent =
              worker.ram_total_mb > 0
                ? Math.min(100, (worker.ram_used_mb / worker.ram_total_mb) * 100)
                : 0;

            const isRevoked = worker.api_key === 'revoked';
            const isRevealed = Boolean(revealedKeys[worker.id]);
            const isCopied = copiedId === worker.id;

            return (
              <div
                key={worker.id}
                className={`rounded-xl bg-gaming-900 border p-5 transition-all relative overflow-hidden group ${
                  isRevoked ? 'border-rose-900/50 opacity-80' : 'border-gaming-800 hover:border-gaming-700'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
                        {worker.name}
                      </span>
                      <span className="text-xs text-slate-400 font-mono bg-gaming-850 px-1.5 py-0.5 rounded border border-gaming-800">
                        v{worker.version}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center space-x-1">
                      <span>ID:</span>
                      <code className="text-slate-300 font-semibold">{worker.id}</code>
                      <span className="text-slate-600">•</span>
                      <span>Hôte: {worker.hostname}</span>
                    </div>
                  </div>
                  <div>{getStatusBadge(worker.status, worker.last_heartbeat_at, worker.api_key)}</div>
                </div>

                {/* Worker Secret Key Section */}
                <div className="mb-4 p-2.5 rounded-lg bg-gaming-950/80 border border-gaming-800/80 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span className="flex items-center space-x-1.5 font-medium">
                      <Key className="w-3 h-3 text-amber-400" />
                      <span>Clé API Secrète :</span>
                    </span>
                    {worker.api_key && !isRevoked && (
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => toggleRevealKey(worker.id)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-gaming-850 transition-colors"
                          title={isRevealed ? 'Masquer' : 'Afficher'}
                        >
                          {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyKey(worker.id, worker.api_key)}
                          className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-gaming-850 transition-colors"
                          title="Copier la clé"
                        >
                          {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="font-mono text-[11px] truncate">
                    {isRevoked ? (
                      <span className="text-rose-400 font-semibold">Révoquée (Accès bloqué)</span>
                    ) : worker.api_key ? (
                      <span className="text-emerald-300 font-semibold select-all">
                        {isRevealed
                          ? worker.api_key
                          : worker.api_key_preview || worker.api_key.substring(0, 8) + '••••••••'}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Clé globale héritée</span>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="space-y-3 mb-4 text-xs">
                  {/* CPU */}
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span className="flex items-center space-x-1">
                        <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Charge CPU</span>
                      </span>
                      <span className="font-mono text-slate-200">
                        {cpuPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gaming-850 h-1.5 rounded-full overflow-hidden border border-gaming-800">
                      <div
                        className={`h-full ${getCpuColor(cpuPercent)} transition-all duration-500 rounded-full`}
                        style={{ width: `${cpuPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* RAM */}
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span className="flex items-center space-x-1">
                        <HardDrive className="w-3.5 h-3.5 text-blue-400" />
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

                {/* Footer Info & Actions */}
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

                  {/* Actions */}
                  <div className="flex items-center space-x-1">
                    <span className="text-[11px] text-slate-500 mr-1.5">
                      {formatLastHeartbeat(worker.last_heartbeat_at)}
                    </span>

                    <button
                      onClick={() => onRegenerateKey(worker.id)}
                      className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                      title="Régénérer une nouvelle clé pour ce worker"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    {!isRevoked && (
                      <button
                        onClick={() => onRevokeKey(worker.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Révoquer la clé de ce worker (bloque les requêtes)"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => onDeleteWorker(worker.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Supprimer définitivement le worker"
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

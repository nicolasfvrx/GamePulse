import React, { useState } from 'react';
import { X, Cpu, Key, Copy, Check, Terminal, ShieldCheck } from 'lucide-react';
import type { CreateWorkerInput, CreateWorkerResponse } from '@gamepulse/shared';

interface WorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateWorkerInput) => Promise<CreateWorkerResponse | null>;
}

export const WorkerModal: React.FC<WorkerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [createdData, setCreatedData] = useState<CreateWorkerResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleResetAndClose = () => {
    setId('');
    setName('');
    setHostname('');
    setCreatedData(null);
    setCopied(false);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !name.trim()) {
      setError('L\'identifiant ID et le nom du worker sont requis.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await onSubmit({
        id: id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        name: name.trim(),
        hostname: hostname.trim() || 'worker-host',
      });

      if (res) {
        setCreatedData(res);
      } else {
        setError('Impossible d\'enregistrer le worker.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Erreur: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyKey = () => {
    if (createdData?.api_key) {
      navigator.clipboard.writeText(createdData.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-gaming-900 border border-gaming-800 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gaming-800 mb-5">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-gaming-850 border border-gaming-800 text-emerald-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                {createdData ? 'Worker & Clé Créés' : 'Ajouter un Worker Démon'}
              </h2>
              <p className="text-xs text-slate-400">
                {createdData
                  ? 'Copiez la clé secrète générée pour configurer le démon'
                  : 'Générez une clé d\'accès individuelle sécurisée'}
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-gaming-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Mode Success / Clé générée */}
        {createdData ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-3">
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
              <div className="text-xs text-emerald-300">
                Worker <strong className="text-white">{createdData.worker.name}</strong> créé avec succès !
                Sa clé secrète individuelle a été générée ci-dessous.
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Clé secrète Worker (à conserver) :
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={createdData.api_key}
                  className="flex-1 bg-gaming-950 border border-gaming-700/80 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1.5">
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                <span>Configuration du démon (.env ou docker-compose) :</span>
              </div>
              <pre className="p-3 rounded-lg bg-gaming-950 border border-gaming-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
{`WORKER_ID=${createdData.worker.id}
WORKER_NAME="${createdData.worker.name}"
WORKER_SECRET_KEY=${createdData.api_key}
ADMIN_API_URL=https://gamepulse-admin.pages.dev`}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-4 py-2 rounded-lg bg-gaming-800 hover:bg-gaming-700 text-white text-xs font-medium transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          /* Formulaire de création */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Identifiant unique (ID) <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                required
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="ex: worker-eu-paris-01"
                className="w-full bg-gaming-950 border border-gaming-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono transition-colors"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Doit correspondre à la variable <code className="text-slate-400">WORKER_ID</code> sur le serveur hôte.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nom d'affichage <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: Serveur Paris OVH"
                className="w-full bg-gaming-950 border border-gaming-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nom d'hôte / Localisation (optionnel)
              </label>
              <input
                type="text"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="ex: vps-gra-01.ovh.net"
                className="w-full bg-gaming-950 border border-gaming-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="p-3 rounded-lg bg-gaming-950/80 border border-gaming-800/80 text-[11px] text-slate-400 flex items-start space-x-2">
              <Key className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Une clé secrète dédiée (<code className="text-emerald-300">gp_wrk_...</code>) sera générée et assignée automatiquement à ce worker.
              </span>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-4 py-2 rounded-lg bg-gaming-850 hover:bg-gaming-800 border border-gaming-800 text-slate-300 text-xs font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold shadow-glow-green transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Génération...' : 'Créer le Worker & Générer la Clé'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

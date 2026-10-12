import React, { useState, useEffect } from 'react';
import { X, Cloud, CheckCircle, ExternalLink, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import type { CFToolsSettings, UpdateCFToolsSettingsInput } from '@gamepulse/shared';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGetSettings: () => Promise<CFToolsSettings>;
  onSaveSettings: (input: UpdateCFToolsSettingsInput) => Promise<{ updated: boolean }>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onGetSettings,
  onSaveSettings,
}) => {
  const [applicationId, setApplicationId] = useState('');
  const [secret, setSecret] = useState('');
  const [secretPreview, setSecretPreview] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSuccessMsg(null);
      setErrorMsg(null);
      setSecret('');
      setShowSecret(false);
      setIsLoading(true);

      onGetSettings()
        .then((data) => {
          setApplicationId(data.application_id || '');
          setSecretPreview(data.secret_preview || '');
          setIsConfigured(Boolean(data.is_configured));
        })
        .catch((err) => {
          setErrorMsg(err instanceof Error ? err.message : 'Erreur de chargement des paramètres');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, onGetSettings]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!applicationId.trim()) {
      setErrorMsg("L'Application ID CFTools est obligatoire.");
      return;
    }

    try {
      setIsSaving(true);
      await onSaveSettings({
        application_id: applicationId.trim(),
        secret: secret.trim() ? secret.trim() : undefined,
      });

      setSuccessMsg('Paramètres CFTools Cloud enregistrés avec succès !');
      setIsConfigured(true);
      setSecret('');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Une erreur est survenue lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-gaming-900 border border-gaming-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gaming-800 flex items-center justify-between bg-gaming-850">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Intégration CFTools Cloud</span>
                {isConfigured && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Configuré</span>
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">API DayZ avancée, file d'attente (queue) et télémétrie</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-gaming-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Guide Banner */}
          <div className="p-3.5 rounded-xl bg-gaming-850/80 border border-gaming-800 text-xs text-slate-300 space-y-2">
            <div className="flex items-center justify-between font-semibold text-slate-200">
              <span>Créer une application CFTools :</span>
              <a
                href="https://developer.cftools.cloud"
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:text-sky-300 inline-flex items-center space-x-1 underline text-[11px]"
              >
                <span>developer.cftools.cloud</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              En configurant votre Application ID et Secret ici une seule fois, vos workers recevront automatiquement
              l'autorisation pour interroger les serveurs via CFTools Cloud et afficher le nombre de joueurs en file d'attente (<code className="text-emerald-400">{'{queue}'}</code>).
            </p>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Chargement des paramètres...
            </div>
          ) : (
            <>
              {/* Application ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  CFTools Application ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: 64f1a2b3c4d5e6f7a8b9c0d1"
                  value={applicationId}
                  onChange={(e) => setApplicationId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gaming-850 border border-gaming-800 focus:border-sky-500 focus:outline-none text-white font-mono text-xs"
                />
              </div>

              {/* Secret */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>CFTools Secret</span>
                  {secretPreview && (
                    <span className="text-[11px] font-mono text-slate-500">
                      Actuel: {secretPreview}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder={isConfigured ? 'Laisser vide pour conserver le secret actuel' : 'Collez votre Application Secret...'}
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 rounded-lg bg-gaming-850 border border-gaming-800 focus:border-sky-500 focus:outline-none text-white font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {isConfigured && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Un secret est déjà configuré dans la base D1. Remplissez ce champ uniquement pour le renouveler.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Footer buttons */}
          <div className="pt-4 border-t border-gaming-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gaming-850 hover:bg-gaming-800 border border-gaming-800 text-slate-300 text-xs font-semibold transition-all"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={isSaving || isLoading}
              className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-all shadow-glow-blue disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

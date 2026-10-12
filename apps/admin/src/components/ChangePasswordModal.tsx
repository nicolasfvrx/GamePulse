import React, { useState } from 'react';
import { X, Key, Check } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangePassword: (currentPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onChangePassword,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 3) {
      setError('Le nouveau mot de passe doit comporter au moins 3 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les deux nouveaux mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await onChangePassword(currentPassword, newPassword);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => handleClose(), 2000);
      } else {
        setError(res.error || 'Erreur lors de la mise à jour du mot de passe.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Erreur: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-gaming-900 border border-gaming-800 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gaming-800 mb-5">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-gaming-850 border border-gaming-800 text-amber-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Changer le Mot de Passe
              </h2>
              <p className="text-xs text-slate-400">
                Mis à jour instantanément dans votre base Cloudflare D1
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-gaming-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {success ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-white">Mot de passe modifié avec succès !</p>
            <p className="text-xs text-slate-400">Fermeture automatique...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Mot de passe actuel <span className="text-slate-500">(par défaut: admin)</span>
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Mot de passe actuel..."
                className="w-full bg-gaming-950 border border-gaming-800 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nouveau mot de passe..."
                className="w-full bg-gaming-950 border border-gaming-800 focus:border-emerald-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Confirmer le nouveau mot de passe
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez le mot de passe..."
                className="w-full bg-gaming-950 border border-gaming-800 focus:border-emerald-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition-colors"
              />
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-gaming-850 hover:bg-gaming-800 border border-gaming-800 text-slate-300 text-xs font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold shadow-glow-green transition-all disabled:opacity-50"
              >
                {isLoading ? 'Enregistrement...' : 'Enregistrer le Mot de Passe'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

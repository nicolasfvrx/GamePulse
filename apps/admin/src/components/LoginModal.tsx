import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, KeyRound, Radio } from 'lucide-react';

interface LoginModalProps {
  onLogin: (token: string) => Promise<boolean>;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const success = await onLogin(password.trim());
      if (!success) {
        setError('Clé secrète ou mot de passe incorrect.');
      }
    } catch (_err) {
      setError('Impossible de joindre le serveur d\'authentification.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-gaming-900 border border-gaming-800 rounded-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden">
        {/* Glow background */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Logo and Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border border-emerald-500/40 flex items-center justify-center shadow-glow-green mb-3">
            <Radio className="w-7 h-7 text-emerald-400 animate-pulse" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Game<span className="text-emerald-400">Pulse</span> Console
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Interface d'administration sécurisée • Accès restreint
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Mot de passe Administrateur
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                placeholder="Entrez votre clé secrète..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 rounded-lg bg-gaming-850 border border-gaming-800 focus:border-emerald-500 focus:outline-none text-white text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-glow-green flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4" />
            <span>{isLoading ? 'Vérification...' : 'Déverrouiller le Cluster'}</span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-gaming-800 text-center">
          <p className="text-[11px] text-slate-500 flex items-center justify-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Chiffrement et contrôle d'accès activés</span>
          </p>
        </div>
      </div>
    </div>
  );
};

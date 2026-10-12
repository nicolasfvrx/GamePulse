import React, { useState, useEffect } from 'react';
import { X, Map, Plus, Trash2, Check, Search, AlertCircle, Sparkles } from 'lucide-react';
import { apiClient } from '../api/client.js';
import type { MapDictionaryEntry } from '@gamepulse/shared';

interface MapsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMapsUpdated?: () => void;
}

export const MapsModal: React.FC<MapsModalProps> = ({ isOpen, onClose, onMapsUpdated }) => {
  const [maps, setMaps] = useState<MapDictionaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New map form
  const [newRaw, setNewRaw] = useState('');
  const [newDisplay, setNewDisplay] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // In-place edits
  const [editedNames, setEditedNames] = useState<Record<string, string>>({});
  const [savingRaw, setSavingRaw] = useState<string | null>(null);

  const loadMaps = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getMaps();
      setMaps(data);
      // Initialize edit map
      const initialEdits: Record<string, string> = {};
      for (const m of data) {
        initialEdits[m.raw_name] = m.display_name;
      }
      setEditedNames(initialEdits);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Erreur lors du chargement des maps: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMaps();
      setNewRaw('');
      setNewDisplay('');
      setSearch('');
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRaw.trim() || !newDisplay.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await apiClient.saveMap({
        raw_name: newRaw.trim().toLowerCase(),
        display_name: newDisplay.trim(),
      });
      setSuccessMsg(`La map "${newDisplay.trim()}" a été enregistrée avec succès.`);
      setNewRaw('');
      setNewDisplay('');
      await loadMaps();
      onMapsUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Erreur lors de l'ajout: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (rawName: string) => {
    const updatedDisplay = (editedNames[rawName] || '').trim();
    if (!updatedDisplay) return;

    setSavingRaw(rawName);
    setError(null);
    try {
      await apiClient.saveMap({
        raw_name: rawName,
        display_name: updatedDisplay,
      });
      setSuccessMsg(`Nom d'affichage mis à jour pour "${rawName}".`);
      await loadMaps();
      onMapsUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Erreur lors de la mise à jour: ${msg}`);
    } finally {
      setSavingRaw(null);
    }
  };

  const handleDelete = async (rawName: string) => {
    if (!window.confirm(`Supprimer la traduction pour "${rawName}" ?`)) return;

    setError(null);
    try {
      await apiClient.deleteMap(rawName);
      setSuccessMsg(`Map "${rawName}" supprimée.`);
      await loadMaps();
      onMapsUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Erreur lors de la suppression: ${msg}`);
    }
  };

  const filteredMaps = maps.filter(
    (m) =>
      m.raw_name.toLowerCase().includes(search.toLowerCase()) ||
      m.display_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-gaming-900 border border-gaming-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gaming-800 bg-gaming-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/30 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-glow-green">
              <Map className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Dictionnaire des Maps DayZ
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {maps.length} maps
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Traduisez les noms techniques de maps en affichages propres pour Discord & le Dashboard
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg bg-gaming-850 hover:bg-gaming-800 border border-gaming-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info banner */}
        <div className="px-6 py-3 bg-gaming-850/60 border-b border-gaming-800 text-xs text-slate-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Auto-découverte :</strong> Toute nouvelle map détectée sur un serveur s'ajoute automatiquement ici. Vous n'avez plus qu'à ajuster son nom !
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form to add a map manually */}
          <form onSubmit={handleAddMap} className="p-4 rounded-xl bg-gaming-850 border border-gaming-800 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              Ajouter ou traduire une map
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Nom technique brut (ex: takistanplus)"
                  value={newRaw}
                  onChange={(e) => setNewRaw(e.target.value)}
                  className="w-full px-3 py-2 bg-gaming-900 border border-gaming-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Nom propre pour Discord (ex: Takistan+)"
                  value={newDisplay}
                  onChange={(e) => setNewDisplay(e.target.value)}
                  className="w-full px-3 py-2 bg-gaming-900 border border-gaming-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div className="sm:col-span-1">
                <button
                  type="submit"
                  disabled={isSubmitting || !newRaw.trim() || !newDisplay.trim()}
                  className="w-full h-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-glow-green disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </div>
            </div>
          </form>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher une map (brute ou traduite)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gaming-850 border border-gaming-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Maps Table */}
          <div className="border border-gaming-800 rounded-xl overflow-hidden bg-gaming-850/40">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Chargement du dictionnaire...
              </div>
            ) : filteredMaps.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Aucune map trouvée{search ? ' pour cette recherche' : ''}.
              </div>
            ) : (
              <div className="divide-y divide-gaming-800/80 max-h-80 overflow-y-auto">
                <div className="grid grid-cols-12 px-4 py-2.5 bg-gaming-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="col-span-5">Nom Brut / Détecté</div>
                  <div className="col-span-5">Nom d'Affichage Discord</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {filteredMaps.map((item) => {
                  const currentEdit = editedNames[item.raw_name] ?? item.display_name;
                  const isModified = currentEdit.trim() !== item.display_name;
                  const isSavingThis = savingRaw === item.raw_name;

                  return (
                    <div
                      key={item.raw_name}
                      className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-gaming-800/30 transition-colors gap-2"
                    >
                      <div className="col-span-5 font-mono text-xs text-emerald-400 flex items-center gap-1.5 truncate">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 truncate">
                          {item.raw_name}
                        </span>
                      </div>
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={currentEdit}
                          onChange={(e) =>
                            setEditedNames({
                              ...editedNames,
                              [item.raw_name]: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit(item.raw_name);
                            }
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg bg-gaming-900 border text-xs text-white focus:outline-none transition-colors ${
                            isModified
                              ? 'border-amber-500/80 bg-amber-500/5 focus:border-amber-400'
                              : 'border-gaming-700/60 focus:border-emerald-500'
                          }`}
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-end space-x-1.5">
                        {isModified ? (
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item.raw_name)}
                            disabled={isSavingThis}
                            className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-colors"
                            title="Sauvegarder la modification"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleDelete(item.raw_name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Supprimer la map"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gaming-800 bg-gaming-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>
            {maps.length} map{maps.length > 1 ? 's' : ''} au total dans le dictionnaire
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gaming-850 hover:bg-gaming-800 text-white font-medium transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

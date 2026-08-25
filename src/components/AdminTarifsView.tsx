import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ShieldCheck, 
  RotateCcw,
  Crown,
  Star,
  Ship,
  Anchor,
  HelpCircle
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TravelClass } from '../types';
import { DEFAULT_PRICES, getClassPrices } from '../App';

interface AdminTarifsViewProps {
  siteSettings?: any;
}

interface ClassConfig {
  key: TravelClass;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  icon: React.ElementType;
  colorClass: {
    bgLight: string;
    border: string;
    text: string;
    badgeBg: string;
    badgeText: string;
    accentBg: string;
    ring: string;
  };
  features: string[];
}

const CLASS_CONFIGS: ClassConfig[] = [
  {
    key: 'VIP',
    title: 'Classe VIP',
    subtitle: 'Prestige & Confort Absolu',
    description: 'Salon climatisé privatisé, embarquement prioritaire et service exclusif.',
    badge: 'Prestige VIP',
    icon: Crown,
    colorClass: {
      bgLight: 'bg-amber-50/60',
      border: 'border-amber-200',
      text: 'text-amber-900',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-800 border-amber-300',
      accentBg: 'bg-gradient-to-r from-amber-500 to-amber-600',
      ring: 'focus-within:border-amber-500 focus-within:ring-amber-500/20'
    },
    features: ['Salon Climatisé VIP', 'Embarquement prioritaire', 'Boisson offerte']
  },
  {
    key: '1ère Classe',
    title: '1ère Classe',
    subtitle: 'Standard Supérieur',
    description: 'Fauteuils spacieux de première qualité, espace calme et voyage rapide.',
    badge: 'Première',
    icon: Star,
    colorClass: {
      bgLight: 'bg-yellow-50/60',
      border: 'border-yellow-200',
      text: 'text-yellow-900',
      badgeBg: 'bg-yellow-100',
      badgeText: 'text-yellow-800 border-yellow-300',
      accentBg: 'bg-gradient-to-r from-yellow-500 to-yellow-600',
      ring: 'focus-within:border-yellow-500 focus-within:ring-yellow-500/20'
    },
    features: ['Sièges première classe', 'Vue panoramique', 'Service de bord soigné']
  },
  {
    key: '2ème Classe',
    title: '2ème Classe',
    subtitle: 'Standard Populaire',
    description: 'Excellente option équilibrée, espace aéré, très plébiscitée par les voyageurs.',
    badge: 'Standard',
    icon: Ship,
    colorClass: {
      bgLight: 'bg-blue-50/60',
      border: 'border-blue-200',
      text: 'text-blue-900',
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-800 border-blue-300',
      accentBg: 'bg-gradient-to-r from-blue-600 to-[#0047AB]',
      ring: 'focus-within:border-blue-600 focus-within:ring-blue-600/20'
    },
    features: ['Sièges confortables', 'Espace ventilé & ouvert', 'Recommandé standard']
  },
  {
    key: '3ème Classe',
    title: '3ème Classe',
    subtitle: 'Classe Économique',
    description: 'Tarif le plus abordable et accessible à tous pour les liaisons quotidiennes.',
    badge: 'Économique',
    icon: Anchor,
    colorClass: {
      bgLight: 'bg-emerald-50/60',
      border: 'border-emerald-200',
      text: 'text-emerald-900',
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-800 border-emerald-300',
      accentBg: 'bg-gradient-to-r from-emerald-600 to-teal-700',
      ring: 'focus-within:border-emerald-600 focus-within:ring-emerald-600/20'
    },
    features: ['Tarif économique', 'Accès direct au pont', 'Bagages standards inclus']
  }
];

export const AdminTarifsView: React.FC<AdminTarifsViewProps> = ({ siteSettings }) => {
  const currentPrices = getClassPrices(siteSettings);

  const [pricesForm, setPricesForm] = useState<Record<TravelClass, number>>({
    'VIP': currentPrices['VIP'],
    '1ère Classe': currentPrices['1ère Classe'],
    '2ème Classe': currentPrices['2ème Classe'],
    '3ème Classe': currentPrices['3ème Classe'],
  });

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state when Firestore settings update
  useEffect(() => {
    const updated = getClassPrices(siteSettings);
    setPricesForm({
      'VIP': updated['VIP'],
      '1ère Classe': updated['1ère Classe'],
      '2ème Classe': updated['2ème Classe'],
      '3ème Classe': updated['3ème Classe'],
    });
  }, [siteSettings?.classPrices]);

  const handlePriceChange = (cls: TravelClass, val: string) => {
    const num = parseFloat(val);
    setPricesForm(prev => ({
      ...prev,
      [cls]: isNaN(num) ? 0 : Math.max(0, num)
    }));
  };

  const handleAdjustPrice = (cls: TravelClass, delta: number) => {
    setPricesForm(prev => ({
      ...prev,
      [cls]: Math.max(1, (prev[cls] || 0) + delta)
    }));
  };

  const handleResetToDefaults = () => {
    if (window.confirm("Voulez-vous rétablir les tarifs par défaut (VIP: 27$, 1ère: 27$, 2ème: 17$, 3ème: 10$) ?")) {
      setPricesForm({ ...DEFAULT_PRICES });
    }
  };

  const handleSavePrices = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation
    for (const cfg of CLASS_CONFIGS) {
      const p = pricesForm[cfg.key];
      if (typeof p !== 'number' || isNaN(p) || p <= 0) {
        setErrorMessage(`Veuillez renseigner un prix strictement supérieur à 0 USD pour la classe ${cfg.title}.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'site'), {
        classPrices: {
          'VIP': Number(pricesForm['VIP']),
          '1ère Classe': Number(pricesForm['1ère Classe']),
          '2ème Classe': Number(pricesForm['2ème Classe']),
          '3ème Classe': Number(pricesForm['3ème Classe']),
        }
      }, { merge: true });

      setSuccessMessage("✅ Tarifs officiels enregistrés avec succès ! Toute la plateforme (Accueil, Réservations, Billetterie, Horaires) a été mise à jour en temps réel.");
      setTimeout(() => {
        setSuccessMessage(null);
      }, 7000);
    } catch (err: any) {
      console.error("Erreur enregistrement tarifs:", err);
      setErrorMessage("Une erreur est survenue lors de l'enregistrement des tarifs. Veuillez réessayer.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = CLASS_CONFIGS.some(
    c => pricesForm[c.key] !== currentPrices[c.key]
  );

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-5xl mx-auto text-left" id="admin-tarifs-container">
      {/* Header section */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-[#001233] text-white p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gold/20 text-gold rounded-full text-[10px] font-black uppercase tracking-widest border border-gold/30">
              <DollarSign size={12} />
              <span>Gestion Tarifaire Unique & Officielle</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic text-white">
              Configuration des Prix par Classe
            </h3>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Saisissez et mettez à jour le prix officiel en dollars (USD) pour chaque classe de voyage. Chaque classe dispose d'un tarif unique appliqué uniformément sur toute la plateforme.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="text-left">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-300">Synchronisation</p>
              <p className="text-xs font-extrabold text-white">En direct sur le site</p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-500/30 rounded-2xl flex items-start gap-3 text-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-wide">Succès</p>
            <p className="text-xs font-semibold mt-0.5">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border-2 border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-900 shadow-sm animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-wide">Attention</p>
            <p className="text-xs font-semibold mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* 4 Classes Pricing Form Cards */}
      <form onSubmit={handleSavePrices} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CLASS_CONFIGS.map((cfg) => {
            const Icon = cfg.icon;
            const currentVal = pricesForm[cfg.key];
            const liveSavedVal = currentPrices[cfg.key];
            const isModified = currentVal !== liveSavedVal;

            return (
              <div 
                key={cfg.key}
                className={`bg-white rounded-3xl border-2 ${cfg.colorClass.border} p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden`}
              >
                {/* Header card */}
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl ${cfg.colorClass.bgLight} border ${cfg.colorClass.border} flex items-center justify-center ${cfg.colorClass.text}`}>
                        <Icon size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                            {cfg.title}
                          </h4>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${cfg.colorClass.badgeBg} ${cfg.colorClass.badgeText}`}>
                            {cfg.badge}
                          </span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          {cfg.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Active live badge */}
                    <div className="text-right">
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">
                        Prix Actuel
                      </span>
                      <span className="text-base font-black font-mono text-slate-800">
                        {liveSavedVal}$
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed mb-5">
                    {cfg.description}
                  </p>
                </div>

                {/* Price Input & Quick Adjusters */}
                <div className={`p-4 rounded-2xl ${cfg.colorClass.bgLight} border ${cfg.colorClass.border} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                      Nouveau Prix (USD) :
                    </label>
                    {isModified && (
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md animate-pulse">
                        Modifié (non enregistré)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`flex-1 flex items-center bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 shadow-inner transition-all ${cfg.colorClass.ring}`}>
                      <DollarSign size={18} className="text-slate-400 mr-2 shrink-0" />
                      <input 
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={currentVal || ''}
                        onChange={(e) => handlePriceChange(cfg.key, e.target.value)}
                        className="w-full bg-transparent text-xl font-black font-mono text-slate-900 focus:outline-none"
                        placeholder="Ex: 27"
                        id={`price-input-${cfg.key}`}
                      />
                      <span className="text-xs font-black uppercase text-slate-400 ml-2">USD</span>
                    </div>

                    {/* Quick increment / decrement buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleAdjustPrice(cfg.key, -5)}
                        className="px-2.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-black text-slate-600 shadow-sm active:scale-95 transition-all"
                        title="Diminuer de 5$"
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustPrice(cfg.key, -1)}
                        className="px-2.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-black text-slate-600 shadow-sm active:scale-95 transition-all"
                        title="Diminuer de 1$"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustPrice(cfg.key, 1)}
                        className="px-2.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-black text-slate-600 shadow-sm active:scale-95 transition-all"
                        title="Augmenter de 1$"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustPrice(cfg.key, 5)}
                        className="px-2.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-black text-slate-600 shadow-sm active:scale-95 transition-all"
                        title="Augmenter de 5$"
                      >
                        +5
                      </button>
                    </div>
                  </div>

                  {/* Feature Bullets */}
                  <div className="pt-2 flex flex-wrap gap-1.5">
                    {cfg.features.map((f, fIdx) => (
                      <span key={fIdx} className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-white/80 border border-slate-200/60 px-2 py-0.5 rounded-md">
                        • {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Global Summary and Save Controls */}
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h4 className="text-sm font-black uppercase text-slate-900 tracking-wider">
              Récapitulatif des Tarifs Saisis
            </h4>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
              {CLASS_CONFIGS.map(c => (
                <div key={c.key} className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-xl text-xs font-mono">
                  <span className="font-bold text-slate-600 uppercase text-[10px]">{c.title}:</span>
                  <span className="font-black text-slate-900">{pricesForm[c.key]}$</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw size={14} /> Réinitialiser
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 md:flex-initial px-8 py-3.5 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Enregistrer les Tarifs Officiels</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* FAQ & Information Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
          <ShieldCheck size={20} />
        </div>
        <div className="space-y-1 text-xs text-slate-600 leading-relaxed">
          <p className="font-black text-slate-900 uppercase tracking-wide">Garantie d'Unicité des Tarifs</p>
          <p>
            Chaque classe possède une valeur unique et exclusive sur la plateforme. Dès validation, ces tarifs sont automatiquement appliqués aux formulaires de réservation des clients, aux calculs automatiques des montants à payer, aux QR Codes de contrôle et aux reçus générés.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminTarifsView;

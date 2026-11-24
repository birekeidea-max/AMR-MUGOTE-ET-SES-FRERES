import React, { useState, useEffect, useRef } from 'react';
import { 
  Ship, 
  Ticket, 
  Camera, 
  Upload, 
  Trash2,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface HomeViewProps {
  onBook: () => void;
  onNavigate: (page: string) => void;
  siteSettings: any;
  schedules?: any[];
  user: FirebaseUser | null;
  onLoginRequest?: () => void;
  onLogout?: () => void;
  onOpenScanner?: () => void;
  isAdmin?: boolean;
}

export function HomeView({ 
  onBook, 
  siteSettings, 
  isAdmin = false
}: HomeViewProps) {
  // Photo de profil / bateau (en haut à gauche)
  const [boatImage, setBoatImage] = useState<string>(() => {
    return localStorage.getItem('mugote_boat_image') || siteSettings?.homeDetail || '';
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (siteSettings?.homeDetail && !localStorage.getItem('mugote_boat_image')) {
      setBoatImage(siteSettings.homeDetail);
    }
  }, [siteSettings?.homeDetail]);

  // Synchronisation dynamique si modifiée depuis un autre onglet
  useEffect(() => {
    const handleSync = () => {
      const stored = localStorage.getItem('mugote_boat_image');
      if (stored) setBoatImage(stored);
    };
    window.addEventListener('boat_image_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('boat_image_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setBoatImage(base64);
        try {
          localStorage.setItem('mugote_boat_image', base64);
          window.dispatchEvent(new Event('boat_image_updated'));
          await updateDoc(doc(db, 'settings', 'general'), {
            homeDetail: base64
          });
        } catch (err) {
          console.warn("Storage sync:", err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBoatImage('');
    localStorage.removeItem('mugote_boat_image');
    window.dispatchEvent(new Event('boat_image_updated'));
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 sm:py-12 text-left font-sans">
      {/* Input de fichier réservé strictement à l'administrateur */}
      {isAdmin && (
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />
      )}

      {/* Cadre épuré Hero */}
      <div className="relative overflow-hidden rounded-3xl sm:rounded-[36px] bg-[#001f35] text-white p-6 sm:p-10 lg:p-12 shadow-2xl border border-white/10">
        <div className="flex flex-col sm:flex-row items-start gap-7 sm:gap-10">
          
          {/* ZONE EN CERCLE EN HAUT À GAUCHE (Photo de profil / Bateau) */}
          <div className="shrink-0 flex flex-col items-center">
            <div
              onClick={() => {
                if (isAdmin) fileInputRef.current?.click();
              }}
              className={`relative w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-amber-400 bg-[#070d1e] shadow-2xl overflow-hidden flex items-center justify-center transition-all duration-300 ${
                isAdmin ? 'cursor-pointer group hover:scale-[1.03]' : 'cursor-default'
              }`}
              title={isAdmin ? "Cliquez pour modifier l'image du bateau" : "Navire AMR Mugote"}
            >
              {boatImage ? (
                <>
                  <img
                    src={boatImage}
                    alt="Bateau AMR Mugote"
                    className={`w-full h-full object-cover transition-opacity ${
                      isAdmin ? 'group-hover:opacity-75' : ''
                    }`}
                  />
                  {isAdmin && (
                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                      <Camera size={22} className="text-amber-400 mb-1" />
                      <span className="text-[10px] font-bold text-center px-2 leading-tight">Changer</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-3 space-y-1">
                  <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400">
                    <Ship size={22} />
                  </div>
                  {isAdmin ? (
                    <>
                      <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                        <Upload size={10} /> Photo
                      </span>
                      <span className="text-[9px] text-slate-300">du bateau</span>
                    </>
                  ) : (
                    <span className="text-[10px] font-black text-amber-400/95 tracking-wide uppercase">
                      AMR MUGOTE
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions de gestion sous le cercle (STRICTEMENT réservées à l'administrateur) */}
            {isAdmin && (
              <div className="mt-3.5 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-[11px] leading-none text-amber-300 hover:text-amber-200 font-semibold whitespace-nowrap transition-colors cursor-pointer"
                >
                  <Camera size={12} className="shrink-0" />
                  <span>{boatImage ? "Modifier photo" : "Ajouter photo"}</span>
                </button>
                {boatImage && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-400/30 text-[11px] leading-none text-rose-300 hover:text-rose-200 font-semibold whitespace-nowrap transition-colors cursor-pointer"
                    title="Supprimer la photo"
                  >
                    <Trash2 size={12} className="shrink-0" />
                    <span>Retirer</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* CONTENU PRINCIPAL DE L'ACCUEIL */}
          <div className="flex-1 space-y-4 sm:pt-0.5">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.15]">
              Voyagez en toute sécurité sur le Lac Kivu !
            </h1>

            <p className="text-sm sm:text-base text-slate-200/95 leading-relaxed max-w-2xl font-normal">
              La plateforme officielle des <strong className="font-semibold text-white">ETS AMR MUGOTE &amp; FRÈRES</strong> assure la liaison lacustre régulière entre <strong className="font-semibold text-white">Goma</strong> et <strong className="font-semibold text-white">Bukavu</strong> pour passagers et marchandises. Réservez votre place en ligne en quelques clics et embarquez en toute sérénité.
            </p>

            {/* PETIT BOUTON : RÉSERVER UN BILLET */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onBook}
                className="px-5 py-3 sm:px-6 sm:py-3.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black rounded-xl text-xs sm:text-sm uppercase tracking-wider inline-flex items-center justify-center gap-2.5 leading-none shadow-lg shadow-amber-500/15 transition cursor-pointer"
              >
                <Ticket size={16} className="shrink-0" />
                <span>Réserver un billet</span>
                <ArrowRight size={14} className="shrink-0" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

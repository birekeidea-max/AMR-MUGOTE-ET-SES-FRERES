import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  RotateCw, 
  Search, 
  ShieldAlert, 
  Ship, 
  Calendar, 
  Clock, 
  User, 
  Ticket,
  Lock,
  QrCode
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Reservation } from '../types';
import { cn } from '../lib/utils';

interface TravelerTicketScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteSettings?: any;
}

export function TravelerTicketScannerModal({ isOpen, onClose, siteSettings }: TravelerTicketScannerModalProps) {
  const [manualInput, setManualInput] = useState('');
  const [scannedTicket, setScannedTicket] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');

  useEffect(() => {
    if (!isOpen || activeTab !== 'camera') return;

    // Small delay to ensure DOM element '#traveler-qr-reader' is mounted
    const timer = setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          'traveler-qr-reader',
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [0]
          },
          false
        );

        const onScanSuccess = (decodedText: string) => {
          let id = decodedText.trim();
          if (decodedText.startsWith('{') && decodedText.endsWith('}')) {
            try {
              const parsed = JSON.parse(decodedText);
              if (parsed.id) id = parsed.id;
            } catch {
              // ignore
            }
          } else if (decodedText.includes('verify=')) {
            try {
              const match = decodedText.match(/[?&]verify=([a-zA-Z0-9_\-]+)/);
              if (match && match[1]) {
                id = match[1];
              } else {
                const url = new URL(decodedText);
                id = url.searchParams.get('verify') || decodedText;
              }
            } catch {
              const parts = decodedText.split('verify=');
              if (parts[1]) id = parts[1].split('&')[0];
            }
          }

          handleLookup(id);
        };

        const onScanFailure = () => {
          // ignore stream ticks
        };

        scanner.render(onScanSuccess, onScanFailure);

        return () => {
          scanner.clear().catch(e => console.warn('Traveler scanner cleanup:', e));
        };
      } catch (err) {
        console.warn('Init traveler scanner error:', err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen, activeTab]);

  const handleLookup = async (lookupKey: string) => {
    if (!lookupKey || !lookupKey.trim()) return;
    const cleanKey = lookupKey.trim();
    if (!cleanKey) return;
    if (!db) {
      setErrorMsg("Connexion à la base de données indisponible.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Check direct doc ID
      const docRef = doc(db, 'reservations', cleanKey);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setScannedTicket({ ...(docSnap.data() as Reservation), id: docSnap.id });
        setLoading(false);
        return;
      }

      // 2. Check ticketId or transactionId
      const q = query(
        collection(db, 'reservations'),
        where('ticketId', '==', cleanKey)
      );
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const d = querySnap.docs[0];
        setScannedTicket({ ...(d.data() as Reservation), id: d.id });
        setLoading(false);
        return;
      }

      // 3. Check lowercase / uppercase variations
      const qUpper = query(
        collection(db, 'reservations'),
        where('ticketId', '==', cleanKey.toUpperCase())
      );
      const snapUpper = await getDocs(qUpper);
      if (!snapUpper.empty) {
        const d = snapUpper.docs[0];
        setScannedTicket({ ...(d.data() as Reservation), id: d.id });
        setLoading(false);
        return;
      }

      setErrorMsg(`Aucun billet trouvé correspondant à l'identifiant "${cleanKey}". Vérifiez le code inscrit sur votre reçu.`);
      setScannedTicket(null);
    } catch (err: any) {
      console.error('Lookup ticket error:', err);
      setErrorMsg(`Erreur lors de la vérification : ${err.message}`);
      setScannedTicket(null);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleLookup(manualInput);
    }
  };

  if (!isOpen) return null;

  const isPaid = scannedTicket?.status === 'VALIDATED';
  const isBoarded = (scannedTicket as any)?.boardingStatus === 'BOARDED' || (scannedTicket as any)?.boarded === true;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-100 relative my-8">
        
        {/* Header */}
        <div className="bg-[#001233] text-white p-6 relative">
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            title="Fermer"
          >
            <X size={18} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gold/20 text-gold flex items-center justify-center shrink-0 border border-gold/30">
              <QrCode size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  Mode Voyageur • Consultation
                </span>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white mt-1">
                Vérifier le Statut d'un Billet
              </h3>
              <p className="text-[10px] text-slate-300 font-bold mt-0.5">
                Scannez votre billet pour savoir si vous pouvez déjà embarquer à bord
              </p>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-2 mt-5">
            <button
              onClick={() => { setActiveTab('camera'); setScannedTicket(null); setErrorMsg(null); }}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer",
                activeTab === 'camera'
                  ? "bg-gold text-maritime shadow-md"
                  : "bg-white/10 text-white/70 hover:bg-white/15"
              )}
            >
              <Camera size={14} />
              <span>Caméra QR Code</span>
            </button>
            <button
              onClick={() => { setActiveTab('manual'); setErrorMsg(null); }}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer",
                activeTab === 'manual'
                  ? "bg-gold text-maritime shadow-md"
                  : "bg-white/10 text-white/70 hover:bg-white/15"
              )}
            >
              <Search size={14} />
              <span>Saisie Numéro Billet</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Strict Security Rule Banner */}
          <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4 flex items-start gap-3 text-left">
            <ShieldAlert size={20} className="text-slate-800 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-black text-slate-950 uppercase tracking-tight">
                Règle Officielle d'Embarquement
              </p>
              <p className="text-[11px] font-medium text-slate-800 leading-relaxed">
                Ce scanner voyageur vous permet de <strong>consulter votre statut</strong>. <span className="underline font-bold">Seul l'agent administratif au quai</span> possède l'autorité pour scanner et valider l'embarquement physique à bord du navire. Aucun passager ne peut valider son propre embarquement.
              </p>
            </div>
          </div>

          {/* Camera Scanner View */}
          {activeTab === 'camera' && (
            <div className="space-y-3">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-inner flex flex-col items-center">
                <div id="traveler-qr-reader" className="w-full max-w-xs aspect-square bg-black rounded-xl overflow-hidden" />
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-3 text-center">
                  Présentez le QR Code de votre billet face à la caméra
                </p>
              </div>
            </div>
          )}

          {/* Manual Input View */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-3 text-left">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Code Billet ou Référence de Réservation
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: TIK-847291 ou ID réservation..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-maritime"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-3 bg-maritime text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-900 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? <RotateCw size={14} className="animate-spin" /> : <Search size={14} />}
                  <span>Vérifier</span>
                </button>
              </div>
            </form>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="py-8 text-center space-y-2">
              <RotateCw size={24} className="animate-spin text-maritime mx-auto" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Recherche des données de vol/voyage...
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-left">
              <AlertCircle size={20} className="text-rose-600 shrink-0" />
              <p className="text-xs font-bold text-rose-800 leading-tight">
                {errorMsg}
              </p>
            </div>
          )}

          {/* Scanned Ticket Result Card */}
          {scannedTicket && (
            <div className="bg-slate-50 rounded-3xl border-2 border-slate-200 p-5 sm:p-6 space-y-5 text-left animate-fade-in shadow-md">
              
              {/* STATUS BANNER: Can I board or not? */}
              <div className={cn(
                "p-4 rounded-2xl border-2 space-y-1.5",
                isBoarded
                  ? "bg-emerald-50 border-emerald-400 text-emerald-950"
                  : isPaid
                  ? "bg-sky-50 border-sky-400 text-sky-950"
                  : "bg-slate-100 border-slate-300 text-slate-900"
              )}>
                <div className="flex items-center gap-2">
                  {isBoarded ? (
                    <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                  ) : isPaid ? (
                    <CheckCircle2 size={20} className="text-sky-600 shrink-0" />
                  ) : (
                    <AlertCircle size={20} className="text-slate-700 shrink-0" />
                  )}
                  <h4 className="text-sm font-black uppercase tracking-tight">
                    {isBoarded
                      ? "✓ EMBARQUÉ À BORD DU NAVIRE"
                      : isPaid
                      ? "🟢 PRÊT POUR L'EMBARQUEMENT"
                      : "⏳ EN ATTENTE DE VALIDATION PAR L'ADMINISTRATEUR"}
                  </h4>
                </div>

                <p className="text-xs font-semibold leading-relaxed">
                  {isBoarded ? (
                    <>
                      Votre présence a déjà été validée et enregistrée à bord. Pointé le{' '}
                      <strong>
                        {(scannedTicket as any).boardedAt
                          ? new Date((scannedTicket as any).boardedAt).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'long',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Aujourd\'hui'}
                      </strong>. Bon voyage !
                    </>
                  ) : isPaid ? (
                    <>
                      Votre billet a été <strong>validé par l'administration</strong>. Vous pouvez vous présenter à la passerelle d'embarquement. <strong>Présentez ce QR Code à l'agent administratif au quai pour qu'il autorise votre montée à bord.</strong>
                    </>
                  ) : (
                    <>
                      Ce billet n'est <strong>pas encore validé par l'administrateur</strong>. Conformément aux consignes de sécurité, tant que le billet n'est pas validé chez l'admin, le client ne peut jamais avoir son billet ni monter à bord. Veuillez attendre la validation de la direction.
                    </>
                  )}
                </p>
              </div>

              {/* Ticket Details */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Passager</span>
                    <p className="text-base font-black text-slate-900 uppercase">
                      {scannedTicket.fullName} {scannedTicket.lastName}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">{scannedTicket.phone}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">N° Billet</span>
                    <p className="text-xs font-black font-mono text-gold uppercase">
                      #{scannedTicket.ticketId || scannedTicket.id?.substring(0, 8).toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[8px] font-bold uppercase text-slate-400 block">Itinéraire</span>
                    <span className="font-extrabold text-slate-800 uppercase">{scannedTicket.itinerary}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold uppercase text-slate-400 block">Navire</span>
                    <span className="font-extrabold text-slate-800 uppercase">{scannedTicket.ship}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold uppercase text-slate-400 block">Date & Heure</span>
                    <span className="font-extrabold text-slate-800">
                      {scannedTicket.travelDate} à {scannedTicket.departureTime || '07:30'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold uppercase text-slate-400 block">Classe & Places</span>
                    <span className="font-extrabold text-slate-800">
                      {scannedTicket.travelClass} • {scannedTicket.passengersCount} PAX
                    </span>
                  </div>
                </div>
              </div>

              {/* Strict Notice: Read-only for traveler */}
              <div className="p-3 bg-slate-100 rounded-xl flex items-center justify-between text-[10px] text-slate-500 font-bold">
                <span className="flex items-center gap-1.5">
                  <Lock size={12} className="text-slate-400" />
                  Mode consultation voyageur (Lecture seule)
                </span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400">
                  Validation réservée à l'administration
                </span>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            AMR MUGOTE &bull; Contrôle d'Embarquement Lacustre
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}

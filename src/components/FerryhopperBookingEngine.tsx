import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  Ticket, 
  Lock, 
  Calendar, 
  User, 
  Mail, 
  Phone, 
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { Reservation, TravelClass, ShipName } from '../types';
import { cn } from '../lib/utils';
import { mongoApi } from '../services/api';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface FerryhopperBookingEngineProps {
  user: any | null;
  siteSettings?: any;
  onLoginRequest: () => void;
  onTicketGenerated?: (reservation: Reservation) => void;
  onViewAllTickets?: () => void;
}

export function FerryhopperBookingEngine({
  user,
  siteSettings,
  onLoginRequest,
  onTicketGenerated,
  onViewAllTickets
}: FerryhopperBookingEngineProps) {
  // Champs stricts du formulaire
  const [fullName, setFullName] = useState(() => {
    return user?.displayName || localStorage.getItem('mugote_user_name') || '';
  });
  const [email, setEmail] = useState(() => {
    return user?.email || localStorage.getItem('mugote_user_email') || '';
  });
  const [phone, setPhone] = useState(() => {
    return user?.phone || localStorage.getItem('mugote_user_phone') || '';
  });
  const [travelClass, setTravelClass] = useState<TravelClass>('2ème Classe');
  const [isClassOpen, setIsClassOpen] = useState(false);
  const classDropdownRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [travelDate, setTravelDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Le bateau reste toujours pré-encodé sur "Bateau Mugote" (aucun sélecteur sur le formulaire)
  const ship: ShipName = 'Bateau Mugote';

  // État de soumission
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedReservation, setConfirmedReservation] = useState<Reservation | null>(null);

  // Tarifs officiels
  const classPricesUSD: Record<TravelClass, number> = {
    '1ère Classe': Number(siteSettings?.classPrices?.['1ère Classe'] ?? 11),
    '2ème Classe': Number(siteSettings?.classPrices?.['2ème Classe'] ?? 20),
    '3ème Classe': Number(siteSettings?.classPrices?.['3ème Classe'] ?? 27),
    'VIP': Number(siteSettings?.classPrices?.['VIP'] ?? 35)
  };

  useEffect(() => {
    if (user?.displayName && !fullName) setFullName(user.displayName);
    if (user?.email && !email) setEmail(user.email);
    if (user?.phone && !phone) setPhone(user.phone);
  }, [user]);

  // Fermer le dropdown de classe en cas de clic en dehors
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(e.target as Node)) {
        setIsClassOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Si le client n'est pas connecté, le login intervient au moment de réserver
    if (!user) {
      onLoginRequest();
      return;
    }

    if (!fullName.trim()) {
      setErrorMessage("veuillez renseigner votre nom complet.");
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage("veuillez renseigner une adresse mail valide.");
      return;
    }

    if (!phone.trim()) {
      setErrorMessage("veuillez renseigner votre numéro de téléphone.");
      return;
    }

    if (!travelDate) {
      setErrorMessage("veuillez sélectionner la date de votre voyage.");
      return;
    }

    setSubmitting(true);
    try {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const uniqueTicketId = `MUG-${new Date().getFullYear().toString().slice(-2)}${randomSuffix}`;
      const tempTxnId = `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const price = classPricesUSD[travelClass] || 20;

      const reservationData: Reservation = {
        userId: user.uid,
        fullName: fullName.trim(),
        lastName: '',
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        itinerary: 'Goma-Bukavu',
        ship, // Bateau Mugote pré-encodé
        travelDate,
        departureTime: '07:30',
        travelClass,
        passengersCount: 1,
        status: 'PENDING', // En attente de validation administrative
        paymentMethod: 'Paiement au Quai / Mobile Money',
        identityNum: 'NON SPÉCIFIÉ',
        transactionId: tempTxnId,
        amount: price,
        createdAt: Date.now(),
        ticketId: uniqueTicketId,
        boardingStatus: 'PENDING',
        notes: `Bateau Mugote • ${travelClass} • Date: ${travelDate}`
      };

      // Sauvegarde MongoDB Atlas
      let mongoId: string | undefined;
      try {
        const mongoRes = await mongoApi.createReservation(reservationData);
        mongoId = mongoRes?._id || (mongoRes as any)?.id;
      } catch (mErr) {
        console.warn("MongoDB sync:", mErr);
      }

      // Sauvegarde Firestore
      const docRef = await addDoc(collection(db, 'reservations'), {
        ...reservationData,
        mongoId: mongoId || null
      });

      const finalReservation: Reservation = {
        ...reservationData,
        id: docRef.id,
        _id: mongoId
      };

      setConfirmedReservation(finalReservation);
      if (onTicketGenerated) {
        onTicketGenerated(finalReservation);
      }
      window.scrollTo({ top: 30, behavior: 'smooth' });
    } catch (err: any) {
      console.error("Booking error:", err);
      setErrorMessage("Une erreur est survenue lors de l'enregistrement de votre réservation.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- ECRAN DE CONFIRMATION AVEC VALIDATION ADMIN OBLIGATOIRE ---
  if (confirmedReservation) {
    return (
      <div className="w-full max-w-sm mx-auto py-4 px-2 text-left font-sans">
        <div className="bg-[#001f35] text-white rounded-2xl p-4 shadow-xl border border-white/10 space-y-3.5">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">réservation enregistrée</h2>
              <p className="text-[11px] text-amber-300 font-mono font-semibold">billet n° #{confirmedReservation.ticketId}</p>
            </div>
          </div>

          <div className="space-y-1.5 text-[11px] bg-slate-900/60 p-3 rounded-xl border border-white/5">
            <div className="flex justify-between py-0.5 border-b border-white/5">
              <span className="text-slate-400">nom complet :</span>
              <span className="font-semibold text-white">{confirmedReservation.fullName}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-white/5">
              <span className="text-slate-400">adresse mail :</span>
              <span className="font-semibold text-white">{confirmedReservation.email}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-white/5">
              <span className="text-slate-400">numéro téléphone :</span>
              <span className="font-semibold text-white">{confirmedReservation.phone}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-white/5">
              <span className="text-slate-400">bateau :</span>
              <span className="font-semibold text-amber-300">{confirmedReservation.ship}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-white/5">
              <span className="text-slate-400">classe :</span>
              <span className="font-semibold text-white">{confirmedReservation.travelClass} ({confirmedReservation.amount}$)</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-400">date du voyage :</span>
              <span className="font-semibold text-white">{confirmedReservation.travelDate}</span>
            </div>
          </div>

          {/* Avertissement réglementaire : Validation admin obligatoire */}
          <div className="p-2.5 bg-amber-500/15 border border-amber-400/40 rounded-xl flex items-start gap-2">
            <Lock size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[10px] space-y-0.5">
              <p className="font-bold text-amber-300 uppercase tracking-tight">validation administrative requise</p>
              <p className="text-slate-200 leading-normal">
                Avant que le client n'ait son billet, l'administrateur doit le valider d'abord. Tant que le billet n'est pas validé chez l'administrateur, il ne peut être ni téléchargé ni émis.
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            {onViewAllTickets && (
              <button
                type="button"
                onClick={onViewAllTickets}
                className="flex-1 py-2 px-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs uppercase tracking-wider transition cursor-pointer"
              >
                mes billets
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmedReservation(null)}
              className="py-2 px-3 bg-white/10 hover:bg-white/15 text-white font-medium rounded-lg text-xs uppercase tracking-wider transition cursor-pointer"
            >
              retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- FORMULAIRE DE RÉSERVATION PETIT, COURT ET ÉPURÉ ---
  return (
    <div className="w-full max-w-sm mx-auto py-4 px-2 text-left font-sans">
      <div className="bg-[#001f35] text-white rounded-2xl p-4 sm:p-5 shadow-xl border border-white/10 space-y-3">
        
        {/* Titre discret et compact */}
        <div className="border-b border-white/10 pb-2 flex items-center justify-between">
          <h1 className="text-sm font-bold text-white tracking-tight">
            formulaire de réservation
          </h1>
          <span className="text-[10px] text-amber-300 font-semibold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
            {ship}
          </span>
        </div>

        {errorMessage && (
          <div className="p-2 bg-rose-500/20 border border-rose-500/40 rounded-lg text-rose-200 text-[11px] font-medium flex items-center gap-1.5">
            <AlertCircle size={13} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2.5">
          
          {/* nom complet */}
          <div>
            <label className="block text-[12px] font-normal text-slate-300 mb-1 lowercase">
              nom complet
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ex: patient mugabo"
                className="w-full h-8 sm:h-9 px-2.5 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <User size={13} className="absolute right-2.5 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* adresse mail */}
          <div>
            <label className="block text-[12px] font-normal text-slate-300 mb-1 lowercase">
              adresse mail
            </label>
            <div className="relative flex items-center">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ex: passager@gmail.com"
                className="w-full h-8 sm:h-9 px-2.5 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <Mail size={13} className="absolute right-2.5 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* numéro téléphone */}
          <div>
            <label className="block text-[12px] font-normal text-slate-300 mb-1 lowercase">
              numéro téléphone
            </label>
            <div className="relative flex items-center">
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="ex: 0994102673"
                className="w-full h-8 sm:h-9 px-2.5 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <Phone size={13} className="absolute right-2.5 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* classe avec petite onglet de sélection */}
          <div className="relative" ref={classDropdownRef}>
            <label className="block text-[12px] font-normal text-slate-300 mb-1 lowercase">
              classe
            </label>
            <button
              type="button"
              onClick={() => setIsClassOpen(!isClassOpen)}
              className="w-full h-8 sm:h-9 px-2.5 bg-slate-900/80 border border-slate-700 hover:border-slate-500 rounded-lg text-xs text-white flex items-center justify-between transition cursor-pointer"
            >
              <span className="font-semibold text-white">
                {travelClass} ({classPricesUSD[travelClass]}$)
              </span>
              <span className="flex items-center gap-1 text-[11px] text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/40">
                <span>sélectionner</span>
                <ChevronDown size={12} className={cn("transition-transform duration-200", isClassOpen && "rotate-180")} />
              </span>
            </button>

            {/* Menu d'options déroulant pour la sélection de classe */}
            {isClassOpen && (
              <div className="absolute z-30 left-0 right-0 mt-1 bg-[#001726] border border-slate-700 rounded-lg shadow-2xl overflow-hidden py-1">
                {(['1ère Classe', '2ème Classe', '3ème Classe', 'VIP'] as TravelClass[]).map((cls) => {
                  const price = classPricesUSD[cls];
                  const isSelected = travelClass === cls;
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => {
                        setTravelClass(cls);
                        setIsClassOpen(false);
                      }}
                      className={cn(
                        "w-full px-3 py-1.5 text-xs flex items-center justify-between text-left hover:bg-white/10 transition cursor-pointer",
                        isSelected ? "bg-amber-400 text-slate-950 font-bold hover:bg-amber-300" : "text-slate-200"
                      )}
                    >
                      <span>{cls}</span>
                      <span className={cn("font-bold text-[11px]", isSelected ? "text-slate-950" : "text-amber-300")}>
                        {price}$
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* date avec petite onglet calendrier */}
          <div>
            <label className="block text-[12px] font-normal text-slate-300 mb-1 lowercase">
              date
            </label>
            <div className="relative flex items-center">
              <input
                ref={dateInputRef}
                type="date"
                required
                value={travelDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setTravelDate(e.target.value)}
                className="w-full h-8 sm:h-9 pl-2.5 pr-28 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => {
                  try {
                    (dateInputRef.current as any)?.showPicker?.();
                  } catch {
                    dateInputRef.current?.focus();
                  }
                }}
                className="absolute right-1 px-2 py-1 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer transition"
                title="Ouvrir le calendrier"
              >
                <Calendar size={12} className="text-amber-400" />
                <span>calendrier</span>
              </button>
            </div>
          </div>

          {/* touche reserver */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-8 sm:h-9 bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 font-bold rounded-lg text-xs uppercase tracking-wider transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Ticket size={14} />
              <span>{submitting ? "réservation en cours..." : "réserver"}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}


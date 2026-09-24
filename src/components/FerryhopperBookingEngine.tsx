import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Ticket, 
  Lock,
  Calendar,
  User,
  Mail,
  Phone,
  AlertCircle
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Si le client n'est pas connecté, le login intervient au moment de réserver
    if (!user) {
      onLoginRequest();
      return;
    }

    if (!fullName.trim()) {
      setErrorMessage("Veuillez renseigner votre nom complet.");
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage("Veuillez renseigner une adresse email valide.");
      return;
    }

    if (!phone.trim()) {
      setErrorMessage("Veuillez renseigner votre numéro de téléphone.");
      return;
    }

    if (!travelDate) {
      setErrorMessage("Veuillez sélectionner la date de votre voyage.");
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
      <div className="w-full max-w-xl mx-auto py-8 px-4 text-left font-sans">
        <div className="bg-[#001f35] text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/10 space-y-6">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
              <CheckCircle2 size={26} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Réservation Enregistrée</h2>
              <p className="text-xs text-amber-300 font-bold">Billet N° #{confirmedReservation.ticketId}</p>
            </div>
          </div>

          <div className="space-y-2 text-xs bg-slate-900/60 p-4 rounded-2xl border border-white/5">
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Nom complet :</span>
              <span className="font-bold text-white">{confirmedReservation.fullName}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Email :</span>
              <span className="font-bold text-white">{confirmedReservation.email}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Téléphone :</span>
              <span className="font-bold text-white">{confirmedReservation.phone}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Bateau :</span>
              <span className="font-bold text-amber-300">{confirmedReservation.ship}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Classe :</span>
              <span className="font-bold text-white">{confirmedReservation.travelClass} ({confirmedReservation.amount}$)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Date du voyage :</span>
              <span className="font-bold text-white">{confirmedReservation.travelDate}</span>
            </div>
          </div>

          {/* Avertissement réglementaire : Validation admin obligatoire */}
          <div className="p-4 bg-amber-500/15 border border-amber-400/40 rounded-2xl flex items-start gap-3">
            <Lock size={20} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-amber-300 uppercase tracking-wide">Validation administrative requise</p>
              <p className="text-slate-200 leading-relaxed">
                Avant que le client n'ait son billet, l'administrateur doit le valider d'abord. Tant que le billet n'est pas validé chez l'administrateur, il ne peut être ni téléchargé ni émis.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {onViewAllTickets && (
              <button
                type="button"
                onClick={onViewAllTickets}
                className="flex-1 py-3 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Consulter mes billets
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmedReservation(null)}
              className="py-3 px-4 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
            >
              Autre réservation
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- FORMULAIRE DE RÉSERVATION SIMPLE & ÉPURÉ ---
  return (
    <div className="w-full max-w-xl mx-auto py-8 px-4 text-left font-sans">
      <div className="bg-[#001f35] text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/10 space-y-6">
        
        {/* Titre */}
        <div className="border-b border-white/10 pb-4">
          <h1 className="text-2xl font-black text-white tracking-tight">
            Formulaire de Réservation
          </h1>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-200 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Nom complet */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1 flex items-center gap-1.5">
              <User size={13} className="text-amber-400" />
              <span>Nom complet</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: Patient Mugabo"
              className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Adresse mail */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1 flex items-center gap-1.5">
              <Mail size={13} className="text-amber-400" />
              <span>Adresse mail</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex: passager@gmail.com"
              className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Numéro de téléphone */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1 flex items-center gap-1.5">
              <Phone size={13} className="text-amber-400" />
              <span>Numéro téléphone</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex: 0994102673"
              className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Classe (sélectionnée : 1ère Classe 11$, 2ème Classe 20$, 3ème Classe 27$, VIP 35$) */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5 flex items-center gap-1.5">
              <Ticket size={13} className="text-amber-400" />
              <span>Classe</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['1ère Classe', '2ème Classe', '3ème Classe', 'VIP'] as TravelClass[]).map((cls) => {
                const price = classPricesUSD[cls];
                const isSelected = travelClass === cls;
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setTravelClass(cls)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between",
                      isSelected
                        ? "bg-amber-400 text-slate-950 border-amber-400 font-black shadow-md ring-2 ring-amber-300/40"
                        : "bg-slate-900/70 text-slate-200 border-slate-700 hover:border-slate-500"
                    )}
                  >
                    <span className="text-xs font-black uppercase tracking-wider">{cls}</span>
                    <span className={cn("text-base font-black mt-1", isSelected ? "text-slate-950" : "text-amber-300")}>
                      ${price} USD
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date (calendrier) */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1 flex items-center gap-1.5">
              <Calendar size={13} className="text-amber-400" />
              <span>Date</span>
            </label>
            <input
              type="date"
              required
              value={travelDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setTravelDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Touche Réserver */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 font-black rounded-xl text-xs sm:text-sm uppercase tracking-wider transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <Ticket size={16} />
              <span>{submitting ? "Réservation en cours..." : "Réserver"}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

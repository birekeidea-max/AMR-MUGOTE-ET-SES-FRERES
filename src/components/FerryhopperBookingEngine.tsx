import React, { useState, useEffect } from 'react';
import { 
  Ship, 
  Calendar, 
  Users, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Ticket, 
  QrCode, 
  Download, 
  Mail, 
  Printer, 
  MapPin, 
  AlertCircle, 
  Phone, 
  CreditCard, 
  Search, 
  User,
  Luggage,
  Sparkles,
  ArrowRight,
  FileText,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Reservation, TravelClass, Itinerary, ShipName } from '../types';
import { cn, formatPrice } from '../lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { mongoApi } from '../services/api';
import { auth, db } from '../lib/firebase';
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
  // --- Form State (Google Form / Tabular single screen) ---
  const [itinerary, setItinerary] = useState<Itinerary>('Goma-Bukavu');
  const [departureDate, setDepartureDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [departureTime, setDepartureTime] = useState<'07:30' | '18:00'>('07:30');
  const [ship, setShip] = useState<ShipName>('Mugote 1');
  const [travelClass, setTravelClass] = useState<TravelClass>('2ème Classe');
  const [passengersCount, setPassengersCount] = useState<number>(1);
  const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');

  // Passenger data
  const [fullName, setFullName] = useState(() => {
    return user?.displayName || localStorage.getItem('mugote_user_name') || '';
  });
  const [phone, setPhone] = useState(() => {
    return user?.phone || localStorage.getItem('mugote_user_phone') || '';
  });
  const [email, setEmail] = useState(() => {
    return user?.email || localStorage.getItem('mugote_user_email') || '';
  });
  const [identityNum, setIdentityNum] = useState('');
  const [luggageOption, setLuggageOption] = useState<'standard' | 'extra_10kg' | 'extra_20kg'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'Airtel Money' | 'M-Pesa' | 'Orange Money' | 'Carte Bancaire' | 'Espèces'>('Airtel Money');
  const [paymentPhone, setPaymentPhone] = useState('');

  // UI status
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedReservation, setConfirmedReservation] = useState<Reservation | null>(null);
  const [showLookupModal, setShowLookupModal] = useState(false);
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<any | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  // Tarifs officiels
  const classPricesUSD: Record<TravelClass, number> = {
    'VIP': Number(siteSettings?.classPrices?.['VIP'] ?? 35),
    '1ère Classe': Number(siteSettings?.classPrices?.['1ère Classe'] ?? 11),
    '2ème Classe': Number(siteSettings?.classPrices?.['2ème Classe'] ?? 20),
    '3ème Classe': Number(siteSettings?.classPrices?.['3ème Classe'] ?? 27)
  };

  const exchangeRate = 2800; // 1 USD = 2800 CDF
  const basePriceUSD = classPricesUSD[travelClass] || 35;
  const luggageExtraUSD = luggageOption === 'extra_10kg' ? 5 : luggageOption === 'extra_20kg' ? 10 : 0;
  const unitPriceUSD = basePriceUSD + luggageExtraUSD;
  const totalAmountUSD = unitPriceUSD * passengersCount;
  const totalAmountCDF = totalAmountUSD * exchangeRate;

  useEffect(() => {
    if (user?.displayName && !fullName) setFullName(user.displayName);
    if (user?.phone && !phone) setPhone(user.phone);
    if (user?.email && !email) setEmail(user.email);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage("Veuillez renseigner le nom complet du passager.");
      return;
    }

    if (!phone.trim() || phone.trim().length < 7) {
      setErrorMessage("Veuillez renseigner le numéro de téléphone pour le billet.");
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage("Veuillez renseigner une adresse email valide pour recevoir le billet.");
      return;
    }

    setSubmitting(true);
    try {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const uniqueTicketId = `MUG-${new Date().getFullYear().toString().slice(-2)}${randomSuffix}`;
      const tempTxnId = `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const userId = user?.uid || `usr_${phone.trim().replace(/\D/g, '')}`;

      const reservationData: Reservation = {
        userId,
        fullName: fullName.trim(),
        lastName: '',
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        itinerary,
        ship,
        travelDate: departureDate,
        departureTime,
        travelClass,
        passengersCount,
        status: 'PENDING',
        paymentMethod,
        identityNum: identityNum.trim() || 'NON SPECIFIÉ',
        transactionId: tempTxnId,
        amount: totalAmountUSD,
        createdAt: Date.now(),
        ticketId: uniqueTicketId,
        boardingStatus: 'PENDING',
        notes: `Bagages: ${luggageOption} • Payé par ${paymentMethod} (${currency === 'CDF' ? totalAmountCDF.toLocaleString() + ' CDF' : '$' + totalAmountUSD})`
      };

      // 1. Sauvegarde MongoDB Atlas
      let mongoId: string | undefined;
      try {
        const mongoRes = await mongoApi.createReservation(reservationData);
        mongoId = mongoRes?._id || (mongoRes as any)?.id;
      } catch (mErr) {
        console.warn("MongoDB Atlas sync:", mErr);
      }

      // 2. Sauvegarde Firestore
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

      // 3. Notification Email automatique
      if (finalReservation.email) {
        dispatchBookingEmail(finalReservation);
      }

      window.scrollTo({ top: 50, behavior: 'smooth' });
    } catch (err: any) {
      console.error("Booking error:", err);
      setErrorMessage(err.message || "Impossible d'enregistrer la réservation. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  const dispatchBookingEmail = async (res: Reservation) => {
    if (!res.email) return;
    setEmailSending(true);
    setEmailSuccess(null);
    try {
      const resp = await fetch('/api/email/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: res.id || res._id, reservation: res })
      });
      const data = await resp.json();
      if (data.success) {
        setEmailSuccess(`Billet électronique expédié à ${res.email}`);
      }
    } catch {
      // Ignorer les erreurs d'envoi non bloquantes
    } finally {
      setEmailSending(false);
    }
  };

  const handleLookupTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const cleanQ = lookupQuery.trim();
      const mongoReservations = await mongoApi.getReservations();
      const found = mongoReservations.find((r: any) => 
        (r.ticketId && r.ticketId.toUpperCase() === cleanQ.toUpperCase()) ||
        (r.phone && r.phone.includes(cleanQ)) ||
        (r.email && r.email.toLowerCase() === cleanQ.toLowerCase())
      );
      if (found) {
        setLookupResult(found);
      } else {
        setLookupError("Aucune réservation trouvée correspondant à cette référence ou numéro.");
      }
    } catch (err: any) {
      setLookupError("Erreur lors de la recherche. Veuillez vérifier votre connexion.");
    } finally {
      setLookupLoading(false);
    }
  };

  // --- ECRAN DE CONFIRMATION (BILLET GENERÉ) ---
  if (confirmedReservation) {
    return (
      <div className="w-full max-w-3xl mx-auto py-6 px-4 space-y-6 text-left font-sans">
        <div className="bg-[#0b132b] text-slate-100 rounded-3xl border border-slate-700/60 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-700 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  Réservation Enregistrée • En attente de validation admin
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Dossier N° #{confirmedReservation.ticketId}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setConfirmedReservation(null);
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition self-start sm:self-auto cursor-pointer"
            >
              + Nouvelle réservation
            </button>
          </div>

          {emailSuccess && (
            <div className="mt-4 p-3 bg-emerald-950/50 border border-emerald-800 rounded-xl text-xs font-semibold text-emerald-300 flex items-center gap-2">
              <Mail size={16} />
              <span>{emailSuccess}</span>
            </div>
          )}

          {/* Tableau Récapitulatif du Billet */}
          <div className="mt-6 bg-[#070d1e] rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Passager</span>
                <span className="text-white font-bold text-sm">{confirmedReservation.fullName}</span>
              </div>
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Trajet Officiel</span>
                <span className="text-white font-bold text-sm">{confirmedReservation.itinerary}</span>
              </div>
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Navire Mugote</span>
                <span className="text-white font-bold text-sm">{confirmedReservation.ship}</span>
              </div>
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Date & Heure</span>
                <span className="text-white font-bold text-sm">{confirmedReservation.travelDate} • {confirmedReservation.departureTime}</span>
              </div>
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Classe</span>
                <span className="text-white font-bold text-sm">{confirmedReservation.travelClass} ({confirmedReservation.passengersCount} place{confirmedReservation.passengersCount > 1 ? 's' : ''})</span>
              </div>
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Statut du Billet</span>
                <span className="text-amber-400 font-bold text-sm">En Attente de Validation Admin</span>
              </div>
            </div>

            {/* QR Code d'embarquement verrouillé tant que non validé par l'admin */}
            <div className="p-5 bg-amber-950/30 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-slate-200">
                <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-wider mb-1">
                  <Lock size={15} />
                  <span>Validation Administrative Obligatoire</span>
                </div>
                <p className="text-sm font-bold text-white">Votre billet sera débloqué après validation par l'administrateur</p>
                <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
                  Conformément aux consignes de sécurité, tant que le billet n'est pas validé chez l'administrateur, le client ne peut pas obtenir son billet ni son QR code d'embarquement. Dès validation par l'administration, votre billet officiel s'affichera dans la section <strong>« Mes Billets »</strong>.
                </p>
              </div>
              <div className="bg-[#0b132b] p-4 rounded-2xl border border-amber-500/30 text-center shrink-0 flex flex-col items-center justify-center min-w-[140px]">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mb-1">
                  <Lock size={24} />
                </div>
                <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider">QR Code Bloqué</span>
                <span className="text-[8px] text-slate-400 mt-0.5">En attente admin</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {onViewAllTickets && (
                <button
                  type="button"
                  onClick={onViewAllTickets}
                  className="flex-1 py-3 px-5 bg-gold hover:bg-gold-light text-[#001233] rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  <Ticket size={16} />
                  <span>Voir Mes Billets & Statuts</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- ECRAN UNIQUE : FORMULAIRE DE RÉSERVATION STYLE TABLEAU / GOOGLE FORM ---
  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4 space-y-6 text-left font-sans" id="booking-google-form-container">
      {/* En-tête Google Form / Tableau de réservation */}
      <div className="bg-[#0b132b] text-slate-100 rounded-3xl border border-slate-700/60 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#070d1e] border border-white/20 text-slate-200 text-xs font-bold uppercase tracking-wider mb-2">
              <Ship size={14} className="text-white" />
              <span>ETS AMR MUGOTE • FORMULAIRE DE RÉSERVATION UNIQUE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Réserver un Billet de Traversée
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Remplissez les champs ci-dessous de manière continue sur un seul écran, puis cliquez sur <strong>Réserver et Payer</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowLookupModal(true)}
              className="px-4 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-700 cursor-pointer"
            >
              <Search size={14} />
              <span>Retrouver un Billet</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 p-4 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs sm:text-sm font-semibold flex items-start gap-2.5">
            <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FORMULAIRE CONTINU EN TABLEAU / GOOGLE FORM SUR UN SEUL ÉCRAN             */}
        {/* ========================================================================= */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          
          {/* LIGNE 1 DU TABLEAU : ITINÉRAIRE */}
          <div className="p-5 rounded-2xl bg-[#070d1e] border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-slate-300">
              <MapPin size={18} className="text-white" />
              <label className="text-xs sm:text-sm font-black uppercase tracking-wider">
                1. Itinéraire & Sens de Traversée <span className="text-rose-400">*</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setItinerary('Goma-Bukavu')}
                className={cn(
                  "p-4 rounded-xl border text-left font-bold transition cursor-pointer flex items-center justify-between",
                  itinerary === 'Goma-Bukavu'
                    ? "bg-[#0b132b] text-white border-white shadow-lg ring-1 ring-white/30"
                    : "bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700"
                )}
              >
                <div>
                  <div className="text-xs uppercase font-extrabold">Départ de Goma</div>
                  <div className="text-sm font-black text-white">Goma ➔ Bukavu</div>
                  <div className="text-[11px] text-slate-400">Port Public de Goma ➔ Port Ihusi / Beach Muhanzi</div>
                </div>
                {itinerary === 'Goma-Bukavu' && <CheckCircle2 size={20} className="text-white shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => setItinerary('Bukavu-Goma')}
                className={cn(
                  "p-4 rounded-xl border text-left font-bold transition cursor-pointer flex items-center justify-between",
                  itinerary === 'Bukavu-Goma'
                    ? "bg-[#0b132b] text-white border-white shadow-lg ring-1 ring-white/30"
                    : "bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700"
                )}
              >
                <div>
                  <div className="text-xs uppercase font-extrabold">Départ de Bukavu</div>
                  <div className="text-sm font-black text-white">Bukavu ➔ Goma</div>
                  <div className="text-[11px] text-slate-400">Beach Muhanzi / Port Ihusi ➔ Port Public de Goma</div>
                </div>
                {itinerary === 'Bukavu-Goma' && <CheckCircle2 size={20} className="text-white shrink-0" />}
              </button>
            </div>
          </div>

          {/* LIGNE 2 DU TABLEAU : DATE ET HEURE DE DÉPART */}
          <div className="p-5 rounded-2xl bg-[#070d1e] border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-slate-300">
              <Calendar size={18} className="text-white" />
              <label className="text-xs sm:text-sm font-black uppercase tracking-wider">
                2. Date du Voyage & Heure de Départ <span className="text-rose-400">*</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Date de Voyage
                </label>
                <input
                  type="date"
                  required
                  value={departureDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Créneau Horaire
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDepartureTime('07:30')}
                    className={cn(
                      "py-3 px-3 rounded-xl border text-center font-bold text-xs transition cursor-pointer",
                      departureTime === '07:30'
                        ? "bg-[#0b132b] text-white border-white shadow-sm ring-1 ring-white/30"
                        : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <div className="font-black text-sm">07h30</div>
                    <div className="text-[10px] text-slate-400">Départ Matin (Express)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDepartureTime('18:00')}
                    className={cn(
                      "py-3 px-3 rounded-xl border text-center font-bold text-xs transition cursor-pointer",
                      departureTime === '18:00'
                        ? "bg-[#0b132b] text-white border-white shadow-sm ring-1 ring-white/30"
                        : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <div className="font-black text-sm">18h00</div>
                    <div className="text-[10px] text-slate-400">Départ Soir (Nuit)</div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* LIGNE 3 DU TABLEAU : SÉLECTION DU BATEAU */}
          <div className="p-5 rounded-2xl bg-[#070d1e] border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-slate-300">
              <Ship size={18} className="text-white" />
              <label className="text-xs sm:text-sm font-black uppercase tracking-wider">
                3. Choix du Bateau de la Flotte <span className="text-rose-400">*</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { name: 'Mugote 1', type: 'Vedette Rapide', cap: '200 Passagers' },
                { name: 'Mugote 2', type: 'Confort & Sécurité', cap: '300 Passagers' },
                { name: 'Mugote 3', type: 'Grand Express', cap: '400 Passagers' }
              ].map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setShip(s.name as ShipName)}
                  className={cn(
                    "p-3.5 rounded-xl border text-left transition cursor-pointer",
                    ship === s.name
                      ? "bg-[#0b132b] text-white border-white shadow-md ring-1 ring-white/30"
                      : "bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700"
                  )}
                >
                  <div className="text-sm font-black text-white">{s.name}</div>
                  <div className="text-xs font-semibold text-slate-300">{s.type}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{s.cap}</div>
                </button>
              ))}
            </div>
          </div>

          {/* LIGNE 4 DU TABLEAU : CLASSE & NOMBRE DE PLACES */}
          <div className="p-5 rounded-2xl bg-[#070d1e] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300">
                <Ticket size={18} className="text-white" />
                <label className="text-xs sm:text-sm font-black uppercase tracking-wider">
                  4. Classe de Voyage & Nombre de Passagers <span className="text-rose-400">*</span>
                </label>
              </div>

              {/* Devise USD / CDF */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer",
                    currency === 'USD' ? "bg-white text-black font-black" : "text-slate-400 hover:text-white"
                  )}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('CDF')}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer",
                    currency === 'CDF' ? "bg-white text-black font-black" : "text-slate-400 hover:text-white"
                  )}
                >
                  CDF (FC)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(['VIP', '1ère Classe', '2ème Classe', '3ème Classe'] as TravelClass[]).map((cls) => {
                const pUSD = classPricesUSD[cls];
                const pCDF = pUSD * exchangeRate;
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setTravelClass(cls)}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition cursor-pointer",
                      travelClass === cls
                        ? "bg-[#0b132b] text-white border-white shadow-md ring-1 ring-white/30"
                        : "bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <div className="text-xs uppercase font-extrabold text-slate-300">{cls}</div>
                    <div className="text-base sm:text-lg font-black text-white mt-0.5">
                      {currency === 'USD' ? `$${pUSD} USD` : `${pCDF.toLocaleString()} FC`}
                    </div>
                    <div className="text-[11px] text-slate-400">Siège gilet certifié</div>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Nombre de passagers
              </label>
              <div className="flex items-center gap-3">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPassengersCount(num)}
                    className={cn(
                      "w-12 h-11 rounded-xl font-black text-sm transition border cursor-pointer flex items-center justify-center",
                      passengersCount === num
                        ? "bg-white text-black font-black border-white shadow-md"
                        : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                    )}
                  >
                    {num}
                  </button>
                ))}
                <span className="text-xs text-slate-400 font-semibold">
                  {passengersCount} billet{passengersCount > 1 ? 's' : ''} réservé{passengersCount > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* LIGNE 5 DU TABLEAU : INFORMATIONS DU PASSAGER */}
          <div className="p-5 rounded-2xl bg-[#070d1e] border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-slate-300">
              <User size={18} className="text-white" />
              <label className="text-xs sm:text-sm font-black uppercase tracking-wider">
                5. Informations du Passager Principal <span className="text-rose-400">*</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Nom Complet du Passager <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Patient Mugabo"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Numéro de Téléphone (WhatsApp/SMS) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: 0994102673"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Adresse Email (Réception du Billet) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: voyageur@gmail.com"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Numéro de Pièce d'Identité / Électeur / Passeport
                </label>
                <input
                  type="text"
                  value={identityNum}
                  onChange={(e) => setIdentityNum(e.target.value)}
                  placeholder="Ex: N° carte d'électeur ou passeport"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white"
                />
              </div>
            </div>
          </div>

          {/* LIGNE 6 DU TABLEAU : BAGAGES */}
          <div className="p-5 rounded-2xl bg-[#070d1e] border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-slate-300">
              <Luggage size={18} className="text-white" />
              <label className="text-xs sm:text-sm font-black uppercase tracking-wider">
                6. Franchise Bagages & Fret
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'standard', title: 'Standard (20 kg)', sub: 'Inclus sans frais', price: 0 },
                { id: 'extra_10kg', title: 'Supplément +10 kg', sub: '+ $5 USD', price: 5 },
                { id: 'extra_20kg', title: 'Supplément +20 kg', sub: '+ $10 USD', price: 10 }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLuggageOption(opt.id as any)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition cursor-pointer",
                    luggageOption === opt.id
                      ? "bg-[#0b132b] text-white border-white shadow-md ring-1 ring-white/30"
                      : "bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700"
                  )}
                >
                  <div className="text-xs font-bold text-white">{opt.title}</div>
                  <div className="text-[11px] text-slate-400">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* LIGNE 7 DU TABLEAU : PAIEMENT */}
          <div className="p-5 rounded-2xl bg-[#070d1e] border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-slate-300">
              <CreditCard size={18} className="text-white" />
              <label className="text-xs sm:text-sm font-black uppercase tracking-wider">
                7. Mode de Paiement Sécurisé <span className="text-rose-400">*</span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {(['Airtel Money', 'M-Pesa', 'Orange Money', 'Carte Bancaire', 'Espèces'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={cn(
                    "p-3 rounded-xl border text-center transition cursor-pointer",
                    paymentMethod === method
                      ? "bg-[#0b132b] text-white border-white shadow-md ring-1 ring-white/30"
                      : "bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700"
                  )}
                >
                  <div className="text-xs font-bold">{method}</div>
                </button>
              ))}
            </div>

            {paymentMethod.includes('Money') || paymentMethod === 'M-Pesa' ? (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Numéro de débit Mobile Money ({paymentMethod})
                </label>
                <input
                  type="tel"
                  value={paymentPhone || phone}
                  onChange={(e) => setPaymentPhone(e.target.value)}
                  placeholder="099... ou 081..."
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white"
                />
              </div>
            ) : null}
          </div>

          {/* LIGNE 8 DU TABLEAU : SYNTHÈSE DU CALCUL ET BOUTON RÉSERVER ET PAYER */}
          <div className="p-6 rounded-2xl bg-[#070d1e] border border-white/20 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 block">
                Total à Régler ({passengersCount} passager{passengersCount > 1 ? 's' : ''})
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                {currency === 'USD' ? `$${totalAmountUSD} USD` : `${totalAmountCDF.toLocaleString()} FC`}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {itinerary} • {ship} • {departureDate} à {departureTime}
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-200 active:scale-[0.98] text-black font-black text-sm uppercase tracking-wider rounded-xl shadow-xl border border-white/20 transition cursor-pointer flex items-center justify-center gap-3"
            >
              {submitting ? (
                <span>Validation en cours...</span>
              ) : (
                <>
                  <span>Réserver et Payer</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* MODAL RETROUVER MON BILLET                                                */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showLookupModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b132b] text-slate-100 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-700 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center border border-white/20">
                    <Search size={18} />
                  </div>
                  <h3 className="text-base font-extrabold text-white">Retrouver ma Réservation</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLookupModal(false)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-800 flex items-center justify-center font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleLookupTicket} className="space-y-3">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide">
                  Référence du Billet (ex: MUG-2684) ou Numéro de Téléphone :
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    placeholder="MUG-XXXX ou 099..."
                    className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-white"
                  />
                  <button
                    type="submit"
                    disabled={lookupLoading}
                    className="px-5 py-3 bg-white hover:bg-slate-200 text-black font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {lookupLoading ? "Recherche..." : "Vérifier"}
                  </button>
                </div>
              </form>

              {lookupError && (
                <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl font-medium">
                  {lookupError}
                </div>
              )}

              {lookupResult && (
                <div className="bg-[#070d1e] rounded-2xl p-4 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Passager</span>
                      <p className="text-sm font-black text-white">{lookupResult.fullName}</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-white/10 text-white border border-white/20">
                      {lookupResult.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Trajet :</span>
                      <span className="font-bold text-white">{lookupResult.itinerary}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Navire :</span>
                      <span className="font-bold text-white">{lookupResult.ship}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Date :</span>
                      <span className="font-bold text-white">{lookupResult.travelDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">N° Billet :</span>
                      <span className="font-mono font-bold text-white">#{lookupResult.ticketId}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedReservation(lookupResult);
                      setShowLookupModal(false);
                    }}
                    className="w-full py-2.5 bg-white text-black font-black rounded-xl text-xs uppercase tracking-wider hover:bg-slate-200 transition mt-2 cursor-pointer shadow-md"
                  >
                    Voir mon Billet Électronique & QR Code
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

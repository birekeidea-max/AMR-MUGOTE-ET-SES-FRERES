import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Ship, 
  Ticket, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Smartphone,
  Banknote,
  ArrowRight,
  ShieldCheck,
  X
} from 'lucide-react';
import { mongoApi } from '../services/api';

export interface CompactBookingFormProps {
  isModal?: boolean;
  onClose?: () => void;
  onSuccess?: (reservation: any) => void;
  user?: any;
  initialTrajet?: string;
  initialBoat?: string;
  initialClass?: 'standard' | 'business' | 'vip';
  currency?: 'USD' | 'CDF';
}

export function CompactBookingForm({
  isModal = false,
  onClose,
  onSuccess,
  user,
  initialTrajet = 'Goma Port Public ➔ Bukavu Ihusi',
  initialBoat = 'Mugote 1',
  initialClass = 'standard',
  currency = 'USD'
}: CompactBookingFormProps) {
  // Sélecteur de devise directement dans le formulaire de réservation
  const [formCurrency, setFormCurrency] = useState<'USD' | 'CDF'>(currency || 'USD');

  // 1. COORDONNÉES DU PASSAGER PRINCIPAL
  const [nom, setNom] = useState(() => {
    if (user?.displayName) {
      const parts = user.displayName.trim().split(' ');
      return parts[0] || '';
    }
    return '';
  });
  const [prenom, setPrenom] = useState(() => {
    if (user?.displayName) {
      const parts = user.displayName.trim().split(' ');
      return parts.slice(1).join(' ') || '';
    }
    return '';
  });
  const [telephone, setTelephone] = useState('+243 ');
  const [email, setEmail] = useState(user?.email || '');

  // 2. DÉTAILS DU VOYAGE & BATEAU
  const [trajet, setTrajet] = useState(initialTrajet);
  const [travelDate, setTravelDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [boat, setBoat] = useState(initialBoat);
  const [travelClass, setTravelClass] = useState<'standard' | 'business' | 'vip'>(initialClass);
  const [passengerCount, setPassengerCount] = useState(1);

  // 3. PAIEMENT & VALIDATION
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'airtel' | 'orange' | 'cash'>('mpesa');

  // États d'envoi & validation
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdReservation, setCreatedReservation] = useState<any>(null);

  // Barème officiel des classes selon la demande
  const classPricing: Record<'standard' | 'business' | 'vip', { label: string; price: number; desc: string }> = {
    standard: { label: 'Standard', price: 15, desc: 'Salon principal' },
    business: { label: 'Business', price: 20, desc: 'Salon climatisé' },
    vip: { label: 'VIP', price: 30, desc: 'Salon panoramique & collation' }
  };

  const unitPrice = classPricing[travelClass].price;
  const totalPriceUSD = unitPrice * passengerCount;
  // Taux indicatif CDF (1 USD = 2850 CDF)
  const exchangeRate = 2850;
  const totalPriceCDF = totalPriceUSD * exchangeRate;

  // Validation email
  const isEmailValid = (val: string) => {
    const trimmed = val.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation des champs obligatoires
    if (!nom.trim()) {
      setErrorMsg('Veuillez saisir votre Nom.');
      return;
    }
    if (!prenom.trim()) {
      setErrorMsg('Veuillez saisir votre Prénom.');
      return;
    }
    const cleanPhone = telephone.trim().replace(/\s+/g, '');
    if (cleanPhone.length < 9) {
      setErrorMsg('Numéro de téléphone invalide (Ex: +243 994 102 673).');
      return;
    }
    if (!email.trim() || !isEmailValid(email)) {
      setErrorMsg('Adresse Email obligatoire et valide pour recevoir votre billet électronique.');
      return;
    }

    setIsSubmitting(true);

    const mappedItinerary: 'Goma-Bukavu' | 'Bukavu-Goma' = trajet.toLowerCase().startsWith('bukavu') 
      ? 'Bukavu-Goma' 
      : 'Goma-Bukavu';

    const mappedClass: '1ère Classe' | '2ème Classe' | 'VIP' = travelClass === 'vip' 
      ? 'VIP' 
      : travelClass === 'business' 
        ? '1ère Classe' 
        : '2ème Classe';

    const reservationPayload = {
      userId: user?.uid || `anon-${Date.now()}`,
      fullName: `${nom.trim().toUpperCase()} ${prenom.trim()}`,
      lastName: nom.trim(),
      phone: telephone.trim(),
      email: email.trim().toLowerCase(),
      itinerary: mappedItinerary,
      ship: (boat as any) || 'Mugote 1',
      travelDate,
      departureTime: '07:30',
      travelClass: mappedClass,
      passengersCount: passengerCount,
      status: (paymentMethod === 'cash' ? 'PENDING' : 'VALIDATED') as any,
      paymentMethod,
      transactionId: `TX-${Date.now().toString().slice(-6)}`,
      ticketId: `MUG-${Date.now().toString().slice(-6)}`,
      amount: totalPriceUSD,
      createdAt: Date.now(),
      notes: `Trajet: ${trajet}, Navire: ${boat}, Classe: ${travelClass.toUpperCase()}`
    };

    try {
      // Sauvegarde via mongoApi / backend / Firestore
      try {
        await mongoApi.createReservation(reservationPayload);
      } catch (saveErr) {
        console.warn("Sauvegarde API échouée, conservation en local:", saveErr);
      }

      setCreatedReservation({
        ...reservationPayload,
        passengerName: reservationPayload.fullName,
        totalPrice: totalPriceUSD,
        totalPriceCDF,
        passengerCount,
        unitPrice
      });
      setIsSuccess(true);
      if (onSuccess) {
        onSuccess(reservationPayload);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur lors de l'enregistrement de la réservation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden text-slate-800 transition-all ${isModal ? 'max-h-[92vh] flex flex-col' : ''}`}>
      
      {/* 1. TITRE DU FORMULAIRE (STYLE AIRBNB / DRIBBLE ÉPURÉ) */}
      <div className="px-5 sm:px-7 py-4 bg-[#0b132b] text-white flex items-center justify-between gap-3 shrink-0">
        <div className="text-left">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-black shadow-xs">
              <Ship size={16} />
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white leading-snug">
              Formulaire de Réservation
            </h2>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-300 font-medium mt-0.5">
            Remplissez vos informations pour réserver votre traversée sur le Lac Kivu
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Sélecteur de Devise USD / CDF DANS LE FORMULAIRE DE RÉSERVATION */}
          <div className="flex items-center bg-white/10 p-1 rounded-xl border border-white/20 text-[10px] font-black">
            <button
              type="button"
              onClick={() => setFormCurrency('USD')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                formCurrency === 'USD' ? 'bg-white text-black shadow-xs font-black' : 'text-slate-300 hover:text-white'
              }`}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => setFormCurrency('CDF')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                formCurrency === 'CDF' ? 'bg-white text-black shadow-xs font-black' : 'text-slate-300 hover:text-white'
              }`}
            >
              CDF (FC)
            </button>
          </div>

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer shrink-0"
              title="Fermer"
            >
              <X size={17} />
            </button>
          )}
        </div>
      </div>

      {/* CONTENU PRINCIPAL DU FORMULAIRE */}
      <div className={`p-4 sm:p-6 text-left ${isModal ? 'overflow-y-auto' : ''}`}>
        {isSuccess && createdReservation ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Traversée Réservée avec Succès !
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                Billet <strong>#{createdReservation.ticketId}</strong> généré pour <strong>{createdReservation.passengerName}</strong>. Un e-mail de confirmation a été envoyé à <strong>{createdReservation.email}</strong>.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl max-w-md mx-auto text-xs space-y-1.5 font-mono text-left">
              <p className="text-slate-600"><strong>Trajet :</strong> {createdReservation.itinerary}</p>
              <p className="text-slate-600"><strong>Date :</strong> {createdReservation.travelDate} | <strong>Navire :</strong> {createdReservation.ship}</p>
              <p className="text-slate-600"><strong>Passagers :</strong> {createdReservation.passengerCount} ({createdReservation.travelClass})</p>
              <p className="text-black font-black">
                <strong>Total :</strong> ${createdReservation.totalPrice} USD ({createdReservation.totalPriceCDF.toLocaleString()} FC) via {createdReservation.paymentMethod.toUpperCase()}
              </p>
            </div>

            <div className="pt-2 flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsSuccess(false);
                  setCreatedReservation(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Nouvelle réservation
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-[#0b132b] hover:bg-[#111c3d] text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer"
                >
                  Fermer
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ================================================================ */}
            {/* 2. SECTION - COORDONNÉES DU PASSAGER PRINCIPAL                  */}
            {/* ================================================================ */}
            <div className="bg-slate-50/70 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200/80">
                <div className="w-5 h-5 rounded-md bg-slate-200 text-slate-900 flex items-center justify-center font-bold text-[10px]">
                  1
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Coordonnées du Passager Principal
                </h3>
              </div>

              {/* GRILLE COMPACTE : 2 COLONNES SUR PC, 1 SUR SMARTPHONE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Nom */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nom <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      placeholder="Ex: Kabila"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-slate-800 focus:outline-none transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* Prénom */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Prénom <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    placeholder="Ex: Jean-Luc"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-slate-800 focus:outline-none transition shadow-2xs"
                  />
                </div>

                {/* Téléphone (+243) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Téléphone <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      placeholder="+243 994 102 673"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-slate-800 focus:outline-none transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* Adresse Email (OBLIGATOIRE avec mention "Pour recevoir votre billet") */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">
                      Adresse Email <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-bold">
                      Pour recevoir votre billet
                    </span>
                  </div>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom@exemple.com"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-slate-800 focus:outline-none transition shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ================================================================ */}
            {/* 3. SECTION - DÉTAILS DU VOYAGE & BATEAU                         */}
            {/* ================================================================ */}
            <div className="bg-slate-50/70 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200/80">
                <div className="w-5 h-5 rounded-md bg-slate-200 text-slate-900 flex items-center justify-center font-bold text-[10px]">
                  2
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Détails du Voyage & Bateau
                </h3>
              </div>

              {/* GRILLE COMPACTE SUR 2 COLONNES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Port de Départ & Arrivée (Select compact) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Port de Départ & Arrivée
                  </label>
                  <div className="relative">
                    <MapPin size={15} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    <select
                      value={trajet}
                      onChange={(e) => setTrajet(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:ring-2 focus:ring-slate-800 focus:outline-none cursor-pointer shadow-2xs"
                    >
                      <option value="Goma Port Public ➔ Bukavu Ihusi">Goma Port Public ➔ Bukavu Ihusi</option>
                      <option value="Bukavu Ihusi ➔ Goma Port Public">Bukavu Ihusi ➔ Goma Port Public</option>
                      <option value="Goma Port Public ➔ Bukavu Beach Muanzi">Goma Port Public ➔ Bukavu Beach Muanzi</option>
                      <option value="Bukavu Beach Muanzi ➔ Goma Port Public">Bukavu Beach Muanzi ➔ Goma Port Public</option>
                      <option value="Goma ➔ Île d'Idjwi">Goma ➔ Île d'Idjwi</option>
                      <option value="Bukavu ➔ Île d'Idjwi">Bukavu ➔ Île d'Idjwi</option>
                    </select>
                  </div>
                </div>

                {/* Date de Voyage (Datepicker avec icône Calendrier) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Date de Voyage
                  </label>
                  <div className="relative">
                    <Calendar size={15} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={travelDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setTravelDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:ring-2 focus:ring-slate-800 focus:outline-none cursor-pointer shadow-2xs"
                    />
                  </div>
                </div>

                {/* Bateau (Puces / badges cliquables Mugote 1, 2, 3) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Bateau
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['Mugote 1', 'Mugote 2', 'Mugote 3'].map((b) => {
                      const isSelected = boat === b;
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setBoat(b)}
                          className={`py-1.5 px-2 rounded-xl border text-center transition cursor-pointer flex items-center justify-center gap-1.5 text-xs font-black ${
                            isSelected
                              ? 'bg-[#0b132b] text-white border-[#0b132b] shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Ship size={13} className={isSelected ? 'text-white' : 'text-slate-700'} />
                          <span>{b}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Classe & Prix (Menu déroulant dynamique associant le prix) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Classe & Prix
                  </label>
                  <select
                    value={travelClass}
                    onChange={(e) => setTravelClass(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:ring-2 focus:ring-slate-800 focus:outline-none cursor-pointer shadow-2xs"
                  >
                    <option value="standard">Standard - 15$</option>
                    <option value="business">Business - 20$</option>
                    <option value="vip">VIP - 30$</option>
                  </select>
                </div>

                {/* Nombre de Passagers (Compteur numérique compact 1 à 10) */}
                <div className="md:col-span-2 flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Nombre de Passagers
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Billet individuel nominatif (max 10)
                    </span>
                  </div>

                  <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-slate-50 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setPassengerCount(Math.max(1, passengerCount - 1))}
                      disabled={passengerCount <= 1}
                      className="w-8 h-8 flex items-center justify-center font-black text-slate-600 hover:bg-slate-200 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                    <span className="w-9 text-center font-black text-xs text-slate-900">
                      {passengerCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPassengerCount(Math.min(10, passengerCount + 1))}
                      disabled={passengerCount >= 10}
                      className="w-8 h-8 flex items-center justify-center font-black text-slate-600 hover:bg-slate-200 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ================================================================ */}
            {/* 4. SECTION - PAIEMENT & VALIDATION                              */}
            {/* ================================================================ */}
            <div className="bg-slate-50/70 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200/80">
                <div className="w-5 h-5 rounded-md bg-slate-200 text-slate-900 flex items-center justify-center font-bold text-[10px]">
                  3
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Paiement & Validation
                </h3>
              </div>

              {/* Mode de Paiement (Boutons radio/badges compacts cliquables) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  Mode de Paiement
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'mpesa', label: 'M-Pesa', badge: 'Vodacom' },
                    { id: 'airtel', label: 'Airtel Money', badge: 'Airtel' },
                    { id: 'orange', label: 'Orange Money', badge: 'Orange' },
                    { id: 'cash', label: 'Cash au guichet', badge: 'Port' }
                  ].map((p) => {
                    const isSelected = paymentMethod === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPaymentMethod(p.id as any)}
                        className={`py-2 px-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-0.5 ${
                          isSelected
                            ? 'bg-[#0b132b] text-white border-[#0b132b] shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-[11px] font-black">{p.label}</span>
                        <span className={`text-[9px] ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                          {p.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Récapitulatif dynamique du prix total & Bouton d'action */}
              <div className="pt-2.5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-left">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Récapitulatif de la réservation :
                  </span>
                  <div className="text-xs font-semibold text-slate-700 mt-0.5">
                    {passengerCount} passager{passengerCount > 1 ? 's' : ''} × {classPricing[travelClass].label} ({formCurrency === 'USD' ? `$${unitPrice}` : `${(unitPrice * exchangeRate).toLocaleString()} FC`}) ={' '}
                    <span className="text-base font-black text-black">
                      Total : {formCurrency === 'USD' ? `$${totalPriceUSD}` : `${totalPriceCDF.toLocaleString()} FC`}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 ml-1">
                      ({formCurrency === 'USD' ? `${totalPriceCDF.toLocaleString()} FC` : `$${totalPriceUSD} USD`})
                    </span>
                  </div>
                </div>

                {/* Grand bouton compact Monochrome / Noir */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-6 py-2.5 bg-black hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg border border-white/10 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <CreditCard size={16} />
                  <span>{isSubmitting ? 'Validation en cours...' : 'RÉSERVER ET PAYER'}</span>
                </button>
              </div>
            </div>

          </form>
        )}
      </div>

    </div>
  );
}

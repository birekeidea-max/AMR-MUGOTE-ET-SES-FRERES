import React, { useState, useEffect } from 'react';
import { 
  Ship, 
  Calendar, 
  Users, 
  ArrowRight, 
  ArrowLeftRight, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Ticket, 
  QrCode, 
  Download, 
  Mail, 
  Printer, 
  Share2, 
  MapPin, 
  Sparkles, 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  AlertCircle, 
  Phone, 
  CreditCard, 
  DollarSign, 
  Search, 
  RefreshCw, 
  Eye, 
  Star,
  Check,
  Wifi,
  Coffee,
  Wind,
  Luggage,
  Info,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Reservation, TravelClass, Itinerary, ShipName } from '../types';
import { cn, formatPrice } from '../lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { mongoApi } from '../services/api';
import { auth, db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  setDoc, 
  serverTimestamp, 
  increment, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';

interface FerryhopperBookingEngineProps {
  user: any | null;
  siteSettings?: any;
  onLoginRequest: () => void;
  onTicketGenerated?: (reservation: Reservation) => void;
  onViewAllTickets?: () => void;
}

interface FerryTrip {
  id: string;
  ship: ShipName;
  shipType: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  itinerary: Itinerary;
  originPort: string;
  destinationPort: string;
  amenities: string[];
  recommended?: boolean;
}

export const FERRY_TRIPS: FerryTrip[] = [
  {
    id: 'trip-bukavu-goma-morning',
    ship: 'Mugote 1',
    shipType: 'Vedette Rapide (200 PAX)',
    departureTime: '07:30',
    arrivalTime: '12:30',
    duration: '5h 00m',
    itinerary: 'Bukavu-Goma',
    originPort: 'Port de Bukavu (Beach Muhanzi)',
    destinationPort: 'Port de Goma (Port Public)',
    amenities: ['Wi-Fi Haut Débit', 'Climatisation', 'Prises 220V', 'Snack Bar'],
    recommended: true
  },
  {
    id: 'trip-bukavu-goma-evening',
    ship: 'Mugote 2',
    shipType: 'Haute Performance (300 PAX)',
    departureTime: '18:00',
    arrivalTime: '06:00 (+1)',
    duration: '12h 00m (Nuit)',
    itinerary: 'Bukavu-Goma',
    originPort: 'Port de Bukavu (Beach Muhanzi)',
    destinationPort: 'Port de Goma (Port Public)',
    amenities: ['Pont Panoramique', 'Climatisation', 'Salon Confort', 'Traversée de Nuit']
  },
  {
    id: 'trip-goma-bukavu-morning',
    ship: 'Mugote 1',
    shipType: 'Vedette Rapide (200 PAX)',
    departureTime: '07:30',
    arrivalTime: '12:30',
    duration: '5h 00m',
    itinerary: 'Goma-Bukavu',
    originPort: 'Port de Goma (Port Public)',
    destinationPort: 'Port de Bukavu (Beach Muhanzi)',
    amenities: ['Wi-Fi Haut Débit', 'Climatisation', 'Prises 220V', 'Snack Bar'],
    recommended: true
  },
  {
    id: 'trip-goma-bukavu-evening',
    ship: 'Mugote 3',
    shipType: 'Grand Express (400 PAX)',
    departureTime: '18:00',
    arrivalTime: '06:00 (+1)',
    duration: '12h 00m (Nuit)',
    itinerary: 'Goma-Bukavu',
    originPort: 'Port de Goma (Port Public)',
    destinationPort: 'Port de Bukavu (Beach Muhanzi)',
    amenities: ['Espace Bagages Spacieux', 'Pont Aéré', 'Boissons Fraîches', 'Grand Confort']
  }
];

export function FerryhopperBookingEngine({
  user,
  siteSettings,
  onLoginRequest,
  onTicketGenerated,
  onViewAllTickets
}: FerryhopperBookingEngineProps) {
  // --- Search Parameters (Ferryhopper style) ---
  const [tripType, setTripType] = useState<'one-way' | 'round-trip'>('one-way');
  const [origin, setOrigin] = useState<'Bukavu' | 'Goma'>('Bukavu');
  const [destination, setDestination] = useState<'Bukavu' | 'Goma'>('Goma');
  
  const getTodayStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const [departureDate, setDepartureDate] = useState<string>(getTodayStr());
  const [passengersCount, setPassengersCount] = useState<number>(1);
  const [selectedClass, setSelectedClass] = useState<TravelClass>('2ème Classe');
  // Sélecteur de devise DANS le formulaire de réservation
  const [bookingCurrency, setBookingCurrency] = useState<'USD' | 'CDF'>('USD');

  // Filter state for results
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'afternoon'>('all');
  const [shipFilter, setShipFilter] = useState<string>('all');
  
  // Checkout flow step: 1 = Search & Results, 2 = Passenger Details, 3 = Payment & Confirmation, 4 = E-Ticket Issued
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedTrip, setSelectedTrip] = useState<FerryTrip | null>(null);

  // Passenger form
  const [passengerData, setPassengerData] = useState({
    firstName: user?.displayName?.split(' ')[0] || '',
    lastName: user?.displayName?.split(' ').slice(1).join(' ') || '',
    phone: user?.phoneNumber || '',
    email: user?.email || '',
    identityNum: '',
    paymentMethod: 'M-Pesa (Vodacom)',
    notes: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedReservation, setConfirmedReservation] = useState<Reservation | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  // Manage booking lookup tool
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<Reservation | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [showLookupModal, setShowLookupModal] = useState(false);

  // Sync user details when auth updates
  useEffect(() => {
    if (user) {
      setPassengerData(prev => ({
        ...prev,
        firstName: prev.firstName || user.displayName?.split(' ')[0] || '',
        lastName: prev.lastName || user.displayName?.split(' ').slice(1).join(' ') || '',
        email: prev.email || user.email || '',
        phone: prev.phone || user.phoneNumber || ''
      }));
    }
  }, [user]);

  // Current itinerary based on origin & destination
  const activeItinerary: Itinerary = `${origin}-${destination}` as Itinerary;

  // Filtered trips
  const matchingTrips = FERRY_TRIPS.filter(trip => {
    if (trip.itinerary !== activeItinerary) return false;
    if (shipFilter !== 'all' && trip.ship !== shipFilter) return false;
    if (timeFilter === 'morning') {
      const hour = parseInt(trip.departureTime.split(':')[0], 10);
      if (hour >= 12) return false;
    }
    if (timeFilter === 'afternoon') {
      const hour = parseInt(trip.departureTime.split(':')[0], 10);
      if (hour < 12) return false;
    }
    return true;
  });

  // Price calculations
  const prices: Record<TravelClass, number> = {
    'VIP': Number(siteSettings?.classPrices?.['VIP'] ?? 27),
    '1ère Classe': Number(siteSettings?.classPrices?.['1ère Classe'] ?? 27),
    '2ème Classe': Number(siteSettings?.classPrices?.['2ème Classe'] ?? 17),
    '3ème Classe': Number(siteSettings?.classPrices?.['3ème Classe'] ?? 10)
  };

  const handleSwapPorts = () => {
    const oldOrigin = origin;
    setOrigin(destination);
    setDestination(oldOrigin);
  };

  const handleSelectTrip = (trip: FerryTrip, chosenClass?: TravelClass) => {
    setSelectedTrip(trip);
    if (chosenClass) {
      setSelectedClass(chosenClass);
    }
    setCheckoutStep(2);
    setErrorMessage(null);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  // Quick Date Selectors (hier, aujourd'hui, demain, j+2)
  const getRelativeDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatDisplayDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    } catch {
      return dateStr;
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedTrip) {
      setErrorMessage("Veuillez d'abord sélectionner une traversée.");
      setCheckoutStep(1);
      return;
    }

    if (!passengerData.firstName.trim() || passengerData.firstName.trim().length < 2) {
      setErrorMessage("Veuillez renseigner un prénom valide (minimum 2 lettres).");
      return;
    }

    if (!passengerData.lastName.trim() || passengerData.lastName.trim().length < 2) {
      setErrorMessage("Veuillez renseigner un nom / post-nom valide (minimum 2 lettres).");
      return;
    }

    const cleanPhone = passengerData.phone.replace(/[\s\-\(\)\.]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMessage("Veuillez saisir un numéro de téléphone valide pour la confirmation et le paiement mobile.");
      return;
    }

    if (passengerData.email && passengerData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(passengerData.email.trim())) {
        setErrorMessage("L'adresse email n'est pas valide (ex: voyageur@gmail.com).");
        return;
      }
    }

    setSubmitting(true);

    try {
      const unitPrice = prices[selectedClass] || 17;
      const totalAmount = unitPrice * passengersCount;

      // Unique Ticket ID in Ferryhopper / Aviation standard (e.g. MUG-2026-XXXX)
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const uniqueTicketId = `MUG-${new Date().getFullYear().toString().slice(-2)}${randomSuffix}`;
      const tempTxnId = `TXN-FLX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const userId = user?.uid || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const reservationData: Reservation = {
        userId,
        fullName: passengerData.firstName.trim(),
        lastName: passengerData.lastName.trim(),
        phone: passengerData.phone.trim(),
        email: passengerData.email.trim().toLowerCase(),
        itinerary: selectedTrip.itinerary,
        ship: selectedTrip.ship,
        travelDate: departureDate,
        departureTime: selectedTrip.departureTime,
        travelClass: selectedClass,
        passengersCount,
        status: 'PENDING',
        paymentMethod: passengerData.paymentMethod,
        identityNum: passengerData.identityNum.trim(),
        transactionId: tempTxnId,
        amount: totalAmount,
        createdAt: Date.now(),
        ticketId: uniqueTicketId,
        boardingStatus: 'PENDING',
        notes: passengerData.notes.trim()
      };

      // 1. Enregistrement MongoDB Atlas
      let mongoId: string | undefined;
      try {
        const mongoRes = await mongoApi.createReservation(reservationData);
        mongoId = mongoRes?._id || (mongoRes as any)?.id;
      } catch (mErr) {
        console.warn("MongoDB Atlas sync failed, fallback to Firestore:", mErr);
      }

      // 2. Enregistrement Firestore
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

      // 3. Envoi automatique du billet électronique par email si adresse fournie
      if (finalReservation.email) {
        dispatchBookingEmail(finalReservation);
      }

      setCheckoutStep(4);
      window.scrollTo({ top: 100, behavior: 'smooth' });
    } catch (err: any) {
      console.error("Booking error:", err);
      setErrorMessage(err.message || "Impossible de finaliser la réservation. Veuillez vérifier votre connexion.");
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
        setEmailSuccess(`Billet électronique officiel expédié avec succès à ${res.email}`);
      } else {
        setEmailSuccess(`Réservation confirmée. Notification par email en cours de traitement.`);
      }
    } catch {
      setEmailSuccess(`Réservation enregistrée. Le billet est disponible ci-dessous.`);
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
      // First attempt lookup via mongoApi
      try {
        const mongoReservations = await mongoApi.getReservations();
        const found = mongoReservations.find((r: any) => 
          (r.ticketId && r.ticketId.toUpperCase() === cleanQ.toUpperCase()) ||
          (r.phone && r.phone.includes(cleanQ)) ||
          (r.email && r.email.toLowerCase() === cleanQ.toLowerCase())
        );
        if (found) {
          setLookupResult(found);
          setLookupLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Mongo lookup error, fallback to firestore:", err);
      }

      setLookupError("Aucune réservation trouvée correspondant à cette référence ou numéro.");
    } catch (err: any) {
      setLookupError("Erreur lors de la recherche du billet. Veuillez réessayer.");
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 pb-20 text-left font-sans">
      
      {/* --- HERO FERRYHOPPER / CHEAPOAIR SEARCH BANNER --- */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-r from-[#001f3f] via-[#003366] to-[#001f3f] text-white p-6 sm:p-10 border border-white/10">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/15 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-400/20 text-sky-300 text-xs font-bold tracking-wide uppercase mb-2">
                <Ship size={14} className="text-sky-300" />
                Liaison Maritime Officielle Lac Kivu
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                Réservez vos Billets de Bateau
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-1">
                Traversées régulières et rapides entre Bukavu et Goma • Billets électroniques avec QR code instantané
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowLookupModal(true)}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 border border-white/20 backdrop-blur-sm"
              >
                <Search size={14} className="text-sky-300" />
                Retrouver mon Billet
              </button>
            </div>
          </div>

          {/* --- SEARCH WIDGET CARD (FERRYHOPPER STYLE) --- */}
          <div className="bg-white text-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl border border-slate-100">
            {/* Trip Type Tabs & Devise DANS le formulaire */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTripType('one-way')}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer",
                    tripType === 'one-way'
                      ? "bg-[#002b49] text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  Aller simple
                </button>
                <button
                  type="button"
                  onClick={() => setTripType('round-trip')}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer",
                    tripType === 'round-trip'
                      ? "bg-[#002b49] text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  Aller-retour
                </button>
              </div>

              {/* Sélecteur de devise DANS le formulaire de réservation */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 px-1 uppercase">Devise :</span>
                <button
                  type="button"
                  onClick={() => setBookingCurrency('USD')}
                  className={cn(
                    "px-2.5 py-1 text-xs font-black rounded-lg transition cursor-pointer",
                    bookingCurrency === 'USD' ? "bg-white text-blue-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setBookingCurrency('CDF')}
                  className={cn(
                    "px-2.5 py-1 text-xs font-black rounded-lg transition cursor-pointer",
                    bookingCurrency === 'CDF' ? "bg-white text-blue-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  CDF (FC)
                </button>
              </div>
            </div>

            {/* Segmented Inputs Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              
              {/* Origin Port */}
              <div className="sm:col-span-3 bg-slate-50 hover:bg-slate-100/80 transition p-3 rounded-xl border border-slate-200 relative">
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Départ de
                </label>
                <div className="flex items-center gap-2 mt-0.5">
                  <MapPin size={16} className="text-sky-600 shrink-0" />
                  <select
                    value={origin}
                    onChange={(e) => {
                      const newOrig = e.target.value as 'Bukavu' | 'Goma';
                      setOrigin(newOrig);
                      setDestination(newOrig === 'Bukavu' ? 'Goma' : 'Bukavu');
                    }}
                    className="w-full bg-transparent font-bold text-sm text-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="Bukavu">Bukavu (Port Ihusi)</option>
                    <option value="Goma">Goma (Port Public)</option>
                  </select>
                </div>
              </div>

              {/* Swap Button */}
              <div className="sm:col-span-1 flex justify-center">
                <button
                  type="button"
                  onClick={handleSwapPorts}
                  title="Inverser les ports"
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-600 border border-slate-200 flex items-center justify-center transition shadow-sm"
                >
                  <ArrowLeftRight size={16} />
                </button>
              </div>

              {/* Destination Port */}
              <div className="sm:col-span-3 bg-slate-50 hover:bg-slate-100/80 transition p-3 rounded-xl border border-slate-200">
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Arrivée à
                </label>
                <div className="flex items-center gap-2 mt-0.5">
                  <MapPin size={16} className="text-amber-500 shrink-0" />
                  <select
                    value={destination}
                    onChange={(e) => {
                      const newDest = e.target.value as 'Bukavu' | 'Goma';
                      setDestination(newDest);
                      setOrigin(newDest === 'Bukavu' ? 'Goma' : 'Bukavu');
                    }}
                    className="w-full bg-transparent font-bold text-sm text-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="Goma">Goma (Port Public)</option>
                    <option value="Bukavu">Bukavu (Port Ihusi)</option>
                  </select>
                </div>
              </div>

              {/* Departure Date */}
              <div className="sm:col-span-3 bg-slate-50 hover:bg-slate-100/80 transition p-3 rounded-xl border border-slate-200">
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Date de départ
                </label>
                <div className="flex items-center gap-2 mt-0.5">
                  <Calendar size={16} className="text-sky-600 shrink-0" />
                  <input
                    type="date"
                    min={getTodayStr()}
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full bg-transparent font-bold text-sm text-slate-900 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Search CTA Button */}
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutStep(1);
                    const el = document.getElementById('ferryhopper-results-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full h-full min-h-[52px] bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold rounded-xl text-sm uppercase tracking-wider transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Search size={18} />
                  <span>Rechercher</span>
                </button>
              </div>

            </div>

            {/* Quick Date Pills under search */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 overflow-x-auto text-xs">
              <span className="text-slate-400 font-bold whitespace-nowrap text-[11px]">Départs rapides :</span>
              {[
                { label: "Aujourd'hui", val: getTodayStr() },
                { label: "Demain", val: getRelativeDate(1) },
                { label: "Après-demain", val: getRelativeDate(2) },
                { label: "Dans 3 jours", val: getRelativeDate(3) }
              ].map(d => (
                <button
                  key={d.val}
                  type="button"
                  onClick={() => setDepartureDate(d.val)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition",
                    departureDate === d.val
                      ? "bg-sky-100 text-sky-900 font-bold border border-sky-300"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {d.label} ({formatDisplayDate(d.val)})
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- STEPPER BREADCRUMB (FERRYHOPPER STYLE) --- */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => setCheckoutStep(1)}
            className={cn(
              "flex items-center gap-2 text-xs font-bold transition",
              checkoutStep >= 1 ? "text-sky-700" : "text-slate-400"
            )}
          >
            <span className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold",
              checkoutStep > 1 ? "bg-emerald-500 text-white" : checkoutStep === 1 ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-500"
            )}>
              {checkoutStep > 1 ? "✓" : "1"}
            </span>
            <span>1. Traversée & Bateau</span>
          </button>

          <div className={cn("h-0.5 flex-1 mx-4", checkoutStep >= 2 ? "bg-sky-600" : "bg-slate-200")} />

          <button
            type="button"
            onClick={() => selectedTrip && setCheckoutStep(2)}
            disabled={!selectedTrip}
            className={cn(
              "flex items-center gap-2 text-xs font-bold transition disabled:opacity-50",
              checkoutStep >= 2 ? "text-sky-700" : "text-slate-400"
            )}
          >
            <span className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold",
              checkoutStep > 2 ? "bg-emerald-500 text-white" : checkoutStep === 2 ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-500"
            )}>
              {checkoutStep > 2 ? "✓" : "2"}
            </span>
            <span>2. Passagers</span>
          </button>

          <div className={cn("h-0.5 flex-1 mx-4", checkoutStep >= 3 ? "bg-sky-600" : "bg-slate-200")} />

          <div className={cn(
            "flex items-center gap-2 text-xs font-bold",
            checkoutStep === 4 ? "text-emerald-600" : "text-slate-400"
          )}>
            <span className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold",
              checkoutStep === 4 ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
            )}>
              {checkoutStep === 4 ? "✓" : "3"}
            </span>
            <span>3. Billet Électronique</span>
          </div>
        </div>
      </div>

      {/* --- ERROR MESSAGE DISPLAY --- */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs font-bold flex items-center gap-3">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- STEP 1: SEARCH RESULTS & DEPARTURES LISTING (FERRYHOPPER CARDS) --- */}
      {/* ========================================================================= */}
      {checkoutStep === 1 && (
        <div id="ferryhopper-results-section" className="space-y-6">
          
          {/* Summary & Filter Bar */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Traversées disponibles : {origin} ➔ {destination}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Date : <span className="font-bold text-slate-800">{formatDisplayDate(departureDate)}</span> ({departureDate}) • {matchingTrips.length} départs trouvés
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setTimeFilter('all')}
                  className={cn(
                    "px-3 py-1 rounded-lg font-semibold transition",
                    timeFilter === 'all' ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Tous
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilter('morning')}
                  className={cn(
                    "px-3 py-1 rounded-lg font-semibold transition",
                    timeFilter === 'morning' ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Matin (07h30)
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilter('afternoon')}
                  className={cn(
                    "px-3 py-1 rounded-lg font-semibold transition",
                    timeFilter === 'afternoon' ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Soir (18h00)
                </button>
              </div>

              <select
                value={shipFilter}
                onChange={(e) => setShipFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">Tous les Navires</option>
                <option value="Mugote 1">Mugote 1 (Express)</option>
                <option value="Mugote 2">Mugote 2</option>
                <option value="Mugote 3">Mugote 3</option>
              </select>
            </div>
          </div>

          {/* Ferry Cards Listing */}
          {matchingTrips.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
              <Ship size={48} className="mx-auto text-slate-300" />
              <h3 className="text-lg font-extrabold text-slate-700">Aucun départ ne correspond à vos filtres</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Veuillez modifier vos filtres d'heure ou changer le sens du trajet pour consulter les traversées disponibles.
              </p>
              <button
                type="button"
                onClick={() => { setTimeFilter('all'); setShipFilter('all'); }}
                className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {matchingTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-sky-300 hover:shadow-lg transition-all p-5 sm:p-6 space-y-5"
                >
                  {/* Card Header: Ship name, Company, and badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center font-black">
                        <Ship size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-slate-900">{trip.ship}</h3>
                          <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                            {trip.shipType}
                          </span>
                          {trip.recommended && (
                            <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Star size={10} className="fill-amber-600 text-amber-600" /> Le plus rapide
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium">ETS AMR MUGOTE & SES FRÈRES • Navigation Lacustre</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1"><Luggage size={14} className="text-slate-400" /> Bagage 25kg inclus</span>
                      <span className="flex items-center gap-1"><Wifi size={14} className="text-slate-400" /> Wi-Fi à bord</span>
                    </div>
                  </div>

                  {/* Route & Times Timeline (Ferryhopper style) */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    
                    {/* Departure info */}
                    <div className="sm:col-span-3">
                      <p className="text-2xl font-black text-slate-900 tracking-tight">{trip.departureTime}</p>
                      <p className="text-xs font-bold text-slate-700">{origin}</p>
                      <p className="text-[11px] text-slate-400">{trip.originPort}</p>
                    </div>

                    {/* Progress Duration Graphic */}
                    <div className="sm:col-span-6 flex flex-col items-center justify-center px-4">
                      <div className="flex items-center justify-between w-full text-[11px] text-slate-400 font-semibold mb-1">
                        <span>Traversée directe</span>
                        <span className="text-sky-700 font-bold">{trip.duration}</span>
                      </div>
                      <div className="relative w-full flex items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-900 shrink-0" />
                        <div className="h-0.5 flex-1 bg-slate-300 relative">
                          <Ship size={14} className="absolute left-1/2 -top-2 text-sky-600 -translate-x-1/2" />
                        </div>
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Lac Kivu • Express</p>
                    </div>

                    {/* Arrival info */}
                    <div className="sm:col-span-3 text-left sm:text-right">
                      <p className="text-2xl font-black text-slate-900 tracking-tight">{trip.arrivalTime}</p>
                      <p className="text-xs font-bold text-slate-700">{destination}</p>
                      <p className="text-[11px] text-slate-400">{trip.destinationPort}</p>
                    </div>

                  </div>

                  {/* Class Selection Pills embedded in Card (Ferryhopper seat selector) */}
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-2">
                      Choisissez votre classe :
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { cls: '3ème Classe' as TravelClass, label: 'Économique', desc: 'Pont principal' },
                        { cls: '2ème Classe' as TravelClass, label: 'Standard', desc: 'Salon intérieur' },
                        { cls: '1ère Classe' as TravelClass, label: '1ère Classe', desc: 'Salon climatisé' },
                        { cls: 'VIP' as TravelClass, label: 'VIP Salon', desc: 'Confort exclusif' }
                      ].map(item => {
                        const price = prices[item.cls];
                        const isChosen = selectedClass === item.cls;
                        return (
                          <div
                            key={item.cls}
                            onClick={() => setSelectedClass(item.cls)}
                            className={cn(
                              "p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between",
                              isChosen
                                ? "bg-sky-50 border-sky-500 shadow-sm ring-1 ring-sky-500"
                                : "bg-slate-50 border-slate-200 hover:bg-slate-100/70"
                            )}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs font-bold text-slate-900">{item.cls}</p>
                                <p className="text-[10px] text-slate-500">{item.desc}</p>
                              </div>
                              {isChosen && <Check size={14} className="text-sky-600 shrink-0" />}
                            </div>
                            <div className="mt-2 text-right">
                              <span className="text-sm font-black text-slate-900">{price}$</span>
                              <span className="text-[10px] text-slate-500 ml-1">/ pers.</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* CTA Action Bottom Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100 bg-slate-50/50 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 p-4 rounded-b-2xl">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Prix pour {passengersCount} passager(s) en <span className="font-bold text-slate-800">{selectedClass}</span> :</span>
                      <span className="text-xl font-black text-slate-900 font-mono">
                        {prices[selectedClass] * passengersCount}$
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectTrip(trip)}
                      className="px-6 py-3 bg-[#002b49] hover:bg-[#001f35] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Sélectionner cette traversée</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* --- STEP 2: PASSENGER INFORMATION & DETAILS (FERRYHOPPER CHECKOUT) --- */}
      {/* ========================================================================= */}
      {checkoutStep === 2 && selectedTrip && (
        <div className="space-y-6">
          
          {/* Trip Header Recap Box */}
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-sky-800 tracking-wider">Traversée Sélectionnée</span>
              <h3 className="text-lg font-black text-sky-950">
                {selectedTrip.ship} • {selectedTrip.itinerary.replace('-', ' ➔ ')} à {selectedTrip.departureTime}
              </h3>
              <p className="text-xs text-sky-800 font-medium mt-0.5">
                Date : {formatDisplayDate(departureDate)} • Classe : <span className="font-bold">{selectedClass}</span> • {passengersCount} passager(s)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs text-sky-700 block">Montant Total</span>
                <span className="text-xl font-black text-sky-950 font-mono">{prices[selectedClass] * passengersCount}$</span>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutStep(1)}
                className="px-3 py-1.5 bg-white border border-sky-300 text-sky-800 rounded-lg text-xs font-bold hover:bg-sky-100 transition"
              >
                Modifier
              </button>
            </div>
          </div>

          <form onSubmit={handleCreateBooking} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900">Coordonnées du Passager Principal</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Veuillez renseigner les informations exactes telles qu'elles figurent sur la pièce d'identité pour le contrôle portuaire.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wide mb-1">
                  Prénom <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={passengerData.firstName}
                  onChange={(e) => setPassengerData({ ...passengerData, firstName: e.target.value })}
                  placeholder="Ex: David"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wide mb-1">
                  Nom / Post-nom <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={passengerData.lastName}
                  onChange={(e) => setPassengerData({ ...passengerData, lastName: e.target.value })}
                  placeholder="Ex: Mugisho"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wide mb-1">
                  Téléphone Mobile Money (RDC ou Int.) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-slate-400"><Phone size={16} /></span>
                  <input
                    type="tel"
                    required
                    value={passengerData.phone}
                    onChange={(e) => setPassengerData({ ...passengerData, phone: e.target.value })}
                    placeholder="0994102673 ou +243..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Numéro utilisé pour la confirmation et le débit Mobile Money</p>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wide mb-1">
                  Adresse Email (Gmail recommandé) <span className="text-sky-600 font-bold">(Pour recevoir le e-billet)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-slate-400"><Mail size={16} /></span>
                  <input
                    type="email"
                    value={passengerData.email}
                    onChange={(e) => setPassengerData({ ...passengerData, email: e.target.value })}
                    placeholder="passager@gmail.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Votre billet avec QR code y sera envoyé instantanément</p>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wide mb-1">
                  Numéro Pièce d'Identité (Optionnel)
                </label>
                <input
                  type="text"
                  value={passengerData.identityNum}
                  onChange={(e) => setPassengerData({ ...passengerData, identityNum: e.target.value })}
                  placeholder="Carte d'électeur ou passeport..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wide mb-1">
                  Mode de Paiement Préféré
                </label>
                <select
                  value={passengerData.paymentMethod}
                  onChange={(e) => setPassengerData({ ...passengerData, paymentMethod: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="Vodacom M-Pesa">Vodacom M-Pesa (+243 816 680 709)</option>
                  <option value="Airtel Money">Airtel Money (+243 994 102 673)</option>
                  <option value="Orange Money">Orange Money (+243 994 102 673)</option>
                  <option value="Guichet Portuaire">Paiement en espèces au guichet du port</option>
                </select>
              </div>
            </div>

            {/* Passengers Count Selector */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Nombre de Passagers</p>
                <p className="text-[11px] text-slate-400">Voyagez-vous seul ou en groupe ?</p>
              </div>

              <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPassengersCount(Math.max(1, passengersCount - 1))}
                  className="w-8 h-8 rounded-lg bg-white shadow-sm font-black text-slate-800 text-sm flex items-center justify-center hover:bg-slate-200 transition"
                >
                  -
                </button>
                <span className="font-extrabold text-slate-900 text-sm px-3">{passengersCount} place(s)</span>
                <button
                  type="button"
                  onClick={() => setPassengersCount(Math.min(10, passengersCount + 1))}
                  className="w-8 h-8 rounded-lg bg-[#002b49] text-white shadow-sm font-black text-sm flex items-center justify-center hover:bg-slate-800 transition"
                >
                  +
                </button>
              </div>
            </div>

            {/* Transparent Pricing Summary Box */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>{passengersCount}x Billet {selectedClass} ({selectedTrip.itinerary})</span>
                <span className="font-mono font-bold text-slate-900">{prices[selectedClass] * passengersCount}.00 $</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Taxes portuaires & Sécurité maritime lacustre</span>
                <span className="font-bold text-emerald-600">Incluses</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Bagage cabine (25 kg)</span>
                <span className="font-bold text-emerald-600">Inclus</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-extrabold text-slate-900">
                <span>Total à Payer :</span>
                <span className="text-xl font-black text-slate-900 font-mono">
                  {prices[selectedClass] * passengersCount}.00 $
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCheckoutStep(1)}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50 transition"
              >
                Retour aux départs
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:flex-1 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Création du billet en cours...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Confirmer la Réservation & Obtenir mon Billet</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- STEP 4: CONFIRMATION & OFFICIAL E-TICKET (FERRYHOPPER STYLE) --- */}
      {/* ========================================================================= */}
      {checkoutStep === 4 && confirmedReservation && (
        <div className="space-y-6">
          
          {/* Top Success Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <Check size={24} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Réservation Validée avec Succès</span>
                <h2 className="text-xl font-black text-emerald-950">
                  Votre Billet Électronique est Prêt !
                </h2>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Référence Billet : <span className="font-mono font-bold">{confirmedReservation.ticketId}</span> • Présentez ce QR Code au port d'embarquement.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-white text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 transition flex items-center gap-1.5 shadow-sm"
              >
                <Printer size={14} />
                Imprimer
              </button>
            </div>
          </div>

          {emailSuccess && (
            <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
              <Mail size={16} className="text-blue-600 shrink-0" />
              <span>{emailSuccess}</span>
            </div>
          )}

          {/* E-TICKET VISUAL BOARDING PASS (FERRYHOPPER CARD) */}
          <div className="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-2xl max-w-3xl mx-auto">
            
            {/* Ticket Header */}
            <div className="bg-gradient-to-r from-[#001f3f] to-[#003366] text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-400">
                  <Ship size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">ETS AMR MUGOTE & SES FRÈRES</h3>
                  <p className="text-[11px] text-slate-300 font-medium">BILLET ÉLECTRONIQUE OFFICIEL • LAC KIVU</p>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[10px] uppercase font-bold text-slate-300 block">Numéro Billet</span>
                <span className="text-lg font-black font-mono text-amber-400 tracking-wider">
                  #{confirmedReservation.ticketId}
                </span>
              </div>
            </div>

            {/* Ticket Body with Details and QR Code */}
            <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              
              {/* Trip Data */}
              <div className="md:col-span-8 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Passager</span>
                    <p className="text-sm font-black text-slate-900">{confirmedReservation.fullName} {confirmedReservation.lastName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Téléphone</span>
                    <p className="text-sm font-mono font-bold text-slate-800">{confirmedReservation.phone}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Trajet & Navire</span>
                    <p className="text-sm font-extrabold text-sky-900">{confirmedReservation.itinerary} ({confirmedReservation.ship})</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Classe & Places</span>
                    <p className="text-sm font-extrabold text-slate-800">{confirmedReservation.travelClass} ({confirmedReservation.passengersCount} place(s))</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Date de Voyage</span>
                    <p className="text-sm font-bold text-slate-800">{formatDisplayDate(confirmedReservation.travelDate)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Heure de Départ</span>
                    <p className="text-sm font-black text-sky-900">{confirmedReservation.departureTime}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Montant Payé</span>
                    <p className="text-base font-black text-emerald-600 font-mono">{confirmedReservation.amount}.00 $</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Statut Embarquement</span>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                      ENREGISTRÉ AU PORT
                    </span>
                  </div>
                </div>

                {/* Notice */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] text-slate-600 flex items-start gap-2">
                  <Info size={16} className="text-sky-600 shrink-0 mt-0.5" />
                  <span>Présentez-vous au port d'embarquement 45 minutes avant le départ muni d'une pièce d'identité valide.</span>
                </div>
              </div>

              {/* QR Code Scannable */}
              <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">SCANNER CONTRÔLE PORT</p>
                <div className="p-2 bg-white rounded-xl shadow-inner border border-slate-200">
                  <QRCodeSVG
                    value={JSON.stringify({
                      ticketId: confirmedReservation.ticketId,
                      passenger: `${confirmedReservation.fullName} ${confirmedReservation.lastName}`,
                      ship: confirmedReservation.ship,
                      itinerary: confirmedReservation.itinerary,
                      date: confirmedReservation.travelDate,
                      class: confirmedReservation.travelClass,
                      amount: confirmedReservation.amount
                    })}
                    size={130}
                    level="H"
                  />
                </div>
                <p className="text-[9px] text-slate-400 text-center mt-2 font-mono">
                  #{confirmedReservation.ticketId}
                </p>
              </div>

            </div>

            {/* Ticket Footer with Actions */}
            <div className="bg-slate-50 p-4 sm:p-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {confirmedReservation.email && (
                  <button
                    type="button"
                    disabled={emailSending}
                    onClick={() => dispatchBookingEmail(confirmedReservation)}
                    className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Mail size={14} />
                    {emailSending ? "Envoi..." : "Renvoyer par Email"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (onViewAllTickets) {
                      onViewAllTickets();
                    } else {
                      setCheckoutStep(1);
                    }
                  }}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Ticket size={14} />
                  Mes Réservations
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCheckoutStep(1);
                  setSelectedTrip(null);
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                + Nouvelle réservation
              </button>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* --- LOOKUP MODAL ("RETROUVER MON BILLET" - FERRYHOPPER STYLE) --- */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showLookupModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                    <Search size={18} />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">Retrouver ma Réservation</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLookupModal(false)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleLookupTicket} className="space-y-3">
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wide">
                  Référence du Billet (ex: MUG-2684) ou Numéro de Téléphone :
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    placeholder="MUG-XXXX ou 0994102673"
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    disabled={lookupLoading}
                    className="px-5 py-3 bg-slate-900 hover:bg-black text-white font-bold text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-50"
                  >
                    {lookupLoading ? "Recherche..." : "Vérifier"}
                  </button>
                </div>
              </form>

              {lookupError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                  {lookupError}
                </div>
              )}

              {lookupResult && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Passager</span>
                      <p className="text-sm font-black text-slate-900">{lookupResult.fullName} {lookupResult.lastName}</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                      {lookupResult.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Trajet :</span>
                      <span className="font-bold text-slate-800">{lookupResult.itinerary}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Navire :</span>
                      <span className="font-bold text-slate-800">{lookupResult.ship}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Date :</span>
                      <span className="font-bold text-slate-800">{lookupResult.travelDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">N° Billet :</span>
                      <span className="font-mono font-bold text-sky-800">#{lookupResult.ticketId}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedReservation(lookupResult);
                      setCheckoutStep(4);
                      setShowLookupModal(false);
                    }}
                    className="w-full py-2.5 bg-[#002b49] text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-900 transition mt-2"
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

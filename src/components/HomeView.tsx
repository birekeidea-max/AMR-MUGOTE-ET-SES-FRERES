import React, { useState, useEffect } from 'react';
import { 
  Ship, 
  Ticket, 
  Clock, 
  MapPin, 
  Calendar, 
  Users, 
  Search, 
  ArrowRightLeft, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  CreditCard, 
  QrCode, 
  ChevronRight, 
  Phone, 
  Mail, 
  User, 
  AlertCircle,
  Smartphone,
  Anchor,
  Compass,
  ArrowRight,
  LogOut,
  Sun,
  Waves
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CompactBookingModal } from './CompactBookingModal';
import { CompactBookingForm } from './CompactBookingForm';

interface HomeViewProps {
  onBook: () => void;
  onNavigate: (page: string) => void;
  siteSettings: any;
  schedules?: any[];
  user: FirebaseUser | null;
  onLoginRequest?: () => void;
  onLogout?: () => void;
  onOpenScanner?: () => void;
}

export function HomeView({ 
  onBook, 
  onNavigate, 
  siteSettings, 
  schedules = [],
  user, 
  onLoginRequest, 
  onLogout,
  onOpenScanner 
}: HomeViewProps) {
  // Compteurs réels auto-incrémentés depuis Firestore en direct
  const [realPaxCount, setRealPaxCount] = useState<number>(0);
  const [realBookingsCount, setRealBookingsCount] = useState<number>(0);

  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'reservations'), (snapshot) => {
        setRealBookingsCount(snapshot.size);
        let sum = 0;
        snapshot.forEach((doc) => {
          const data = doc.data();
          sum += (Number(data.passengersCount) || 1);
        });
        setRealPaxCount(sum);
      }, (err) => {
        console.warn("Firestore live reservations counter error:", err);
      });
      return () => unsub();
    } catch (e) {
      console.warn("Firestore counter initialization failed:", e);
    }
  }, []);

  // Widget de recherche rapide Hero
  const [tripType, setTripType] = useState<'one-way' | 'round-trip'>('one-way');
  const [departurePort, setDeparturePort] = useState('Goma (Port Public)');
  const [arrivalPort, setArrivalPort] = useState('Bukavu (Beach Muanzi)');
  const [searchDate, setSearchDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    return today.toISOString().split('T')[0];
  });
  const [passengerCount, setPassengerCount] = useState(1);
  const [selectedClass, setSelectedClass] = useState<'Standard' | 'Business' | 'VIP'>('Standard');

  // Filtres des traversées : Matin (07h30) vs Soir (18h00) & Direction
  const [timePeriodFilter, setTimePeriodFilter] = useState<'all' | 'matin' | 'soir'>('all');
  const [crossingFilter, setCrossingFilter] = useState<'all' | 'GOM-BKV' | 'BKV-GOM'>('all');

  // Modale de réservation compacte
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalParams, setModalParams] = useState({
    trajet: 'Goma ➔ Bukavu',
    boat: 'M/V MUGOTE I',
    classe: 'standard' as 'standard' | 'business' | 'vip'
  });

  // Swap des ports Départ ⇄ Arrivée
  const handleSwapPorts = () => {
    const temp = departurePort;
    setDeparturePort(arrivalPort);
    setArrivalPort(temp);
  };

  // Ouverture de la réservation pour une traversée spécifique
  const handleBookCrossing = (crossingTrajet: string, boatName: string, defaultClass: 'standard' | 'business' | 'vip') => {
    setModalParams({
      trajet: crossingTrajet,
      boat: boatName,
      classe: defaultClass
    });
    setIsModalOpen(true);
  };

  // Helper capacité officielle : MV Mugote 1 : 200, MV Mugote 2 : 300, MV Mugote 3 : 400
  const getCapacityForShip = (shipName: string): number => {
    const s = (shipName || '').toLowerCase();
    if (s.includes('1') || (s.includes('i') && !s.includes('ii') && !s.includes('iii'))) return 200;
    if (s.includes('2') || (s.includes('ii') && !s.includes('iii'))) return 300;
    if (s.includes('3') || s.includes('iii')) return 400;
    return 300;
  };

  // Horaires officiels programmés depuis la console d'administration ou base 07h30 & 18h00
  const baseSchedules = (schedules && schedules.length > 0) ? schedules : [
    { from: 'Goma', to: 'Bukavu', time: '07:30', ship: 'M/V MUGOTE I', days: 'Tous les jours' },
    { from: 'Bukavu', to: 'Goma', time: '07:30', ship: 'M/V MUGOTE II', days: 'Tous les jours' },
    { from: 'Goma', to: 'Bukavu', time: '18:00', ship: 'M/V MUGOTE III', days: 'Tous les jours' },
    { from: 'Bukavu', to: 'Goma', time: '18:00', ship: 'M/V MUGOTE I', days: 'Tous les jours' }
  ];

  // Construction des traversées réactives aux réglages d'administration
  const crossings = baseSchedules.map((s, idx) => {
    const rawTime = (s.time || '07:30').replace('h', ':').replace(' AM', '').replace(' PM', '').trim();
    const hour = parseInt(rawTime.split(':')[0] || '7', 10);
    const isMatin = hour < 12;
    const period: 'matin' | 'soir' = isMatin ? 'matin' : 'soir';

    const fromCity = (s.from || '').toLowerCase().includes('gom') ? 'Goma' : 'Bukavu';
    const toCity = fromCity === 'Goma' ? 'Bukavu' : 'Goma';
    const direction = fromCity === 'Goma' ? 'GOM-BKV' : 'BKV-GOM';

    const boat = s.ship || (isMatin ? (fromCity === 'Goma' ? 'M/V MUGOTE I' : 'M/V MUGOTE II') : (fromCity === 'Goma' ? 'M/V MUGOTE III' : 'M/V MUGOTE I'));
    const capacity = getCapacityForShip(boat);

    return {
      id: s.id || `cr-${idx}`,
      boat,
      capacity,
      departureTime: s.time || (isMatin ? '07:30' : '18:00'),
      arrivalTime: isMatin ? '12:30' : '06:00 (+1)',
      period,
      departureCity: fromCity,
      departurePortName: fromCity === 'Goma' ? 'Port Public de Goma' : 'Port MUGOTE (Beach Muhanzi)',
      arrivalCity: toCity,
      arrivalPortName: toCity === 'Goma' ? 'Port Public de Goma' : 'Port MUGOTE (Beach Muhanzi)',
      status: isMatin ? 'Départ Matin (07h30 ➔ 12h30)' : 'Départ Soir (18h00 ➔ 06h00 +1)',
      statusColor: 'bg-slate-100 text-slate-800 border-slate-300',
      statusDot: 'bg-slate-700',
      direction,
      days: s.days || 'Quotidien',
      prices: { eco: 10, standard: 17, vip: 27 },
      seatsLeft: Math.max(14, capacity - 22)
    };
  });

  // Filtrage combiné (Matin 07h30 / Soir 18h00 & Direction)
  const filteredCrossings = crossings.filter(c => {
    if (crossingFilter !== 'all' && c.direction !== crossingFilter) return false;
    if (timePeriodFilter !== 'all' && c.period !== timePeriodFilter) return false;
    return true;
  });

  return (
    <div className="w-full text-slate-900 antialiased space-y-10 pb-16 pt-1 text-left" id="modern-mugote-home">

      {/* ========================================================= */}
      {/* ACCUEIL : HERO BANNER & RECHERCHE AVANCÉE ÉPURÉE         */}
      {/* Sans encombrement : session affichée exclusivement dans l'en-tête */}
      {/* ========================================================= */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 space-y-8">
        
        {/* BANNIÈRE HERO BLEU DE NUIT */}
        <div className="bg-gradient-to-br from-[#0b132b] via-[#1c2541] to-[#0b132b] rounded-3xl p-6 sm:p-9 shadow-2xl relative overflow-hidden text-white border border-white/10">
          
          {/* Motifs géométriques décoratifs légers en arrière-plan */}
          <div className="absolute -right-24 -top-24 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-white/5 rounded-full blur-2xl pointer-events-none" />

          {/* Badge officiel de liaison */}
          <div className="relative z-10 flex flex-wrap items-center gap-3 mb-4">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-white font-bold text-[11px] sm:text-xs">
                Liaisons Quotidiennes • 07h30 (Matin ➔ 12h30) & 18h00 (Soir ➔ 06h00 +1)
              </span>
            </div>
            
            <div className="hidden sm:inline-flex items-center gap-1.5 text-xs text-white font-bold bg-white/10 border border-white/20 px-3 py-1 rounded-full">
              <ShieldCheck size={14} />
              <span>Flotte homologuée & gilets certifiés</span>
            </div>
          </div>

              {/* Titre & Description Hero */}
              <div className="relative z-10 max-w-2xl mb-6">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight text-white">
                  Voyagez en toute sécurité sur le Lac Kivu
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
                  ETS AMR MUGOTE & FRÈRES assure vos traversées quotidiennes entre <strong>Goma</strong> et <strong>Bukavu</strong> à bord de vedettes rapides et confortables.
                </p>

                {/* Bouton de réservation Hero proéminent */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onBook}
                    className="px-6 py-3 bg-white hover:bg-slate-100 active:scale-95 text-slate-950 font-black rounded-2xl shadow-lg shadow-black/25 flex items-center gap-2 text-xs uppercase tracking-wider transition cursor-pointer"
                  >
                    <Ticket size={18} />
                    <span>Réserver un billet maintenant</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('tarifs')}
                    className="px-4 py-3 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold rounded-2xl border border-white/20 text-xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Clock size={16} />
                    <span>Voir tous les horaires</span>
                  </button>
                </div>
              </div>

              {/* WIDGET BLANC ENCASTRÉ DE RECHERCHE DE BILLETS */}
              <div className="relative z-10 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl text-slate-900 border border-slate-100">
                
                {/* Commutateur Aller simple / Aller-retour */}
                <div className="flex items-center gap-4 mb-4 pb-3 border-b border-slate-100">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input 
                      type="radio" 
                      name="tripType" 
                      checked={tripType === 'one-way'} 
                      onChange={() => setTripType('one-way')}
                      className="w-4 h-4 text-[#0b132b] focus:ring-slate-700"
                    />
                    <span>Aller simple</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input 
                      type="radio" 
                      name="tripType" 
                      checked={tripType === 'round-trip'} 
                      onChange={() => setTripType('round-trip')}
                      className="w-4 h-4 text-[#0b132b] focus:ring-slate-700"
                    />
                    <span>Aller-retour</span>
                  </label>
                </div>

                {/* Grille avec 4 champs bien délimités + Bouton Swap */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  
                  {/* Départ */}
                  <div className="md:col-span-3 bg-slate-50 hover:bg-slate-100/80 p-3 rounded-2xl border border-slate-200 transition">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Départ
                    </label>
                    <div className="flex items-center gap-2">
                      <MapPin size={18} className="text-[#0b132b] shrink-0" />
                      <select 
                        value={departurePort}
                        onChange={(e) => setDeparturePort(e.target.value)}
                        className="w-full bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer truncate"
                      >
                        <option value="Goma (Port Public)">Goma (Port Public)</option>
                        <option value="Bukavu (Beach Muanzi)">Bukavu (Beach Muanzi)</option>
                        <option value="Île d'Idjwi">Île d'Idjwi</option>
                      </select>
                    </div>
                  </div>

                  {/* Bouton Swap (⇄) */}
                  <div className="hidden md:flex md:col-span-1 justify-center">
                    <button
                      type="button"
                      onClick={handleSwapPorts}
                      title="Inverser départ et arrivée"
                      className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center justify-center transition shadow-xs cursor-pointer active:scale-90"
                    >
                      <ArrowRightLeft size={16} />
                    </button>
                  </div>

                  {/* Destination */}
                  <div className="md:col-span-3 bg-slate-50 hover:bg-slate-100/80 p-3 rounded-2xl border border-slate-200 transition">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Destination
                    </label>
                    <div className="flex items-center gap-2">
                      <MapPin size={18} className="text-[#0b132b] shrink-0" />
                      <select 
                        value={arrivalPort}
                        onChange={(e) => setArrivalPort(e.target.value)}
                        className="w-full bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer truncate"
                      >
                        <option value="Bukavu (Beach Muanzi)">Bukavu (Beach Muanzi)</option>
                        <option value="Goma (Port Public)">Goma (Port Public)</option>
                        <option value="Île d'Idjwi">Île d'Idjwi</option>
                      </select>
                    </div>
                  </div>

                  {/* Date de départ */}
                  <div className="md:col-span-2 bg-slate-50 hover:bg-slate-100/80 p-3 rounded-2xl border border-slate-200 transition">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Date
                    </label>
                    <div className="flex items-center gap-2">
                      <Calendar size={18} className="text-[#0b132b] shrink-0" />
                      <input 
                        type="date" 
                        value={searchDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setSearchDate(e.target.value)}
                        className="w-full bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Passagers & Classe */}
                  <div className="md:col-span-3 bg-slate-50 hover:bg-slate-100/80 p-3 rounded-2xl border border-slate-200 transition">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Passagers & Classe
                    </label>
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-[#0b132b] shrink-0" />
                      <select 
                        value={`${passengerCount}-${selectedClass}`}
                        onChange={(e) => {
                          const [count, cls] = e.target.value.split('-');
                          setPassengerCount(Number(count));
                          setSelectedClass(cls as any);
                        }}
                        className="w-full bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer truncate"
                      >
                        <option value="1-Standard">1 Adulte, Classe Standard ($15)</option>
                        <option value="1-Business">1 Adulte, Classe Business ($20)</option>
                        <option value="1-VIP">1 Adulte, Classe VIP ($30)</option>
                        <option value="2-Standard">2 Adultes, Classe Standard ($30)</option>
                        <option value="2-VIP">2 Adultes, Classe VIP ($60)</option>
                        <option value="3-Standard">3 Adultes, Classe Standard ($45)</option>
                        <option value="4-Standard">Famille / Groupe (4 pers.)</option>
                      </select>
                    </div>
                  </div>

                </div>

                {/* Bouton de recherche principal qui redirige directement vers la réservation */}
                <div className="mt-4 pt-3 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Compass size={16} className="text-[#0b132b]" />
                    <span>Traversées express 2h30 à 3h00 • Horaires fixes matin & midi</span>
                  </div>

                  <button
                    type="button"
                    onClick={onBook}
                    className="w-full sm:w-auto px-8 py-3.5 bg-[#0b132b] hover:bg-black active:scale-95 text-white font-black rounded-2xl shadow-lg shadow-black/25 flex items-center justify-center gap-2.5 text-xs uppercase tracking-wider transition cursor-pointer"
                  >
                    <Search size={18} className="stroke-[2.5]" />
                    <span>Rechercher & Réserver</span>
                  </button>
                </div>

              </div>

            </div>

            {/* SECTION DES TRAVERSÉES DISPONIBLES : MATIN (07h30) & SOIR (18h00) */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-800">
                      Horaires Officiels Programmés (Console Admin)
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                    Traversées du Lac Kivu (Matin & Soir)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Départs quotidiens fixes : <strong>Matin à 07h30</strong> et <strong>Soir à 18h00</strong>
                  </p>
                </div>

                {/* Double Filtre : Créneau (Matin/Soir) & Trajet */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Filtre Créneau */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setTimePeriodFilter('all')}
                      className={`px-3 py-1.5 text-xs font-black rounded-xl transition cursor-pointer ${
                        timePeriodFilter === 'all' 
                          ? 'bg-slate-900 text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tous
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimePeriodFilter('matin')}
                      className={`px-3 py-1.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1 ${
                        timePeriodFilter === 'matin' 
                          ? 'bg-black text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Sun size={13} />
                      <span>Matin (07h30)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimePeriodFilter('soir')}
                      className={`px-3 py-1.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1 ${
                        timePeriodFilter === 'soir' 
                          ? 'bg-[#0b132b] text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Clock size={13} />
                      <span>Soir (18h00)</span>
                    </button>
                  </div>

                  {/* Filtre Trajet */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setCrossingFilter('all')}
                      className={`px-2.5 py-1.5 text-xs font-black rounded-xl transition cursor-pointer ${
                        crossingFilter === 'all' 
                          ? 'bg-[#0b132b] text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tous
                    </button>
                    <button
                      type="button"
                      onClick={() => setCrossingFilter('GOM-BKV')}
                      className={`px-2.5 py-1.5 text-xs font-black rounded-xl transition cursor-pointer ${
                        crossingFilter === 'GOM-BKV' 
                          ? 'bg-[#0b132b] text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Goma ➔ Bkv
                    </button>
                    <button
                      type="button"
                      onClick={() => setCrossingFilter('BKV-GOM')}
                      className={`px-2.5 py-1.5 text-xs font-black rounded-xl transition cursor-pointer ${
                        crossingFilter === 'BKV-GOM' 
                          ? 'bg-[#0b132b] text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Bkv ➔ Goma
                    </button>
                  </div>
                </div>
              </div>

              {/* Liste des traversées */}
              <div className="space-y-3">
                {filteredCrossings.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-sm space-y-3">
                    <Clock size={40} className="mx-auto text-slate-300" />
                    <h3 className="text-base font-black text-slate-800">Aucune traversée pour ce filtre</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Les bateaux voyagent uniquement le matin à 07h30 et le soir à 18h00. Vous pouvez ajuster vos filtres ci-dessus ou programmer de nouveaux horaires dans la console d'administration.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setTimePeriodFilter('all'); setCrossingFilter('all'); }}
                      className="px-4 py-2 bg-slate-100 text-slate-800 text-xs font-black rounded-xl hover:bg-slate-200 transition cursor-pointer"
                    >
                      Afficher tous les départs (07h30 & 18h00)
                    </button>
                  </div>
                ) : (
                  filteredCrossings.map((c) => (
                    <div 
                      key={c.id}
                      className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-md border border-slate-200 transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Infos Horaires & Trajet */}
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1.5">
                            <Ship size={13} />
                            {c.boat} • Capacité : {c.capacity} PAX
                          </span>
                          
                          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border flex items-center gap-1.5 ${c.statusColor}`}>
                            <span className={`w-2 h-2 rounded-full ${c.statusDot} animate-pulse`} />
                            {c.status}
                          </span>

                          <span className="text-[11px] font-semibold text-slate-400">
                            • {c.seatsLeft} places disponibles
                          </span>
                        </div>

                        <div className="flex items-center gap-4 sm:gap-6 pt-1">
                          <div>
                            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                              {c.departureTime}
                            </span>
                            <p className="text-xs font-bold text-slate-700">{c.departureCity}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{c.departurePortName}</p>
                          </div>

                          <div className="flex-1 max-w-[140px] sm:max-w-[200px] flex flex-col items-center">
                            <span className="text-[10px] font-bold text-slate-500 mb-0.5">
                              {c.period === 'matin' ? '5h00 directe' : '12h00 • De nuit'}
                            </span>
                            <div className="w-full flex items-center">
                              <div className="w-2.5 h-2.5 rounded-full border-2 border-slate-800 bg-white shrink-0" />
                              <div className="flex-1 h-0.5 bg-slate-200 relative">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-1">
                                  <Ship size={13} className="text-slate-800" />
                                </div>
                              </div>
                              <div className="w-2.5 h-2.5 rounded-full bg-slate-800 shrink-0" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-700 mt-0.5">
                              {c.period === 'matin' ? 'Arrivée 12h30' : 'Arrivée 06h00 (Lendemain)'}
                            </span>
                          </div>

                          <div>
                            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                              {c.arrivalTime}
                            </span>
                            {c.period === 'soir' && (
                              <span className="block text-[9px] font-black text-slate-700 uppercase tracking-tight -mt-0.5">
                                Lendemain
                              </span>
                            )}
                            <p className="text-xs font-bold text-slate-700">{c.arrivalCity}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{c.arrivalPortName}</p>
                          </div>
                        </div>
                      </div>

                      {/* Tarifs & Bouton Réserver pour ce départ */}
                      <div className="border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-5 flex items-center justify-between md:flex-col md:items-end gap-3 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-800 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200" title="Classe Économique">
                            Éco ${c.prices.eco}
                          </span>
                          <span className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-1 rounded-lg border border-slate-300" title="Classe Standard">
                            Std ${c.prices.standard}
                          </span>
                          <span className="text-xs font-black text-slate-900 bg-slate-200 px-2 py-1 rounded-lg border border-slate-300" title="Classe VIP">
                            VIP ${c.prices.vip}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleBookCrossing(
                            c.direction === 'GOM-BKV' ? 'Goma ➔ Bukavu' : 'Bukavu ➔ Goma',
                            c.boat,
                            'standard'
                          )}
                          className="px-5 py-2.5 bg-[#0b132b] hover:bg-black active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Ticket size={15} />
                          <span>Réserver ce départ</span>
                        </button>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </div>

      </div>

      {/* ========================================================= */}
      {/* SECTION LA FLOTTE & SÉCURITÉ MUGOTE                        */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-4">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-800">
            Qualité & Fiabilité Lacustre
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            La Flotte Officielle ETS AMR MUGOTE
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Navires révisés avec moteurs marins puissants, équipages formés et gilets de sauvetage certifiés pour chaque passager.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              name: 'M/V MUGOTE I',
              type: 'Vedette Rapide Passagers',
              capacity: '200 Passagers',
              speed: '28 Nœuds',
              desc: 'Notre navire emblématique avec salon spacieux et vue panoramique sur le Lac Kivu.'
            },
            {
              name: 'M/V MUGOTE II',
              type: 'Vedette Haute Performance',
              capacity: '300 Passagers',
              speed: '30 Nœuds',
              desc: 'Confort optimisé avec climatisation, salon Business et espace VIP exclusif.'
            },
            {
              name: 'M/V MUGOTE III',
              type: 'Grand Express Maritime',
              capacity: '400 Passagers',
              speed: '34 Nœuds',
              desc: 'Navire amiral à haute capacité, liaison express directe Goma ⇄ Bukavu.'
            }
          ].map((boat, idx) => (
            <div 
              key={idx}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-lg transition-all space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#0b132b] text-white flex items-center justify-center font-black">
                <Ship size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">{boat.name}</h3>
                <span className="text-[11px] font-bold text-slate-600 block">{boat.type}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {boat.desc}
              </p>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Capacité : {boat.capacity}</span>
                <span className="text-slate-900">{boat.speed}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MODALE DE RÉSERVATION COMPACTE */}
      <CompactBookingModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={user}
        initialTrajet={modalParams.trajet}
        initialBoat={modalParams.boat}
        initialClass={modalParams.classe}
        onSuccess={() => {
          setIsModalOpen(false);
          onNavigate('tickets');
        }}
      />

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Ship,
  QrCode,
  LayoutDashboard,
  Calendar,
  Compass,
  User,
  HelpCircle,
  Zap,
  Tent,
  Settings,
  Sun,
  Search,
  Bell,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowRight,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  ChevronRight,
  Radio,
  Sparkles,
  ExternalLink,
  Users,
  ChevronDown,
  Navigation,
  Anchor,
  X
} from 'lucide-react';
import { mongoApi } from '../services/api';

export interface ReservationDashboardProps {
  user?: any;
  onNavigate?: (page: string) => void;
  onOpenScanner?: () => void;
  onOpenAdminConsole?: () => void;
  siteSettings?: any;
}

export function ReservationDashboard({
  user,
  onNavigate,
  onOpenScanner,
  onOpenAdminConsole,
  siteSettings
}: ReservationDashboardProps) {
  // Sidebar menu actif
  const [activeMenu, setActiveMenu] = useState<string>('dashboard');

  // État du formulaire de réservation compact
  const [nom, setNom] = useState(() => {
    if (user?.displayName) return user.displayName.split(' ')[0] || '';
    return '';
  });
  const [prenom, setPrenom] = useState(() => {
    if (user?.displayName) return user.displayName.split(' ').slice(1).join(' ') || '';
    return '';
  });
  const [telephone, setTelephone] = useState('+243 ');
  const [email, setEmail] = useState(user?.email || '');
  const [trajet, setTrajet] = useState('Goma ➔ Bukavu');
  const [travelDate, setTravelDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [boat, setBoat] = useState('Mugote 1');
  const [travelClass, setTravelClass] = useState<'economique' | 'standard' | 'vip'>('standard');
  const [billetsCount, setBilletsCount] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'airtel' | 'orange' | 'cash'>('mpesa');

  // Feedback réservation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successTicket, setSuccessTicket] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Recherche Topbar & Notifications
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(3);

  // Modal / Panneau "Sélection en un clic"
  const [showQuickSelectModal, setShowQuickSelectModal] = useState(false);
  // Modal / Panneau "Nouvelles tentes"
  const [showTentsModal, setShowTentsModal] = useState(false);

  // Activité récente (liste des réservations dynamiques)
  const [recentBookings, setRecentBookings] = useState<any[]>([
    {
      id: 'MUG-894210',
      client: 'Alain Kanyamuhanga',
      route: 'Goma ➔ Bukavu',
      date: 'Aujourd\'hui 07:30',
      ship: 'Mugote 1',
      classe: 'VIP',
      amount: '$27',
      status: 'Confirmé',
      statusColor: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
    },
    {
      id: 'MUG-894195',
      client: 'Jeanne Masika',
      route: 'Bukavu ➔ Goma',
      date: 'Demain 13:45',
      ship: 'Mugote 2',
      classe: 'Standard',
      amount: '$20',
      status: 'Confirmé',
      statusColor: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
    },
    {
      id: 'MUG-894182',
      client: 'Patrick Cishambo',
      route: 'Goma ➔ Idjwi',
      date: '22 Sept 08:00',
      ship: 'Mugote 3',
      classe: 'Economique',
      amount: '$15',
      status: 'En attente guichet',
      statusColor: 'bg-slate-700/60 text-slate-300 border-slate-600'
    },
    {
      id: 'MUG-894160',
      client: 'Nathalie Baraka',
      route: 'Goma ➔ Bukavu',
      date: '23 Sept 14:00',
      ship: 'Mugote 1',
      classe: 'VIP',
      amount: '$54',
      status: 'Confirmé',
      statusColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    }
  ]);

  // Barème des classes selon la demande exacte : Economique, standard 20$, VIP 27$
  const classOptions: Record<'economique' | 'standard' | 'vip', { label: string; price: number }> = {
    economique: { label: 'Économique - 15$', price: 15 },
    standard: { label: 'Standard - 20$', price: 20 },
    vip: { label: 'VIP - 27$', price: 27 }
  };

  const currentPriceUnit = classOptions[travelClass].price;
  const totalAmountUSD = currentPriceUnit * billetsCount;
  const totalAmountCDF = totalAmountUSD * 2850;

  // Soumission du formulaire
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!nom.trim() || !prenom.trim()) {
      setErrorMessage('Veuillez renseigner le Nom et le Prénom du passager.');
      return;
    }
    if (!telephone.trim() || telephone.trim().length < 8) {
      setErrorMessage('Numéro de téléphone obligatoire (ex: +243 994 102 673).');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage('Adresse Email OBLIGATOIRE et valide pour expédier le billet électronique.');
      return;
    }

    setIsSubmitting(true);
    const ticketNum = `MUG-${Date.now().toString().slice(-6)}`;

    const newReservation = {
      userId: user?.uid || `usr-${Date.now()}`,
      fullName: `${nom.trim().toUpperCase()} ${prenom.trim()}`,
      lastName: nom.trim(),
      phone: telephone.trim(),
      email: email.trim().toLowerCase(),
      itinerary: (trajet.toLowerCase().includes('bukavu') && trajet.toLowerCase().startsWith('bukavu')) 
        ? 'Bukavu-Goma' 
        : 'Goma-Bukavu',
      ship: boat,
      travelDate,
      departureTime: '07:30',
      travelClass: travelClass === 'vip' ? 'VIP' : travelClass === 'standard' ? '1ère Classe' : '2ème Classe',
      passengersCount: billetsCount,
      status: 'PENDING',
      paymentMethod,
      ticketId: ticketNum,
      amount: totalAmountUSD,
      createdAt: Date.now()
    };

    try {
      await mongoApi.createReservation(newReservation as any);
    } catch (err) {
      console.warn("Sauvegarde API automatique locale:", err);
    }

    // Ajouter à l'activité récente
    setRecentBookings(prev => [
      {
        id: ticketNum,
        client: `${nom.trim().toUpperCase()} ${prenom.trim()}`,
        route: trajet,
        date: `${travelDate} 07:30`,
        ship: boat,
        classe: travelClass.toUpperCase(),
        amount: `$${totalAmountUSD}`,
        status: paymentMethod === 'cash' ? 'En attente guichet' : 'Confirmé',
        statusColor: paymentMethod === 'cash' 
          ? 'bg-slate-700/60 text-slate-300 border-slate-600' 
          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      },
      ...prev
    ]);

    setSuccessTicket({
      ...newReservation,
      ticketId: ticketNum,
      totalAmountUSD,
      totalAmountCDF
    });
    setIsSubmitting(false);
  };

  // Raccourci Sélection en un clic
  const handleApplyPreset = (presetTrajet: string, presetClass: 'economique' | 'standard' | 'vip', presetBoat: string) => {
    setTrajet(presetTrajet);
    setTravelClass(presetClass);
    setBoat(presetBoat);
    setShowQuickSelectModal(false);
    // Scroll fluide vers le formulaire
    const formEl = document.getElementById('booking-compact-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row rounded-3xl overflow-hidden shadow-2xl border border-slate-800/80 my-2 font-sans antialiased">
      
      {/* ========================================================================= */}
      {/* 1. NAVIGATION LATÉRALE (SIDEBAR SOMBRE À GAUCHE)                         */}
      {/* ========================================================================= */}
      <aside className="w-full lg:w-72 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
        <div>
          {/* Logo & Slogan */}
          <div className="p-5 sm:p-6 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#0b132b] flex items-center justify-center text-white shadow-lg border border-white/20 shrink-0">
                <Ship size={22} className="text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-xs sm:text-sm font-black text-white tracking-tight uppercase leading-snug">
                  ETS AMR MUGOTE & FRÈRES
                </h1>
                <p className="text-[10px] text-slate-300 font-bold tracking-wider uppercase">
                  Voyager en toute sécurité
                </p>
              </div>
            </div>

            {/* Bouton spécial sous le logo : VÉRIFIER BILLET (QR Code) */}
            <button
              type="button"
              onClick={() => {
                if (onOpenScanner) onOpenScanner();
              }}
              className="mt-4 w-full py-2.5 px-3 bg-black hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md border border-white/10 flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
            >
              <QrCode size={16} className="text-white animate-pulse" />
              <span>VÉRIFIER BILLET (QR Code)</span>
            </button>
          </div>

          {/* Profil connecté : "Administrateur Mugote" */}
          <div className="px-5 py-3.5 mx-4 mt-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-white text-black font-black text-sm flex items-center justify-center shadow-inner">
                AM
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
            </div>
            <div className="text-left overflow-hidden">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Session Active
              </span>
              <p className="text-xs font-black text-white truncate">
                {user?.displayName || "Administrateur Mugote"}
              </p>
            </div>
          </div>

          {/* Menu de navigation (icônes + texte) */}
          <nav className="p-4 space-y-1 text-left">
            {[
              { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
              { id: 'booking', label: 'Nouvelle réservation', icon: Calendar },
              { id: 'trips', label: 'Mes voyages', icon: Compass },
              { id: 'fleet', label: 'Flotte', icon: Ship },
              { id: 'profile', label: 'Profil', icon: User },
              { id: 'support', label: 'Aide & Support', icon: HelpCircle },
              { id: 'quick-select', label: 'Sélection en un clic', icon: Zap },
              { id: 'tents', label: 'Nouvelles tentes', icon: Tent },
              { id: 'settings', label: 'Paramètres', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveMenu(item.id);
                    if (item.id === 'quick-select') setShowQuickSelectModal(true);
                    else if (item.id === 'tents') setShowTentsModal(true);
                    else if (item.id === 'trips' && onNavigate) onNavigate('tickets');
                    else if (item.id === 'fleet' && onNavigate) onNavigate('gallery');
                    else if (item.id === 'settings' && onOpenAdminConsole) onOpenAdminConsole();
                    else if (item.id === 'booking') {
                      const el = document.getElementById('booking-compact-form');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-[#0b132b] text-white shadow-lg border border-white/10 font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={17} className={isActive ? 'text-white' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* En bas : Widget Météo compact (24°C Ensoleillé - Lac Kivu) */}
        <div className="p-4 border-t border-slate-800/80">
          <div className="bg-gradient-to-r from-slate-800 to-slate-800/70 p-3 rounded-2xl border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center">
                <Sun size={18} className="animate-spin-slow" />
              </div>
              <div className="text-left">
                <span className="text-xs font-black text-white">24°C Ensoleillé</span>
                <span className="text-[10px] text-slate-400 font-semibold block">Lac Kivu • Vagues Calmes</span>
              </div>
            </div>
            <span className="text-[9px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-bold rounded-full border border-emerald-500/30">
              Navigable
            </span>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* ZONE CENTRALE DU DASHBOARD (TOPBAR + CONTENU + MODULES)                 */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900/60">
        
        {/* ===================================================================== */}
        {/* 2. EN-TÊTE SUPÉRIEUR (TOPBAR)                                         */}
        {/* ===================================================================== */}
        <header className="h-16 px-6 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between gap-4 sticky top-0 z-30">
          {/* Titre de page */}
          <div className="flex items-center gap-3 text-left">
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
              Tableau de bord
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white/10 text-slate-200 border border-white/20 rounded-full text-[10px] font-bold">
              <Sparkles size={11} className="text-white" />
              ETS AMR MUGOTE
            </span>
          </div>

          {/* Droite : Recherche, Notifications, Photo de profil */}
          <div className="flex items-center gap-3">
            {/* Barre de recherche compacte */}
            <div className="relative hidden md:block w-48 lg:w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher billet, client..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700/80 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition"
              />
            </div>

            {/* Bouton recherche mobile */}
            <button
              type="button"
              className="md:hidden w-9 h-9 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700 transition"
            >
              <Search size={16} />
            </button>

            {/* Notifications avec badge rouge */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setUnreadNotifications(0);
                }}
                className="relative w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer border border-slate-700/70"
                title="Notifications"
              >
                <Bell size={16} />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white font-black text-[9px] rounded-full flex items-center justify-center shadow-md animate-bounce">
                    {unreadNotifications}
                  </span>
                )}
              </button>

              {/* Popover Notifications */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 text-left animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                    <span className="text-xs font-black text-white uppercase tracking-wider">
                      Alertes & Notifications
                    </span>
                    <span className="text-[10px] text-white font-bold">Lac Kivu</span>
                  </div>
                  <div className="divide-y divide-slate-700/60 text-xs mt-1">
                    <div className="py-2">
                      <p className="font-bold text-white">Mugote 1 prêt à l'embarquement</p>
                      <p className="text-[11px] text-slate-400">Départ 07:30 vers Bukavu Ihusi confirmé.</p>
                    </div>
                    <div className="py-2">
                      <p className="font-bold text-white">Météo Favorable</p>
                      <p className="text-[11px] text-slate-400">Navigation optimale sur le bassin sud.</p>
                    </div>
                    <div className="py-2">
                      <p className="font-bold text-white">Paiements Mobile Money actifs</p>
                      <p className="text-[11px] text-slate-400">M-Pesa, Airtel & Orange opérationnels.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Photo de profil */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="relative cursor-pointer">
                <div className="w-9 h-9 rounded-xl bg-[#0b132b] border border-white/20 flex items-center justify-center font-black text-white text-xs shadow-md">
                  AM
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border border-slate-900 rounded-full" />
              </div>
              <div className="hidden sm:block text-left">
                <span className="text-xs font-black text-white block leading-tight">
                  {user?.displayName || "Admin Mugote"}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">
                  Direction Générale
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ===================================================================== */}
        {/* 3. CONTENU PRINCIPAL (HERO SECTION & FORMULAIRE COMPACT)              */}
        {/* ===================================================================== */}
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 overflow-y-auto">
          
          {/* GRAND CONTENEUR BLEU DE NUIT ARRONDI */}
          <section className="relative bg-[#0b132b] rounded-3xl p-5 sm:p-7 text-white shadow-xl overflow-hidden border border-white/10 text-left">
            
            {/* Décoration de fond moderne */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />

            {/* En-tête Hero : Titre + Illustration/Icône de navire rapide à droite */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 relative z-10">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[11px] font-bold text-slate-200 mb-2 border border-white/15">
                  <ShieldCheck size={13} className="text-white" />
                  <span>Flotte Navale Mugote • Sécurité & Confort Supérieur</span>
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight leading-tight">
                  Réservez votre traversée du lac Kivu. Voyage sûr et sécurisé entre Goma et Bukavu
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1.5">
                  Billetterie officielle directe avec confirmation instantanée par QR Code et SMS.
                </p>
              </div>

              {/* Illustration / Icône de navire rapide */}
              <div className="shrink-0 flex items-center justify-center self-start md:self-center">
                <div className="relative group">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/10 backdrop-blur-md border border-white/25 flex flex-col items-center justify-center p-2 shadow-inner transition-transform group-hover:scale-105">
                    <Ship size={40} className="text-white drop-shadow-md animate-pulse" />
                    <span className="text-[10px] font-black tracking-wider uppercase text-white mt-1">
                      Fast Ferry
                    </span>
                  </div>
                  <div className="absolute -bottom-1 left-2 right-2 h-1.5 bg-white/30 rounded-full blur-xs" />
                </div>
              </div>
            </div>

            {/* FORMULAIRE DE RÉSERVATION COMPACT ENCASTRÉ */}
            {/* (Carte blanche encastrée bg-white text-slate-900 rounded-2xl p-5 shadow-lg) */}
            <div 
              id="booking-compact-form" 
              className="bg-white text-slate-900 rounded-2xl p-4 sm:p-6 shadow-2xl relative z-10 border border-slate-100"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#0b132b] text-white flex items-center justify-center font-bold text-xs">
                    <Calendar size={14} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                    Formulaire de Réservation Rapide
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                  1-2 min • Billet immédiat
                </span>
              </div>

              {/* Message de succès ou formulaire */}
              {successTicket ? (
                <div className="py-4 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 size={28} />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900">
                      Réservation Validée avec Succès !
                    </h4>
                    <p className="text-xs text-slate-600 max-w-md mx-auto mt-0.5">
                      Billet officiel <strong>#{successTicket.ticketId}</strong> établi pour <strong>{successTicket.fullName}</strong>.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 font-mono text-left max-w-md mx-auto">
                    <p><strong>Trajet :</strong> {successTicket.itinerary} ({successTicket.ship})</p>
                    <p><strong>Date :</strong> {successTicket.travelDate} à {successTicket.departureTime}</p>
                    <p><strong>Classe :</strong> {successTicket.travelClass} ({successTicket.passengersCount} billet(s))</p>
                    <p className="text-black font-black">
                      <strong>Total :</strong> ${successTicket.totalAmountUSD} ({successTicket.totalAmountCDF.toLocaleString()} FC)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuccessTicket(null)}
                    className="px-5 py-2 bg-[#0b132b] hover:bg-[#111c3d] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Faire une nouvelle réservation
                  </button>
                </div>
              ) : (
                <form onSubmit={handleBookingSubmit} className="space-y-4">
                  {errorMessage && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                      <AlertCircle size={15} className="shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* 1. COORDONNÉES PASSAGER PRINCIPAL : Nom | Prénom | Téléphone | Email */}
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-900 flex items-center justify-center text-[9px] font-bold">1</span>
                      <span>Coordonnées Passager Principal</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {/* Nom */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Nom <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={nom}
                          onChange={(e) => setNom(e.target.value)}
                          placeholder="Nom de famille"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800 focus:outline-none transition shadow-2xs"
                        />
                      </div>

                      {/* Prénom */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Prénom <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={prenom}
                          onChange={(e) => setPrenom(e.target.value)}
                          placeholder="Prénom"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800 focus:outline-none transition shadow-2xs"
                        />
                      </div>

                      {/* Téléphone (+243) */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Téléphone (+243) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Phone size={13} className="absolute left-3 top-2.5 text-slate-400" />
                          <input
                            type="tel"
                            required
                            value={telephone}
                            onChange={(e) => setTelephone(e.target.value)}
                            placeholder="+243 994 102 673"
                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800 focus:outline-none transition shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* Email (OBLIGATOIRE) */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Email (Obligatoire) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail size={13} className="absolute left-3 top-2.5 text-slate-400" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="billet@exemple.com"
                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800 focus:outline-none transition shadow-2xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. DÉTAILS DE LA TRAVERSÉE : Trajet / Date / Bateau / Classe & Prix / Nombre / Paiement */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-900 flex items-center justify-center text-[9px] font-bold">2</span>
                      <span>Détails de la Traversée & Paiement</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                      {/* Trajet / Ports (Select: Goma ➔ Bukavu) */}
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Trajet / Ports
                        </label>
                        <div className="relative">
                          <MapPin size={14} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                          <select
                            value={trajet}
                            onChange={(e) => setTrajet(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800 focus:outline-none cursor-pointer shadow-2xs"
                          >
                            <option value="Goma ➔ Bukavu">Goma ➔ Bukavu (Port Public ➔ Ihusi)</option>
                            <option value="Bukavu ➔ Goma">Bukavu ➔ Goma (Ihusi ➔ Port Public)</option>
                            <option value="Goma ➔ Idjwi">Goma ➔ Île d'Idjwi</option>
                            <option value="Bukavu ➔ Idjwi">Bukavu ➔ Île d'Idjwi</option>
                          </select>
                        </div>
                      </div>

                      {/* Date de voyage (Input Datepicker) */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Date de voyage
                        </label>
                        <input
                          type="date"
                          required
                          value={travelDate}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setTravelDate(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800 focus:outline-none cursor-pointer shadow-2xs"
                        />
                      </div>

                      {/* Bateau (Select: Mugote 1, Mugote 2, Mugote 3) */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Bateau
                        </label>
                        <select
                          value={boat}
                          onChange={(e) => setBoat(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800 focus:outline-none cursor-pointer shadow-2xs"
                        >
                          <option value="Mugote 1">Mugote 1 (Rapide)</option>
                          <option value="Mugote 2">Mugote 2 (Confort)</option>
                          <option value="Mugote 3">Mugote 3 (Express)</option>
                        </select>
                      </div>

                      {/* Classe & Prix (Select: Economique, standard 20$, VIP 27$) */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Classe & Prix
                        </label>
                        <select
                          value={travelClass}
                          onChange={(e) => setTravelClass(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800 focus:outline-none cursor-pointer shadow-2xs"
                        >
                          <option value="economique">Économique - 15$</option>
                          <option value="standard">Standard - 20$</option>
                          <option value="vip">VIP - 27$</option>
                        </select>
                      </div>

                      {/* Nombre de billets (Compteur 1 à 10) */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Billets (1-10)
                        </label>
                        <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 shadow-2xs overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setBilletsCount(Math.max(1, billetsCount - 1))}
                            disabled={billetsCount <= 1}
                            className="w-8 h-[34px] flex items-center justify-center font-black text-slate-600 hover:bg-slate-200 transition cursor-pointer disabled:opacity-30"
                          >
                            -
                          </button>
                          <span className="flex-1 text-center font-black text-xs text-slate-900">
                            {billetsCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => setBilletsCount(Math.min(10, billetsCount + 1))}
                            disabled={billetsCount >= 10}
                            className="w-8 h-[34px] flex items-center justify-center font-black text-slate-600 hover:bg-slate-200 transition cursor-pointer disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Mode de paiement (M-Pesa, Airtel Money, Orange Money, Cash) */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-600 uppercase mb-1.5">
                          Mode de paiement :
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { id: 'mpesa', label: 'M-Pesa' },
                            { id: 'airtel', label: 'Airtel Money' },
                            { id: 'orange', label: 'Orange Money' },
                            { id: 'cash', label: 'Cash au guichet' }
                          ].map((p) => {
                            const isSelected = paymentMethod === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setPaymentMethod(p.id as any)}
                                className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#0b132b] text-white border-[#0b132b] shadow-xs'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Récapitulatif tarifaire dynamique */}
                      <div className="text-left md:text-right">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">
                          Total à régler :
                        </span>
                        <div className="flex items-baseline md:justify-end gap-1.5">
                          <span className="text-xl font-black text-black">${totalAmountUSD}</span>
                          <span className="text-xs font-semibold text-slate-500">
                            ({totalAmountCDF.toLocaleString()} FC)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. BOUTON D'ACTION : Bouton Monochrome Noir compact */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-black hover:bg-slate-900 text-white font-black py-3 rounded-xl w-full text-sm uppercase tracking-wider shadow-lg border border-white/10 active:scale-98 transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CreditCard size={18} />
                      <span>{isSubmitting ? 'EN COURS DE VALIDATION...' : 'RÉSERVER MAINTENANT'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>

          {/* ===================================================================== */}
          {/* 4. MODULES DU BAS (CARDS SECONDAIRES EN GRILLE)                       */}
          {/* ===================================================================== */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-left">
            
            {/* CARD 1 : Activité récente (Dernières réservations effectuées) */}
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center">
                      <Clock size={15} />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      Activité récente
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">En direct</span>
                </div>

                <div className="mt-3 space-y-2.5">
                  {recentBookings.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white truncate">{item.client}</p>
                        <p className="text-[10px] text-slate-400 font-medium truncate">
                          {item.route} • {item.ship}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-white block">{item.amount}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${item.statusColor}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Total passagers jour</span>
                <span className="font-black text-white">184 personnes</span>
              </div>
            </div>

            {/* CARD 2 : Prochain voyage (Carte récapitulative du prochain départ Goma ➔ Bukavu) */}
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 flex flex-col justify-between shadow-lg relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Anchor size={15} />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      Prochain voyage
                    </h4>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-bold rounded-full border border-emerald-500/30">
                    À l'heure
                  </span>
                </div>

                <div className="mt-3 p-3 bg-gradient-to-br from-slate-900 to-slate-900/90 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-white">
                    <span>Goma (Port Public)</span>
                    <ArrowRight size={13} className="text-slate-400" />
                    <span>Bukavu (Ihusi)</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold pt-1 border-t border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-400" />
                      <span>07h30 du matin</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Ship size={12} className="text-slate-300" />
                      <span>Mugote 1</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Embarquement :</span>
                    <span className="font-bold text-slate-200">06h45 - 07h15</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Places VIP restantes :</span>
                    <span className="font-bold text-white">8 sièges</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => {
                    setTrajet('Goma ➔ Bukavu');
                    setBoat('Mugote 1');
                    setTravelClass('vip');
                    const formEl = document.getElementById('booking-compact-form');
                    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Rejoindre ce départ</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* CARD 3 : Itinéraires populaires (Goma ➔ Bukavu, Bukavu ➔ Idjwi) */}
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center">
                      <TrendingUp size={15} />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      Itinéraires populaires
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">Fréquentés</span>
                </div>

                <div className="mt-3 space-y-2">
                  {[
                    {
                      route: 'Goma ➔ Bukavu',
                      freq: '2 départs / jour',
                      fare: 'dès $15',
                      highlight: true
                    },
                    {
                      route: 'Bukavu ➔ Goma',
                      freq: '2 départs / jour',
                      fare: 'dès $15',
                      highlight: false
                    },
                    {
                      route: 'Bukavu ➔ Île d\'Idjwi',
                      freq: '1 départ / jour',
                      fare: 'dès $10',
                      highlight: false
                    }
                  ].map((it, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setTrajet(it.route);
                        const formEl = document.getElementById('booking-compact-form');
                        if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="p-2.5 bg-slate-900/60 hover:bg-slate-900 rounded-xl border border-slate-800 transition cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-black text-white block">{it.route}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{it.freq}</span>
                      </div>
                      <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded-lg border border-white/20">
                        {it.fare}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-700/60 text-[11px] text-slate-400 text-center">
                Traversées rapides de 2h45 à 3h15
              </div>
            </div>

            {/* CARD 4 : Annonces & Communiqués officiels */}
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center">
                      <Bell size={15} />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      Annonces officielles
                    </h4>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 bg-white/10 text-slate-300 font-bold rounded">
                    Direction
                  </span>
                </div>

                <div className="mt-3 space-y-2.5 text-xs text-slate-300">
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                    <span className="text-[9px] font-black uppercase text-white tracking-wider block mb-0.5">
                      Gilets de sauvetage 100% conformes
                    </span>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Tous les passagers sont dotés de gilets certifiés SOLAS avant chaque appareillage.
                    </p>
                  </div>

                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                    <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider block mb-0.5">
                      Wi-Fi Starlink à bord
                    </span>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Connexion Internet haut débit disponible en cabine VIP et Business tout au long du trajet.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Capitainerie Goma-Bukavu</span>
                <span className="text-white font-bold">Actif 24/7</span>
              </div>
            </div>

          </section>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL : SÉLECTION EN UN CLIC                                             */}
      {/* ========================================================================= */}
      {showQuickSelectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full text-left space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-white" />
                <h3 className="text-base font-black text-white">Sélection en un clic</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickSelectModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Sélectionnez une formule prête à réserver pour charger instantanément le formulaire.
            </p>
            <div className="space-y-2">
              {[
                { label: 'Goma ➔ Bukavu VIP Mugote 1', trajet: 'Goma ➔ Bukavu', classe: 'vip' as const, boat: 'Mugote 1', price: '$27' },
                { label: 'Goma ➔ Bukavu Standard Mugote 2', trajet: 'Goma ➔ Bukavu', classe: 'standard' as const, boat: 'Mugote 2', price: '$20' },
                { label: 'Bukavu ➔ Goma Express Mugote 3', trajet: 'Bukavu ➔ Goma', classe: 'standard' as const, boat: 'Mugote 3', price: '$20' },
                { label: 'Goma ➔ Idjwi Économique', trajet: 'Goma ➔ Idjwi', classe: 'economique' as const, boat: 'Mugote 2', price: '$15' },
              ].map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleApplyPreset(p.trajet, p.classe, p.boat)}
                  className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 flex items-center justify-between text-xs font-bold transition cursor-pointer text-left"
                >
                  <span className="text-white">{p.label}</span>
                  <span className="text-white font-black">{p.price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : NOUVELLES TENTES / ESPACES MUGOTE                                 */}
      {/* ========================================================================= */}
      {showTentsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full text-left space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Tent size={18} className="text-emerald-400" />
                <h3 className="text-base font-black text-white">Nouvelles Tentes & Salons VIP</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTentsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Découvrez les nouveaux aménagements de tentes d'ombrage panoramiques et salons ventilés sur les ponts supérieurs de la flotte <strong>ETS AMR MUGOTE & FRÈRES</strong> pour les traversées touristiques et d'affaires du Lac Kivu.
            </p>
            <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1.5 text-xs">
              <p className="font-bold text-white">☀️ Pont Supérieur Panoramique</p>
              <p className="text-slate-400 text-[11px]">Idéal pour contempler les volcans des Virunga et les collines verdoyantes d'Idjwi à l'abri du soleil.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowTentsModal(false)}
              className="w-full py-2.5 bg-[#0b132b] hover:bg-[#111c3d] text-white font-bold text-xs rounded-xl transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

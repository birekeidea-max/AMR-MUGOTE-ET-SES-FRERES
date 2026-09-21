import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Calendar, 
  Ship, 
  Search, 
  Info,
  Check,
  Eye,
  X,
  Bell,
  Radio,
  Megaphone,
  Users,
  ShieldCheck,
  Trash2,
  Phone,
  Key,
  Lock,
  Ticket,
  ExternalLink
} from 'lucide-react';
import { mongoApi } from '../services/api';
import { Reservation } from '../types';

interface AdminRemindersViewProps {
  reservations: Reservation[];
  onRefresh?: () => void;
}

export function AdminRemindersView({ reservations, onRefresh }: AdminRemindersViewProps) {
  const [activeTab, setActiveTab] = useState<'agenda' | 'reminders' | 'test'>('agenda');

  // Status SMTP / Service
  const [status, setStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Test Email state
  const [testEmail, setTestEmail] = useState('birekeidea@gmail.com');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // SMTP Configuration form state
  const [smtpUser, setSmtpUser] = useState('birekeidea@gmail.com');
  const [smtpPass, setSmtpPass] = useState('');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [smtpPort, setSmtpPort] = useState(465);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [verifyingSmtp, setVerifyingSmtp] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Confirmation email sending state
  const [sendingConfirmId, setSendingConfirmId] = useState<string | null>(null);
  
  // Bulk reminders state
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);

  // Single reservation reminder state
  const [sendingSingleId, setSendingSingleId] = useState<string | null>(null);
  const [singleResult, setSingleResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEmailOnly, setFilterEmailOnly] = useState(false);
  const [previewReservation, setPreviewReservation] = useState<Reservation | null>(null);

  // ==========================================================
  // 🗓️ SERVER AGENDA STATES
  // ==========================================================
  const [agendaList, setAgendaList] = useState<any[]>([]);
  const [agendaStats, setAgendaStats] = useState<any>(null);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [selectedShipFilter, setSelectedShipFilter] = useState('ALL');
  const [agendaSearch, setAgendaSearch] = useState('');

  // Broadcast Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastShip, setBroadcastShip] = useState('Mugote 1');
  const [broadcastDate, setBroadcastDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [broadcastStatus, setBroadcastStatus] = useState('BOARDING');
  const [broadcastTitle, setBroadcastTitle] = useState("Ouverture de l'embarquement");
  const [broadcastMessage, setBroadcastMessage] = useState("L'embarquement des passagers pour le Mugote 1 est officiellement ouvert au port. Veuillez vous présenter au quai muni de votre billet.");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<any>(null);

  // Individual Agenda Alert State
  const [selectedAgendaPassenger, setSelectedAgendaPassenger] = useState<any | null>(null);
  const [individualAlertTitle, setIndividualAlertTitle] = useState("Information concernant votre départ");
  const [individualAlertMessage, setIndividualAlertMessage] = useState("");
  const [sendingIndividual, setSendingIndividual] = useState(false);
  const [individualResult, setIndividualResult] = useState<any>(null);

  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await mongoApi.getNotificationStatus();
      setStatus(res);
    } catch (e: any) {
      console.warn("Failed to fetch notification status", e);
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchAgenda = async () => {
    try {
      setLoadingAgenda(true);
      const [list, stats] = await Promise.all([
        mongoApi.getServerAgenda(),
        mongoApi.getServerAgendaStats()
      ]);
      setAgendaList(list || []);
      setAgendaStats(stats || null);
    } catch (e) {
      console.warn("Error fetching agenda", e);
    } finally {
      setLoadingAgenda(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchAgenda();
  }, []);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) return;

    try {
      setSendingTest(true);
      setTestResult(null);
      const res = await mongoApi.sendTestEmail(testEmail);
      setTestResult({
        success: res.success,
        message: res.message || "Email de test traité avec succès."
      });
      fetchStatus();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Échec de l'envoi du test."
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendSingleReminder = async (res: Reservation) => {
    const targetId = res.ticketId || res.id || res._id;
    if (!targetId) return;

    try {
      setSendingSingleId(targetId);
      setSingleResult(null);
      const result = await mongoApi.sendDepartureReminder(targetId);
      setSingleResult({
        id: targetId,
        success: result.success,
        message: result.message || "Rappel envoyé !"
      });
      fetchStatus();
      fetchAgenda();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setSingleResult({
        id: targetId,
        success: false,
        message: err.message || "Erreur lors de l'envoi du rappel."
      });
    } finally {
      setSendingSingleId(null);
    }
  };

  const handleSendSingleConfirmation = async (res: Reservation) => {
    const targetId = res.ticketId || res.id || res._id;
    if (!targetId) return;

    try {
      setSendingConfirmId(targetId);
      setSingleResult(null);
      const result = await mongoApi.sendBookingConfirmation(targetId, res.email);
      setSingleResult({
        id: targetId,
        success: result.success,
        message: result.message || "Billet officiel et confirmation de réservation envoyés !"
      });
      fetchStatus();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setSingleResult({
        id: targetId,
        success: false,
        message: err.message || "Erreur lors de l'envoi de la confirmation."
      });
    } finally {
      setSendingConfirmId(null);
    }
  };

  const handleSaveAndConnectSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpUser || !smtpPass) {
      setSmtpFeedback({
        success: false,
        message: "Veuillez renseigner votre adresse email Gmail et votre Mot de passe d'application Google."
      });
      return;
    }

    try {
      setSavingSmtp(true);
      setSmtpFeedback(null);
      const res = await mongoApi.configureSmtp({
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim().replace(/\s+/g, ''),
        smtpHost: 'smtp.gmail.com',
        smtpPort: Number(smtpPort),
        smtpSecure: Number(smtpPort) === 465,
        emailFrom: `AMR MUGOTE ET SES FRÈRES <${smtpUser.trim()}>`
      });

      setSmtpFeedback({
        success: res.connected,
        message: res.message
      });
      fetchStatus();
    } catch (err: any) {
      setSmtpFeedback({
        success: false,
        message: err.message || "Erreur lors de l'enregistrement des identifiants SMTP."
      });
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleTestVerifyConnection = async () => {
    try {
      setVerifyingSmtp(true);
      setSmtpFeedback(null);
      const res = await mongoApi.verifySmtp();
      setSmtpFeedback({
        success: res.success,
        message: res.message
      });
      fetchStatus();
    } catch (err: any) {
      setSmtpFeedback({
        success: false,
        message: err.message || "Erreur lors de la vérification de la connexion."
      });
    } finally {
      setVerifyingSmtp(false);
    }
  };

  const handleSendBulk = async () => {
    if (!confirm(`Confirmez-vous l'envoi des rappels d'heure de départ par Gmail à tous les passagers prévus le ${selectedDate} ?`)) {
      return;
    }

    try {
      setSendingBulk(true);
      setBulkResult(null);
      const res = await mongoApi.sendBulkDepartureReminders(selectedDate);
      setBulkResult(res);
      fetchStatus();
      fetchAgenda();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert("Erreur envoi groupé: " + err.message);
    } finally {
      setSendingBulk(false);
    }
  };

  // Broadcast boat alert to all passengers on a boat
  const handleBroadcastBoatAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastShip || !broadcastTitle || !broadcastMessage) return;

    try {
      setBroadcasting(true);
      setBroadcastResult(null);
      const res = await mongoApi.broadcastBoatAlert({
        ship: broadcastShip,
        travelDate: broadcastDate || undefined,
        alertTitle: broadcastTitle,
        alertMessage: broadcastMessage,
        boatStatus: broadcastStatus
      });
      setBroadcastResult(res);
      fetchAgenda();
    } catch (err: any) {
      setBroadcastResult({
        success: false,
        message: err.message || "Erreur lors de la diffusion de l'alerte."
      });
    } finally {
      setBroadcasting(false);
    }
  };

  // Send individual alert to passenger in agenda
  const handleSendIndividualAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgendaPassenger || !individualAlertMessage) return;

    try {
      setSendingIndividual(true);
      setIndividualResult(null);
      const res = await mongoApi.sendIndividualAgendaAlert(
        selectedAgendaPassenger.ticketId || selectedAgendaPassenger._id,
        {
          alertTitle: individualAlertTitle,
          alertMessage: individualAlertMessage
        }
      );
      setIndividualResult(res);
      fetchAgenda();
    } catch (err: any) {
      setIndividualResult({
        success: false,
        message: err.message || "Erreur d'envoi d'alerte individuelle."
      });
    } finally {
      setSendingIndividual(false);
    }
  };

  // Delete / Unsubscribe entry
  const handleDeleteAgenda = async (id: string, name: string) => {
    if (!confirm(`Retirer ${name} de l'agenda en temps réel du serveur ?`)) return;
    try {
      await mongoApi.deleteAgendaEntry(id);
      fetchAgenda();
    } catch (err: any) {
      alert("Erreur suppression: " + err.message);
    }
  };

  // Filtered agenda entries
  const filteredAgenda = agendaList.filter(item => {
    if (selectedShipFilter !== 'ALL' && item.ship !== selectedShipFilter) return false;
    if (!agendaSearch.trim()) return true;
    const q = agendaSearch.toLowerCase();
    return (
      (item.fullName || '').toLowerCase().includes(q) ||
      (item.email || '').toLowerCase().includes(q) ||
      (item.ticketId || '').toLowerCase().includes(q) ||
      (item.phone || '').toLowerCase().includes(q) ||
      (item.ship || '').toLowerCase().includes(q)
    );
  });

  // Filtered reservations
  const filteredReservations = reservations.filter(r => {
    const matchesSearch = 
      (r.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.ticketId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.itinerary || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterEmailOnly && (!r.email || !r.email.includes('@'))) {
      return false;
    }

    return matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 py-6">
      {/* En-tête principal */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-black uppercase tracking-wider">
            <Mail size={14} className="text-blue-600" />
            Agenda Serveur & Notifications Gmail Bateau
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Agenda Central & Alertes Bateau en Direct
          </h2>
          <p className="text-xs text-slate-500 font-medium max-w-2xl">
            Système en temps réel qui enregistre automatiquement les adresses Gmail des voyageurs dès leur réservation pour les prévenir en direct des départs, heures d'embarquement et statuts de navigation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => { fetchStatus(); fetchAgenda(); if (onRefresh) onRefresh(); }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loadingStatus || loadingAgenda ? "animate-spin" : ""} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Cartes métriques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Agenda Serveur</span>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-emerald-600 uppercase">Actif</span>
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">
            {agendaStats?.totalScheduled ?? agendaList.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Voyageurs inscrits à l'agenda
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Départs Aujourd'hui</span>
            <Calendar size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600 font-mono">
            {agendaStats?.todayScheduled ?? 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Passagers prévus ce jour
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Alertes & Notifications</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 font-mono">
            {agendaStats?.totalNotified ?? status?.sentRemindersCount ?? 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Emails d'agenda & rappels transmis
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Moteur d'Acheminement</span>
            <div className={`w-2.5 h-2.5 rounded-full ${status?.configured ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-amber-500 ring-4 ring-amber-100'}`} />
          </div>
          <p className="text-lg font-black text-slate-800">
            {status?.configured ? 'SMTP Gmail Actif' : 'Mode Simulation'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {status?.fromAddress || 'no-reply@amrmugote.com'}
          </p>
        </div>
      </div>

      {/* Onglets de navigation */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('agenda')}
          className={`pb-3 px-4 font-black text-xs uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'agenda'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Calendar size={15} />
          1. Agenda Bateau & Passagers ({agendaList.length})
        </button>

        <button
          onClick={() => setActiveTab('reminders')}
          className={`pb-3 px-4 font-black text-xs uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'reminders'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Send size={15} />
          2. Rappels Départs & Billets
        </button>

        <button
          onClick={() => setActiveTab('test')}
          className={`pb-3 px-4 font-black text-xs uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'test'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Key size={15} />
          3. Configuration Gmail / SMTP & Tests
        </button>
      </div>

      {/* ============================================================ */}
      {/* ONGLET 1 : AGENDA SERVEUR EN TEMPS RÉEL                       */}
      {/* ============================================================ */}
      {activeTab === 'agenda' && (
        <div className="space-y-6">
          {/* Barre d'action rapide pour l'agenda */}
          <div className="bg-gradient-to-r from-blue-900 via-[#001233] to-slate-900 text-white p-5 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-gold tracking-widest flex items-center gap-1.5">
                <Radio size={14} className="text-emerald-400 animate-pulse" />
                Diffusion d'Informations en Direct
              </span>
              <h3 className="text-lg font-black text-white">
                Diffuser une alerte bateau à tous les passagers de l'agenda
              </h3>
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                Prévenez en un clic tous les passagers inscrits sur un navire précis (ouverture de l'embarquement, bateau à quai, retard météo ou départ imminent).
              </p>
            </div>

            <button
              onClick={() => setShowBroadcastModal(true)}
              className="px-5 py-2.5 bg-gold hover:bg-amber-400 text-maritime font-black uppercase tracking-wider text-xs rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Megaphone size={16} />
              Diffuser une Alerte Bateau
            </button>
          </div>

          {/* Filtres & Recherche de l'agenda */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  Passagers Programmés dans l'Agenda Serveur
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Les emails saisis lors de la réservation sont automatiquement intégrés ici pour l'envoi des alertes temps réel
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                {/* Sélecteur de bateau */}
                <select
                  value={selectedShipFilter}
                  onChange={e => setSelectedShipFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ALL">Tous les Navires</option>
                  <option value="Mugote 1">Mugote 1</option>
                  <option value="Mugote 2">Mugote 2</option>
                  <option value="Mugote 3">Mugote 3</option>
                  <option value="Mugote 4">Mugote 4</option>
                </select>

                {/* Recherche */}
                <div className="relative flex-1 sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={agendaSearch}
                    onChange={e => setAgendaSearch(e.target.value)}
                    placeholder="Filtrer par nom, email, billet..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Table des inscrits à l'agenda */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Passager</th>
                    <th className="py-3 px-4">Compte Gmail / Email</th>
                    <th className="py-3 px-4">Navire & Trajet</th>
                    <th className="py-3 px-4">Date & Embarquement</th>
                    <th className="py-3 px-4 text-center">Statut Bateau</th>
                    <th className="py-3 px-4">Confirmation Agenda</th>
                    <th className="py-3 px-4 text-right">Actions Directes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredAgenda.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                        Aucun voyageur inscrit dans l'agenda pour ces critères. Dès qu'un client réserve avec son Gmail, il apparaîtra ici en temps réel.
                      </td>
                    </tr>
                  ) : (
                    filteredAgenda.map(item => {
                      const id = item._id || item.ticketId;
                      const hasConfirmation = Boolean(item.confirmationSent);
                      const notifCount = item.notificationsLog?.length || 0;

                      let statusBadge = "bg-slate-100 text-slate-700 border-slate-200";
                      if (item.boatStatus === 'NORMAL') statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
                      if (item.boatStatus === 'BOARDING') statusBadge = "bg-blue-50 text-blue-700 border-blue-200 animate-pulse";
                      if (item.boatStatus === 'DELAYED') statusBadge = "bg-rose-50 text-rose-700 border-rose-200";

                      return (
                        <tr key={id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{item.fullName}</div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <span>{item.ticketId}</span>
                              {item.phone && (
                                <span className="flex items-center gap-0.5 text-slate-500">
                                  • <Phone size={10} /> {item.phone}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-mono text-[11px] font-bold">
                              <Mail size={12} className="text-blue-500 shrink-0" />
                              {item.email}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-black text-maritime">{item.ship}</div>
                            <div className="text-[10px] text-slate-500">{item.itinerary} ({item.travelClass})</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800">{item.travelDate}</div>
                            <div className="text-[10px] text-slate-500">
                              Départ : <span className="font-bold text-slate-900">{item.departureTime || '07h30'}</span>
                              {item.boardingTime && (
                                <span className="text-blue-600 font-bold ml-1">(Embarq. : {item.boardingTime})</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${statusBadge}`}>
                              {item.boatStatus || 'NORMAL'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {hasConfirmation ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <CheckCircle2 size={11} className="text-emerald-600" /> Confirmé
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <Clock size={11} className="text-amber-600" /> En attente
                              </span>
                            )}
                            {notifCount > 0 && (
                              <span className="block text-[9px] text-slate-400 mt-0.5">
                                {notifCount} alerte(s) reçue(s)
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedAgendaPassenger(item);
                                  setIndividualAlertTitle(`Information pour le ${item.ship} du ${item.travelDate}`);
                                  setIndividualAlertMessage(`Bonjour ${item.fullName}, votre départ à bord du ${item.ship} est prévu à ${item.departureTime || '07h30'}. Veuillez vous présenter au quai.`);
                                  setIndividualResult(null);
                                }}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                                title="Envoyer une notification personnalisée"
                              >
                                <Send size={11} /> Alerte
                              </button>

                              <button
                                onClick={() => handleDeleteAgenda(item._id || item.ticketId, item.fullName)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                                title="Retirer de l'agenda"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ONGLET 2 : RAPPELS DE DÉPART GROUPÉS (CRON)                  */}
      {/* ============================================================ */}
      {activeTab === 'reminders' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 text-slate-800 font-black text-sm uppercase tracking-wider">
              <Send size={16} className="text-blue-600" />
              Envoi Groupé des Rappels d'Heure de Départ
            </div>
            <p className="text-xs text-slate-500">
              Déclenche les rappels Gmail pour tous les passagers ayant réservé pour une date précise. Le système extrait leur heure de départ et leur envoie les consignes officielles.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <div className="flex-1">
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Date de Départ à Notifier
                </label>
                <input 
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="sm:self-end">
                <button
                  onClick={handleSendBulk}
                  disabled={sendingBulk}
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {sendingBulk ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Mail size={14} />
                      Envoyer les Rappels du Jour
                    </>
                  )}
                </button>
              </div>
            </div>

            {bulkResult && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <p className="font-bold text-slate-800">{bulkResult.message}</p>
                {bulkResult.summary && (
                  <div className="flex gap-4 text-[11px] text-slate-600">
                    <span className="font-semibold text-emerald-600">✓ {bulkResult.summary.sentCount} envoyé(s)</span>
                    <span className="font-semibold text-amber-600">⚠ {bulkResult.summary.skippedNoEmail} sans email</span>
                    {bulkResult.summary.failedCount > 0 && (
                      <span className="font-semibold text-rose-600">✕ {bulkResult.summary.failedCount} échec(s)</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Liste des Réservations classiques */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  Toutes les Réservations du Système
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Contrôlez et envoyez individuellement les rappels d'heure de départ aux voyageurs
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Rechercher voyageur, email, billet..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={filterEmailOnly}
                    onChange={e => setFilterEmailOnly(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Avec Gmail uniquement
                </label>
              </div>
            </div>

            {singleResult && (
              <div className={`mx-5 my-3 p-3 rounded-xl border text-xs flex items-center justify-between ${singleResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                <span className="font-medium">{singleResult.message}</span>
                <button onClick={() => setSingleResult(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Passager</th>
                    <th className="py-3 px-4">Adresse Gmail</th>
                    <th className="py-3 px-4">Trajet & Bateau</th>
                    <th className="py-3 px-4">Date de Voyage</th>
                    <th className="py-3 px-4 text-center">Heure de Départ</th>
                    <th className="py-3 px-4">Statut Rappel</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredReservations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                        Aucune réservation trouvée pour ces critères.
                      </td>
                    </tr>
                  ) : (
                    filteredReservations.map(res => {
                      const targetId = res.ticketId || res.id || res._id || '';
                      const hasEmail = Boolean(res.email && res.email.includes('@'));
                      const isSending = sendingSingleId === targetId;
                      const isSent = Boolean((res as any).reminderEmailSent);

                      return (
                        <tr key={targetId} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{res.fullName} {res.lastName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{res.ticketId || res.id || 'N/A'}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            {hasEmail ? (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-mono text-[11px]">
                                <Mail size={12} className="text-blue-500 shrink-0" />
                                {res.email}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Non renseigné</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800">{res.itinerary}</div>
                            <div className="text-[10px] text-slate-400">{res.ship} ({res.travelClass})</div>
                          </td>

                          <td className="py-3.5 px-4 text-slate-700">
                            {res.travelDate}
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono font-bold text-blue-700">
                            {res.departureTime || '07h30'}
                          </td>

                          <td className="py-3.5 px-4">
                            {isSent ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                                <CheckCircle2 size={10} />
                                Rappel Envoyé
                              </span>
                            ) : hasEmail ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold">
                                <Clock size={10} />
                                En attente
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">
                                Aucun email
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setPreviewReservation(res)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Aperçu du contenu du rappel"
                              >
                                <Eye size={14} />
                              </button>

                              <button
                                onClick={() => handleSendSingleConfirmation(res)}
                                disabled={!hasEmail || sendingConfirmId === targetId}
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-30 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                                title="Envoyer le Billet Officiel & Confirmation par email"
                              >
                                {sendingConfirmId === targetId ? (
                                  <RefreshCw size={11} className="animate-spin" />
                                ) : (
                                  <Ticket size={11} />
                                )}
                                Billet Email
                              </button>

                              <button
                                onClick={() => handleSendSingleReminder(res)}
                                disabled={!hasEmail || isSending}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                {isSending ? (
                                  <RefreshCw size={11} className="animate-spin" />
                                ) : (
                                  <Send size={11} />
                                )}
                                Notifier
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ONGLET 3 : CONFIGURATION & TEST GMAIL / SMTP RÉEL            */}
      {/* ============================================================ */}
      {activeTab === 'test' && (
        <div className="space-y-6">
          {/* CARTE 1 : STATUT EN DIRECT */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5 text-slate-800 font-black text-sm uppercase tracking-wider">
                  <Mail size={18} className="text-blue-600" />
                  Statut de l'Acheminement Email en Temps Réel
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Surveillez l'état de la connexion avec les serveurs d'envoi SMTP / Gmail.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${status?.configured ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                  {status?.configured ? (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      Envoi Réel Opérationnel
                    </>
                  ) : (
                    <>
                      <Clock size={13} className="text-amber-600" />
                      Mode Simulation (Attente Identifiants)
                    </>
                  )}
                </span>

                <button
                  onClick={handleTestVerifyConnection}
                  disabled={verifyingSmtp}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Vérifier la négociation TLS / handshake avec le serveur"
                >
                  {verifyingSmtp ? <RefreshCw size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                  Tester le Handshake
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Serveur Hôte</span>
                <span className="font-mono font-bold text-slate-800">{status?.host || 'smtp.gmail.com'} : {status?.port || 465}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Compte Expéditeur</span>
                <span className="font-mono font-bold text-blue-700 truncate block">{status?.user || 'Non configuré'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Rappels Déjà Expédiés</span>
                <span className="font-bold text-emerald-700">{status?.sentRemindersCount || 0} envoyé(s)</span>
              </div>
            </div>
          </div>

          {/* CARTE 2 : CONFIGURATION DES IDENTIFIANTS GMAIL EN BASE DE DONNÉES */}
          <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-sm uppercase tracking-wider">
              <Key size={18} className="text-blue-600" />
              Configurer vos Identifiants Gmail pour l'Envoi Réel
            </div>
            <p className="text-xs text-slate-600">
              Renseignez votre adresse Gmail et votre <strong>Mot de passe d'application Google (16 caractères)</strong> pour que les confirmations et billets électroniques arrivent réellement dans les boîtes de réception des passagers.
            </p>

            <form onSubmit={handleSaveAndConnectSmtp} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    Adresse Gmail de l'Armateur / Expéditeur
                  </label>
                  <input
                    type="email"
                    required
                    value={smtpUser}
                    onChange={e => setSmtpUser(e.target.value)}
                    placeholder="birekeidea@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Votre compte officiel pour l'émission des billets
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Mot de Passe d'Application (16 lettres)
                    </label>
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-bold"
                    >
                      Obtenir un code Google <ExternalLink size={10} />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showSmtpPass ? "text" : "password"}
                      required
                      value={smtpPass}
                      onChange={e => setSmtpPass(e.target.value)}
                      placeholder="Ex: abcd efgh ijkl mnop"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showSmtpPass ? <Eye size={14} /> : <Lock size={14} />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Généré en 30s depuis la sécurité de votre compte Google
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                  <span>Port SMTP :</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="smtpPortChoice"
                      checked={smtpPort === 465}
                      onChange={() => setSmtpPort(465)}
                      className="text-blue-600"
                    />
                    465 (SSL Sécurisé recommandé)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="smtpPortChoice"
                      checked={smtpPort === 587}
                      onChange={() => setSmtpPort(587)}
                      className="text-blue-600"
                    />
                    587 (TLS Standard)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={savingSmtp}
                  className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {savingSmtp ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Enregistrement & Test...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      Enregistrer & Activer l'Envoi Réel
                    </>
                  )}
                </button>
              </div>
            </form>

            {smtpFeedback && (
              <div className={`p-4 rounded-xl border text-xs ${smtpFeedback.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                <div className="flex items-center gap-2 font-black mb-1">
                  {smtpFeedback.success ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
                  {smtpFeedback.success ? 'Identifiants Validés avec Succès !' : 'Vérification de la Connexion Échouée'}
                </div>
                <p className="text-slate-700">{smtpFeedback.message}</p>
              </div>
            )}
          </div>

          {/* CARTE 3 : TEST D'ENVOI IMMÉDIAT DANS VOTRE BOÎTE DE RÉCEPTION */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 text-slate-800 font-black text-sm uppercase tracking-wider">
              <Send size={16} className="text-emerald-600" />
              Tester l'Envoi d'un Email Réel
            </div>
            <p className="text-xs text-slate-500">
              Envoyez un email réel vers votre propre adresse pour vérifier immédiatement la réception, le format HTML et la rapidité de délivrance.
            </p>

            <form onSubmit={handleSendTestEmail} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <div className="flex-1">
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Adresse Email Destinataire du Test
                </label>
                <input 
                  type="email"
                  required
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="Ex: passager@gmail.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="sm:self-end">
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {sendingTest ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Envoi test en cours...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Tester l'Envoi
                    </>
                  )}
                </button>
              </div>
            </form>

            {testResult && (
              <div className={`p-4 rounded-xl border text-xs ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                <div className="flex items-center gap-2 font-bold mb-1">
                  {testResult.success ? <Check size={14} /> : <AlertCircle size={14} />}
                  {testResult.success ? 'Succès de l\'envoi' : 'Échec de l\'envoi'}
                </div>
                <p>{testResult.message}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL : DIFFUSION ALERTE BATEAU EN DIRECT                   */}
      {/* ============================================================ */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-blue-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Megaphone size={18} className="text-gold" />
                <h3 className="font-black text-sm uppercase tracking-wider">
                  Diffuser une Alerte Bateau en Temps Réel
                </h3>
              </div>
              <button 
                onClick={() => setShowBroadcastModal(false)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBroadcastBoatAlert} className="p-6 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed font-medium">
                Cette alerte sera envoyée par email à <strong>tous les passagers inscrits dans l'agenda</strong> pour le bateau sélectionné.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Navire Concerné
                  </label>
                  <select
                    value={broadcastShip}
                    onChange={e => setBroadcastShip(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Mugote 1">Mugote 1</option>
                    <option value="Mugote 2">Mugote 2</option>
                    <option value="Mugote 3">Mugote 3</option>
                    <option value="Mugote 4">Mugote 4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Statut du Bateau
                  </label>
                  <select
                    value={broadcastStatus}
                    onChange={e => {
                      setBroadcastStatus(e.target.value);
                      if (e.target.value === 'BOARDING') {
                        setBroadcastTitle("Ouverture de l'embarquement");
                        setBroadcastMessage(`L'embarquement des passagers pour le ${broadcastShip} est ouvert au quai. Veuillez vous présenter.`);
                      } else if (e.target.value === 'DELAYED') {
                        setBroadcastTitle("Avis de retard de navigation");
                        setBroadcastMessage(`En raison des conditions lacustres, le départ du ${broadcastShip} aura un léger différé de 20 minutes.`);
                      } else if (e.target.value === 'DEPARTED') {
                        setBroadcastTitle("Navire appareillé");
                        setBroadcastMessage(`Le navire ${broadcastShip} a levé l'ancre et navigue actuellement sur le Lac Kivu.`);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="NORMAL">Normal / À Quai</option>
                    <option value="BOARDING">Embarquement Ouvert</option>
                    <option value="DELAYED">Retardé / Ajustement Météo</option>
                    <option value="DEPARTED">Départ Effectué</option>
                    <option value="CANCELLED">Annulé</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Date de Voyage (Optionnel - Laisser vide pour tous les inscrits récents)
                </label>
                <input
                  type="date"
                  value={broadcastDate}
                  onChange={e => setBroadcastDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Objet de l'Alerte
                </label>
                <input
                  type="text"
                  required
                  value={broadcastTitle}
                  onChange={e => setBroadcastTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Message d'Alerte à Diffuser
                </label>
                <textarea
                  rows={4}
                  required
                  value={broadcastMessage}
                  onChange={e => setBroadcastMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {broadcastResult && (
                <div className={`p-3 rounded-xl border text-xs ${broadcastResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                  <p className="font-bold">{broadcastResult.message}</p>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={broadcasting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
                >
                  {broadcasting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      Diffusion en cours...
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      Diffuser Maintenant
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL : ALERTE INDIVIDUELLE POUR UN PASSAGER DE L'AGENDA    */}
      {/* ============================================================ */}
      {selectedAgendaPassenger && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-blue-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send size={16} className="text-gold" />
                <h3 className="font-black text-sm uppercase tracking-wider">
                  Alerte Individuelle Passager
                </h3>
              </div>
              <button 
                onClick={() => setSelectedAgendaPassenger(null)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendIndividualAlert} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                <div className="font-black text-slate-900 text-sm">{selectedAgendaPassenger.fullName}</div>
                <div className="text-blue-700 font-mono font-bold text-[11px]">{selectedAgendaPassenger.email}</div>
                <div className="text-slate-500 text-[10px]">
                  Navire : <strong>{selectedAgendaPassenger.ship}</strong> • Départ : {selectedAgendaPassenger.travelDate} à {selectedAgendaPassenger.departureTime || '07h30'}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Titre du Message
                </label>
                <input
                  type="text"
                  required
                  value={individualAlertTitle}
                  onChange={e => setIndividualAlertTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Message / Instruction Bateau
                </label>
                <textarea
                  rows={4}
                  required
                  value={individualAlertMessage}
                  onChange={e => setIndividualAlertMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {individualResult && (
                <div className={`p-3 rounded-xl border text-xs ${individualResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                  <p className="font-bold">{individualResult.message}</p>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedAgendaPassenger(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={sendingIndividual}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
                >
                  {sendingIndividual ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      Transmettre l'Alerte
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal d'Aperçu du contenu de rappel */}
      {previewReservation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Mail size={18} className="text-blue-400" />
                <h3 className="font-black text-sm uppercase tracking-wider">
                  Aperçu du Rappel d'Heure de Départ
                </h3>
              </div>
              <button 
                onClick={() => setPreviewReservation(null)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                <div className="border-b border-slate-200 pb-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Destinataire</span>
                  <span className="font-bold text-slate-900 font-mono text-[11px]">
                    {previewReservation.email || 'Aucune adresse Gmail renseignée'}
                  </span>
                </div>

                <div className="border-b border-slate-200 pb-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Objet</span>
                  <span className="font-bold text-slate-900">
                    ⛵ Rappel Départ AMR MUGOTE : {previewReservation.departureTime || '07h30'} à bord du {previewReservation.ship}
                  </span>
                </div>

                <p className="text-slate-700">
                  Bonjour <strong>{previewReservation.fullName} {previewReservation.lastName}</strong>,<br />
                  La compagnie AMR MUGOTE a le plaisir de vous rappeler l'heure de départ de votre voyage.
                </p>

                <div className="bg-slate-900 text-white p-4 rounded-xl text-center space-y-1">
                  <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Heure Précise de Départ</div>
                  <div className="text-3xl font-black font-mono tracking-tight text-white">{previewReservation.departureTime || '07h30'}</div>
                  <div className="text-xs text-slate-300">Date : {previewReservation.travelDate}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Bateau</span>
                    <span className="font-bold text-slate-800">{previewReservation.ship}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Trajet</span>
                    <span className="font-bold text-slate-800">{previewReservation.itinerary}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Classe</span>
                    <span className="font-bold text-slate-800">{previewReservation.travelClass}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Billet N°</span>
                    <span className="font-bold text-slate-800 font-mono">{previewReservation.ticketId || 'AMR-123456'}</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded-r-lg text-[11px] leading-relaxed">
                  ⚠️ <strong>Consigne :</strong> Présentez-vous au port d'embarquement au moins 45 minutes avant le départ avec une pièce d'identité valide et votre billet.
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button 
                onClick={() => setPreviewReservation(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Fermer
              </button>
              {previewReservation.email && (
                <button
                  onClick={() => {
                    handleSendSingleReminder(previewReservation);
                    setPreviewReservation(null);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Send size={12} />
                  Envoyer ce Rappel Maintenant
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

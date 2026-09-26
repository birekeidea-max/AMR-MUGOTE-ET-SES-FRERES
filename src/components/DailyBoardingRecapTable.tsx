import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  Ship, 
  UserCheck, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Search, 
  Filter, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  X, 
  FileText, 
  Anchor, 
  Database, 
  RefreshCw,
  Phone,
  Ticket,
  DollarSign,
  ArrowUpDown,
  ExternalLink,
  Copy,
  Sparkles
} from 'lucide-react';
import { Reservation } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc, collection, onSnapshot, query } from 'firebase/firestore';
import { mongoApi } from '../services/api';

interface DailyBoardingRecapTableProps {
  reservations?: Reservation[];
  onRefresh?: () => void;
  titlePrefix?: string;
  sourceContext?: 'mongodb' | 'admin';
}

export function DailyBoardingRecapTable({ 
  reservations: externalReservations, 
  onRefresh, 
  titlePrefix = "Base de Données",
  sourceContext = 'mongodb'
}: DailyBoardingRecapTableProps) {
  const [internalReservations, setInternalReservations] = useState<Reservation[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(false);
  
  // Format today as YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'TO_BOARD' | 'BOARDED' | 'VALIDATED' | 'PENDING'>('ALL');
  const [selectedShip, setSelectedShip] = useState<string>('ALL');
  const [selectedDepartureTime, setSelectedDepartureTime] = useState<string>('ALL');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // If externalReservations not provided, listen to Firestore in real-time
  useEffect(() => {
    if (externalReservations && externalReservations.length > 0) {
      setInternalReservations(externalReservations);
      return;
    }

    setLoadingInternal(true);
    const q = query(collection(db, 'reservations'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Reservation));
      setInternalReservations(docs);
      setLoadingInternal(false);
    }, (err) => {
      console.warn("Realtime listener in DailyBoardingRecapTable:", err);
      setLoadingInternal(false);
    });

    return () => unsub();
  }, [externalReservations]);

  const allReservations = externalReservations && externalReservations.length > 0 
    ? externalReservations 
    : internalReservations;

  // Find all unique dates that have reservations, sorted chronologically
  const availableDatesWithCounts = useMemo(() => {
    const countsMap = new Map<string, { totalPax: number; totalRes: number; boardedPax: number }>();
    
    allReservations.forEach(r => {
      const date = r.travelDate || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : null);
      if (!date) return;

      const pax = Number(r.passengersCount) || 1;
      const isBoarded = r.boardingStatus === 'BOARDED';

      const prev = countsMap.get(date) || { totalPax: 0, totalRes: 0, boardedPax: 0 };
      countsMap.set(date, {
        totalPax: prev.totalPax + pax,
        totalRes: prev.totalRes + 1,
        boardedPax: prev.boardedPax + (isBoarded ? pax : 0)
      });
    });

    // Sort dates ascending or descending around today
    const sortedDates = Array.from(countsMap.keys()).sort((a, b) => b.localeCompare(a));
    return sortedDates.map(date => ({
      date,
      ...(countsMap.get(date)!)
    }));
  }, [allReservations]);

  // If selectedDate is not set or has no reservations, default to today or the closest date
  useEffect(() => {
    if (availableDatesWithCounts.length > 0 && !availableDatesWithCounts.some(d => d.date === selectedDate)) {
      const today = getTodayStr();
      const hasToday = availableDatesWithCounts.some(d => d.date === today);
      if (!hasToday && availableDatesWithCounts.length > 0) {
        // Pick the most relevant date
        setSelectedDate(availableDatesWithCounts[0].date);
      }
    }
  }, [availableDatesWithCounts, selectedDate]);

  // Filter reservations for the selected date
  const dayReservations = useMemo(() => {
    return allReservations.filter(r => {
      const date = r.travelDate || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '');
      return date === selectedDate;
    });
  }, [allReservations, selectedDate]);

  // Extract unique ships and departure times for the selected day
  const uniqueShips = useMemo(() => {
    const set = new Set<string>();
    dayReservations.forEach(r => { if (r.ship) set.add(r.ship); });
    return Array.from(set);
  }, [dayReservations]);

  const uniqueTimes = useMemo(() => {
    const set = new Set<string>();
    dayReservations.forEach(r => { if (r.departureTime) set.add(r.departureTime); });
    return Array.from(set).sort();
  }, [dayReservations]);

  // Sort reservations STRICTLY IN ORDER:
  // 1. Departure time (07:00, 07:30, 08:30...)
  // 2. Itinerary & Ship
  // 3. Passenger full name
  const sortedDayReservations = useMemo(() => {
    const list = [...dayReservations];
    list.sort((a, b) => {
      const timeA = a.departureTime || '99:99';
      const timeB = b.departureTime || '99:99';
      const timeDiff = timeA.localeCompare(timeB);
      if (timeDiff !== 0) return timeDiff;

      const shipDiff = (a.ship || '').localeCompare(b.ship || '');
      if (shipDiff !== 0) return shipDiff;

      return (a.fullName || '').localeCompare(b.fullName || '');
    });
    return list;
  }, [dayReservations]);

  // Apply search & status filter
  const filteredReservations = useMemo(() => {
    return sortedDayReservations.filter(r => {
      // Ship filter
      if (selectedShip !== 'ALL' && r.ship !== selectedShip) return false;

      // Time filter
      if (selectedDepartureTime !== 'ALL' && r.departureTime !== selectedDepartureTime) return false;

      // Status filter
      if (filterStatus === 'TO_BOARD') {
        if (r.boardingStatus === 'BOARDED') return false;
      } else if (filterStatus === 'BOARDED') {
        if (r.boardingStatus !== 'BOARDED') return false;
      } else if (filterStatus === 'VALIDATED') {
        if (r.status !== 'VALIDATED') return false;
      } else if (filterStatus === 'PENDING') {
        if (r.status !== 'PENDING') return false;
      }

      // Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const nameMatch = `${r.fullName || ''} ${r.lastName || ''}`.toLowerCase().includes(q);
        const phoneMatch = (r.phone || '').toLowerCase().includes(q);
        const ticketMatch = (r.ticketId || r.id || r._id || '').toLowerCase().includes(q);
        const shipMatch = (r.ship || '').toLowerCase().includes(q);
        const itinMatch = (r.itinerary || '').toLowerCase().includes(q);
        const classMatch = (r.travelClass || '').toLowerCase().includes(q);
        return nameMatch || phoneMatch || ticketMatch || shipMatch || itinMatch || classMatch;
      }

      return true;
    });
  }, [sortedDayReservations, selectedShip, selectedDepartureTime, filterStatus, searchTerm]);

  // Daily statistics
  const dayStats = useMemo(() => {
    let totalPax = 0;
    let boardedPax = 0;
    let pendingPax = 0;
    let totalRevenue = 0;
    let validatedPax = 0;

    dayReservations.forEach(r => {
      const pax = Number(r.passengersCount) || 1;
      totalPax += pax;
      if (r.boardingStatus === 'BOARDED') {
        boardedPax += pax;
      } else {
        pendingPax += pax;
      }

      if (r.status === 'VALIDATED') {
        validatedPax += pax;
        totalRevenue += Number(r.amount) || 0;
      }
    });

    const percentBoarded = totalPax > 0 ? Math.round((boardedPax / totalPax) * 100) : 0;

    return {
      totalRes: dayReservations.length,
      totalPax,
      boardedPax,
      pendingPax,
      validatedPax,
      totalRevenue,
      percentBoarded
    };
  }, [dayReservations]);

  // Show quick toast notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // 1-Click Boarding / "Lâcher directement le voyageur"
  const handleToggleBoarding = async (reservation: Reservation) => {
    const resId = reservation.id || (reservation as any)._id;
    if (!resId) return;

    const isCurrentlyBoarded = reservation.boardingStatus === 'BOARDED';
    const nextStatus = isCurrentlyBoarded ? 'PENDING' : 'BOARDED';
    const boardedTime = nextStatus === 'BOARDED' ? Date.now() : null;
    const ticketId = reservation.ticketId || `AMR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    setActionLoadingId(resId);
    try {
      // 1. Update in Firestore
      try {
        const updatePayload: any = {
          boardingStatus: nextStatus,
          boarded: nextStatus === 'BOARDED',
          boardedAt: boardedTime,
          isUsed: nextStatus === 'BOARDED',
          usedAt: boardedTime
        };
        if (nextStatus === 'BOARDED') {
          updatePayload.status = 'VALIDATED';
          updatePayload.ticketId = ticketId;
          updatePayload.validatedAt = reservation.validatedAt || boardedTime;
        }
        await updateDoc(doc(db, 'reservations', resId), updatePayload);
      } catch (fErr) {
        console.warn("Firestore updateDoc note:", fErr);
      }

      // 2. Mirror in MongoDB Atlas
      try {
        const mongoPayload: any = {
          boardingStatus: nextStatus,
          boarded: nextStatus === 'BOARDED',
          boardedAt: boardedTime || undefined,
          isUsed: nextStatus === 'BOARDED'
        };
        if (nextStatus === 'BOARDED') {
          mongoPayload.status = 'VALIDATED';
          mongoPayload.ticketId = ticketId;
          mongoPayload.validatedAt = reservation.validatedAt || boardedTime;
        }
        await mongoApi.updateReservationStatus(resId, mongoPayload);
      } catch (mErr) {
        console.warn("MongoDB Atlas update mirror note:", mErr);
      }

      // 3. Local optimistic update
      setInternalReservations(prev => 
        prev.map(item => {
          if ((item.id || (item as any)._id) === resId) {
            return {
              ...item,
              boardingStatus: nextStatus,
              boarded: nextStatus === 'BOARDED',
              boardedAt: boardedTime || undefined,
              isUsed: nextStatus === 'BOARDED',
              ...(nextStatus === 'BOARDED' ? {
                status: 'VALIDATED' as const,
                ticketId,
                validatedAt: item.validatedAt || boardedTime
              } : {})
            };
          }
          return item;
        })
      );

      showToast(
        nextStatus === 'BOARDED' 
          ? `🚢 Voyageur ${reservation.fullName} lâché et marqué EMBARQUÉ avec succès !`
          : `Pointage d'embarquement annulé pour ${reservation.fullName}.`
      );

      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error("Failed to toggle boarding status:", err);
      showToast(`Erreur : ${err.message || 'Impossible de mettre à jour le statut'}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Batch action: Board all validated passengers of the selected day
  const handleBatchBoardAllValidated = async () => {
    const toBoardList = filteredReservations.filter(
      r => r.status === 'VALIDATED' && r.boardingStatus !== 'BOARDED'
    );

    if (toBoardList.length === 0) {
      showToast("Tous les voyageurs validés pour cette sélection sont déjà lâchés / embarqués !");
      return;
    }

    const confirmMsg = `Confirmez-vous le lâcher et l'embarquement groupé de ${toBoardList.length} réservations (${toBoardList.reduce((acc, r) => acc + (Number(r.passengersCount) || 1), 0)} voyageurs) pour la date du ${selectedDate} ?`;
    if (!window.confirm(confirmMsg)) return;

    setBatchLoading(true);
    let successCount = 0;

    for (const r of toBoardList) {
      const resId = r.id || (r as any)._id;
      if (!resId) continue;
      const now = Date.now();

      try {
        const ticketId = r.ticketId || `AMR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const updatePayload: any = {
          boardingStatus: 'BOARDED',
          boarded: true,
          boardedAt: now,
          isUsed: true,
          usedAt: now,
          status: 'VALIDATED',
          ticketId,
          validatedAt: r.validatedAt || now
        };
        await updateDoc(doc(db, 'reservations', resId), updatePayload);
        await mongoApi.updateReservationStatus(resId, updatePayload).catch(() => null);
        successCount++;
      } catch (err) {
        console.warn(`Error boarding ${resId}:`, err);
      }
    }

    setBatchLoading(false);
    showToast(`✅ ${successCount} réservations lâchées / enregistrées à bord pour le ${selectedDate} !`);
    if (onRefresh) onRefresh();
  };

  // Format date readable in French
  const formatDateFr = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-');
      const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
      return dateObj.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Print official manifest
  const handlePrintDailyManifest = () => {
    window.print();
  };

  // Copy text manifest for port radio/WhatsApp
  const handleCopyTextManifest = () => {
    const lines = [
      `📋 MANIFESTE DES PASSAGERS - DÉPARTS DU ${selectedDate.toUpperCase()}`,
      `Navire / Liaisons : AMR MUGOTE`,
      `Total Voyageurs (PAX) : ${dayStats.totalPax} | Déjà Lâchés / Embarqués : ${dayStats.boardedPax}`,
      `--------------------------------------------------`
    ];

    sortedDayReservations.forEach((r, idx) => {
      const pax = Number(r.passengersCount) || 1;
      const statusIcon = r.boardingStatus === 'BOARDED' ? '✅ [À BORD]' : '⏳ [EN ATTENTE]';
      lines.push(
        `${idx + 1}. ${r.departureTime || '07:30'} | ${r.ship || 'MUGOTE'} | ${r.itinerary || ''} | ${r.fullName} ${r.lastName || ''} (${pax} PAX, ${r.travelClass}) | Tél: ${r.phone} | ${statusIcon}`
      );
    });

    lines.push(`--------------------------------------------------`);
    lines.push(`Généré le ${new Date().toLocaleString('fr-FR')} - Système AMR MUGOTE`);

    navigator.clipboard.writeText(lines.join('\n'));
    showToast("📋 Liste des voyageurs du jour copiée dans le presse-papier !");
  };

  const isSelectedToday = selectedDate === getTodayStr();

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#001E2B] text-white border-2 border-[#00ED64] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in text-xs font-bold">
          <Sparkles size={16} className="text-[#00ED64] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header Card with Signature MongoDB / Database Styling */}
      <div className="bg-[#001E2B] border-2 border-[#00ED64]/40 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-[#00ED64]/10 relative overflow-hidden text-white">
        {/* Glowing Top Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#00ED64] via-[#00684A] to-[#00ED64]" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="p-3 bg-[#00ED64]/15 text-[#00ED64] rounded-2xl border border-[#00ED64]/30 shadow-lg shadow-[#00ED64]/20">
                <Calendar size={26} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    Tableau Récapitulatif Journalier des Départs & Embarquement
                  </h2>
                  <span className="text-[9px] font-black bg-[#00ED64] text-[#001E2B] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {sourceContext === 'mongodb' ? 'MongoDB Atlas' : 'Base de Données'}
                  </span>
                </div>
                <p className="text-xs text-[#00ED64]/80 font-medium mt-0.5">
                  Gestion chronologique ordonnée par date de voyage • Lâcher et pointage direct des passagers à quai
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Tools */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleCopyTextManifest}
              className="px-3.5 py-2.5 bg-[#002B3B] hover:bg-[#00384D] text-[#00ED64] border border-[#00ED64]/30 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm"
              title="Copier la liste complète du jour pour WhatsApp ou la radio"
            >
              <Copy size={14} />
              <span className="hidden sm:inline">Copier le</span> Manifeste
            </button>

            <button
              onClick={handlePrintDailyManifest}
              className="px-4 py-2.5 bg-gradient-to-r from-[#00ED64] to-[#00c853] hover:brightness-110 text-[#001E2B] font-black rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-[#00ED64]/20 active:scale-95"
            >
              <Printer size={14} />
              <span>Imprimer le Manifeste</span>
            </button>

            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2.5 bg-[#002B3B] hover:bg-[#00384D] text-slate-300 border border-white/10 rounded-xl transition cursor-pointer"
                title="Actualiser les données"
              >
                <RefreshCw size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Date Selector Ribbon ("Chaque jour à part") */}
        <div className="mt-6 pt-6 border-t border-[#00ED64]/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#00ED64] flex items-center gap-1.5">
              <Clock size={13} />
              Sélectionnez le Jour de Voyage à Contrôler (Chaque jour à part) :
            </span>

            {/* Direct Date Picker Input */}
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Autre Date :
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-[#002B3B] text-white border border-[#00ED64]/40 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00ED64]"
              />
            </div>
          </div>

          {/* Quick Date Chips Carousel */}
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
            {/* Today Button */}
            <button
              onClick={() => setSelectedDate(getTodayStr())}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                isSelectedToday
                  ? 'bg-[#00ED64] text-[#001E2B] shadow-lg shadow-[#00ED64]/30 scale-102 border-2 border-[#00ED64]'
                  : 'bg-[#002B3B]/80 text-white border border-white/10 hover:border-[#00ED64]/50'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Aujourd'hui ({getTodayStr()})</span>
            </button>

            {/* Available dates from reservations */}
            {availableDatesWithCounts.map(({ date, totalPax, totalRes, boardedPax }) => {
              const isSelected = date === selectedDate;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-2.5 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-[#001E2B] shadow-lg shadow-white/20 border-2 border-[#00ED64] scale-102'
                      : 'bg-[#002B3B]/60 text-slate-300 border border-white/10 hover:bg-[#002B3B] hover:text-white'
                  }`}
                >
                  <Calendar size={13} className={isSelected ? 'text-[#00684A]' : 'text-[#00ED64]'} />
                  <span>{date}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                    isSelected ? 'bg-[#001E2B] text-[#00ED64]' : 'bg-white/10 text-white'
                  }`}>
                    {totalPax} PAX ({boardedPax} à bord)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Daily Progress & Metric Cards for Selected Date */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Users size={13} className="text-blue-600" />
            Total Voyageurs (PAX)
          </span>
          <div className="text-2xl font-black text-slate-900">
            {dayStats.totalPax} <span className="text-xs font-bold text-slate-400">passagers</span>
          </div>
          <span className="text-[10px] font-bold text-slate-500 block">
            sur {dayStats.totalRes} réservation(s)
          </span>
        </div>

        <div className="bg-emerald-50/80 p-4 rounded-2xl border-2 border-emerald-300 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-600" />
            Lâchés / Déjà à Bord
          </span>
          <div className="text-2xl font-black text-emerald-900">
            {dayStats.boardedPax} <span className="text-xs font-bold text-emerald-700">PAX</span>
          </div>
          <span className="text-[10px] font-black text-emerald-700 block">
            {dayStats.percentBoarded}% du navire complété
          </span>
        </div>

        <div className="bg-amber-50/80 p-4 rounded-2xl border-2 border-amber-300 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
            <Clock size={13} className="text-amber-600" />
            À Lâcher / En Attente
          </span>
          <div className="text-2xl font-black text-amber-900">
            {dayStats.pendingPax} <span className="text-xs font-bold text-amber-700">PAX</span>
          </div>
          <span className="text-[10px] font-bold text-amber-700 block">
            En attente d'embarquement
          </span>
        </div>

        <div className="bg-indigo-50/80 p-4 rounded-2xl border-2 border-indigo-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
            <UserCheck size={13} className="text-indigo-600" />
            Réservations Validées
          </span>
          <div className="text-2xl font-black text-indigo-950">
            {dayStats.validatedPax} <span className="text-xs font-bold text-indigo-700">PAX</span>
          </div>
          <span className="text-[10px] font-bold text-indigo-600 block">
            Prêts pour embarquement
          </span>
        </div>

        <div className="bg-slate-900 text-white p-4 rounded-2xl border-2 border-slate-800 shadow-sm space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-gold flex items-center gap-1.5">
            <DollarSign size={13} className="text-gold" />
            Recette du Jour
          </span>
          <div className="text-2xl font-black text-gold">
            {dayStats.totalRevenue} $ <span className="text-xs font-bold text-slate-300">USD</span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 block">
            Paiements vérifiés
          </span>
        </div>
      </div>

      {/* Boarding Progress Bar */}
      {dayStats.totalPax > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-black">
            <span className="uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Anchor size={14} className="text-[#00684A]" />
              Taux d'embarquement / passagers lâchés pour le {formatDateFr(selectedDate)}
            </span>
            <span className="text-emerald-700 font-mono">
              {dayStats.boardedPax} / {dayStats.totalPax} PAX ({dayStats.percentBoarded}%)
            </span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-[#00ED64] transition-all duration-500 rounded-full"
              style={{ width: `${dayStats.percentBoarded}%` }}
            />
          </div>
        </div>
      )}

      {/* Operational Controls & Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone, N° billet, navire..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#00684A] focus:bg-white transition-all"
            />
          </div>

          {/* Quick Ship & Time Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            {uniqueTimes.length > 0 && (
              <select
                value={selectedDepartureTime}
                onChange={(e) => setSelectedDepartureTime(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#00684A]"
              >
                <option value="ALL">Tous les départs ({uniqueTimes.length})</option>
                {uniqueTimes.map(time => (
                  <option key={time} value={time}>Départ de {time}</option>
                ))}
              </select>
            )}

            {uniqueShips.length > 0 && (
              <select
                value={selectedShip}
                onChange={(e) => setSelectedShip(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#00684A]"
              >
                <option value="ALL">Tous les navires ({uniqueShips.length})</option>
                {uniqueShips.map(ship => (
                  <option key={ship} value={ship}>{ship}</option>
                ))}
              </select>
            )}

            {/* Batch Boarding Button */}
            <button
              onClick={handleBatchBoardAllValidated}
              disabled={batchLoading || dayStats.pendingPax === 0}
              className="px-4 py-2.5 bg-[#001E2B] hover:bg-[#003B2B] text-[#00ED64] border border-[#00ED64]/40 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer disabled:opacity-40 shadow-sm active:scale-95"
              title="Lâcher tous les passagers validés du jour en une seule fois"
            >
              <UserCheck size={14} />
              <span>{batchLoading ? 'Lâcher en cours...' : 'Lâcher Tous les Validés'}</span>
            </button>
          </div>
        </div>

        {/* Filter Status Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1 flex items-center gap-1">
            <Filter size={12} /> Filtres :
          </span>

          {[
            { id: 'ALL', label: `Tous (${dayReservations.length})` },
            { id: 'TO_BOARD', label: `À Lâcher / En attente (${dayStats.pendingPax})`, badgeColor: 'bg-amber-100 text-amber-800' },
            { id: 'BOARDED', label: `Déjà Lâchés / Embarqués (${dayStats.boardedPax})`, badgeColor: 'bg-emerald-100 text-emerald-800' },
            { id: 'VALIDATED', label: `Validés uniquement (${dayStats.validatedPax})` },
            { id: 'PENDING', label: `Paiement en attente` }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id as any)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                filterStatus === f.id
                  ? 'bg-[#001E2B] text-[#00ED64] shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Passenger Boarding Manifest Table (Sorted in Order) */}
      <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-xl overflow-hidden">
        {/* Table Title Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ArrowUpDown size={16} className="text-[#00684A]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Liste Ordonnée des Voyageurs du {formatDateFr(selectedDate)} ({filteredReservations.length} affichés)
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-500">
            Tri automatique : Heure de départ ➔ Navire ➔ Nom du passager
          </span>
        </div>

        {filteredReservations.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
              <Users size={32} />
            </div>
            <h4 className="text-base font-black text-slate-700">
              Aucun voyageur trouvé pour cette date
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Aucune réservation ne correspond aux critères pour le <strong>{selectedDate}</strong>. 
              Sélectionnez une autre date dans le sélecteur ci-dessus.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3.5 text-center w-12">N° Ordre</th>
                  <th className="px-5 py-3.5">Heure & Navire</th>
                  <th className="px-5 py-3.5">Voyageur (Nom & Contact)</th>
                  <th className="px-5 py-3.5">Liaison / Classe</th>
                  <th className="px-4 py-3.5 text-center">Billet & Montant</th>
                  <th className="px-5 py-3.5 text-center">Statut d'Embarquement</th>
                  <th className="px-6 py-3.5 text-right">Action Immédiate ("Lâcher")</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredReservations.map((res, index) => {
                  const resId = res.id || (res as any)._id;
                  const isBoarded = res.boardingStatus === 'BOARDED';
                  const isValidated = res.status === 'VALIDATED';
                  const paxCount = Number(res.passengersCount) || 1;
                  const isLoadingThis = actionLoadingId === resId;

                  return (
                    <tr 
                      key={resId || index} 
                      className={`transition-colors hover:bg-slate-50/80 ${
                        isBoarded ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      {/* Chronological order index */}
                      <td className="px-4 py-4 text-center font-mono font-black text-slate-400">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center mx-auto text-[11px] text-slate-700">
                          #{index + 1}
                        </span>
                      </td>

                      {/* Departure Time & Ship */}
                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-[#00684A]" />
                            <span className="font-mono font-black text-sm text-slate-900">
                              {res.departureTime || '07:30'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                            <Ship size={12} className="text-slate-400" />
                            <span>{res.ship || 'Mugote'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Passenger Name & Contact */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                            isBoarded 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {(res.fullName || 'V')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-black text-slate-900 uppercase">
                              {res.fullName} {res.lastName || ''}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                              <span className="flex items-center gap-1">
                                <Phone size={10} />
                                {res.phone || 'N/A'}
                              </span>
                              {res.identityNum && (
                                <span className="bg-slate-100 px-1.5 py-0.2 rounded text-[9px]">
                                  ID: {res.identityNum}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Itinerary & Class & PAX */}
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="font-extrabold text-slate-800 text-[11px] flex items-center gap-1">
                            <span>{res.itinerary || 'GOMA - BUKAVU'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[9px] uppercase">
                              {res.travelClass || 'Standard'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-black text-[9px]">
                              {paxCount} PAX
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Ticket ID & Amount */}
                      <td className="px-4 py-4 text-center">
                        <div className="space-y-1">
                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded block truncate max-w-[110px] mx-auto">
                            {res.ticketId || (resId ? resId.slice(0, 8).toUpperCase() : 'TICKET')}
                          </span>
                          <span className="font-mono font-black text-xs text-slate-900 block">
                            {res.amount}$
                          </span>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full inline-block ${
                            isValidated 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isValidated ? 'Payé' : 'En attente'}
                          </span>
                        </div>
                      </td>

                      {/* Boarding Status with Timestamp */}
                      <td className="px-5 py-4 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border shadow-sm ${
                            isBoarded
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}>
                            {isBoarded ? (
                              <>
                                <CheckCircle2 size={13} className="text-emerald-600" />
                                <span>🚢 À BORD / LÂCHÉ</span>
                              </>
                            ) : (
                              <>
                                <Clock size={13} className="text-amber-600" />
                                <span>Non embarqué</span>
                              </>
                            )}
                          </span>

                          {isBoarded && res.boardedAt && (
                            <span className="text-[9px] text-slate-400 font-mono">
                              Pointé à {new Date(res.boardedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Direct Action "Lâcher directement" */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleBoarding(res)}
                            disabled={isLoadingThis}
                            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 disabled:opacity-50 ${
                              isBoarded
                                ? 'bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200'
                                : 'bg-[#001E2B] hover:bg-[#003B2B] text-[#00ED64] border-2 border-[#00ED64]/60 shadow-emerald-500/20 hover:scale-102'
                            }`}
                            title={isBoarded ? "Annuler le lâcher / Débarquer" : "Lâcher et autoriser l'accès au bateau"}
                          >
                            {isLoadingThis ? (
                              <RefreshCw size={13} className="animate-spin" />
                            ) : isBoarded ? (
                              <>
                                <X size={13} />
                                <span>Débarquer</span>
                              </>
                            ) : (
                              <>
                                <Check size={14} className="text-[#00ED64]" />
                                <span>Lâcher / Embarquer</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Summary Bar */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-bold">
          <div className="flex items-center gap-3">
            <span>
              Total affiché : <strong>{filteredReservations.length}</strong> réservations ({filteredReservations.reduce((acc, r) => acc + (Number(r.passengersCount) || 1), 0)} passagers)
            </span>
            <span>•</span>
            <span className="text-emerald-700 font-black">
              {filteredReservations.filter(r => r.boardingStatus === 'BOARDED').length} déjà lâchés
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
              Base de données synchronisée en temps réel (Firestore & MongoDB Atlas)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

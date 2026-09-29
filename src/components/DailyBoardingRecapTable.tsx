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

      // 2. Mirror in MongoDB Atlas & trigger email confirmation
      try {
        const mongoPayload: any = {
          ...reservation,
          boardingStatus: nextStatus,
          boarded: nextStatus === 'BOARDED',
          boardedAt: boardedTime || undefined,
          isUsed: nextStatus === 'BOARDED',
          email: reservation.email,
          fullName: reservation.fullName,
          lastName: reservation.lastName,
          phone: reservation.phone,
          itinerary: reservation.itinerary,
          ship: reservation.ship,
          travelDate: reservation.travelDate,
          departureTime: reservation.departureTime,
          travelClass: reservation.travelClass,
          amount: reservation.amount
        };
        if (nextStatus === 'BOARDED') {
          mongoPayload.status = 'VALIDATED';
          mongoPayload.ticketId = ticketId;
          mongoPayload.validatedAt = reservation.validatedAt || boardedTime;
        }
        await mongoApi.updateReservationStatus(resId, mongoPayload);

        // Confirmation automatique par Gmail dès que l'administrateur lâche le passager
        if (nextStatus === 'BOARDED' && reservation.email && reservation.email.includes('@')) {
          mongoApi.sendBookingConfirmation(ticketId, reservation.email, mongoPayload).catch(e => {
            console.warn("Direct email confirmation trigger note:", e);
          });
        }
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
          ...r,
          boardingStatus: 'BOARDED',
          boarded: true,
          boardedAt: now,
          isUsed: true,
          usedAt: now,
          status: 'VALIDATED',
          ticketId,
          validatedAt: r.validatedAt || now,
          email: r.email,
          fullName: r.fullName,
          phone: r.phone
        };
        await updateDoc(doc(db, 'reservations', resId), updatePayload);
        await mongoApi.updateReservationStatus(resId, updatePayload).catch(() => null);

        if (r.email && r.email.includes('@')) {
          mongoApi.sendBookingConfirmation(ticketId, r.email, updatePayload).catch(() => null);
        }

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
    <div className="space-y-3.5">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#001E2B] text-white border-2 border-[#00ED64] px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-fade-in text-xs font-bold">
          <Sparkles size={15} className="text-[#00ED64] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header Card with Signature MongoDB / Database Styling - Compact & Refined */}
      <div className="bg-[#001E2B] border border-[#00ED64]/40 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden text-white">
        {/* Glowing Top Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00ED64] via-[#00684A] to-[#00ED64]" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-[#00ED64]/15 text-[#00ED64] rounded-xl border border-[#00ED64]/30 shadow-sm shrink-0">
                <Calendar size={20} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 
                    style={{ fontFamily: '"Times New Roman", Times, serif' }} 
                    className="text-lg sm:text-xl font-bold uppercase tracking-wider text-amber-300 leading-tight"
                  >
                    ETS AMR MUGOTE
                  </h1>
                  <span className="text-[8.5px] font-black bg-[#00ED64] text-[#001E2B] px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {sourceContext === 'mongodb' ? 'MongoDB Atlas' : 'Base de Données'}
                  </span>
                </div>
                <h2 className="text-xs sm:text-sm font-bold text-white mt-0.5">
                  Tableau Récapitulatif Journalier des Départs & Embarquement
                </h2>
                <p className="text-[10px] text-[#00ED64]/80 font-medium">
                  Gestion chronologique par date • Lâcher et pointage direct des passagers à quai
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyTextManifest}
              className="px-3 py-1.5 bg-[#002B3B] hover:bg-[#00384D] text-[#00ED64] border border-[#00ED64]/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              title="Copier la liste complète du jour pour WhatsApp ou la radio"
            >
              <Copy size={13} />
              <span className="hidden sm:inline">Copier</span> Manifeste
            </button>

            <button
              onClick={handlePrintDailyManifest}
              className="px-3.5 py-1.5 bg-gradient-to-r from-[#00ED64] to-[#00c853] hover:brightness-110 text-[#001E2B] font-black rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-[#00ED64]/20 active:scale-95"
            >
              <Printer size={13} />
              <span>Imprimer Manifeste</span>
            </button>

            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 bg-[#002B3B] hover:bg-[#00384D] text-slate-300 border border-white/10 rounded-lg transition cursor-pointer"
                title="Actualiser les données"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Date Selector Ribbon ("Chaque jour à part") */}
        <div className="mt-3.5 pt-3.5 border-t border-[#00ED64]/20 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-[#00ED64] flex items-center gap-1">
              <Clock size={12} />
              Jour de Voyage à Contrôler :
            </span>

            {/* Direct Date Picker Input */}
            <div className="flex items-center gap-1.5">
              <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                Autre Date :
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-[#002B3B] text-white border border-[#00ED64]/40 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-[#00ED64]"
              />
            </div>
          </div>

          {/* Quick Date Chips Carousel */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {/* Today Button */}
            <button
              onClick={() => setSelectedDate(getTodayStr())}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                isSelectedToday
                  ? 'bg-[#00ED64] text-[#001E2B] shadow-md shadow-[#00ED64]/30 border border-[#00ED64]'
                  : 'bg-[#002B3B]/80 text-white border border-white/10 hover:border-[#00ED64]/50'
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
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
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-[#001E2B] shadow-md shadow-white/20 border border-[#00ED64]'
                      : 'bg-[#002B3B]/60 text-slate-300 border border-white/10 hover:bg-[#002B3B] hover:text-white'
                  }`}
                >
                  <Calendar size={12} className={isSelected ? 'text-[#00684A]' : 'text-[#00ED64]'} />
                  <span>{date}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
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

      {/* Daily Progress & Metric Cards for Selected Date - Compact */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-0.5">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Users size={12} className="text-blue-600" />
            Total Voyageurs (PAX)
          </span>
          <div className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
            {dayStats.totalPax} <span className="text-[10px] font-bold text-slate-400">passagers</span>
          </div>
          <span className="text-[9px] font-bold text-slate-500 block">
            sur {dayStats.totalRes} réservation(s)
          </span>
        </div>

        <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-300 shadow-xs space-y-0.5">
          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Lâchés / À Bord
          </span>
          <div className="text-lg sm:text-xl font-black text-emerald-900 leading-tight">
            {dayStats.boardedPax} <span className="text-[10px] font-bold text-emerald-700">PAX</span>
          </div>
          <span className="text-[9px] font-black text-emerald-700 block">
            {dayStats.percentBoarded}% complété
          </span>
        </div>

        <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-300 shadow-xs space-y-0.5">
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1">
            <Clock size={12} className="text-amber-600" />
            À Lâcher / En Attente
          </span>
          <div className="text-lg sm:text-xl font-black text-amber-900 leading-tight">
            {dayStats.pendingPax} <span className="text-[10px] font-bold text-amber-700">PAX</span>
          </div>
          <span className="text-[9px] font-bold text-amber-700 block">
            En attente quai
          </span>
        </div>

        <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-200 shadow-xs space-y-0.5">
          <span className="text-[9px] font-black uppercase tracking-wider text-indigo-800 flex items-center gap-1">
            <UserCheck size={12} className="text-indigo-600" />
            Billets Validés
          </span>
          <div className="text-lg sm:text-xl font-black text-indigo-950 leading-tight">
            {dayStats.validatedPax} <span className="text-[10px] font-bold text-indigo-700">PAX</span>
          </div>
          <span className="text-[9px] font-bold text-indigo-600 block">
            Prêts embarquement
          </span>
        </div>

        <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-xs space-y-0.5 col-span-2 sm:col-span-1">
          <span className="text-[9px] font-black uppercase tracking-wider text-gold flex items-center gap-1">
            <DollarSign size={12} className="text-gold" />
            Recette du Jour
          </span>
          <div className="text-lg sm:text-xl font-black text-gold leading-tight">
            {dayStats.totalRevenue} $ <span className="text-[10px] font-bold text-slate-300">USD</span>
          </div>
          <span className="text-[9px] font-bold text-slate-400 block">
            Paiements vérifiés
          </span>
        </div>
      </div>

      {/* Boarding Progress Bar */}
      {dayStats.totalPax > 0 && (
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="uppercase tracking-wider text-slate-700 flex items-center gap-1.5 text-[11px]">
              <Anchor size={13} className="text-[#00684A]" />
              Taux d'embarquement pour le {formatDateFr(selectedDate)}
            </span>
            <span className="text-emerald-700 font-mono text-xs font-black">
              {dayStats.boardedPax} / {dayStats.totalPax} PAX ({dayStats.percentBoarded}%)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-[#00ED64] transition-all duration-500 rounded-full"
              style={{ width: `${dayStats.percentBoarded}%` }}
            />
          </div>
        </div>
      )}

      {/* Operational Controls & Filter Toolbar - Compact */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone, N° billet, navire..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#00684A] focus:bg-white transition-all"
            />
          </div>

          {/* Quick Ship & Time Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {uniqueTimes.length > 0 && (
              <select
                value={selectedDepartureTime}
                onChange={(e) => setSelectedDepartureTime(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-[#00684A]"
              >
                <option value="ALL">Tous départs ({uniqueTimes.length})</option>
                {uniqueTimes.map(time => (
                  <option key={time} value={time}>Départ {time}</option>
                ))}
              </select>
            )}

            {uniqueShips.length > 0 && (
              <select
                value={selectedShip}
                onChange={(e) => setSelectedShip(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-[#00684A]"
              >
                <option value="ALL">Tous navires ({uniqueShips.length})</option>
                {uniqueShips.map(ship => (
                  <option key={ship} value={ship}>{ship}</option>
                ))}
              </select>
            )}

            {/* Batch Boarding Button */}
            <button
              onClick={handleBatchBoardAllValidated}
              disabled={batchLoading || dayStats.pendingPax === 0}
              className="px-3 py-1.5 bg-[#001E2B] hover:bg-[#003B2B] text-[#00ED64] border border-[#00ED64]/40 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 shadow-xs active:scale-95"
              title="Lâcher tous les passagers validés du jour en une seule fois"
            >
              <UserCheck size={13} />
              <span>{batchLoading ? 'Lâcher...' : 'Lâcher Tous'}</span>
            </button>
          </div>
        </div>

        {/* Filter Status Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-1 flex items-center gap-1">
            <Filter size={11} /> Filtres :
          </span>

          {[
            { id: 'ALL', label: `Tous (${dayReservations.length})` },
            { id: 'TO_BOARD', label: `À Lâcher (${dayStats.pendingPax})` },
            { id: 'BOARDED', label: `Lâchés (${dayStats.boardedPax})` },
            { id: 'VALIDATED', label: `Validés (${dayStats.validatedPax})` },
            { id: 'PENDING', label: `En attente` }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id as any)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                filterStatus === f.id
                  ? 'bg-[#001E2B] text-[#00ED64] shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Passenger Boarding Manifest Table (Sorted in Order) - Compact */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
        {/* Table Title Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={14} className="text-[#00684A]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Liste Ordonnée des Voyageurs du {formatDateFr(selectedDate)} ({filteredReservations.length})
            </h3>
          </div>
          <span className="text-[9px] font-medium text-slate-500">
            Tri : Heure ➔ Navire ➔ Passager
          </span>
        </div>

        {filteredReservations.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
              <Users size={24} />
            </div>
            <h4 className="text-sm font-bold text-slate-700">
              Aucun voyageur trouvé pour cette date
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Aucune réservation ne correspond aux critères pour le <strong>{selectedDate}</strong>.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-[9px] font-black uppercase tracking-wider text-slate-600">
                  <th className="px-2.5 py-2 text-center w-10">N°</th>
                  <th className="px-3 py-2">Heure & Navire</th>
                  <th className="px-3 py-2">Voyageur (Nom & Contact)</th>
                  <th className="px-3 py-2">Liaison / Classe</th>
                  <th className="px-2.5 py-2 text-center">Billet & Montant</th>
                  <th className="px-3 py-2 text-center">Embarquement</th>
                  <th className="px-3 py-2 text-right">Action ("Lâcher")</th>
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
                        isBoarded ? 'bg-emerald-50/25' : ''
                      }`}
                    >
                      {/* Chronological order index */}
                      <td className="px-2.5 py-2 text-center font-mono font-bold text-slate-400">
                        <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center mx-auto text-[10px] text-slate-700">
                          #{index + 1}
                        </span>
                      </td>

                      {/* Departure Time & Ship */}
                      <td className="px-3 py-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <Clock size={11} className="text-[#00684A]" />
                            <span className="font-mono font-bold text-xs text-slate-900">
                              {res.departureTime || '07:30'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[9.5px] font-medium text-slate-600">
                            <Ship size={10} className="text-slate-400" />
                            <span>{res.ship || 'Mugote'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Passenger Name & Contact */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
                            isBoarded 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {(res.fullName || 'V')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate max-w-[170px]">
                              {res.fullName} {res.lastName || ''}
                            </div>
                            <div className="flex items-center gap-1.5 text-[9.5px] text-slate-500 font-mono">
                              <span className="flex items-center gap-0.5">
                                <Phone size={9} />
                                {res.phone || 'N/A'}
                              </span>
                              {res.identityNum && (
                                <span className="bg-slate-100 px-1 py-0.2 rounded text-[8.5px]">
                                  ID: {res.identityNum}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Itinerary & Class & PAX */}
                      <td className="px-3 py-2">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-800 text-[10.5px]">
                            {res.itinerary || 'GOMA - BUKAVU'}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-medium text-[8.5px] uppercase">
                              {res.travelClass || 'Standard'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-bold text-[8.5px]">
                              {paxCount} PAX
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Ticket ID & Amount */}
                      <td className="px-2.5 py-2 text-center">
                        <div className="space-y-0.5">
                          <span className="font-mono text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded block truncate max-w-[95px] mx-auto">
                            {res.ticketId || (resId ? resId.slice(0, 8).toUpperCase() : 'TICKET')}
                          </span>
                          <span className="font-mono font-bold text-xs text-slate-900 block">
                            {res.amount}$
                          </span>
                          <span className={`text-[7.5px] font-bold uppercase px-1.5 py-0.2 rounded-full inline-block ${
                            isValidated 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isValidated ? 'Payé' : 'Attente'}
                          </span>
                        </div>
                      </td>

                      {/* Boarding Status with Timestamp */}
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 border shadow-2xs ${
                            isBoarded
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}>
                            {isBoarded ? (
                              <>
                                <CheckCircle2 size={11} className="text-emerald-600" />
                                <span>À BORD</span>
                              </>
                            ) : (
                              <>
                                <Clock size={11} className="text-amber-600" />
                                <span>En attente</span>
                              </>
                            )}
                          </span>

                          {isBoarded && res.boardedAt && (
                            <span className="text-[8.5px] text-slate-400 font-mono">
                              {new Date(res.boardedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Direct Action "Lâcher directement" */}
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleToggleBoarding(res)}
                          disabled={isLoadingThis}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all inline-flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 ${
                            isBoarded
                              ? 'bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200'
                              : 'bg-[#001E2B] hover:bg-[#003B2B] text-[#00ED64] border border-[#00ED64]/60 shadow-emerald-500/10'
                          }`}
                          title={isBoarded ? "Annuler le lâcher / Débarquer" : "Lâcher et autoriser l'accès au bateau"}
                        >
                          {isLoadingThis ? (
                            <RefreshCw size={11} className="animate-spin" />
                          ) : isBoarded ? (
                            <>
                              <X size={11} />
                              <span>Débarquer</span>
                            </>
                          ) : (
                            <>
                              <Check size={12} className="text-[#00ED64]" />
                              <span>Lâcher</span>
                            </>
                          )}
                        </button>
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

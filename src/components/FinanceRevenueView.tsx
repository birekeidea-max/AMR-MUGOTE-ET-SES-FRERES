import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  Download, 
  Printer, 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  Filter, 
  Ship, 
  FileSpreadsheet,
  Layers,
  ChevronDown
} from 'lucide-react';
import { Reservation } from '../types';

interface FinanceRevenueViewProps {
  reservations: Reservation[];
  exchangeRate?: number;
}

type PeriodMode = 'day' | 'week' | 'month';

interface RevenueGroup {
  key: string;
  label: string;
  subLabel?: string;
  dateObj: Date;
  totalReservations: number;
  validatedReservations: number;
  totalPassengers: number;
  validatedRevenueUSD: number;
  pendingRevenueUSD: number;
  totalRevenueUSD: number;
  validatedRevenueCDF: number;
}

export const FinanceRevenueView: React.FC<FinanceRevenueViewProps> = ({
  reservations,
  exchangeRate = 2850
}) => {
  const [period, setPeriod] = useState<PeriodMode>('day');
  const [statusFilter, setStatusFilter] = useState<'all' | 'validated'>('validated');
  const [shipFilter, setShipFilter] = useState<string>('all');
  const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filtrage préliminaire des réservations
  const filteredReservations = useMemo(() => {
    return reservations.filter(res => {
      if (shipFilter !== 'all' && res.ship !== shipFilter) return false;
      if (statusFilter === 'validated') {
        return res.status === 'VALIDATED' || res.boardingStatus === 'BOARDED' || res.boarded === true;
      }
      return res.status !== 'REJECTED' && res.status !== 'ANNULÉ';
    });
  }, [reservations, shipFilter, statusFilter]);

  // Calcul des statistiques globales (KPIs)
  const globalStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    // Début de semaine (lundi)
    const currentDayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - currentDayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    // Début de mois
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalValUSD = 0;
    let todayValUSD = 0;
    let weekValUSD = 0;
    let monthValUSD = 0;
    let totalPassengers = 0;
    let todayCount = 0;

    reservations.forEach(r => {
      const isValid = r.status === 'VALIDATED' || r.boardingStatus === 'BOARDED' || r.boarded === true;
      const amt = Number(r.amount || 20);
      const pax = Number(r.passengersCount || 1);

      if (isValid) {
        totalValUSD += amt;
        totalPassengers += pax;

        if (r.travelDate === todayStr) {
          todayValUSD += amt;
          todayCount += pax;
        }

        const rDate = r.travelDate ? new Date(r.travelDate) : (r.createdAt ? new Date(r.createdAt) : null);
        if (rDate) {
          if (rDate >= startOfWeek) weekValUSD += amt;
          if (rDate >= startOfMonth) monthValUSD += amt;
        }
      }
    });

    return {
      totalValUSD,
      totalValCDF: totalValUSD * exchangeRate,
      todayValUSD,
      todayValCDF: todayValUSD * exchangeRate,
      weekValUSD,
      weekValCDF: weekValUSD * exchangeRate,
      monthValUSD,
      monthValCDF: monthValUSD * exchangeRate,
      totalPassengers,
      todayCount
    };
  }, [reservations, exchangeRate]);

  // Regroupement selon la période : Jour, Semaine, Mois
  const groupedData = useMemo<RevenueGroup[]>(() => {
    const map = new Map<string, RevenueGroup>();

    filteredReservations.forEach(r => {
      const rawDateStr = r.travelDate || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '2026-01-01');
      const d = new Date(rawDateStr);
      const isValidDate = !isNaN(d.getTime());
      const dateObj = isValidDate ? d : new Date();

      let groupKey = '';
      let groupLabel = '';
      let subLabel = '';

      if (period === 'day') {
        groupKey = rawDateStr;
        groupLabel = dateObj.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
        subLabel = rawDateStr;
      } else if (period === 'week') {
        // Numéro de semaine ISO
        const startOfYear = new Date(dateObj.getFullYear(), 0, 1);
        const pastDaysOfYear = (dateObj.getTime() - startOfYear.getTime()) / 86400000;
        const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
        groupKey = `${dateObj.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
        groupLabel = `Semaine ${weekNum} (${dateObj.getFullYear()})`;
        subLabel = `Mois de ${dateObj.toLocaleDateString('fr-FR', { month: 'long' })}`;
      } else {
        // Mois
        const y = dateObj.getFullYear();
        const m = dateObj.getMonth();
        groupKey = `${y}-${String(m + 1).padStart(2, '0')}`;
        groupLabel = dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        groupLabel = groupLabel.charAt(0).toUpperCase() + groupLabel.slice(1);
        subLabel = `${y}`;
      }

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          key: groupKey,
          label: groupLabel,
          subLabel,
          dateObj,
          totalReservations: 0,
          validatedReservations: 0,
          totalPassengers: 0,
          validatedRevenueUSD: 0,
          pendingRevenueUSD: 0,
          totalRevenueUSD: 0,
          validatedRevenueCDF: 0
        });
      }

      const item = map.get(groupKey)!;
      const amt = Number(r.amount || 20);
      const pax = Number(r.passengersCount || 1);
      const isValid = r.status === 'VALIDATED' || r.boardingStatus === 'BOARDED' || r.boarded === true;

      item.totalReservations += 1;
      item.totalPassengers += pax;
      item.totalRevenueUSD += amt;

      if (isValid) {
        item.validatedReservations += 1;
        item.validatedRevenueUSD += amt;
        item.validatedRevenueCDF += amt * exchangeRate;
      } else {
        item.pendingRevenueUSD += amt;
      }
    });

    // Trier chronologiquement pour le graphique
    const sorted = Array.from(map.values()).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    return sorted;
  }, [filteredReservations, period, exchangeRate]);

  // Valeur maximale pour dimensionner les barres du graphique
  const maxRevenue = useMemo(() => {
    if (groupedData.length === 0) return 100;
    const max = Math.max(...groupedData.map(g => g.validatedRevenueUSD));
    return max > 0 ? max : 100;
  }, [groupedData]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Période',
      'Libellé',
      'Réservations Validées',
      'Total Réservations',
      'Passagers',
      'Recette Validée (USD)',
      'Recette Validée (CDF)',
      'Taux Taux de Change'
    ];

    const rows = groupedData.map(g => [
      `"${g.key}"`,
      `"${g.label}"`,
      g.validatedReservations,
      g.totalReservations,
      g.totalPassengers,
      g.validatedRevenueUSD.toFixed(2),
      Math.round(g.validatedRevenueCDF),
      exchangeRate
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
      [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Recettes_AMR_MUGOTE_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Impression
  const handlePrint = () => {
    window.print();
  };

  const formatMoney = (usd: number) => {
    if (currency === 'CDF') {
      return `${Math.round(usd * exchangeRate).toLocaleString('fr-FR')} FC`;
    }
    return `${usd.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-800">
      {/* Entête avec Titre & Actions d'Exportation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <DollarSign size={20} className="stroke-[2.5]" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">
              Recettes & Analyse Financière
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Suivi complet des encaissements par jour, semaine et mois avec graphiques d'évolution et export comptable.
          </p>
        </div>

        {/* Contrôles & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Basculeur de devise */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currency === 'USD' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              $ USD
            </button>
            <button
              type="button"
              onClick={() => setCurrency('CDF')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currency === 'CDF' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              FC (CDF)
            </button>
          </div>

          {/* Bouton Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            title="Exporter les recettes en format CSV Excel"
          >
            <FileSpreadsheet size={15} />
            <span>Exporter CSV</span>
          </button>

          {/* Bouton Imprimer */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-black active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            title="Imprimer le rapport financier"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">Imprimer</span>
          </button>
        </div>
      </div>

      {/* Cartes Métriques (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Recette Globale Validée */}
        <div className="bg-gradient-to-br from-slate-950 to-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign size={64} />
          </div>
          <span className="text-[10px] uppercase font-black tracking-widest text-emerald-400 block mb-1">
            Recette Totale Encaissée
          </span>
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1">
            {formatMoney(globalStats.totalValUSD)}
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between pt-2 border-t border-white/10 mt-2">
            <span>{globalStats.totalPassengers} passagers validés</span>
            <span className="text-emerald-400 font-bold">100% Vérifié</span>
          </div>
        </div>

        {/* Recette du Jour */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <span className="text-[10px] uppercase font-black tracking-widest text-blue-600 block mb-1">
            Recette d'Aujourd'hui
          </span>
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-1">
            {formatMoney(globalStats.todayValUSD)}
          </div>
          <div className="text-[10px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
            <span>{globalStats.todayCount} passager(s) au départ</span>
            <span className="text-blue-600 font-bold">Aujourd'hui</span>
          </div>
        </div>

        {/* Recette de la Semaine */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <span className="text-[10px] uppercase font-black tracking-widest text-indigo-600 block mb-1">
            Cette Semaine
          </span>
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-1">
            {formatMoney(globalStats.weekValUSD)}
          </div>
          <div className="text-[10px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
            <span>Cumul 7 derniers jours</span>
            <span className="text-indigo-600 font-bold">Hebdomadaire</span>
          </div>
        </div>

        {/* Recette du Mois */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <span className="text-[10px] uppercase font-black tracking-widest text-amber-600 block mb-1">
            Ce Mois-ci
          </span>
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-1">
            {formatMoney(globalStats.monthValUSD)}
          </div>
          <div className="text-[10px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
            <span>Mois en cours</span>
            <span className="text-amber-600 font-bold">Mensuel</span>
          </div>
        </div>
      </div>

      {/* Barre de Filtres & Sélecteur de Période (Jour / Semaine / Mois) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Sélecteur de Période Principal */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setPeriod('day')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              period === 'day' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Calendar size={13} />
            <span>Par Jour</span>
          </button>

          <button
            type="button"
            onClick={() => setPeriod('week')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              period === 'week' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <BarChart3 size={13} />
            <span>Par Semaine</span>
          </button>

          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              period === 'month' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <TrendingUp size={13} />
            <span>Par Mois</span>
          </button>
        </div>

        {/* Filtres secondaires : Navire & Statut */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Filtre navire */}
          <div className="flex items-center gap-1.5 text-xs">
            <Ship size={14} className="text-slate-400 shrink-0" />
            <select
              value={shipFilter}
              onChange={e => setShipFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="all">Tous les navires</option>
              <option value="Bateau Mugote">Bateau Mugote</option>
              <option value="Mugote 1">Mugote 1</option>
              <option value="Mugote 2">Mugote 2</option>
              <option value="Mugote 3">Mugote 3</option>
            </select>
          </div>

          {/* Filtre statut */}
          <div className="flex items-center gap-1.5 text-xs">
            <Filter size={14} className="text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="validated">Billets Validés / Encaissés</option>
              <option value="all">Toutes réservations (y compris attente)</option>
            </select>
          </div>
        </div>
      </div>

      {/* SECTION GRAPHIQUE INTERACTIF */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <BarChart3 size={16} className="text-emerald-600" />
              <span>
                Graphique d'Évolution des Recettes ({period === 'day' ? 'Par Jour' : period === 'week' ? 'Par Semaine' : 'Par Mois'})
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Survolez une barre pour afficher le détail exact du chiffre d'affaires et du nombre de passagers.
            </p>
          </div>

          <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            Total Période : {formatMoney(groupedData.reduce((acc, g) => acc + g.validatedRevenueUSD, 0))}
          </div>
        </div>

        {groupedData.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs font-medium">
            Aucune donnée financière enregistrée pour les filtres sélectionnés.
          </div>
        ) : (
          <div className="pt-6 pb-2">
            {/* Histogramme interactif en barres SVG & HTML Responsive */}
            <div className="h-64 flex items-end gap-2 sm:gap-3 overflow-x-auto pb-6 pt-12 px-2 no-scrollbar">
              {groupedData.map((item, idx) => {
                const heightPercent = maxRevenue > 0 
                  ? Math.max(8, Math.round((item.validatedRevenueUSD / maxRevenue) * 100))
                  : 8;
                const isHovered = hoveredIndex === idx;

                return (
                  <div
                    key={item.key}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className="flex-1 min-w-[42px] max-w-[70px] flex flex-col items-center h-full justify-end relative group cursor-pointer"
                  >
                    {/* Tooltip au survol */}
                    {isHovered && (
                      <div className="absolute -top-12 z-30 bg-slate-900 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-xl border border-slate-700 whitespace-nowrap animate-fade-in pointer-events-none text-center">
                        <div className="text-emerald-400">{formatMoney(item.validatedRevenueUSD)}</div>
                        <div className="text-slate-300 text-[9px]">{item.validatedReservations} réservation(s)</div>
                      </div>
                    )}

                    {/* Étiquette supérieure de montant si espace suffisant */}
                    <span className="text-[9px] font-bold text-slate-400 mb-1 truncate max-w-full">
                      ${Math.round(item.validatedRevenueUSD)}
                    </span>

                    {/* Barre de l'histogramme */}
                    <div 
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-xl transition-all duration-300 relative ${
                        isHovered 
                          ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' 
                          : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                    >
                      {/* Ligne lumineuse en tête de barre */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400 rounded-t-xl" />
                    </div>

                    {/* Label temporel en bas */}
                    <div className="mt-2 text-center w-full">
                      <span className="text-[9px] font-bold text-slate-600 block truncate" title={item.label}>
                        {period === 'day' 
                          ? item.label.split(' ')[0] + ' ' + item.label.split(' ')[1] 
                          : period === 'week' 
                          ? `S${item.key.split('-W')[1]}` 
                          : item.label.slice(0, 4)}
                      </span>
                      <span className="text-[8px] text-slate-400 block font-mono">
                        {item.validatedReservations} rés.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* TABLEAU RÉCAPITULATIF DÉTAILLÉ */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Registre Détaillé des Recettes ({groupedData.length} périodes identifiées)
            </h3>
            <p className="text-[10px] text-slate-500">
              Récapitulatif comptable officiel pour export et consultation.
            </p>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Taux : 1 $ = {exchangeRate} FC
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-[10px] uppercase font-black tracking-wider text-slate-600">
                <th className="py-3.5 px-4 sm:px-6">Période / Date</th>
                <th className="py-3.5 px-3 text-center">Réservations Validées</th>
                <th className="py-3.5 px-3 text-center">Passagers Totaux</th>
                <th className="py-3.5 px-4 text-right">Recette Validée (USD)</th>
                <th className="py-3.5 px-4 text-right">Contrevaleur (CDF)</th>
                <th className="py-3.5 px-4 text-center">Statut d'Encaissement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {groupedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    Aucune recette enregistrée pour cette période.
                  </td>
                </tr>
              ) : (
                groupedData.slice().reverse().map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900">
                      <div className="text-xs">{row.label}</div>
                      {row.subLabel && (
                        <div className="text-[10px] font-mono text-slate-400 font-normal">{row.subLabel}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center font-bold">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-800">
                        {row.validatedReservations} / {row.totalReservations}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                      {row.totalPassengers}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                      ${row.validatedRevenueUSD.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-800 text-xs">
                      {Math.round(row.validatedRevenueCDF).toLocaleString('fr-FR')} FC
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={10} /> Validé & Encaissé
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {groupedData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-black text-xs">
                  <td className="py-4 px-4 sm:px-6 uppercase tracking-wider">
                    TOTAL GÉNÉRAL
                  </td>
                  <td className="py-4 px-3 text-center">
                    {groupedData.reduce((acc, g) => acc + g.validatedReservations, 0)} validées
                  </td>
                  <td className="py-4 px-3 text-center">
                    {groupedData.reduce((acc, g) => acc + g.totalPassengers, 0)} passagers
                  </td>
                  <td className="py-4 px-4 text-right text-emerald-400 text-sm">
                    ${groupedData.reduce((acc, g) => acc + g.validatedRevenueUSD, 0).toFixed(2)}
                  </td>
                  <td className="py-4 px-4 text-right text-emerald-400 font-mono text-xs">
                    {Math.round(groupedData.reduce((acc, g) => acc + g.validatedRevenueCDF, 0)).toLocaleString('fr-FR')} FC
                  </td>
                  <td className="py-4 px-4 text-center text-slate-400 text-[10px] uppercase tracking-wider">
                    Conforme
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default FinanceRevenueView;

import React, { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight, 
  Server, 
  ShieldCheck, 
  Layers, 
  UploadCloud, 
  Check, 
  Clock, 
  PlusCircle, 
  Search, 
  Trash2, 
  Edit3 
} from 'lucide-react';
import { mongoApi } from '../services/api';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

function sanitizeFirestoreDoc(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj.toDate && typeof obj.toDate === 'function') {
    try {
      return obj.toDate().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  if ('seconds' in obj && typeof obj.seconds === 'number') {
    return new Date(obj.seconds * 1000).toISOString();
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeFirestoreDoc);
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      result[key] = sanitizeFirestoreDoc(val);
    }
  }
  return result;
}

export function MongoMigrationView() {
  const [healthData, setHealthData] = useState<{
    server: string;
    database: string;
    databaseStatus: string;
    isConnected: boolean;
    lastError?: string | null;
    counts?: Record<string, number>;
  } | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  // CRUD Test State
  const [crudLoading, setCrudLoading] = useState(false);
  const [crudLogs, setCrudLogs] = useState<Array<{ time: string; type: 'info' | 'success' | 'error'; message: string }>>([]);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const data = await mongoApi.getHealth();
      setHealthData(data);
    } catch (err: any) {
      console.warn("Health check error:", err);
      setHealthData({
        server: 'ok',
        database: 'mongodb',
        databaseStatus: 'error',
        isConnected: false,
        lastError: err?.message || String(err)
      });
    } finally {
      setLoadingHealth(false);
    }
  };

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      await mongoApi.reconnect();
      await fetchHealth();
    } catch (err: any) {
      console.error("Reconnect failed:", err);
      await fetchHealth();
    } finally {
      setReconnecting(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const addLog = (type: 'info' | 'success' | 'error', message: string) => {
    const time = new Date().toLocaleTimeString('fr-FR');
    setCrudLogs(prev => [{ time, type, message }, ...prev.slice(0, 15)]);
  };

  const handleMigration = async () => {
    if (!window.confirm("Voulez-vous lancer la synchronisation de toutes les données de Firestore vers MongoDB Atlas ?\n\nCette opération est STRICTEMENT NON DESTRUCTIVE : aucune donnée existante de Firestore ne sera supprimée.")) {
      return;
    }
    setMigrating(true);
    setMigrationError(null);
    setMigrationResult(null);
    addLog('info', "Démarrage de la migration non-destructive Firestore -> MongoDB Atlas...");

    try {
      // 1. First, attempt client-side collection read from authenticated Firestore
      addLog('info', "Lecture des collections Firestore (Paramètres, Horaires, Navires, Actualités, Utilisateurs, Réservations)...");

      let settingsData: any = null;
      try {
        const sSnap = await getDoc(doc(db, 'settings', 'site'));
        if (sSnap.exists()) settingsData = sSnap.data();
      } catch (e) {
        console.warn("Could not read site settings from client Firestore:", e);
      }

      const [schedSnap, fleetSnap, newsSnap, usersSnap, resSnap] = await Promise.all([
        getDocs(collection(db, 'schedules')).catch(() => null),
        getDocs(collection(db, 'fleet')).catch(() => null),
        getDocs(collection(db, 'news')).catch(() => null),
        getDocs(collection(db, 'users')).catch(() => null),
        getDocs(collection(db, 'reservations')).catch(() => null),
      ]);

      const schedulesList = schedSnap ? schedSnap.docs.map(d => sanitizeFirestoreDoc({ id: d.id, ...d.data() })) : [];
      const fleetList = fleetSnap ? fleetSnap.docs.map(d => sanitizeFirestoreDoc({ id: d.id, ...d.data() })) : [];
      const newsList = newsSnap ? newsSnap.docs.map(d => sanitizeFirestoreDoc({ id: d.id, ...d.data() })) : [];
      const usersList = usersSnap ? usersSnap.docs.map(d => sanitizeFirestoreDoc({ id: d.id, ...d.data() })) : [];
      const resList = resSnap ? resSnap.docs.map(d => sanitizeFirestoreDoc({ id: d.id, ...d.data() })) : [];

      addLog('info', `Firestore lu : ${resList.length} réservations, ${schedListCount(schedulesList)} horaires, ${fleetList.length} navires.`);

      // 2. Send batch to backend MongoDB endpoint
      const batchRes = await mongoApi.batchMigration({
        settings: settingsData ? sanitizeFirestoreDoc(settingsData) : null,
        schedules: schedulesList,
        fleet: fleetList,
        news: newsList,
        users: usersList,
        reservations: resList
      });

      setMigrationResult(batchRes);
      const resMigrated = batchRes.stats?.reservations?.migrated || 0;
      const schedMigrated = batchRes.stats?.schedules?.migrated || 0;
      const fleetMigrated = batchRes.stats?.fleet?.migrated || 0;
      addLog('success', `Migration terminée avec succès ! (${resMigrated} réservations, ${schedMigrated} horaires, ${fleetMigrated} navires sauvegardés dans MongoDB Atlas)`);
      fetchHealth();
    } catch (err: any) {
      console.error("Batch migration error:", err);
      setMigrationError(err?.message || "Échec de la synchronisation vers MongoDB Atlas");
      addLog('error', `Erreur de migration : ${err?.message || 'Erreur inconnue'}`);
    } finally {
      setMigrating(false);
    }
  };

  const schedListCount = (list: any[]) => list?.length || 0;

  // 1. CREATE TEST
  const handleTestCreate = async () => {
    setCrudLoading(true);
    try {
      const testRes = await mongoApi.createReservation({
        fullName: `Passager Test Atlas ${Math.floor(Math.random() * 1000)}`,
        phone: "+243 999 000 111",
        itinerary: "Bukavu-Goma",
        ship: "Mugote 1",
        travelDate: new Date().toISOString().split('T')[0],
        travelClass: "VIP",
        passengersCount: 1,
        amount: 27,
        paymentMethod: "Mobile Money",
        status: "PENDING"
      });
      setLastCreatedId(testRes._id || testRes.ticketId || null);
      addLog('success', `[CREATE] Document créé dans MongoDB Atlas ! ID: ${testRes._id} | Billet: ${testRes.ticketId}`);
      fetchHealth();
    } catch (err: any) {
      addLog('error', `[CREATE] Échec création: ${err.message}`);
    } finally {
      setCrudLoading(false);
    }
  };

  // 2. READ TEST
  const handleTestRead = async () => {
    setCrudLoading(true);
    try {
      const list = await mongoApi.getReservations();
      addLog('info', `[READ] ${list.length} réservations lues avec succès depuis MongoDB Atlas.`);
      if (list.length > 0) {
        setLastCreatedId(list[0]._id || list[0].ticketId || null);
      }
    } catch (err: any) {
      addLog('error', `[READ] Échec lecture: ${err.message}`);
    } finally {
      setCrudLoading(false);
    }
  };

  // 3. UPDATE TEST
  const handleTestUpdate = async () => {
    if (!lastCreatedId) {
      addLog('info', "Veuillez d'abord créer ou charger une réservation pour tester la mise à jour.");
      return;
    }
    setCrudLoading(true);
    try {
      const updated = await mongoApi.updateReservation(lastCreatedId, {
        status: 'VALIDATED',
        notes: `Mis à jour le ${new Date().toLocaleTimeString('fr-FR')}`
      });
      addLog('success', `[UPDATE] Réservation ${updated.ticketId || lastCreatedId} validée dans MongoDB Atlas !`);
      fetchHealth();
    } catch (err: any) {
      addLog('error', `[UPDATE] Échec mise à jour: ${err.message}`);
    } finally {
      setCrudLoading(false);
    }
  };

  // 4. DELETE TEST
  const handleTestDelete = async () => {
    if (!lastCreatedId) {
      addLog('info', "Aucun ID sélectionné pour le test de suppression.");
      return;
    }
    setCrudLoading(true);
    try {
      await mongoApi.deleteReservation(lastCreatedId);
      addLog('success', `[DELETE] Document ${lastCreatedId} supprimé de MongoDB Atlas.`);
      setLastCreatedId(null);
      fetchHealth();
    } catch (err: any) {
      addLog('error', `[DELETE] Échec suppression: ${err.message}`);
    } finally {
      setCrudLoading(false);
    }
  };

  const isConnected = healthData?.isConnected || healthData?.databaseStatus === 'connected';

  return (
    <div className="space-y-6">
      {/* Header & Status Card */}
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <Database size={20} />
              </span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                MongoDB Atlas & Architecture Backend
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Supervision de l'état de la base de données principale et passerelle Express / Mongoose.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleReconnect}
              disabled={reconnecting}
              className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={reconnecting ? 'animate-spin' : ''} />
              {reconnecting ? 'Connexion...' : 'Tester / Reconnecter'}
            </button>

            <button
              onClick={fetchHealth}
              disabled={loadingHealth}
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <RefreshCw size={14} className={loadingHealth ? 'animate-spin' : ''} />
              Actualiser
            </button>

            <div className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : healthData?.databaseStatus === 'connecting'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`} />
              {isConnected 
                ? 'MongoDB Atlas Connecté' 
                : healthData?.databaseStatus === 'connecting' 
                  ? 'Connexion en cours...' 
                  : 'MongoDB En attente MONGODB_URI'}
            </div>
          </div>
        </div>

        {healthData?.lastError && !isConnected && (
          <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-xs text-rose-300">
            <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Détail du diagnostic de connexion :</span>
              <p className="font-mono text-[11px] text-rose-200 break-all">{healthData.lastError}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Astuce : Dans votre console <strong>MongoDB Atlas &gt; Network Access</strong>, assurez-vous d'avoir ajouté l'autorisation IP <code className="bg-white/10 px-1 py-0.5 rounded text-amber-300">0.0.0.0/0</code> (Allow Access from Anywhere) pour autoriser les requêtes du serveur Cloud.
              </p>
            </div>
          </div>
        )}

        {/* Database Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Réservations</span>
            <span className="text-xl font-black text-white mt-1 block">
              {healthData?.counts?.reservations ?? '0'}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">Atlas Collection</span>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Horaires</span>
            <span className="text-xl font-black text-white mt-1 block">
              {healthData?.counts?.schedules ?? '0'}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">Liaisons actives</span>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Flotte</span>
            <span className="text-xl font-black text-white mt-1 block">
              {healthData?.counts?.fleet ?? '0'}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">Navires rapides</span>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Actualités</span>
            <span className="text-xl font-black text-white mt-1 block">
              {healthData?.counts?.news ?? '0'}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">Publications</span>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Passagers</span>
            <span className="text-xl font-black text-white mt-1 block">
              {healthData?.counts?.users ?? '0'}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">Comptes sync</span>
          </div>
        </div>
      </div>

      {/* Architecture Flow Diagram */}
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Layers size={16} className="text-gold" />
          Flux d'Architecture & Sécurité
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block">Frontend</span>
            <p className="text-xs font-bold text-white">React 19 / Vite</p>
            <p className="text-[11px] text-slate-400">Services d'API HTTP REST</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">Authentification</span>
            <p className="text-xs font-bold text-white">Firebase Auth</p>
            <p className="text-[11px] text-slate-400">ID Token (Bearer)</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">Serveur</span>
            <p className="text-xs font-bold text-white">Node.js / Express</p>
            <p className="text-[11px] text-slate-400">Admin SDK & Mongoose</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">Base de Données</span>
            <p className="text-xs font-bold text-white">MongoDB Atlas</p>
            <p className="text-[11px] text-slate-400">Collections persistantes</p>
          </div>
        </div>
      </div>

      {/* Migration Trigger Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 rounded-3xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UploadCloud className="text-gold" size={20} />
              Synchronisation Non Destructive Firestore → MongoDB Atlas
            </h3>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Importe l'intégralité des tarifs, horaires, navires, réservations, billets et profils existants de Firestore vers votre cluster MongoDB Atlas. 
              Les identifiants et clés uniques sont conservés pour éviter tout doublon.
            </p>
          </div>

          <button
            onClick={handleMigration}
            disabled={migrating}
            className="px-5 py-2.5 bg-gold hover:bg-gold-light text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-lg cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {migrating ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Synchronisation en cours...
              </>
            ) : (
              <>
                <UploadCloud size={14} />
                Lancer la Synchronisation
              </>
            )}
          </button>
        </div>

        {migrationResult && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-400">
              <CheckCircle2 size={16} />
              {migrationResult.message}
            </div>
            {migrationResult.stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2 text-white">
                <div className="bg-black/30 p-2 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block">Paramètres</span>
                  <span className="font-bold">{migrationResult.stats.settings?.migrated || 0}</span>
                </div>
                <div className="bg-black/30 p-2 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block">Horaires</span>
                  <span className="font-bold">{migrationResult.stats.schedules?.migrated || 0}</span>
                </div>
                <div className="bg-black/30 p-2 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block">Flotte</span>
                  <span className="font-bold">{migrationResult.stats.fleet?.migrated || 0}</span>
                </div>
                <div className="bg-black/30 p-2 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block">Articles</span>
                  <span className="font-bold">{migrationResult.stats.news?.migrated || 0}</span>
                </div>
                <div className="bg-black/30 p-2 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block">Passagers</span>
                  <span className="font-bold">{migrationResult.stats.users?.migrated || 0}</span>
                </div>
                <div className="bg-black/30 p-2 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block">Réservations</span>
                  <span className="font-bold">{migrationResult.stats.reservations?.migrated || 0}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {migrationError && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{migrationError}</span>
          </div>
        )}
      </div>

      {/* CRUD Test Console for MongoDB Atlas */}
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-400" />
              Banc de Test Opérationnel CRUD (MongoDB Atlas)
            </h3>
            <p className="text-xs text-slate-400">
              Effectue des opérations directes sur le cluster MongoDB Atlas via les endpoints Node.js / Express.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTestCreate}
              disabled={crudLoading}
              className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <PlusCircle size={13} /> Test CREATE
            </button>
            <button
              onClick={handleTestRead}
              disabled={crudLoading}
              className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Search size={13} /> Test READ
            </button>
            <button
              onClick={handleTestUpdate}
              disabled={crudLoading || !lastCreatedId}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
            >
              <Edit3 size={13} /> Test UPDATE
            </button>
            <button
              onClick={handleTestDelete}
              disabled={crudLoading || !lastCreatedId}
              className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
            >
              <Trash2 size={13} /> Test DELETE
            </button>
          </div>
        </div>

        {/* Live Logs Terminal */}
        <div className="bg-slate-950 border border-white/10 rounded-2xl p-4 font-mono text-xs max-h-48 overflow-y-auto space-y-1.5">
          {crudLogs.length === 0 ? (
            <div className="text-slate-500 italic">
              Cliquez sur un des boutons de test ci-dessus pour observer les transactions MongoDB Atlas en direct...
            </div>
          ) : (
            crudLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0">[{log.time}]</span>
                <span className={
                  log.type === 'success' 
                    ? 'text-emerald-400' 
                    : log.type === 'error' 
                      ? 'text-rose-400' 
                      : 'text-cyan-400'
                }>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

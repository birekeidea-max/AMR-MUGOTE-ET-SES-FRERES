import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { 
  User, 
  Search, 
  Share2, 
  Copy, 
  Check, 
  Phone, 
  Mail, 
  Clock, 
  Users 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

// Definir types en accord avec Firebase
interface RegisteredUser {
  id: string;
  uid?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  isAnonymous?: boolean;
  lastLogin?: any;
}

export default function UsersListView({ className }: { className?: string }) {
  const [usersList, setUsersList] = useState<RegisteredUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Feedbacks de copie/partage par ID d'utilisateur
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);

  useEffect(() => {
    // Ecoute en temps réel de tous les utilisateurs enregistrés dans 'users_list'
    const q = query(collection(db, 'users_list'), orderBy('lastLogin', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: RegisteredUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          ...data
        });
      });
      setUsersList(list);
      setLoading(false);
    }, (error) => {
      console.error("Erreur lors de la lecture des utilisateurs :", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCopy = async (user: RegisteredUser) => {
    const name = user.displayName || 'Utilisateur Anonyme';
    const phone = user.phone || 'Non spécifié';
    const email = user.email && user.email !== 'Anonyme' ? user.email : 'Non configuré';
    
    const textToCopy = `📝 ETS AMR MUGOTE - UTILISATEUR\n🔖 Nom : ${name.toUpperCase()}\n📱 Tél : ${phone}\n✉️ Email : ${email}`;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(user.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Échec de la copie :", err);
    }
  };

  const handleShare = async (user: RegisteredUser) => {
    const name = user.displayName || 'Utilisateur Anonyme';
    const phone = user.phone || 'Non spécifié';
    const email = user.email && user.email !== 'Anonyme' ? user.email : 'Non configuré';
    
    const shareData = {
      title: 'Navigation Mugote - Contact Utilisateur',
      text: `Utilisateur Mugote :\nNom : ${name.toUpperCase()}\nTél : ${phone}\nEmail : ${email}`,
      url: window.location.origin
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        setSharedId(user.id);
        setTimeout(() => setSharedId(null), 2000);
      } else {
        // Fallback: copier le texte et notifier de façon claire
        await navigator.clipboard.writeText(shareData.text);
        setSharedId(user.id);
        setTimeout(() => setSharedId(null), 2000);
        // Popup amicale
        alert(`Infos d'utilisateur copiées pour le partage :\n\n${shareData.text}`);
      }
    } catch (err) {
      console.warn("Le partage a échoué ou a été annulé :", err);
      // Fallback sûr
      try {
        await navigator.clipboard.writeText(shareData.text);
        setSharedId(user.id);
        setTimeout(() => setSharedId(null), 2000);
      } catch (copyErr) {
        console.error(copyErr);
      }
    }
  };

  // Filtrer la liste des utilisateurs en temps réel
  const filteredUsers = usersList.filter(u => {
    const nameMatches = (u.displayName || '').toLowerCase().includes(search.toLowerCase());
    const phoneMatches = (u.phone || '').toLowerCase().includes(search.toLowerCase());
    const emailMatches = (u.email || '').toLowerCase().includes(search.toLowerCase());
    return nameMatches || phoneMatches || emailMatches;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className={cn("w-full max-w-5xl mx-auto space-y-6 md:space-y-8", className)}
    >
      {/* En-tête / Header */}
      <div className="bg-gradient-to-r from-[#001233] to-[#002255] text-white p-6 sm:p-10 rounded-[32px] shadow-xl relative overflow-hidden border border-white/5 text-left">
        {/* Background Overlay Decor */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radialEdge from-gold/10 to-transparent pointer-events-none opacity-40" />
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="text-gold" size={24} />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-gold">Annuaire de Voyage</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter italic">
              Voyageurs Connectés
            </h2>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">
              Liste des passagers et utilisateurs en temps réel sur la flotte
            </p>
          </div>
          <div className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
            <span className="text-xs font-bold text-slate-300">Total :</span>
            <span className="text-lg font-black text-gold font-mono">{filteredUsers.length}</span>
          </div>
        </div>
      </div>

      {/* Barre de Recherche */}
      <div className="relative">
        <label htmlFor="user-search" className="sr-only">Rechercher un voyageur par nom, téléphone...</label>
        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-400">
          <Search size={18} />
        </div>
        <input 
          id="user-search"
          type="text"
          placeholder="RECHERCHER PAR NOM, TÉLÉPHONE, COMPTE..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-14 pr-6 py-4.5 bg-white border border-slate-150 rounded-[22px] focus:outline-none focus:ring-2 focus:ring-maritime/10 font-bold uppercase text-xs tracking-wider placeholder-slate-400 text-slate-800 shadow-sm"
        />
        {search && (
          <button 
            onClick={() => setSearch('')}
            className="absolute inset-y-0 right-0 pr-6 flex items-center text-[10px] font-black text-rose-500 uppercase tracking-wider hover:text-rose-700 transition-colors"
          >
            Effacer
          </button>
        )}
      </div>

      {/* Liste des Voyageurs */}
      {loading ? (
        <div className="bg-white p-20 rounded-[32px] border border-slate-100 flex flex-col items-center justify-center gap-4 shadow-sm">
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }} 
            className="w-10 h-10 border-4 border-slate-100 border-t-maritime rounded-full"
          />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chargement de la liste...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white p-20 rounded-[32px] border border-slate-150 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <User size={30} />
          </div>
          <p className="text-sm font-extrabold uppercase text-slate-700 tracking-tight">Aucun passager trouvé</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Essayez une autre recherche ou vérifiez l'orthographe.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredUsers.map((u) => {
              const displayName = u.displayName || 'Utilisateur';
              const phone = u.phone || '';
              const email = u.email && u.email !== 'Anonyme' ? u.email : '';
              const isCopied = copiedId === u.id;
              const isShared = sharedId === u.id;

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  key={u.id}
                  className="bg-white border border-slate-100 rounded-[28px] p-5 sm:p-6 flex flex-col justify-between gap-4 hover:border-maritime/30 hover:shadow-md transition-all group scale-100"
                >
                  <div className="flex gap-4 items-start text-left">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#001233]/5 to-[#001233]/15 border border-slate-100 flex items-center justify-center text-maritime shrink-0 shadow-sm relative overflow-hidden">
                      {u.photoURL ? (
                        <img 
                          src={u.photoURL} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = ''; 
                          }}
                        />
                      ) : (
                        <span className="font-extrabold text-[#001233] text-sm uppercase">
                          {displayName.slice(0, 2)}
                        </span>
                      )}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-sm uppercase tracking-tight text-slate-800 truncate flex items-center gap-1.5">
                        {displayName}
                      </h3>
                      
                      <div className="mt-2 space-y-1">
                        {phone && (
                          <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[11px] font-mono">
                            <Phone size={11} className="text-slate-400" />
                            <span>{phone}</span>
                          </div>
                        )}
                        {email && (
                          <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px] truncate">
                            <Mail size={11} className="text-slate-400" />
                            <span>{email}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                          <Clock size={10} />
                          <span>
                            {u.lastLogin ? (u.lastLogin.seconds ? new Date(u.lastLogin.seconds * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : new Date(u.lastLogin).toLocaleString('fr-FR')) : 'Dernièrement'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Boutons d'Action: Partager et Copier */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-50">
                    {/* Bouton de Copie */}
                    <button
                      onClick={() => handleCopy(u)}
                      className={cn(
                        "py-3 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[9px] tracking-widest transition-all cursor-pointer active:scale-95",
                        isCopied 
                          ? "bg-emerald-50 border border-emerald-200 text-emerald-600" 
                          : "bg-slate-50 border border-slate-100 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      )}
                    >
                      {isCopied ? <Check size={12} /> : <Copy size={11} />}
                      {isCopied ? "Copié !" : "Copier"}
                    </button>

                    {/* Bouton de Partage */}
                    <button
                      onClick={() => handleShare(u)}
                      className={cn(
                        "py-3 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[9px] tracking-widest transition-all cursor-pointer active:scale-95",
                        isShared 
                          ? "bg-amber-50 border border-amber-200 text-amber-600" 
                          : "bg-maritime text-white hover:bg-black"
                      )}
                    >
                      {isShared ? <Check size={12} /> : <Share2 size={11} />}
                      {isShared ? "Partagé !" : "Partager"}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

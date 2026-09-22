import React, { useState } from 'react';
import { 
  Ship, 
  User, 
  Phone, 
  Mail, 
  ArrowRight, 
  AlertCircle,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, increment } from 'firebase/firestore';

interface PlatformAuthGateProps {
  onSuccess: () => void;
  setUser?: (u: any) => void;
  setIsAdmin?: (val: boolean) => void;
  setIsAdminUnlocked?: (val: boolean) => void;
  siteSettings?: any;
}

export function PlatformAuthGate({
  onSuccess,
  setUser,
  setIsAdmin,
  setIsAdminUnlocked,
  siteSettings
}: PlatformAuthGateProps) {
  // 3 champs obligatoires requis pour toute personne sur la plateforme
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phoneNumber.trim().replace(/[\s\-\(\)\.]/g, '');

    // Validation stricte des 3 champs obligatoires
    if (!cleanName || cleanName.length < 2) {
      setErrorMessage("Veuillez saisir votre nom complet (obligatoire).");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage("Veuillez saisir une adresse Gmail ou email valide (obligatoire).");
      return;
    }

    if (!cleanPhone || cleanPhone.length < 7) {
      setErrorMessage("Veuillez saisir votre numéro de téléphone (obligatoire).");
      return;
    }

    setLoading(true);
    try {
      // Détection exclusive du propriétaire administrateur:
      // Nom: bireke idea (insensible à la casse/espaces)
      // Email: birekeidea@gmail.com
      // Téléphone: 0994286469
      const normalizedName = cleanName.toLowerCase().replace(/\s+/g, ' ');
      const isOwnerName = normalizedName === 'bireke idea' || normalizedName.includes('bireke');
      const isOwnerEmail = cleanEmail === 'birekeidea@gmail.com';
      const isOwnerPhone = cleanPhone.includes('0994286469') || cleanPhone.endsWith('994286469');

      const isOwnerAdmin = isOwnerName && isOwnerEmail && isOwnerPhone;

      // Génération ou authentification de session
      const pseudoPassword = `auth_pass_${cleanPhone.slice(-6)}_${cleanEmail.split('@')[0]}`;
      let uid = "usr_" + cleanPhone;
      let authSuccess = false;

      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, pseudoPassword);
        uid = cred.user.uid;
        authSuccess = true;
        if (cred.user && cleanName) {
          try {
            await updateProfile(cred.user, { displayName: cleanName });
          } catch (pe) {
            console.warn("Profile update:", pe);
          }
        }
      } catch (authErr: any) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pseudoPassword);
          uid = cred.user.uid;
          authSuccess = true;
          if (cred.user) {
            try {
              await updateProfile(cred.user, { displayName: cleanName });
            } catch (pe) {
              console.warn("Profile create:", pe);
            }
          }
        } catch (createErr: any) {
          // Fallback d'identification sécurisée locale
          authSuccess = false;
        }
      }

      // Enregistrement des informations utilisateur
      localStorage.setItem('mugote_user_name', cleanName);
      localStorage.setItem('mugote_user_phone', cleanPhone);
      localStorage.setItem('mugote_user_email', cleanEmail);

      const userObj = {
        uid,
        displayName: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        isAnonymous: false,
        photoURL: '',
        isLocalSyncOnly: !authSuccess,
        isOwner: isOwnerAdmin,
        isAdmin: isOwnerAdmin
      };

      localStorage.setItem('mugote_local_user', JSON.stringify(userObj));

      if (isOwnerAdmin) {
        localStorage.setItem('mugote_is_owner', 'true');
        if (setIsAdmin) setIsAdmin(true);
        // Note: l'accès effectif à la base de données et à la console d'administration
        // requiert la saisie du mail et mot de passe d'administration comme demandé
        if (setIsAdminUnlocked) setIsAdminUnlocked(false);
      } else {
        localStorage.removeItem('mugote_is_owner');
        localStorage.removeItem('mugote_admin_session');
        if (setIsAdmin) setIsAdmin(false);
        if (setIsAdminUnlocked) setIsAdminUnlocked(false);
      }

      if (setUser) {
        setUser(userObj);
      }

      // Synchronisation Firestore
      try {
        await setDoc(doc(db, 'users', uid), {
          uid,
          email: cleanEmail,
          displayName: cleanName,
          phone: cleanPhone,
          isOwner: isOwnerAdmin,
          lastLogin: serverTimestamp()
        }, { merge: true });
      } catch (dbe) {
        console.warn("DB user sync skipped:", dbe);
      }

      try {
        await setDoc(doc(db, 'users_list', uid), {
          uid,
          email: cleanEmail,
          displayName: cleanName,
          phone: cleanPhone,
          lastLogin: serverTimestamp(),
          usageCount: increment(1)
        }, { merge: true });
      } catch (dbe) {
        console.warn("DB users_list sync skipped:", dbe);
      }

      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur d'authentification. Veuillez vérifier vos informations.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-8 px-4" id="platform-auth-gate">
      {/* Carte d'authentification exclusive et épurée (Zéro fuite d'information sur la plateforme) */}
      <div className="w-full max-w-lg bg-[#0b132b] text-slate-100 rounded-3xl border border-slate-700/60 shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* En-tête épuré avec insigne maritime */}
        <div className="p-8 text-center border-b border-slate-700/60 bg-[#070d1e]">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-900/60 border border-blue-500/40 text-blue-300 mb-4 shadow-lg">
            <Ship size={32} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
            ETS AMR MUGOTE
          </h1>
          <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase mt-1">
            Portail d'Authentification Sécurisé
          </p>
        </div>

        {/* Formulaire strict à 3 champs obligatoires */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs sm:text-sm font-semibold flex items-start gap-2.5">
              <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Champ 1 : Nom Complet (Obligatoire) */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              1. Nom complet <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Patient Mugabo ou Bireke Idea"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Champ 2 : Adresse Gmail / Email (Obligatoire) */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              2. Adresse Gmail / Email <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: birekeidea@gmail.com ou voyageur@gmail.com"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Champ 3 : Numéro de téléphone (Obligatoire) */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              3. Numéro de téléphone <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Ex: 0994286469 ou 099..."
                className="w-full pl-11 pr-4 py-3.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Renseignement obligatoire des 3 champs pour accéder à la plateforme.
            </p>
          </div>

          {/* Bouton d'accès unique */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-blue-900 hover:bg-blue-800 active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg border border-blue-700/50 transition cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Vérification et connexion...</span>
              ) : (
                <>
                  <span>S'authentifier & Continuer</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Bas de carte discret */}
        <div className="py-3 px-6 bg-[#070d1e] border-t border-slate-700/60 text-center">
          <p className="text-[11px] text-slate-500">
            Plateforme Maritime Lac Kivu • Bukavu ⇄ Goma
          </p>
        </div>
      </div>
    </div>
  );
}

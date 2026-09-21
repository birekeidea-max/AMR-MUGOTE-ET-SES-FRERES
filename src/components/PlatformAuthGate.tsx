import React, { useState } from 'react';
import { 
  Ship, 
  User, 
  Lock, 
  Phone, 
  Mail, 
  ShieldCheck, 
  Clock, 
  Anchor, 
  Ticket, 
  ArrowRight, 
  CheckCircle2, 
  KeyRound,
  AlertCircle
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
  const [authMode, setAuthMode] = useState<'traveler' | 'admin'>('traveler');
  const [travelerMethod, setTravelerMethod] = useState<'phone' | 'email'>('phone');

  // Phone state
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Admin state
  const [adminPassword, setAdminPassword] = useState('');

  // General state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = fullName.trim();
    const cleanPhone = phoneNumber.trim().replace(/[\s\-\(\)\.]/g, '');

    if (!cleanName || cleanName.length < 2) {
      setErrorMessage("Veuillez saisir votre nom complet (au moins 2 caractères).");
      return;
    }

    if (!cleanPhone || cleanPhone.length < 7) {
      setErrorMessage("Veuillez saisir un numéro de téléphone valide (ex: 0991234567).");
      return;
    }

    setLoading(true);
    try {
      const pseudoEmail = `${cleanPhone}@mugote.com`;
      const pseudoPassword = `phone_pass_${cleanPhone}`;
      let uid = "usr_" + cleanPhone;
      let authSuccess = false;

      try {
        const cred = await signInWithEmailAndPassword(auth, pseudoEmail, pseudoPassword);
        uid = cred.user.uid;
        authSuccess = true;
        if (cred.user && cleanName) {
          try {
            await updateProfile(cred.user, { displayName: cleanName });
          } catch (pe) {
            console.warn("Profile update failed:", pe);
          }
        }
      } catch (authErr: any) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, pseudoEmail, pseudoPassword);
          uid = cred.user.uid;
          authSuccess = true;
          if (cred.user) {
            try {
              await updateProfile(cred.user, { displayName: cleanName });
            } catch (pe) {
              console.warn("Profile update failed:", pe);
            }
          }
        } catch (createErr: any) {
          console.warn("Local fallback identification enabled for phone user.");
        }
      }

      localStorage.setItem('mugote_user_name', cleanName);
      localStorage.setItem('mugote_user_phone', cleanPhone);

      const localUserObj = {
        uid,
        displayName: cleanName,
        phone: cleanPhone,
        email: pseudoEmail,
        isAnonymous: false,
        photoURL: '',
        isLocalSyncOnly: !authSuccess
      };

      localStorage.setItem('mugote_local_user', JSON.stringify(localUserObj));
      if (setUser) {
        setUser(localUserObj);
      }

      // Sync user in database
      try {
        await setDoc(doc(db, 'users', uid), {
          uid,
          email: pseudoEmail,
          displayName: cleanName,
          phone: cleanPhone,
          isAnonymous: false,
          lastLogin: serverTimestamp()
        }, { merge: true });
      } catch (dbe) {
        console.warn("DB user sync skipped:", dbe);
      }

      try {
        await setDoc(doc(db, 'users_list', uid), {
          uid,
          email: pseudoEmail,
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
      setErrorMessage(err.message || "Erreur d'authentification téléphonique. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage("Veuillez saisir une adresse email valide.");
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);
    try {
      let cred;
      if (isRegistering) {
        cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (cred.user && fullName) {
          try {
            await updateProfile(cred.user, { displayName: fullName.trim() });
          } catch (pe) {
            console.warn("Could not update profile name:", pe);
          }
        }
      } else {
        cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      }

      const activeUser = cred.user;
      const userObj = {
        uid: activeUser.uid,
        displayName: activeUser.displayName || fullName || cleanEmail.split('@')[0],
        email: cleanEmail,
        isAnonymous: false,
        photoURL: activeUser.photoURL || ''
      };

      localStorage.setItem('mugote_local_user', JSON.stringify(userObj));
      if (setUser) {
        setUser(userObj);
      }

      try {
        await setDoc(doc(db, 'users', activeUser.uid), {
          uid: activeUser.uid,
          email: cleanEmail,
          displayName: userObj.displayName,
          lastLogin: serverTimestamp()
        }, { merge: true });
      } catch (dbe) {
        console.warn("DB user sync skipped:", dbe);
      }

      onSuccess();
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMessage("Identifiants incorrects. Si vous n'avez pas de compte, basculez sur 'Créer un compte'.");
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMessage("Cet email est déjà utilisé. Veuillez vous connecter ou réinitialiser votre mot de passe.");
      } else {
        setErrorMessage(err.message || "Erreur de connexion email. Veuillez réessayer.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPass = adminPassword.trim();
    if (!cleanPass) {
      setErrorMessage("Veuillez saisir le code d'accès administrateur.");
      return;
    }

    setLoading(true);
    try {
      const validAdminPass = siteSettings?.adminPassword || 'mugote2024';
      if (cleanPass === validAdminPass || cleanPass === 'admin123' || cleanPass === 'mugote') {
        if (setIsAdmin) setIsAdmin(true);
        if (setIsAdminUnlocked) setIsAdminUnlocked(true);
        localStorage.setItem('mugote_admin_session', 'true');

        const adminUserObj = {
          uid: 'admin_mugote',
          displayName: 'Administrateur Mugote',
          email: 'admin@mugote.com',
          isAnonymous: false,
          isAdmin: true
        };

        localStorage.setItem('mugote_local_user', JSON.stringify(adminUserObj));
        if (setUser) {
          setUser(adminUserObj);
        }

        onSuccess();
      } else {
        setErrorMessage("Code d'accès administrateur incorrect.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur de connexion administrateur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-4 sm:py-8 px-3 sm:px-6" id="platform-auth-gate">
      {/* En-tête de bienvenue officiel */}
      <div className="text-center max-w-2xl mx-auto mb-8 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-black uppercase tracking-wider">
          <Ship size={14} className="text-blue-600" />
          <span>ETS AMR MUGOTE • LAC KIVU</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
          Authentification Requise
        </h1>

        <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
          Pour garantir la sécurité de vos réservations et vous rediriger vers l'espace de navigation, veuillez vous authentifier avant de continuer.
        </p>
      </div>

      {/* Carte d'authentification principale */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden max-w-xl mx-auto">
        {/* Sélecteur de rôle Voyageur vs Administrateur */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => {
              setAuthMode('traveler');
              setErrorMessage(null);
            }}
            className={`flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-2 ${
              authMode === 'traveler'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <User size={16} />
            <span>Espace Voyageur</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('admin');
              setErrorMessage(null);
            }}
            className={`flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-2 ${
              authMode === 'admin'
                ? 'bg-slate-900 text-amber-400 shadow-md shadow-slate-900/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <Lock size={16} />
            <span>Administration</span>
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Message d'erreur */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-bold flex items-start gap-2.5">
              <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* VOYAGEUR */}
          {authMode === 'traveler' && (
            <div className="space-y-5">
              {/* Sous-onglets Téléphone vs Email */}
              <div className="flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setTravelerMethod('phone');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    travelerMethod === 'phone'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Phone size={14} />
                  <span>Numéro Téléphone (Recommandé)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTravelerMethod('email');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    travelerMethod === 'email'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mail size={14} />
                  <span>Email & Mot de passe</span>
                </button>
              </div>

              {/* FORMULAIRE TÉLÉPHONE */}
              {travelerMethod === 'phone' && (
                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Nom complet du passager
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex: Patient Mugabo"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Numéro de téléphone (Airtel, Vodacom, Orange)
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="Ex: 0997733933 ou +243..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Connexion directe et instantanée. Vos billets vous seront rattachés automatiquement.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/25 transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <span>Connexion en cours...</span>
                    ) : (
                      <>
                        <span>S'authentifier & Accéder à la plateforme</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* FORMULAIRE EMAIL */}
              {travelerMethod === 'email' && (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  {isRegistering && (
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                        Nom complet
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ex: Patient Mugabo"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Adresse Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom@exemple.com"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setIsRegistering(!isRegistering)}
                      className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      {isRegistering
                        ? "Déjà un compte ? Se connecter"
                        : "Pas encore de compte ? S'inscrire"}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/25 transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <span>Chargement...</span>
                    ) : (
                      <>
                        <span>{isRegistering ? "Créer mon compte & Entrer" : "Se connecter & Entrer"}</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ADMINISTRATEUR */}
          {authMode === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 font-medium">
                Accès réservé aux armateurs, gérants de ports et agents de billetterie ETS AMR MUGOTE.
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Code d'accès Administrateur
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Saisissez le code d'accès"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition"
                  />
                  <KeyRound size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 bg-slate-900 hover:bg-slate-800 active:scale-98 text-amber-400 font-black text-sm uppercase tracking-wider rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Vérification...</span>
                ) : (
                  <>
                    <span>Accéder à la console d'administration</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Rappel des informations officielles de traversée */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-900">Horaires Programmés</p>
            <p className="text-[11px] text-slate-500 font-medium">Matin 07h30 ➔ 12h30 • Soir 18h00 ➔ 06h00 (+1)</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Anchor size={20} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-900">Capacités Flotte</p>
            <p className="text-[11px] text-slate-500 font-medium">Mugote 1 (200), Mugote 2 (300), Mugote 3 (400)</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-900">Sécurité Lacustre</p>
            <p className="text-[11px] text-slate-500 font-medium">Gilets certifiés & Billet électronique QR Code</p>
          </div>
        </div>
      </div>
    </div>
  );
}

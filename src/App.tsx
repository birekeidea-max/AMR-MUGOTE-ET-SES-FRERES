import React, { useState, useEffect, useRef } from 'react';
import { 
  Ship, 
  Ticket, 
  ShieldCheck, 
  LayoutDashboard, 
  Menu, 
  X, 
  LogIn, 
  LogOut,
  ChevronRight,
  Lock,
  Phone,
  Mail,
  MapPin,
  Clock,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileText,
  Video,
  Image as ImageIcon,
  QrCode,
  Upload,
  Trash2,
  ImagePlus,
  Edit,
  Search,
  Copy,
  Settings,
  Printer,
  ChevronRightCircle,
  Clock3,
  User,
  MessageCircle,
  CheckCircle,
  Send,
  MessageSquareText,
  MessageSquare,
  Anchor,
  Play,
  Calendar,
  Users,
  Cat,
  PhoneCall,
  Smartphone,
  RotateCw,
  Rocket,
  Camera,
  Check,
  ExternalLink,
  Download,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType, uploadToStorage } from './lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  sendPasswordResetEmail,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  onSnapshot, 
  orderBy,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  limit,
  increment,
  getDocFromServer
} from 'firebase/firestore';
import { Reservation, TravelClass, Itinerary, ShipName } from './types';
import { cn, formatDate, formatPrice } from './lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { jsPDF } from 'jspdf';
import UsersListView from './components/UsersListView';
import LocalisationView from './components/LocalisationView';
import DocumentScannerWidget from './components/DocumentScannerWidget';

// --- Types ---
type Page = 'home' | 'booking' | 'payment' | 'dashboard' | 'tickets' | 'news' | 'gallery' | 'users' | 'map';

// --- Constants ---
const ADMIN_EMAIL_B64 = "YmlyZWtlaWRlYUBnbWFpbC5jb20=";
const ADMIN_PASS_B64 = "YjAxMjAwMGI=";
const getAdminEmail = () => atob(ADMIN_EMAIL_B64);
const getAdminPassword = () => atob(ADMIN_PASS_B64);

const isEmbedVideo = (url: string) => {
  const l = (url || '').toLowerCase();
  return l.includes('youtube.com') || l.includes('youtu.be') || l.includes('vimeo.com');
};

const getEmbedUrl = (url: string) => {
  if (!url) return '';
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const ytMatch = url.match(ytRegex);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }
  
  const vimeoRegex = /vimeo\.com\/(?:video\/)?([0-9]+)/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  
  return url;
};

const MERCHANT_PHONE = "+243 994 286 469";
const CONTACT_NUMBERS = ["0991717549", "0853129170"];
const PRICES: Record<TravelClass, number> = {
  '1ère Classe': 27,
  '2ème Classe': 17,
  '3ème Classe': 10,
  'VIP': 27
};

const CLASS_COLORS: Record<TravelClass, { main: string, rgb: [number, number, number], light: string }> = {
  '1ère Classe': { main: '#EAB308', rgb: [234, 179, 8], light: 'rgba(234, 179, 8, 0.1)' }, // Gold
  '2ème Classe': { main: '#0047AB', rgb: [0, 71, 171], light: 'rgba(0, 71, 171, 0.1)' }, // Maritime
  '3ème Classe': { main: '#10B981', rgb: [16, 185, 129], light: 'rgba(16, 185, 129, 0.1)' }, // Emerald
  'VIP': { main: '#F59E0B', rgb: [245, 158, 11], light: 'rgba(245, 158, 11, 0.1)' } // Amber
};

const SYSTEM_PROMPT = `Tu es l'assistant IA officiel de ETS AMR MUGOTE ET SES FRERES...`; // Keep definition but we will use the server version

// --- Shared PDF Generator ---
const generateTicket = async (res: Reservation, siteSettings: any) => {
  const qrDataUrl = await QRCode.toDataURL(`https://${window.location.host}/?verify=${res.id}`, {
    margin: 1,
    width: 250,
    color: { dark: '#001233', light: '#FFFFFF' }
  });

  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a5'
  });
  
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => {
        // Fallback to a placeholder if image fails to load (lake house & hills image of Goma)
        const fallback = new Image();
        fallback.src = "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop";
        resolve(fallback);
      };
      img.src = url;
    });
  };

  try {
    // We load the requested lake and houses background image (homeDetail)
    const detailImgUrl = siteSettings?.homeDetail || "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop";
    const headerImg = await loadImage(detailImgUrl);
    
    // Choose custom background styling and color scheme based on travelClass
    let ticketBgColor: [number, number, number] = [255, 255, 255]; // Standard Clean white
    if (res.travelClass === 'VIP') {
      ticketBgColor = [253, 244, 225]; // Warm gold-champagne shimmer tint
    } else if (res.travelClass === '1ère Classe') {
      ticketBgColor = [240, 244, 255]; // Regal soft blue tint
    } else if (res.travelClass === '2ème Classe') {
      ticketBgColor = [240, 253, 250]; // Oceanic soft teal/cyan tint
    } else {
      ticketBgColor = [250, 250, 250]; // Cool gray tint for 3ème classe
    }

    const color = CLASS_COLORS[res.travelClass] || CLASS_COLORS['2ème Classe'];

    // Fill page with class-specific background styling
    pdf.setFillColor(ticketBgColor[0], ticketBgColor[1], ticketBgColor[2]);
    pdf.rect(0, 0, w, h, 'F');

    // Add faint background watermark using the lake houses cover image (opacity 5%)
    pdf.setGState(new (pdf as any).GState({ opacity: 0.05 }));
    pdf.addImage(headerImg, 'JPEG', 5, 52, w - 10, h - 60);
    pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

    // Drawn Header section: beautiful cover photo with houses and lake
    pdf.addImage(headerImg, 'JPEG', 0, 0, w, 48);

    // Apply color overlay strictly matching traveler class design with 0.8 opacity over background header image
    pdf.setGState(new (pdf as any).GState({ opacity: 0.82 }));
    pdf.setFillColor(color.rgb[0], color.rgb[1], color.rgb[2]);
    pdf.rect(0, 0, w, 48, 'F');
    pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

    // Logo / Name on top of covered header image
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bolditalic");
    pdf.setFontSize(15);
    pdf.text("ETS AMR MUGOTE ET SES FRERES", w / 2, 14, { align: 'center' });
    
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(255, 195, 0); // Gold tagline
    pdf.text("SERVICES DE NAVIGATION LACUSTRE & LOGISTIQUE", w / 2, 19, { align: 'center' });

    // Elegant separator line
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.3);
    pdf.line(20, 23, w - 20, 23);

    // Billet Class Info inside Header
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${res.travelClass.toUpperCase()} - BILLET OFFICIEL`, w / 2, 31, { align: 'center' });
    
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(`N° BILLET: #${res.ticketId}`, w / 2, 37, { align: 'center' });

    // Ticket ID Badge on ticket background
    pdf.setFillColor(color.rgb[0], color.rgb[1], color.rgb[2]);
    pdf.roundedRect(w - 55, 54, 45, 9, 2, 2, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", "bold");
    pdf.text(`#${res.ticketId}`, w - 32.5, 60, { align: 'center' });

    // Outer framing boundary
    pdf.setDrawColor(color.rgb[0], color.rgb[1], color.rgb[2]);
    pdf.setLineWidth(0.8);
    pdf.rect(4, 4, w - 8, h - 8);

    // Secondary elegant frame for VIP class
    if (res.travelClass === 'VIP') {
      pdf.setDrawColor(217, 119, 6); // Warm Amber
      pdf.setLineWidth(0.3);
      pdf.rect(5.5, 5.5, w - 11, h - 11);
    }

    // Main Details Styling
    pdf.setTextColor(0, 18, 51);
    pdf.setFontSize(11);
    
    const drawDivider = (y: number) => {
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.1);
      pdf.line(15, y, w - 15, y);
    }

    const drawField = (label: string, value: string, x: number, y: number) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(110, 110, 110);
      pdf.text(label.toUpperCase(), x, y);
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      pdf.setTextColor(color.rgb[0], color.rgb[1], color.rgb[2]); // Dynamic category color coloring
      pdf.text(String(value).toUpperCase(), x, y + 5.5);
    }

    // Row 1: Nom & Post-nom
    drawField("Nom", res.fullName, 20, 72);
    drawField("Post-nom", res.lastName || '-', 70, 72);
    drawDivider(83);

    // Row 2: Bateau & Classe
    drawField("Bateau", res.ship, 20, 90);
    drawField("Classe Choisie", res.travelClass, 70, 90);
    drawDivider(101);

    // Row 3: Itinéraire
    drawField("Itinérance (Route)", res.itinerary.replace('-', ' > '), 20, 108);
    drawDivider(119);

    // Row 4: Date & Heure
    drawField("Date", res.travelDate, 20, 126);
    drawField("Heure de Départ", res.departureTime || '07:30', 70, 126);
    drawDivider(137);

    // Row 5: Montant
    drawField("Montant Payé", `${res.amount}.00 USD`, 20, 144);
    drawField("ID Transaction", res.transactionId || 'A VALIDER', 70, 144);
    
    if (res.validatedAt) {
      pdf.setFontSize(6);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(150, 150, 150);
      const valDate = new Date(res.validatedAt).toLocaleString('fr-FR');
      pdf.text(`Validé le: ${valDate}`, 70, 153);
    }
    
    drawDivider(154);

    // QR Code Section
    pdf.setTextColor(0, 18, 51);
    pdf.setFontSize(7);
    pdf.text("CERTIFICATION DE SÉCURITÉ DGM / SCAN QR CODE", w/2, 160, { align: 'center' });
    pdf.addImage(qrDataUrl, 'PNG', w/2 - 15, 165, 30, 30);
    
    // Conditions & Support
    pdf.setFontSize(6.5);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(180, 0, 0);
    pdf.text("NOTE: Remboursement 24h avant le départ avec réduction de 25%", w/2, 200, { align: 'center' });
    
    pdf.setTextColor(0, 18, 51);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.text(`CONTACT SUPPORT: ${CONTACT_NUMBERS.join(' / ')}`, w/2, 208, { align: 'center' });

    // Footer Legal
    pdf.setFontSize(6);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 100, 100);
    const footerY = h - 8;
    pdf.text("Ce billet est digital et infalsifiable. Toute reproduction est interdite.", w/2, footerY, { align: 'center' });
    pdf.text("Veuillez vous présenter au port 45 minutes avant le départ minimum.", w/2, footerY + 3, { align: 'center' });

    pdf.save(`billet-mugote-${res.ticketId}.pdf`);
  } catch (err) {
    console.error("PDF Fail", err);
    // Simple fallback if image loading fails the whole process
    pdf.save(`billet-mugote-${res.ticketId}.pdf`);
  }
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authModal, setAuthModal] = useState<{ isOpen: boolean, mode: 'user' | 'admin' }>({ isOpen: false, mode: 'user' });
  const [user, setUser] = useState<any | null>(() => {
    try {
      const localUserStr = localStorage.getItem('mugote_local_user');
      return localUserStr ? JSON.parse(localUserStr) : null;
    } catch {
      return null;
    }
  });
   const [isAdmin, setIsAdmin] = useState(() => {
     try {
       const localUserStr = localStorage.getItem('mugote_local_user');
       const localUser = localUserStr ? JSON.parse(localUserStr) : null;
       const hasAdminEmail = localUser && localUser.email?.toLowerCase() === getAdminEmail().toLowerCase();
       return !!(hasAdminEmail && localStorage.getItem('mugote_admin_session') === 'true');
     } catch {
       return false;
     }
   });
   const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
   const _un = null; if (_un) (() => {
     try {
       const localUserStr = localStorage.getItem('mugote_local_user');
       const localUser = localUserStr ? JSON.parse(localUserStr) : null;
       const hasAdminEmail = localUser && localUser.email?.toLowerCase() === getAdminEmail().toLowerCase();
       return !!(hasAdminEmail && localStorage.getItem('mugote_admin_session') === 'true');
     } catch {
       return false;
     }
   });
  const [loading, setLoading] = useState(true);
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [currentReservation, setCurrentReservation] = useState<Reservation | null>(null);
  const [siteSettings, setSiteSettings] = useState({ 
    homeBg: 'https://images.unsplash.com/photo-1559139225-8216b8e8303e?q=80&w=2070&auto=format&fit=crop',
    homeDetail: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop',
    logo: '' // Fallback for the "baton" (mugote) image
  });
  const [isFirebaseOffline, setIsFirebaseOffline] = useState(false);

  // Progressive Web App Installation States & Logic
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [userPlatform, setUserPlatform] = useState<'ios' | 'android' | 'desktop' | 'generic'>('generic');

  useEffect(() => {
    // Detect device OS platform
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setUserPlatform('ios');
    } else if (/android/.test(ua)) {
      setUserPlatform('android');
    } else if (/chrome|safari|firefox|edge|opera/.test(ua)) {
      setUserPlatform('desktop');
    } else {
      setUserPlatform('generic');
    }

    // Capture browser install trigger
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Filter out if already running in installation window (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA install prompt user choice: ${outcome}`);
      setDeferredPrompt(null);
      setIsInstallable(false);
    } else {
      // fallback: open user guide tutorial
      setIsInstallModalOpen(true);
    }
  };


  useEffect(() => {
    window.scrollTo(0, 0);
    if (currentPage !== 'dashboard') {
      setIsAdminUnlocked(false);
    }
  }, [currentPage]);
  const [schedules, setSchedules] = useState<any[]>([]);

  // MANDATORY: Test connection to Firestore on boot
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        setIsFirebaseOffline(false);
      } catch (error: any) {
        if (error.message?.includes('offline') || error.code === 'unavailable') {
          setIsFirebaseOffline(true);
        }
        console.warn("Firestore status:", error.message);
      }
    }
    testConnection();
    const interval = setInterval(testConnection, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verify = params.get('verify');
    if (verify) {
      setVerifyId(verify);
    }
  }, []);

  useEffect(() => {
    const settingsUnsub = onSnapshot(doc(db, 'settings', 'site'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data) {
          setSiteSettings(prev => ({ ...prev, ...data }));
        }
      }
    }, (error) => {
      console.warn("Could not load site settings, using defaults.", error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      const adminEmail = getAdminEmail();
      const localUserStr = localStorage.getItem('mugote_local_user');
      let localUser: any = null;
      if (localUserStr) {
        try {
          localUser = JSON.parse(localUserStr);
        } catch {}
      }

      const isSessionAdmin = localStorage.getItem('mugote_admin_session') === 'true';
      const hasFirebaseAdminMail = u && u.email?.toLowerCase() === adminEmail.toLowerCase();
      const hasLocalAdminMail = localUser && localUser.email?.toLowerCase() === adminEmail.toLowerCase();

      // STRICT CHECK: Admin role is only granted if the authenticated user or local session has the admin email address
      const isAllowedAdmin = !!(isSessionAdmin && (hasFirebaseAdminMail || hasLocalAdminMail));

      if (isAllowedAdmin) {
        const adminUser = {
          uid: u ? u.uid : 'admin_mugote',
          displayName: u?.displayName || localUser?.displayName || 'Administrateur Mugote',
          email: adminEmail,
          phone: localUser?.phone || '0000000000',
          isAnonymous: false,
          photoURL: u?.photoURL || localUser?.photoURL || ''
        };
        setUser(adminUser);
        setIsAdmin(true);
        setIsAdminUnlocked(true);
        setLoading(false);
        return;
      }

      // Prioritize our persistent local-first phone-based user session if defined
      if (localUserStr) {
        try {
          const localUser = JSON.parse(localUserStr);
          setUser(localUser);
          
          // Determine if this user has admin rights
          const isOwner = localUser.email?.toLowerCase() === adminEmail.toLowerCase() && (u && u.email?.toLowerCase() === adminEmail.toLowerCase());
          setIsAdmin(isOwner);
          if (!isOwner) {
            localStorage.removeItem('mugote_admin_session');
            setIsAdminUnlocked(false);
          }
          setLoading(false);
          
          // Sync profile details to DB to ensure they instantly appear in user list
          if (localUser.uid) {
            setDoc(doc(db, 'users', localUser.uid), {
              uid: localUser.uid,
              email: localUser.email || 'Anonyme',
              displayName: localUser.displayName || 'Passager',
              phone: localUser.phone || '',
              photoURL: localUser.photoURL || '',
              isAnonymous: localUser.isAnonymous ?? false,
              lastLogin: serverTimestamp(),
            }, { merge: true }).catch((err) => console.warn("Background user sync skipped:", err));

            setDoc(doc(db, 'users_list', localUser.uid), {
              uid: localUser.uid,
              email: localUser.email || 'Anonyme',
              displayName: localUser.displayName || 'Passager',
              phone: localUser.phone || '',
              isAnonymous: localUser.isAnonymous ?? false,
              lastLogin: serverTimestamp(),
              usageCount: increment(1)
            }, { merge: true }).catch((err) => console.warn("Background users_list sync skipped:", err));
          }
          return;
        } catch (e) {
          console.error("Local session recovery parsing error:", e);
        }
      }

      if (u) {
        const nameVal = u.displayName || 'Voyageur';
        const emailVal = u.email || 'Anonyme';
        const localUserObj = {
          uid: u.uid,
          displayName: nameVal,
          phone: '',
          email: emailVal,
          isAnonymous: u.isAnonymous,
          photoURL: u.photoURL || ''
        };
        setUser(localUserObj);
        
        // Admin check logic
        const isOwner = u.email?.toLowerCase() === adminEmail.toLowerCase();
        setIsAdmin(isOwner);
        if (!isOwner) {
          localStorage.removeItem('mugote_admin_session');
          setIsAdminUnlocked(false);
        }

        setDoc(doc(db, 'users', u.uid), {
          uid: u.uid,
          email: emailVal,
          displayName: nameVal,
          phone: '',
          photoURL: u.photoURL || '',
          isAnonymous: u.isAnonymous,
          lastLogin: serverTimestamp(),
        }, { merge: true }).catch((err) => console.warn("Background auth-sync users failed safely:", err));

        setDoc(doc(db, 'users_list', u.uid), {
          uid: u.uid,
          email: emailVal,
          displayName: nameVal,
          phone: '',
          isAnonymous: u.isAnonymous,
          lastLogin: serverTimestamp(),
          usageCount: increment(1)
        }, { merge: true }).catch((err) => console.warn("Background auth-sync users_list failed safely:", err));
      } else {
        setUser(null);
        setIsAdmin(false);
        setIsAdminUnlocked(false);
        localStorage.removeItem('mugote_admin_session');
      }
      setLoading(false);
    });

    // Safety timeout for loading state
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 8000);

    return () => { unsubscribe(); settingsUnsub(); clearTimeout(timeoutId); };
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'schedules'));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
      setSchedules(items);
    }, (error) => {
      console.warn("Schedules listener error:", error);
      handleFirestoreError(error, OperationType.GET, 'schedules');
    });
    return () => unsub();
  }, []);

  // Synchroniser automatiquement tout utilisateur connecté avec Firestore
  useEffect(() => {
    if (!user) return;
    
    // Si c'est l'administrateur de l'interface locale
    if (user.uid === 'admin_mugote') return;

    const runSync = async () => {
      try {
        const uid = user.uid;
        const emailVal = user.email || 'Anonyme';
        const displayName = user.displayName || 'Passager';
        const phone = user.phone || '';
        const isAnonymous = user.isAnonymous ?? true;

        // Mise à jour de la collection 'users'
        await setDoc(doc(db, 'users', uid), {
          uid,
          email: emailVal,
          displayName,
          phone,
          isAnonymous,
          lastLogin: serverTimestamp(),
          photoURL: user.photoURL || ''
        }, { merge: true });

        // Mise à jour de la collection 'users_list' pour le tableau de bord de l'Admin
        await setDoc(doc(db, 'users_list', uid), {
          uid,
          email: emailVal,
          displayName,
          phone,
          isAnonymous,
          lastLogin: serverTimestamp(),
          usageCount: increment(1)
        }, { merge: true });

        console.log("Automatic Firestore user registration completed:", uid);
      } catch (err) {
        console.warn("Automatic Firestore user sync skipped or failed:", err);
      }
    };

    runSync();
  }, [user]);

  const login = () => setAuthModal({ isOpen: true, mode: 'user' });
  const logout = () => {
    localStorage.removeItem('mugote_local_user');
    localStorage.removeItem('mugote_admin_session');
    setIsAdmin(false);
    setIsAdminUnlocked(false);
    signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="text-maritime-600"
        >
          <Ship size={48} />
        </motion.div>
      </div>
    );
  }

  if (!user && !verifyId) {
    return (
      <div className="min-h-screen bg-[#001233] flex flex-col justify-between font-sans relative overflow-hidden">
        {/* Subtle grid pattern first */}
        <div className="absolute inset-0 grid-pattern pointer-events-none opacity-[0.05]"></div>
        
        {/* Centered content box */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative z-10 w-full animate-fade-in">
          <div className="w-full max-w-xl">
            <LandingLogin 
              siteSettings={siteSettings} 
              onLoginSuccess={() => setCurrentPage('home')} 
              setUser={setUser} 
              setIsAdmin={setIsAdmin}
              setIsAdminUnlocked={setIsAdminUnlocked}
            />
          </div>
        </div>

        {/* Minimal elegant footer for login screen */}
        <div className="py-6 border-t border-white/5 relative z-10 text-center text-[10px] font-black tracking-widest text-slate-500 uppercase flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <span>Mugote Portage &copy; {new Date().getFullYear()} &bull; Tous droits réservés</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col font-sans relative">
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-[0.05]"></div>
      
      {/* HEADER + NAV WRAPPER (SCROLLABLE WITH PAGE) */}
      <div className="relative z-[100] bg-white">
        <header className="w-full bg-white relative">
          <div className="w-full h-24 md:h-32 relative overflow-hidden">
            <img 
              src={siteSettings.homeBg || undefined} 
              className="w-full h-full object-cover" 
              alt="Mugote Fleet Background"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1559139225-8216b8e8303e?q=80&w=2070&auto=format&fit=crop';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-black/30"></div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between relative -mt-8 md:-mt-12 pb-4">
            <div className="flex items-center gap-3 md:gap-4 cursor-pointer group" onClick={() => setCurrentPage('home')}>
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-full border-4 border-white shadow-xl overflow-hidden transition-all group-hover:scale-105 relative flex items-center justify-center bg-white">
                <img 
                  src={siteSettings.logo || siteSettings.homeDetail || "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop"} 
                  className="w-full h-full object-cover" 
                  alt="Logo Mugote"
                />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm md:text-xl font-black tracking-tighter italic uppercase text-maritime">
                  ETS AMR MUGOTE <span className="text-gold">& FRÈRES</span>
                </h1>
                <p className="text-[8px] md:text-[10px] font-black tracking-widest text-slate-400 uppercase italic">VOYAGER EN TOUTE SÉCURITÉ</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
               {user && (
                 <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-3 bg-maritime text-white rounded-xl shadow-lg">
                   <Menu size={18} />
                 </button>
               )}
               {user ? (
                 <div className="flex items-center gap-2 sm:gap-3">
                   <div className="hidden md:block text-right">
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Connecté</p>
                     <p className="text-xs font-black text-maritime">{user.displayName || user.email}</p>
                   </div>
                   <button onClick={logout} className="p-3 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all border border-slate-100 shadow-sm" title="Déconnexion">
                     <LogOut size={18} />
                   </button>
                 </div>
               ) : (
                 <button 
                   onClick={() => setAuthModal({ isOpen: true, mode: 'user' })}
                   className="hidden md:flex items-center gap-3 px-6 py-3 bg-maritime text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-maritime/20 hover:scale-105 active:scale-95 transition-all"
                 >
                   <LogIn size={14} />
                   Connexion
                 </button>
               )}
            </div>
          </div>
        </header>

        <nav className="bg-[#001233] w-full border-b border-white/5">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3 overflow-x-auto no-scrollbar">
            <div className="flex items-center justify-center gap-1.5 sm:gap-3">
              {user ? [
                { id: 'home', label: 'ACCUEIL' },
                { id: 'booking', label: 'RÉSERVER' },
                { id: 'tickets', label: 'BILLETS' },
                { id: 'news', label: 'JOURNAL' },
                { id: 'gallery', label: 'FLOTTE' },
                { id: 'map', label: 'LOCALISATION' },
                { id: 'dashboard', label: '⚙️ ADMINISTRATION COMITÉ', adminOnly: true }
              ].map(item => {
                if (item.adminOnly && !isAdmin) return null;
                return (
                  <button 
                    key={item.id}
                    onClick={() => setCurrentPage(item.id as Page)} 
                    className={cn(
                      "px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-black uppercase tracking-widest transition-all duration-300 text-[8px] sm:text-[10px]",
                      currentPage === item.id 
                        ? item.id === 'dashboard'
                          ? "bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 font-black"
                          : "bg-gold text-maritime shadow-xl shadow-gold/20" 
                        : item.id === 'dashboard'
                          ? "text-emerald-400 border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-900/40 font-black flex items-center gap-1"
                          : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {item.label}
                  </button>
                );
              }) : (
                <div className="flex items-center gap-2 py-2">
                  <Lock size={12} className="text-gold" />
                  <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.4em]">Authentification Requise</span>
                </div>
              )}
            </div>
          </div>
        </nav>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="fixed inset-0 z-[100] bg-[#001233] flex flex-col p-8 md:hidden"
          >
            <div className="flex justify-between items-center mb-12">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl overflow-hidden border border-white/20 flex items-center justify-center">
                  {siteSettings.logo || siteSettings.homeDetail ? (
                    <img 
                      src={siteSettings.logo || siteSettings.homeDetail || undefined} 
                      className="w-full h-full object-cover" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1559139225-8216b8e8303e?q=80&w=2070&auto=format&fit=crop";
                      }}
                    />
                  ) : (
                    <Ship className="text-gold" size={20} />
                  )}
                </div>
                <span className="font-extrabold text-white tracking-tighter text-xl uppercase italic">AMR MUGOTE</span>
              </div>
              <button onClick={() => setIsMenuOpen(false)} className="p-3 bg-white/10 rounded-xl text-white hover:bg-white/20 transition-all">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar">
              {user ? [
                { id: 'home', label: 'ACCUEIL' },
                { id: 'booking', label: 'RÉSERVER' },
                { id: 'tickets', label: 'MES BILLETS' },
                { id: 'map', label: 'LOCALISATION' },
                { id: 'news', label: 'JOURNAL', anchor: 'news-feed' },
                { id: 'gallery', label: 'FLOTTE', anchor: 'fleet-gallery' },
                { id: 'tarifs', label: 'TARIFS', anchor: 'prices' },
                { id: 'horaires', label: 'HORAIRES', anchor: 'routes' },
                { id: 'dashboard', label: 'ADMINISTRATION', adminOnly: true }
              ].map(item => {
                if (item.adminOnly && !isAdmin) return null;
                
                const isDashboard = item.id === 'dashboard';

                return (
                  <button 
                    key={item.id}
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (item.anchor) {
                        setCurrentPage('home');
                        setTimeout(() => {
                          document.getElementById(item.anchor!)?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      } else {
                        setCurrentPage(item.id as Page);
                      }
                    }}
                    className={cn(
                      "w-full px-8 rounded-2xl text-left font-black uppercase tracking-widest transition-all duration-300 relative overflow-hidden",
                      isDashboard ? "py-6 text-2xl border-2 border-emerald-500/30" : "py-5 text-xl",
                      currentPage === item.id 
                        ? isDashboard
                          ? "bg-emerald-600 text-white shadow-2xl shadow-emerald-500/40 scale-[1.02]"
                          : "bg-gold text-maritime shadow-2xl shadow-gold/20" 
                        : isDashboard
                          ? "bg-emerald-950/50 text-emerald-400 border-emerald-500/20 shadow-lg shadow-emerald-900/10"
                          : "text-white/70 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <span className="relative z-10">{item.label}</span>
                  </button>
                );
              }) : (
                <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10 mb-4">
                    <Lock size={32} className="text-gold" />
                  </div>
                  <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Accès Restreint</h3>
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest leading-relaxed">
                    Veuillez vous authentifier sur la page d'accueil pour accéder aux services.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-12 space-y-6">
              {user && (
                <div className="p-6 bg-white/5 rounded-2xl flex items-center justify-between border border-white/10">
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">{isAdmin ? "PROFIL ADMIN" : "PROFIL PASSAGER"}</p>
                    <p className="font-bold text-white text-lg">{user.displayName || "Passager"}</p>
                  </div>
                  <button onClick={() => { setIsMenuOpen(false); logout(); }} className="p-4 text-rose-400 bg-rose-400/10 rounded-xl hover:bg-rose-400/20 transition-all">
                    <LogOut size={24} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-4 sm:py-6 relative z-10 text-center">
        <AnimatePresence mode="wait">
          {verifyId ? (
            <VerificationView id={verifyId} onClose={() => { setVerifyId(null); window.history.pushState({}, '', '/'); }} />
          ) : !user ? (
            <LandingLogin 
              siteSettings={siteSettings} 
              onLoginSuccess={() => setCurrentPage('home')} 
              setUser={setUser} 
              setIsAdmin={setIsAdmin}
              setIsAdminUnlocked={setIsAdminUnlocked}
            />
          ) : (
            <>
              {currentPage === 'home' && <Home onBook={() => setCurrentPage('booking')} onNavigate={setCurrentPage} siteSettings={siteSettings} schedules={schedules} />}
              {currentPage === 'booking' && (
                <Booking 
                  onReserved={(res) => { setCurrentReservation(res); setCurrentPage('payment'); }} 
                  user={user} 
                  onLoginRequest={() => setAuthModal({ isOpen: true, mode: 'user' })}
                />
              )}
              {currentPage === 'payment' && <Payment reservation={currentReservation} onComplete={() => setCurrentPage('tickets')} siteSettings={siteSettings} />}
              {currentPage === 'dashboard' && <Dashboard siteSettings={siteSettings} onNavigate={setCurrentPage} schedules={schedules} isAdmin={isAdmin} isAdminUnlocked={isAdminUnlocked} setIsAdminUnlocked={setIsAdminUnlocked} setUser={setUser} />}
              {currentPage === 'tickets' && <MyTickets user={user} siteSettings={siteSettings} />}
              {currentPage === 'news' && <NewsView />}
              {currentPage === 'gallery' && <GalleryView siteSettings={siteSettings} />}
              {currentPage === 'users' && <UsersListView />}
              {currentPage === 'map' && <LocalisationView />}
              <ChatWidget user={user} />
            </>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative py-20 px-8 mt-12 w-full text-center overflow-hidden group">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src={siteSettings.homeDetail} 
            className="w-full h-full object-cover transition-transform duration-[10s] group-hover:scale-110" 
            alt="Footer Background"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop";
            }}
          />
          {/* Background Image fully visible */}
        </div>

        <div className="max-w-7xl mx-auto flex flex-col items-center text-center space-y-16 relative z-10">
          <div className="space-y-4">
            <h5 className="text-4xl font-serif italic text-white leading-none tracking-tighter uppercase">
              AMR MUGOTE <br/>& SES FRERES
            </h5>
            <p className="text-[11px] font-black tracking-[0.5em] text-gold italic uppercase">
              Voyager en toute sécurité
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 w-full pt-16 border-t border-white/10 items-start">
            <div className="space-y-6">
              <h6 className="text-[10px] font-black uppercase tracking-[0.4em] text-white italic underline underline-offset-8 decoration-gold/50">Contact & Support</h6>
              <ul className="space-y-4 text-white/60 text-[10px] font-bold uppercase tracking-[0.2em]">
                <li className="flex items-center justify-center gap-3 hover:text-white transition-colors"> 
                  <span className="w-1.5 h-1.5 bg-gold rounded-full" /> {MERCHANT_PHONE}
                </li>
                <li className="flex items-center justify-center gap-3 hover:text-white transition-colors"> 
                  <span className="w-1.5 h-1.5 bg-gold rounded-full" /> contact@amrmugote.com
                </li>
                <li className="flex items-center justify-center gap-3 hover:text-white transition-colors"> 
                  <span className="w-1.5 h-1.5 bg-gold rounded-full" /> Port de Bukavu / Goma
                </li>
              </ul>
            </div>
            <div className="space-y-6">
              <h6 className="text-[10px] font-black uppercase tracking-[0.4em] text-white italic underline underline-offset-8 decoration-gold/50">Navigation</h6>
              <ul className="space-y-4 text-white/60 text-[10px] font-bold uppercase tracking-[0.2em]">
                <li><button onClick={() => setCurrentPage('home')} className="hover:text-gold transition-colors cursor-pointer uppercase">Accueil</button></li>
                <li><button onClick={() => setCurrentPage('booking')} className="hover:text-gold transition-colors cursor-pointer uppercase">Réservations</button></li>
                <li><button onClick={() => setCurrentPage('news')} className="hover:text-gold transition-colors cursor-pointer uppercase">Journal de Bord</button></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h6 className="text-[10px] font-black uppercase tracking-[0.4em] text-white italic underline underline-offset-8 decoration-gold/50">Flotte Officielle</h6>
              <ul className="space-y-4 text-white/60 text-[10px] font-bold uppercase tracking-[0.2em]">
                <li className="italic hover:text-white transition-colors">M/V MUGOTE 1</li>
                <li className="italic hover:text-white transition-colors">M/V MUGOTE 2</li>
                <li className="italic hover:text-white transition-colors">M/V MUGOTE 3</li>
              </ul>
            </div>
          </div>

          <div className="pt-16 border-t border-white/5 w-full flex flex-col items-center gap-4">
            {isAdmin && (
              <button 
                onClick={() => setAuthModal({ isOpen: true, mode: 'admin' })}
                className="text-[9px] font-bold text-[#d4af37] uppercase tracking-[0.6em] hover:text-white transition-colors mb-2 cursor-pointer"
              >
                ADMINISTRATION
              </button>
            )}
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.6em]">
              © {new Date().getFullYear()} ETS AMR MUGOTE ET SES FRERES • NAVIGATION LACUSTRE
            </p>
          </div>
        </div>
      </footer>
      <AuthModal 
        isOpen={authModal.isOpen} 
        mode={authModal.mode} 
        onClose={() => setAuthModal(prev => ({ ...prev, isOpen: false }))} 
        setUser={setUser}
        setIsAdmin={setIsAdmin}
        setIsAdminUnlocked={setIsAdminUnlocked}
        onAdminSuccess={() => {
          setCurrentPage('dashboard');
        }}
      />

      {/* Bouton de contrôle flottant (PWA) */}
      <div className="fixed bottom-6 left-6 z-[90]">
        <button
          onClick={() => setIsInstallModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white border border-emerald-400/40 rounded-2xl shadow-2xl shadow-black/80 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer relative overflow-hidden"
          title="Installer l'application sur votre appareil pour l'avoir hors-ligne"
        >
          <span className="absolute -right-2 -top-2 w-8 h-8 bg-white/20 rounded-full blur-sm animate-ping opacity-70"></span>
          <Smartphone size={16} className="text-white animate-bounce" />
          <span>📲 TELECHARGER L'APP</span>
        </button>
      </div>

      {/* PWA App Installation Tutorial Modal - GUIDÉ COMME UN BÉBÉ */}
      <AnimatePresence>
        {isInstallModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-slate-100 text-left"
            >
              {/* Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl text-slate-950">
                    <Ship size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm sm:text-lg uppercase tracking-tight">Installer l'Application</h2>
                    <p className="text-[9px] text-[#eab308] font-bold uppercase tracking-widest">AMR MUGOTE SUR VOTRE APPAREIL</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsInstallModalOpen(false)}
                  className="p-1.5 bg-white/10 hover:bg-rose-500/20 hover:text-rose-400 text-white rounded-xl transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body Content */}
              <div className="p-6 overflow-y-auto space-y-6">
                
                {/* Platform Badge Banner */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-left">
                    <span className="text-3xl">📱</span>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Votre Appareil Détecté :</p>
                      <span className="font-extrabold text-sm text-slate-900 uppercase">
                        {userPlatform === 'ios' ? '🍏 iPhone / iPad (iOS)' : 
                         userPlatform === 'android' ? '🤖 Téléphone Android' : 
                         userPlatform === 'desktop' ? '💻 Ordinateur (PC / Mac)' : '📲 Appareil Mobile intelligent'}
                      </span>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 bg-[#001233]/10 text-[#001233] text-[9px] font-bold uppercase tracking-widest rounded-lg">
                    Compatible 100%
                  </div>
                </div>

                {/* Main Instruction Block */}
                <div className="space-y-4">
                  <p className="text-xs sm:text-sm text-slate-600 font-medium">
                    Suivez ces étapes très simples pour installer l'application sur votre écran d'accueil. Ainsi, elle s'ouvrira comme une vraie application native (sans barre d'adresse de recherche) et fonctionnera avec une rapidité impressionnante !
                  </p>

                  {/* Android Install Section */}
                  {userPlatform === 'android' && (
                    <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col gap-4 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-700 font-black text-xs sm:text-sm uppercase tracking-wider">Méthode Ultra Rapide (Recommandé)</span>
                      </div>
                      {isInstallable && deferredPrompt ? (
                        <button
                          onClick={handleInstallClick}
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Rocket size={16} />
                          Installer maintenant en 1 clic
                        </button>
                      ) : (
                        <div className="space-y-3.5 text-xs text-emerald-800 leading-relaxed font-bold">
                          <div className="flex items-start gap-2.5">
                            <span className="bg-emerald-200/60 text-emerald-900 w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                            <p>Appuyez sur les <strong className="text-emerald-950">3 petits points verticaux</strong> en haut à droite de votre navigateur Google Chrome.</p>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <span className="bg-emerald-200/60 text-emerald-900 w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                            <p>Appuyez sur l'option <strong className="text-emerald-950">"Installer l'application"</strong> (ou "Ajouter à l'écran d'accueil").</p>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <span className="bg-emerald-200/60 text-emerald-900 w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
                            <p>Validez en cliquant sur <strong className="text-emerald-950">"Installer"</strong>. L'icône dorée de l'AMR Mugote s'ajoutera à vos applications !</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* iOS/Apple Safari Install Section */}
                  {userPlatform === 'ios' && (
                    <div className="p-5 bg-[#001233]/5 rounded-2xl border border-[#001233]/10 space-y-4 text-left">
                      <span className="text-[#001233] font-black text-xs sm:text-sm uppercase tracking-wider block">Guide d'installation iPhone / iPad 🍏</span>
                      <div className="space-y-3.5 text-xs text-slate-700 leading-relaxed font-semibold">
                        <div className="flex items-start gap-2.5">
                          <span className="bg-[#001233]/10 text-[#001233] w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                          <p>Ouvrez ce lien dans le navigateur par défaut de votre iPhone, <strong className="text-[#001233]">Safari</strong>.</p>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <span className="bg-[#001233]/10 text-[#001233] w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                          <p>Appuyez sur l'icône de <strong className="text-[#001233]">Partager</strong> <Upload size={14} className="inline mx-1 text-[#001233]" /> (le carré avec une flèche pointant vers le haut en bas de votre écran).</p>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <span className="bg-[#001233]/10 text-[#001233] w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
                          <p>Faites défiler le menu d'options vers le bas et sélectionnez l'option <strong className="text-[#001233]">"Sur l'écran d'accueil"</strong> (ou <em className="text-slate-500 font-medium">Add to Home Screen</em>).</p>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <span className="bg-[#001233]/10 text-[#001233] w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">4</span>
                          <p>Cliquez sur l'option <strong className="text-[#001233]">"Ajouter"</strong> en haut à droite. Voilà ! L'application est installée sur votre iPhone.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Desktop Install Section */}
                  {userPlatform === 'desktop' && (
                    <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200/60 space-y-4 text-left">
                      <span className="text-[#ca8a04] font-black text-xs sm:text-sm uppercase tracking-wider block">Méthode Facile pour Ordinateur (PC / Mac / Linux) 💻</span>
                      {isInstallable && deferredPrompt ? (
                        <button
                          onClick={handleInstallClick}
                          className="w-full py-3.5 bg-[#001233] hover:bg-[#00224d] text-[#eab308] border border-[#eab308]/30 text-xs font-black uppercase tracking-widest rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Rocket size={16} />
                          Installer l'application sur mon PC
                        </button>
                      ) : (
                        <div className="space-y-3.5 text-xs text-amber-900 leading-relaxed font-semibold">
                          <div className="flex items-start gap-2.5">
                            <span className="bg-amber-100 text-amber-900 w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                            <p>Dans la barre d'adresse de votre navigateur Chrome ou Edge (en haut à droite, là où vous tapez les adresses de sites), recherchez la petite icône avec une <strong className="text-slate-900">petite flèche pointant vers le bas</strong> ou <strong className="text-slate-900">trois carrés avec un "+"</strong>.</p>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <span className="bg-amber-100 text-amber-900 w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                            <p>Cliquez sur cette icône d'installation rapide.</p>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <span className="bg-amber-100 text-amber-900 w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
                            <p>Choisissez <strong className="text-slate-900">"Installer"</strong>. Un raccourci s'ajoutera automatiquement sur votre Bureau PC/Mac.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Generic Appareil Mobile / fallback */}
                  {userPlatform === 'generic' && (
                    <div className="p-5 bg-slate-100 rounded-2xl border border-slate-200 text-xs space-y-4 text-left">
                      <span className="text-slate-800 font-extrabold uppercase tracking-wider block">Instructions Générales de Téléchargement</span>
                      <p className="text-slate-600 leading-relaxed font-medium">
                        Pour tout autre navigateur ou tablette, ouvrez le <strong>Menu options</strong> (souvent représenté par les trois points <strong className="text-slate-800">⋮</strong> ou l'icône de partage) et choisissez l'option <strong className="text-slate-800">"Ajouter à l'écran d'accueil"</strong> ou <strong className="text-slate-800">"Installer l'application"</strong>.
                      </p>
                    </div>
                  )}
                </div>

                {/* Share feature so it's shareable with everyone */}
                <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-[#eab308] text-xs uppercase tracking-wider">📤 Partager avec vos proches</h5>
                    <p className="text-[10px] text-slate-300 font-semibold leading-relaxed">
                      Envoyez cette web-app à votre équipe ou vos passagers pour qu'ils puissent également l'installer en quelques secondes.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const shareData = {
                        title: "AMR MUGOTE & FRERES",
                        text: "Réservez vos navettes lacustres sécurisées entre Bukavu et Goma sur le lac Kivu via l'application officielle AMR Mugote.",
                        url: window.location.origin
                      };
                      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                        try {
                          await navigator.share(shareData);
                        } catch (err) {
                          console.log("User canceled or sharing failed, falling back to copy", err);
                        }
                      } else {
                        navigator.clipboard.writeText(window.location.origin);
                        alert("Lien de l'application copié ! Vous pouvez maintenant le coller et l'envoyer par WhatsApp, SMS ou vos réseaux favoris.");
                      }
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#eab308] to-yellow-500 hover:from-yellow-500 hover:to-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg flex items-center gap-2 transition-all shrink-0 cursor-pointer"
                  >
                    <Check size={14} className="text-slate-950 font-black" />
                    Partager l'App
                  </button>
                </div>

              </div>

              {/* Close Button Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center flex justify-end">
                <button
                  onClick={() => setIsInstallModalOpen(false)}
                  className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}

function UserLoginForm({ onSuccess, setUser, setIsAdmin, setIsAdminUnlocked }: { onSuccess: () => void, setUser?: (u: any) => void, setIsAdmin?: (val: boolean) => void, setIsAdminUnlocked?: (val: boolean) => void }) {
  const [tab, setTab] = useState<'phone' | 'email'>('phone');
  
  // Nom Complet & numéros
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Email
  const [email, setEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorCode(null);
    const cleanName = name.trim();
    const cleanPhone = phone.trim().replace(/[\s\-\(\)\.]/g, '');

    if (!cleanName || cleanName.length < 2) {
      setErrorCode("Veuillez entrer un nom valide (au moins 2 lettres).");
      return;
    }

    if (!cleanPhone || cleanPhone.length < 7) {
      setErrorCode("Un numéro de téléphone valide est requis (au moins 7 chiffres, ex: 0991234567).");
      return;
    }

    setLoading(true);
    try {
      // Pour s’assurer que l’utilisateur est visible dans la console d’authentification de Firebase,
      // on lui crée un identifiant Firebase Auth sous forme d’un e-mail virtuel stable
      const pseudoEmail = `${cleanPhone}@mugote.com`;
      const pseudoPassword = `phone_pass_${cleanPhone}`;
      let cred;
      let uid = "usr_" + cleanPhone; // Fallback d'identification stable si l'iframe bloque Firebase Auth
      let authSuccess = false;

      try {
        cred = await signInWithEmailAndPassword(auth, pseudoEmail, pseudoPassword);
        uid = cred.user.uid;
        authSuccess = true;
      } catch (authErr: any) {
        console.warn("Tentative de connexion téléphonique échouée ou bloquée par réseau, tentative de création de compte :", authErr.message || authErr);
        try {
          cred = await createUserWithEmailAndPassword(auth, pseudoEmail, pseudoPassword);
          uid = cred.user.uid;
          authSuccess = true;
        } catch (createErr: any) {
          console.warn("Création de compte téléphonique de secours échouée ou bloquée par réseau. Utilisation du mode local stable.");
        }
      }

      if (cred?.user) {
        try {
          await updateProfile(cred.user, { displayName: cleanName });
        } catch (profileErr) {
          console.warn("Could not sync profile to Firebase Auth:", profileErr);
        }
      }

      const emailVal = pseudoEmail;
      
      localStorage.setItem('mugote_user_name', cleanName);
      localStorage.setItem('mugote_user_phone', cleanPhone);
      
      const localUserObj = {
        uid,
        displayName: cleanName,
        phone: cleanPhone,
        email: emailVal,
        isAnonymous: false,
        photoURL: '',
        isLocalSyncOnly: !authSuccess
      };
      
      localStorage.setItem('mugote_local_user', JSON.stringify(localUserObj));
      if (setUser) {
        setUser(localUserObj);
      }
      
      // Enregistrer directement dans Firestore de manière synchrone pour garantir l’affichage instantané.
      // Fonctionne via la règle Firestore 'usr_' même si Firebase Auth est bloqué par le navigateur.
      try {
        await setDoc(doc(db, 'users', uid), {
          uid,
          email: emailVal,
          displayName: cleanName,
          phone: cleanPhone,
          photoURL: '',
          isAnonymous: false,
          lastLogin: serverTimestamp(),
          isLocalSyncOnly: !authSuccess
        }, { merge: true });
      } catch (dbErr) {
        console.warn("Could not sync phone user to main users collection in DB (offline or blocked rules):", dbErr);
      }

      try {
        await setDoc(doc(db, 'users_list', uid), {
          uid,
          email: emailVal,
          displayName: cleanName,
          phone: cleanPhone,
          isAnonymous: false,
          lastLogin: serverTimestamp(),
          isLocalSyncOnly: !authSuccess,
          usageCount: increment(1)
        }, { merge: true });
      } catch (dbErr) {
        console.warn("Could not sync phone user to users_list collection in DB (offline or blocked rules):", dbErr);
      }
      
      console.log("Registered phone user successfully in Firebase and/or Firestore:", uid, "Auth status:", authSuccess);
      onSuccess();
    } catch (err: any) {
      console.error("Phone authentication failure - Fallback automatic user session initialized:", err);
      const fallbackUid = "usr_" + cleanPhone;
      const localUserObj = {
        uid: fallbackUid,
        displayName: cleanName,
        phone: cleanPhone,
        email: `${cleanPhone}@mugote.com`,
        isAnonymous: false,
        photoURL: '',
        isLocalSyncOnly: true
      };
      localStorage.setItem('mugote_user_name', cleanName);
      localStorage.setItem('mugote_user_phone', cleanPhone);
      localStorage.setItem('mugote_local_user', JSON.stringify(localUserObj));
      if (setUser) {
        setUser(localUserObj);
      }
      
      // Enregistrer directement dans Firestore de manière synchrone pour garantir l’affichage instantané
      try {
        await setDoc(doc(db, 'users', fallbackUid), {
          uid: fallbackUid,
          email: `${cleanPhone}@mugote.com`,
          displayName: cleanName,
          phone: cleanPhone,
          photoURL: '',
          isAnonymous: false,
          lastLogin: serverTimestamp(),
          isLocalSyncOnly: true
        }, { merge: true });

        await setDoc(doc(db, 'users_list', fallbackUid), {
          uid: fallbackUid,
          email: `${cleanPhone}@mugote.com`,
          displayName: cleanName,
          phone: cleanPhone,
          isAnonymous: false,
          lastLogin: serverTimestamp(),
          isLocalSyncOnly: true,
          usageCount: increment(1)
        }, { merge: true });
        console.log("Fallback phone user synchronized to users and users_list collections successfully.");
      } catch (dbErr) {
        console.warn("Could not sync fallback phone user to main collections:", dbErr);
      }

      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorCode(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail) {
      setErrorCode("L'adresse e-mail est requise.");
      return;
    }
    if (!cleanName || cleanName.length < 2) {
      setErrorCode("Veuillez entrer un nom complet (au moins 2 lettres).");
      return;
    }

    setLoading(true);
    let authSuccess = false;
    try {
      if (cleanEmail === getAdminEmail().toLowerCase()) {
        if (adminPassword.trim() !== getAdminPassword()) {
          setErrorCode("Mot de passe de session incorrect.");
          setLoading(false);
          return;
        }
        
        try {
          await signInWithEmailAndPassword(auth, getAdminEmail(), getAdminPassword());
          console.log("Firebase Auth admin session initiated successfully.");
        } catch (authErr: any) {
          if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/wrong-password') {
            try {
              await createUserWithEmailAndPassword(auth, getAdminEmail(), getAdminPassword());
              console.log("Firebase Auth admin account created successfully.");
            } catch (signUpErr) {
              console.warn("Could not automatically sign up admin in Firestore:", signUpErr);
            }
          } else {
            console.warn("Underlying Firebase Auth admin sign-in skipped:", authErr);
          }
        }

        const adminUser = {
          uid: 'admin_mugote',
          displayName: 'Administrateur Mugote',
          email: getAdminEmail(),
          phone: '0000000000',
          isAnonymous: false,
          photoURL: ''
        };
        
        localStorage.setItem('mugote_user_name', 'Administrateur Mugote');
        localStorage.setItem('mugote_local_user', JSON.stringify(adminUser));
        localStorage.setItem('mugote_admin_session', 'true');
        
        if (setIsAdmin) setIsAdmin(true);
        if (setIsAdminUnlocked) setIsAdminUnlocked(true);
        if (setUser) setUser(adminUser);
        
        onSuccess();
        setLoading(false);
        return;
      }

      // Compte Firebase Auth silencieux (email-passwordless)
      const pseudoPassword = `pwd_mugote_${cleanEmail}`;
      let cred;
      const cleanEmailKey = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      let uid = `usr_email_${cleanEmailKey}`;

      try {
        cred = await signInWithEmailAndPassword(auth, cleanEmail, pseudoPassword);
        uid = cred.user.uid;
        authSuccess = true;
      } catch (authErr: any) {
        console.warn("Connexion email silencieuse échouée, tentative de création automatique :", authErr.message || authErr);
        try {
          cred = await createUserWithEmailAndPassword(auth, cleanEmail, pseudoPassword);
          uid = cred.user.uid;
          authSuccess = true;
        } catch (createErr: any) {
          console.warn("La création/connexion avec Firebase Auth a échoué (mode de secours local activé) :", createErr);
          uid = `usr_email_${cleanEmailKey}`;
          authSuccess = false;
        }
      }

      if (cred?.user) {
        try {
          await updateProfile(cred.user, { displayName: cleanName });
        } catch (profileErr) {
          console.warn("Could not sync profile to Firebase Auth:", profileErr);
        }
      }

      const localUserObj = {
        uid,
        displayName: cleanName,
        phone: '',
        email: cleanEmail,
        isAnonymous: false,
        photoURL: cred?.user?.photoURL || '',
        isLocalSyncOnly: !authSuccess
      };

      localStorage.setItem('mugote_user_name', cleanName);
      localStorage.setItem('mugote_local_user', JSON.stringify(localUserObj));
      if (setUser) {
        setUser(localUserObj);
      }

      // Enregistrer directement dans Firestore
      try {
        await setDoc(doc(db, 'users', uid), {
          uid,
          email: cleanEmail,
          displayName: cleanName,
          phone: '',
          photoURL: cred?.user?.photoURL || '',
          isAnonymous: false,
          lastLogin: serverTimestamp(),
          isLocalSyncOnly: !authSuccess
        }, { merge: true });
      } catch (dbErr) {
        console.warn("Could not sync email user to main users collection in DB:", dbErr);
      }

      try {
        await setDoc(doc(db, 'users_list', uid), {
          uid,
          email: cleanEmail,
          displayName: cleanName,
          phone: '',
          isAnonymous: false,
          lastLogin: serverTimestamp(),
          isLocalSyncOnly: !authSuccess,
          usageCount: increment(1)
        }, { merge: true });
      } catch (dbErr) {
        console.warn("Could not sync email user to users_list collection in DB:", dbErr);
      }

      console.log("Logged in passwordless email user successfully:", uid, "Auth status:", authSuccess);
      onSuccess();
    } catch (err: any) {
      console.error("Email passwordless authentication failure - Fallback automatic user session initialized:", err);
      const cleanEmailKey = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      const fallbackUid = `usr_email_${cleanEmailKey}`;
      const localUserObj = {
        uid: fallbackUid,
        displayName: cleanName,
        phone: '',
        email: cleanEmail,
        isAnonymous: false,
        photoURL: '',
        isLocalSyncOnly: true
      };
      localStorage.setItem('mugote_user_name', cleanName);
      localStorage.setItem('mugote_local_user', JSON.stringify(localUserObj));
      if (setUser) {
        setUser(localUserObj);
      }

      // Enregistrer directement dans Firestore de manière synchrone pour garantir l’affichage instantané
      try {
        await setDoc(doc(db, 'users', fallbackUid), {
          uid: fallbackUid,
          email: cleanEmail,
          displayName: cleanName,
          phone: '',
          photoURL: '',
          isAnonymous: false,
          lastLogin: serverTimestamp(),
          isLocalSyncOnly: true
        }, { merge: true });

        await setDoc(doc(db, 'users_list', fallbackUid), {
          uid: fallbackUid,
          email: cleanEmail,
          displayName: cleanName,
          phone: '',
          isAnonymous: false,
          lastLogin: serverTimestamp(),
          isLocalSyncOnly: true,
          usageCount: increment(1)
        }, { merge: true });
        console.log("Fallback email user synchronized to users and users_list collections successfully.");
      } catch (dbErr) {
        console.warn("Could not sync fallback email user to main collections:", dbErr);
      }

      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorCode(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      const cred = await signInWithPopup(auth, provider);
      
      const nameVal = cred.user.displayName || 'Voyageur Google';
      const emailVal = cred.user.email || 'Anonyme';
      
      localStorage.setItem('mugote_user_name', nameVal);
      
      const localUserObj = {
        uid: cred.user.uid,
        displayName: nameVal,
        phone: '',
        email: emailVal,
        isAnonymous: false,
        photoURL: cred.user.photoURL || ''
      };
      
      localStorage.setItem('mugote_local_user', JSON.stringify(localUserObj));
      if (setUser) {
        setUser(localUserObj);
      }
      
      try {
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          email: emailVal,
          displayName: nameVal,
          phone: '',
          photoURL: cred.user.photoURL || '',
          isAnonymous: false,
          lastLogin: serverTimestamp()
        }, { merge: true });

        await setDoc(doc(db, 'users_list', cred.user.uid), {
          uid: cred.user.uid,
          email: emailVal,
          displayName: nameVal,
          phone: '',
          isAnonymous: false,
          lastLogin: serverTimestamp(),
          usageCount: increment(1)
        }, { merge: true });
      } catch (dbErr) {
        console.warn("Did not sync authenticated Google user to Firestore (non-blocking):", dbErr);
      }
      
      console.log("Registered or logged Google user successfully:", cred.user.uid);
      onSuccess();
    } catch (err: any) {
      console.error("Google authentication failed:", err);
      const isIframeOrPopupError = 
        err.code === 'auth/popup-blocked' || 
        err.code === 'auth/popup-closed-by-user' || 
        err.message?.includes('popup-closed-by-user') ||
        err.message?.includes('Pending promise was never set') ||
        err.message?.includes('network-request-failed') ||
        err.code?.includes('network-request-failed') ||
        err.message?.includes('INTERNAL ASSERTION');
        
      if (isIframeOrPopupError) {
        setErrorCode("REGRETS_IFRAME_GOOGLE_AUTH");
      } else if (err.code === 'auth/popup-blocked') {
        setErrorCode("Le popup de connexion Google a été bloqué par votre navigateur. Veuillez autoriser les popups ou ouvrir l'application dans un nouvel onglet.");
      } else {
        setErrorCode(err.message || "Impossible de se connecter via Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Selector */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50 mb-6 font-sans">
        <button
          type="button"
          onClick={() => { setTab('phone'); setErrorCode(null); }}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${
            tab === 'phone'
              ? 'bg-white text-maritime shadow-sm font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Phone size={12} />
          Nom & Téléphone
        </button>
        <button
          type="button"
          onClick={() => { setTab('email'); setErrorCode(null); }}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${
            tab === 'email'
              ? 'bg-white text-maritime shadow-sm font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Mail size={12} />
          Email
        </button>
      </div>

      {tab === 'phone' ? (
        /* Traditional Name & Phone Form */
        <form onSubmit={handlePhoneLogin} className="space-y-6 text-left">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">
              Votre Nom Complet (Nom & Post-nom)
            </label>
            <div className="relative">
              <span className="absolute left-5 top-4.5 text-slate-300"><User size={16} /></span>
              <input 
                required
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 ring-maritime/5 text-sm font-bold uppercase tracking-wide placeholder-slate-300"
                placeholder="Ex: LANDRY MUGOTE"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">
              Votre Numéro de Téléphone
            </label>
            <div className="relative">
              <span className="absolute left-5 top-4.5 text-slate-300"><Phone size={16} /></span>
              <input 
                required
                type="text" 
                value={phone} 
                onChange={e => setPhone(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 ring-maritime/5 text-sm font-bold font-mono tracking-wider placeholder-slate-300"
                placeholder="Ex: 0991234567"
              />
            </div>
          </div>

          {errorCode && (
            <div className="p-4 bg-rose-50 border border-rose-150 rounded-2xl space-y-2">
              <div className="text-rose-600 text-[10px] font-bold uppercase tracking-wider leading-relaxed text-left">
                {errorCode.includes('network-request-failed') || errorCode.toLowerCase().includes('network') ? (
                  <>
                    <span className="block font-black text-rose-800 mb-1">⚠️ Restriction Sécuritaire de l'Iframe</span>
                    L'aperçu AI Studio interdit les requêtes sécurisées de connexion tiers. Ouvrez l'application dans un nouvel onglet pour contourner ce blocage.
                    <button 
                      type="button" 
                      onClick={() => window.open(window.location.origin + window.location.pathname, '_blank')}
                      className="block mt-2 font-black text-maritime hover:text-black hover:underline cursor-pointer uppercase text-[9px] tracking-wider"
                    >
                      👉 Ouvrir l'application dans un nouvel onglet
                    </button>
                  </>
                ) : (
                  errorCode
                )}
              </div>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-maritime text-white font-black rounded-2xl uppercase tracking-[0.25em] text-[10px] sm:text-xs shadow-xl shadow-maritime/20 hover:bg-black transform active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer animate-fade-in animate-pulse"
          >
            {loading ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="border-2 border-white/35 border-t-white w-4 h-4 rounded-full" />
                Accès en cours...
              </>
            ) : (
              <>
                Se Connecter par Nom/Tél
                <ChevronRight size={14} />
              </>
            )}
          </button>
        </form>
      ) : (
        /* Email passwordless Form */
        <form onSubmit={handleEmailAuth} className="space-y-6 text-left">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">
              Votre Nom Complet (Nom & Post-nom)
            </label>
            <div className="relative">
              <span className="absolute left-5 top-4.5 text-slate-300"><User size={16} /></span>
              <input 
                required
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 ring-maritime/5 text-sm font-bold uppercase tracking-wide placeholder-slate-300"
                placeholder="Ex: JEAN LOKO"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">
              Adresse E-mail
            </label>
            <div className="relative">
              <span className="absolute left-5 top-4.5 text-slate-300"><Mail size={16} /></span>
              <input 
                required
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 ring-maritime/5 text-sm font-bold placeholder-slate-300"
                placeholder="voyageur@compagnie.com"
              />
            </div>
          </div>

          {email.trim().toLowerCase() === getAdminEmail().toLowerCase() && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className="space-y-4 mt-4 text-left overflow-hidden"
            >
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-maritime mb-2 ml-1">
                  Mot de passe de session (Strictement obligatoire)
                </label>
                <div className="relative">
                  <span className="absolute left-5 top-4.5 text-slate-450"><Lock size={16} /></span>
                  <input 
                    required
                    type="password" 
                    value={adminPassword} 
                    onChange={e => setAdminPassword(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-maritime/30 rounded-2xl focus:outline-none focus:ring-2 ring-maritime/5 text-sm font-bold placeholder-slate-300 text-black animate-pulse-subtle"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {errorCode && (
            <div className="p-4 bg-rose-50 border border-rose-150 rounded-2xl space-y-2">
              <div className="text-rose-600 text-[10px] font-bold uppercase tracking-wider leading-relaxed text-left">
                {errorCode.includes('network-request-failed') || errorCode.toLowerCase().includes('network') ? (
                  <>
                    <span className="block font-black text-rose-800 mb-1">⚠️ Restriction Sécuritaire de l'Iframe</span>
                    L'aperçu AI Studio interdit les requêtes sécurisées de connexion tiers. Ouvrez l'application dans un nouvel onglet pour contourner ce blocage.
                    <button 
                      type="button" 
                      onClick={() => window.open(window.location.origin + window.location.pathname, '_blank')}
                      className="block mt-2 font-black text-maritime hover:text-black hover:underline cursor-pointer uppercase text-[9px] tracking-wider"
                    >
                      👉 Ouvrir l'application dans un nouvel onglet
                    </button>
                  </>
                ) : (
                  errorCode
                )}
              </div>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-maritime text-white font-black rounded-2xl uppercase tracking-[0.25em] text-[10px] sm:text-xs shadow-xl shadow-maritime/20 hover:bg-black transform active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer animate-fade-in animate-pulse"
          >
            {loading ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="border-2 border-white/35 border-t-white w-4 h-4 rounded-full" />
                Traitement...
              </>
            ) : (
              <>
                Se Connecter par Email
                <ChevronRight size={14} />
              </>
            )}
          </button>
        </form>
      )}

      {/* Modern Google Separator & Button */}
      <div className="flex items-center my-6">
        <div className="flex-1 border-t border-slate-100"></div>
        <span className="px-4 text-[9px] font-black tracking-widest text-slate-300 uppercase">OU</span>
        <div className="flex-1 border-t border-slate-100"></div>
      </div>

      {errorCode === "REGRETS_IFRAME_GOOGLE_AUTH" && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3 mb-4 text-left">
          <div className="text-amber-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
            <span className="text-sm">⚠️</span> Restriction de Sécurité Iframe Détectée
          </div>
          <p className="text-slate-600 text-[10px] uppercase font-bold tracking-wide leading-relaxed">
            L'aperçu de l'éditeur AI Studio interdit l'authentification Google via Popup dans une Iframe sécurisée. Veuillez ouvrir l'application dans un nouvel onglet pour vous connecter de manière sécurisée et officielle.
          </p>
          <div className="grid grid-cols-1 gap-2 pt-1 font-sans">
            <button 
              type="button" 
              onClick={() => window.open(window.location.origin + window.location.pathname, '_blank')}
              className="py-3 px-4 bg-maritime text-white font-black rounded-xl uppercase text-[9px] tracking-wider text-center hover:bg-black transition-all cursor-pointer shadow-sm text-ellipsis overflow-hidden"
            >
              👉 Nouvel Onglet
            </button>
          </div>
        </div>
      )}

      <button 
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full py-4.5 bg-[#4285F4] hover:bg-[#357ae8] text-white font-black rounded-2xl uppercase tracking-widest text-[10px] sm:text-xs shadow-lg shadow-blue-500/10 flex items-center justify-center gap-3 active:scale-95 transition-all cursor-pointer"
      >
        <svg className="w-4 h-4 text-white fill-current shrink-0" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        Continuer avec Google
      </button>
    </div>
  );
}

function LandingLogin({ siteSettings, onLoginSuccess, setUser, setIsAdmin, setIsAdminUnlocked }: { siteSettings: any, onLoginSuccess?: () => void, setUser?: (u: any) => void, setIsAdmin?: (val: boolean) => void, setIsAdminUnlocked?: (val: boolean) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto space-y-12 py-12 px-6"
    >
      <div className="space-y-6">
        <div className="w-24 h-24 bg-maritime/5 rounded-[32px] flex items-center justify-center mx-auto border border-maritime/10">
          <Ship size={40} className="text-maritime" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black uppercase tracking-tighter italic text-maritime">Connexion Portage</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
            Accédez instantanément à la plateforme Mugote avec votre nom complet, numéro ou e-mail.
          </p>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[32px] border border-slate-100 shadow-2xl shadow-slate-200">
        <UserLoginForm 
          onSuccess={onLoginSuccess || (() => {})} 
          setUser={setUser} 
          setIsAdmin={setIsAdmin}
          setIsAdminUnlocked={setIsAdminUnlocked}
        />
        <p className="mt-8 text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
          En vous connectant, vous acceptez nos conditions de navigation des Ets AMR MUGOTE.
        </p>
      </div>

      <div className="pt-12 grid grid-cols-2 gap-4">
        <div className="p-6 bg-white/50 backdrop-blur-sm rounded-3xl border border-slate-100">
          <ShieldCheck className="text-emerald-500 mb-3" size={24} />
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sécurité</p>
          <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase">Billets Infalsifiables</p>
        </div>
        <div className="p-6 bg-white/50 backdrop-blur-sm rounded-3xl border border-slate-100">
          <Rocket className="text-gold mb-3" size={24} />
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Rapidité</p>
          <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase">Validation Instantanée</p>
        </div>
      </div>
    </motion.div>
  );
}

function AuthForm({ onSuccess, setUser }: { onSuccess: () => void, setUser?: (u: any) => void }) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-relaxed">
          Saisissez vos identifiants pour vous connecter
        </p>
      </div>

      <UserLoginForm onSuccess={onSuccess} setUser={setUser} />
      
      <div className="pt-4 border-t border-slate-50 text-center">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">Mugote Maritime Services</p>
      </div>
    </div>
  );
}

function AdminAuthForm({ onSuccess, setIsAdmin, setIsAdminUnlocked, setUser }: { onSuccess: () => void, setIsAdmin?: (val: boolean) => void, setIsAdminUnlocked?: (val: boolean) => void, setUser?: (u: any) => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (password === getAdminPassword()) {
        // Authentifier également en arrière-plan avec Firebase Auth pour accorder les privilèges Firestore
        try {
          await signInWithEmailAndPassword(auth, getAdminEmail(), getAdminPassword());
          console.log("Firebase Auth admin session initiated successfully.");
        } catch (authErr: any) {
          if (authErr.code === 'auth/user-not-found') {
            try {
              await createUserWithEmailAndPassword(auth, getAdminEmail(), getAdminPassword());
              console.log("Firebase Auth admin account created successfully.");
            } catch (signUpErr) {
              console.warn("Could not automatically sign up admin in Firestore:", signUpErr);
            }
          } else {
            console.warn("Underlying Firebase Auth admin sign-in skipped:", authErr);
          }
        }

        const adminUser = {
          uid: 'admin_mugote',
          displayName: 'Administrateur Mugote',
          email: getAdminEmail(),
          phone: '0000000000',
          isAnonymous: false,
          photoURL: ''
        };
        localStorage.setItem('mugote_local_user', JSON.stringify(adminUser));
        localStorage.setItem('mugote_admin_session', 'true');
        
        if (setIsAdmin) setIsAdmin(true);
        if (setIsAdminUnlocked) setIsAdminUnlocked(true);
        if (setUser) setUser(adminUser);
        
        onSuccess();
      } else {
        setError("Mot de passe incorrect.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Erreur d'authentification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest text-center leading-relaxed">
          Accès Base de Données — Entrez votre Code d'accés
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Code de la Base de Données</label>
          <input 
            required
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 ring-maritime/5 text-sm font-bold"
            placeholder="••••••••"
            autoFocus
          />
        </div>

        {error && (
          <p className="text-rose-500 text-[10px] font-black uppercase text-center bg-rose-50 py-3 rounded-xl border border-rose-100 animate-shake">
            {error}
          </p>
        )}

        <button 
          type="submit"
          disabled={loading}
          className="w-full py-5 bg-black text-white font-black rounded-2xl uppercase tracking-[0.2em] text-xs shadow-xl shadow-black/20 transform active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Vérification..." : "Accéder à la Console"}
        </button>
      </form>
    </div>
  );
}

function AuthModal({ isOpen, onClose, mode = 'user', setUser, setIsAdmin, setIsAdminUnlocked, onAdminSuccess }: { isOpen: boolean, onClose: () => void, mode?: 'user' | 'admin', setUser?: (u: any) => void, setIsAdmin?: (val: boolean) => void, setIsAdminUnlocked?: (val: boolean) => void, onAdminSuccess?: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl relative z-10 p-8 md:p-12"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X size={20} />
        </button>

        <div className="text-center mb-8">
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4",
            mode === 'admin' ? "bg-red-50" : "bg-maritime/5"
          )}>
            {mode === 'admin' ? <Lock className="text-red-600" size={32} /> : <Ship className="text-maritime" size={32} />}
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight italic">
            {mode === 'admin' ? "Espace Admin" : "Profil Voyageur"}
          </h2>
          <p className="text-slate-500 text-[10px] font-medium mt-1 uppercase tracking-widest text-center">
            {mode === 'admin' ? "Authentification requise" : "Gérez vos réservations Mugote"}
          </p>
        </div>

        {mode === 'admin' ? (
          <AdminAuthForm 
            onSuccess={() => {
              if (onAdminSuccess) onAdminSuccess();
              onClose();
            }} 
            setIsAdmin={setIsAdmin} 
            setIsAdminUnlocked={setIsAdminUnlocked} 
            setUser={setUser}
          />
        ) : (
          <AuthForm onSuccess={onClose} setUser={setUser} />
        )}
      </motion.div>
    </div>
  );
}

function AdminChatView({ conversation }: { conversation: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversation.id) return;
    const q = query(collection(db, 'conversations', conversation.id, 'messages'));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ ...d.data() as any, id: d.id }));
      msgs.sort((a, b) => {
        const timeA = a.createdAt?.seconds !== undefined ? a.createdAt.seconds : (Date.now() / 1000);
        const timeB = b.createdAt?.seconds !== undefined ? b.createdAt.seconds : (Date.now() / 1000);
        return timeA - timeB;
      });
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    // Mark as read
    updateDoc(doc(db, 'conversations', conversation.id), { adminUnreadCount: 0 });
    return unsub;
  }, [conversation.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'conversations', conversation.id, 'messages'), {
        text: reply,
        senderId: auth.currentUser?.uid,
        senderRole: 'ADMIN',
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'conversations', conversation.id), {
        lastMessage: reply,
        updatedAt: serverTimestamp()
      });
      setReply('');
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[600px] bg-white/50 backdrop-blur-xl">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/80">
        <div>
          <h4 className="text-[11px] font-black uppercase text-black tracking-widest">{conversation.userName}</h4>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{conversation.userEmail}</p>
        </div>
        <div className="px-4 py-1.5 bg-slate-100 rounded-full text-[8px] font-black uppercase text-slate-500 tracking-widest">Connecté</div>
      </div>
      <div className="p-10 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={cn(
            "max-w-[75%] p-5 text-[11px] font-bold leading-relaxed shadow-sm",
            m.senderRole === 'ADMIN' 
              ? "bg-black text-white ml-auto rounded-[32px] rounded-tr-none" 
              : m.senderRole === 'AI'
                ? "bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-[32px] rounded-tl-none italic"
                : "bg-white text-slate-700 border border-slate-100 rounded-[32px] rounded-tl-none"
          )}>
            <div className="text-[8px] uppercase tracking-widest opacity-50 mb-1">{m.senderRole}</div>
            {m.text}
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={handleSend} className="p-8 bg-white border-t border-slate-100 flex gap-4">
        <input 
          value={reply}
          onChange={e => setReply(e.target.value)}
          placeholder="Répondre au passager..."
          className="flex-1 px-8 py-5 bg-slate-50 border border-slate-100 rounded-3xl focus:outline-none focus:border-black focus:bg-white transition-all text-xs font-bold"
        />
        <button disabled={sending || !reply.trim()} className="w-16 h-16 bg-black text-white flex items-center justify-center rounded-3xl shadow-2xl shadow-black/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-30">
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

// --- Chat Widget ---

function ChatWidget({ user }: { user: FirebaseUser | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Guest chat state
  const [guestMessages, setGuestMessages] = useState<any[]>([
    { text: "Bienvenue chez Mugote ! Comment puis-je vous aider aujourd'hui ?", senderRole: 'AI' }
  ]);

  useEffect(() => {
    if (!user || !isOpen) return;

    const findConv = async () => {
      try {
        const q = query(
          collection(db, 'conversations'), 
          where('userId', '==', user.uid),
          where('status', '==', 'OPEN'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setConvId(snap.docs[0].id);
        } else {
          const newConv = await addDoc(collection(db, 'conversations'), {
            userId: user.uid,
            userEmail: user.email,
            userName: user.displayName || user.email?.split('@')[0],
            status: 'OPEN',
            updatedAt: serverTimestamp(),
            adminUnreadCount: 0,
            lastMessage: ''
          });
          setConvId(newConv.id);
        }
      } catch (err) {
        console.error("Failed to load conversation", err);
      }
    };
    findConv();
  }, [user, isOpen]);

  useEffect(() => {
    if (!convId) return;
    const q = query(collection(db, 'conversations', convId, 'messages'));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ ...d.data() as any, id: d.id }));
      msgs.sort((a, b) => {
        const timeA = a.createdAt?.seconds !== undefined ? a.createdAt.seconds : (Date.now() / 1000);
        const timeB = b.createdAt?.seconds !== undefined ? b.createdAt.seconds : (Date.now() / 1000);
        return timeA - timeB;
      });
      setMessages(msgs);
    });
    return unsub;
  }, [convId]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
    // Also use scrollIntoView as fallback
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    const text = inputText;
    setInputText('');
    setSending(true);

    if (!user) {
      // Guest Mode: Only IA response, no FireStore
      setGuestMessages(prev => [...prev, { text, senderRole: 'USER' }]);
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, history: guestMessages.slice(-5).map(m => ({ role: m.senderRole, text: m.text })) })
        });
        const data = await response.json();
        setGuestMessages(prev => [...prev, { text: data.text || "Erreur de connexion", senderRole: 'AI' }]);
      } catch (err) {
        setGuestMessages(prev => [...prev, { text: "Désolé, l'IA est indisponible.", senderRole: 'AI' }]);
      } finally {
        setSending(false);
      }
      return;
    }

    if (!convId) {
      setSending(false);
      return;
    }

    try {
      // 1. Add user message
      await addDoc(collection(db, 'conversations', convId, 'messages'), {
        text,
        senderId: user.uid,
        senderRole: 'USER',
        createdAt: serverTimestamp()
      });

      // 2. Update conversation
      await updateDoc(doc(db, 'conversations', convId), {
        lastMessage: text,
        updatedAt: serverTimestamp(),
        adminUnreadCount: increment(1)
      });

      // 3. Trigger AI response via server proxy
      const conversationHistory = messages.slice(-5).map(m => ({
        role: m.senderRole,
        text: m.text
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: text,
          history: conversationHistory
        })
      });
      
      const data = await response.json();
      const responseText = data.text || data.error || "Désolé, je rencontre un problème de connexion. Un administrateur va vous répondre bientôt.";

      await addDoc(collection(db, 'conversations', convId, 'messages'), {
        text: responseText,
        senderId: 'ai',
        senderRole: 'AI',
        createdAt: serverTimestamp()
      });

    } catch (error) {
      console.error("Chat error", error);
      // Show error in chat if it fails
      await addDoc(collection(db, 'conversations', convId, 'messages'), {
        text: "Désolé, je rencontre un problème technique. Veuillez réessayer dans quelques instants.",
        senderId: 'ai',
        senderRole: 'AI',
        createdAt: serverTimestamp()
      });
    } finally {
      setSending(false);
    }
  };

  const displayMessages = user ? messages : guestMessages;

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
           <motion.div 
             initial={{ opacity: 0, y: 20, scale: 0.9 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, y: 20, scale: 0.9 }}
             className="bg-white w-[320px] md:w-[380px] h-[480px] md:h-[600px] max-h-[80vh] shadow-2xl rounded-[32px] border border-slate-100 flex flex-col mb-4 overflow-hidden"
           >
             <div className="p-6 bg-black text-white flex justify-between items-center">
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 bg-gold rounded-full flex items-center justify-center text-black">
                   <Ship size={16} />
                 </div>
                 <div>
                   <h4 className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Mugote Assistant</h4>
                   <p className="text-[8px] opacity-70 font-bold uppercase tracking-wider">Navire en ligne</p>
                 </div>
               </div>
               <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                 <X size={20} />
               </button>
             </div>

             <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
               {displayMessages.length === 0 ? (
                 <div className="text-center py-20 space-y-4 opacity-20">
                   <MessageSquareText size={48} className="mx-auto" />
                   <p className="text-[10px] font-bold uppercase tracking-[.3em]">Posez vos questions !</p>
                 </div>
               ) : (
                 displayMessages.map((m, i) => (
                   <motion.div 
                    initial={{ opacity: 0, x: m.senderRole === 'USER' ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={i} 
                    className={cn(
                      "max-w-[85%] p-4 text-[11px] leading-relaxed shadow-sm",
                      m.senderRole === 'USER' 
                        ? "bg-black text-white ml-auto rounded-3xl rounded-tr-none font-medium" 
                        : "bg-white text-slate-700 border border-slate-100 rounded-3xl rounded-tl-none font-bold"
                    )}
                   >
                     {m.text}
                   </motion.div>
                 ))
               )}
               <div ref={scrollEndRef} />
             </div>

             <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex gap-2">
               <input 
                 value={inputText}
                 onChange={(e) => setInputText(e.target.value)}
                 placeholder="Tapez votre message..."
                 className="flex-1 bg-slate-50 rounded-2xl px-5 py-3 text-xs focus:outline-none focus:ring-2 ring-black/5"
               />
               <button 
                 disabled={sending || !inputText.trim()}
                 className="w-12 h-12 bg-black text-white flex items-center justify-center rounded-2xl shadow-xl shadow-black/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
               >
                 <Send size={18} />
               </button>
             </form>
           </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-16 h-16 flex items-center justify-center rounded-full shadow-2xl transition-all hover:scale-110 active:scale-90",
          isOpen ? "bg-white text-black border border-slate-100" : "bg-black text-white shadow-black/40"
        )}
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
      </button>
    </div>
  );
}

// --- Page Components ---

function Home({ onBook, onNavigate, siteSettings, schedules }: { onBook: () => void, onNavigate: (page: string) => void, siteSettings?: { homeBg: string, homeDetail: string }, schedules: any[] }) {
  const [media, setMedia] = useState<any[]>([]);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);

  const settings = siteSettings || { 
    homeBg: 'https://images.unsplash.com/photo-1559139225-8216b8e8303e?q=80&w=2070&auto=format&fit=crop',
    homeDetail: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop',
    logo: ''
  };

  useEffect(() => {
    // Large limit to catch all content, client-side sort for robustness
    const q = query(collection(db, 'news'), limit(1000));
    const unsub = onSnapshot(q, (snapshot) => {
      const newsItems = snapshot.docs.map(doc => {
        const data = doc.data();
        const type = (data.type || '').toLowerCase();
        const url = data.processedUrl || data.url || data.videoUrl || data.imageUrl || data.image || data.video || data.contentUrl || '';
        const isVideo = type === 'video' || !!(data.videoUrl || data.video) || (url && (url.toLowerCase().match(/\.(mp4|webm|ogg|mov|mkv|3gp|m4v|avi)(\?.*)?$/i) || url.toLowerCase().includes('youtube.com') || url.toLowerCase().includes('youtu.be') || url.toLowerCase().includes('vimeo.com') || (url.toLowerCase().includes('firebasestorage.googleapis.com') && (url.toLowerCase().includes('.mov') || url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('video') || url.toLowerCase().includes('.webm') || url.toLowerCase().includes('.avi')))));
        
        return {
          ...data,
          id: doc.id,
          processedUrl: url,
          processedType: isVideo ? 'video' : (type === 'text' && !url ? 'text' : 'image'),
          processedDesc: data.desc || data.content || data.description || data.text || '',
          sortDate: data.publishedAt || data.updatedAt || data.createdAt || { seconds: 0 }
        };
      }).filter((item: any) => item.title && item.title.trim() !== "");

      const sortedNews = newsItems.sort((a, b) => {
        const ta = a.sortDate?.seconds || 0;
        const tb = b.sortDate?.seconds || 0;
        return tb - ta;
      });

      setMedia(sortedNews.slice(0, 100)); // Show more on home
      // Filter for gallery specifically from the same dataset to avoid index issues
      setGalleryImages(sortedNews.filter(item => item.processedType === 'image').slice(0, 24));
    }, (error) => {
       console.error("Home query error:", error);
       // Silent fail to keep UI clean during network instability
    });

    return () => {
      unsub();
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-10 pb-16"
    >
      {/* Hero Section */}
      <section className="relative h-[85vh] min-h-[700px] -mx-8 -mt-6 overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={settings.homeBg || undefined} 
            alt="AMR MUGOTE Fleet" 
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1559139225-8216b8e8303e?q=80&w=2070&auto=format&fit=crop";
            }}
          />
          <div className="absolute inset-0 bg-black/10" />
        </div>
        
        <div className="relative h-full max-w-7xl mx-auto px-8 flex flex-col justify-center items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl flex flex-col items-center"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-[1px] bg-white/40" />
              <span className="text-white/80 text-[9px] font-extrabold tracking-[0.4em] uppercase">
                L'Excellence Navale sur le Kivu
              </span>
              <div className="w-8 h-[1px] bg-white/40" />
            </div>
            
            <h2 className="text-3xl md:text-5xl text-white font-serif italic mb-6 leading-[0.9] tracking-tighter">
              Voyagez vers <br/> l'essentiel.
            </h2>
            
            <p className="text-white/80 text-base md:text-lg max-w-lg mb-10 leading-relaxed font-light">
              Reliez Bukavu et Goma avec la flotte la plus moderne et sécurisée du bassin lacustre. 
            </p>
            
            <div className="flex flex-wrap gap-4 pt-2 justify-center">
              <button 
                onClick={onBook}
                className="px-8 py-4 bg-white text-black font-extrabold text-[9px] uppercase tracking-[0.3em] shadow-2xl hover:bg-slate-200 transition-all flex items-center gap-3 group"
              >
                Réserver mon trajet <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/20 text-white font-extrabold text-[9px] uppercase tracking-[0.3em] hover:bg-white/20 transition-all">
                Nos Navires
              </button>
            </div>
          </motion.div>
        </div>

        {/* Floating Detail Image */}
        <div className="absolute bottom-20 right-8 z-20 hidden xl:block">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.4, duration: 1 }}
            className="w-72 h-48 border-[12px] border-white nav-blur shadow-2xl rounded-sm overflow-hidden"
          >
            <img 
              src={settings.homeDetail || undefined} 
              alt="MUGOTE Detail"
              className="w-full h-full object-cover transition-transform duration-[3s] hover:scale-110"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop";
              }}
            />
          </motion.div>
        </div>
      </section>

      {/* Trust Marks */}
      <section className="max-w-7xl mx-auto px-8 flex flex-wrap items-center justify-between gap-8 py-8 border-y border-slate-100">
        {[
          { label: "Sécurité Certifiée", icon: ShieldCheck },
          { label: "Transports Quotidiens", icon: Clock },
          { label: "Flotte Moderne", icon: Ship },
          { label: "Réservation Digitale", icon: Ticket },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-4 text-maritime/40">
            <item.icon size={24} className="text-maritime" />
            <span className="text-[10px] font-bold uppercase tracking-widest leading-none">{item.label}</span>
          </div>
        ))}
      </section>

      {/* Document Scanner Section */}
      <section className="max-w-7xl mx-auto px-8 py-4">
        <DocumentScannerWidget />
      </section>

      {/* Services Section */}
      <section id="routes" className="max-w-7xl mx-auto px-8 text-center bg-white py-8 -mx-8">
        <div className="flex flex-col items-center space-y-12">
          <div className="space-y-4 max-w-2xl">
            <h3 className="text-black text-[9px] font-extrabold tracking-[0.4em] uppercase opacity-40">Nos Destinations</h3>
            <h4 className="text-xl font-extrabold tracking-tighter text-black leading-[0.9] italic uppercase">
              RELIER LE KIVU.
            </h4>
            <p className="text-slate-500 text-sm leading-relaxed">
              Nous opérons quotidiennement entre les ports de Bukavu et Goma. 
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
            {(schedules.length > 0 ? schedules : [
              { from: "Bukavu", to: "Goma", time: "07:30 AM", ship: "Mugote 1/2", days: "Tous les jours" },
              { from: "Goma", to: "Bukavu", time: "07:30 AM", ship: "Mugote 1/2", days: "Tous les jours" },
            ]).map((it, i) => (
              <div key={i} className="flex flex-col items-center justify-center p-8 bg-black border border-white/10 rounded-[40px] shadow-2xl space-y-8 transition-transform hover:scale-[1.02] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Clock size={120} />
                </div>
                <div className="flex items-center gap-8 relative z-10 w-full justify-center">
                  <div className="text-center group-hover:-translate-x-2 transition-transform">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-3">Départ</p>
                    <p className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">{it.from}</p>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-[2px] bg-gold/50" />
                    <Ship size={24} className="text-gold animate-pulse" />
                    <div className="w-12 h-[2px] bg-gold/50" />
                  </div>
                  <div className="text-center group-hover:translate-x-2 transition-transform">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-3">Arrivée</p>
                    <p className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">{it.to}</p>
                  </div>
                </div>
                <div className="pt-8 border-t border-white/5 w-full flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10 px-4">
                  <div className="text-center sm:text-left">
                    <p className="text-[10px] font-black text-gold uppercase tracking-[0.4em] leading-none mb-2">Horaire d'Embarquement</p>
                    <p className="text-4xl font-mono font-black text-white flex items-center justify-center sm:justify-start gap-4">
                       <Clock3 size={32} className="text-gold" /> {it.time}
                    </p>
                  </div>
                  <div className="text-center sm:text-right">
                     <p className="text-[11px] font-black text-white uppercase tracking-tighter italic">{it.ship || 'Tous nos Navires'}</p>
                     <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1.5">{it.days || 'Quotidiennement'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* News Highlight */}
      {media.length > 0 && (
        <section id="news-feed" className="bg-slate-50 py-16 -mx-8 border-y border-slate-150 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
          <div className="max-w-7xl mx-auto px-8 relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 border-b border-slate-200 pb-6 text-center md:text-left">
              <div className="space-y-2">
                <h3 className="text-gold text-[9px] font-extrabold tracking-[0.4em] uppercase">Journal d'Actualités</h3>
                <h4 className="text-2xl font-black tracking-tighter text-[#001233] leading-none uppercase">PUBLICATIONS RECENTES</h4>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Mises à jour de la flotte et avertissements aux voyageurs</p>
              </div>
              <button onClick={() => onNavigate('news')} className="px-5 py-2.5 bg-[#001233] text-white hover:bg-[#002255] cursor-pointer text-[9px] font-black uppercase tracking-widest flex items-center gap-2 rounded-xl shadow-md transition-all">Tous les détails <ChevronRight size={14} /></button>
            </div>
            
            <div className="max-w-3xl mx-auto space-y-12">
              {media.map((item: any, i) => {
                const isVideo = item.processedType === 'video';
                const isImage = item.processedType === 'image';
                const hasMedia = isVideo || isImage;
                
                return (
                  <div key={i} className="bg-white border border-slate-200/85 rounded-[32px] overflow-hidden shadow-lg flex flex-col text-center items-center group transition-all hover:border-gold/30">
                    {/* Header info */}
                    <div className="p-6 sm:p-8 pb-4 flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 gap-4 w-full text-center sm:text-left">
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#001233]/5 border border-[#001233]/15 flex items-center justify-center text-[#001233]">
                          <Ship size={18} className="text-[#001233]" />
                        </div>
                        <div className="text-center sm:text-left">
                          <span className="text-[10px] font-black uppercase text-gold tracking-widest block">ETS AMR MUGOTE</span>
                          <span className="text-[10px] text-slate-400 font-bold block">
                            {item.publishedAt ? (item.publishedAt.seconds ? new Date(item.publishedAt.seconds * 1000).toLocaleDateString() : new Date(item.publishedAt).toLocaleDateString()) : 'Nouveauté'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] px-3 py-1 bg-[#001233]/5 text-[#001233] rounded-md border border-[#001233]/10">
                        {item.processedType === 'video' ? 'Vidéo' : item.processedType === 'image' ? 'Image' : 'Information'}
                      </span>
                    </div>

                    {/* Content Section */}
                    <div className="p-6 sm:p-8 space-y-4 text-center w-full">
                      <h5 className="text-[#001233] text-xl sm:text-2xl font-black uppercase tracking-tight italic text-center">
                        {item.title}
                      </h5>
                      <p className="text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-line font-medium text-center max-w-2xl mx-auto">
                        {item.processedDesc}
                      </p>
                    </div>

                    {/* Media Attachments Section (Fully visible! Natural uncropped aspect ratios) */}
                    {hasMedia && (
                      <div className="px-6 sm:px-8 pb-6 w-full">
                        <div className="aspect-video sm:aspect-[16/10] rounded-2xl overflow-hidden bg-slate-50 relative flex items-center justify-center border border-slate-200 w-full">
                          {isVideo ? (
                            isEmbedVideo(item.processedUrl) ? (
                              <iframe
                                src={getEmbedUrl(item.processedUrl)}
                                className="w-full h-full border-0 bg-transparent"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title={item.title}
                              />
                            ) : (
                              <video 
                                key={item.processedUrl}
                                src={item.processedUrl || undefined} 
                                className="w-full h-full object-cover" 
                                controls
                                autoPlay={false}
                                muted={false}
                                playsInline
                              >
                                {item.processedUrl && (
                                  <>
                                    <source src={item.processedUrl} type="video/mp4" />
                                    <source src={item.processedUrl} type="video/quicktime" />
                                  </>
                                )}
                                Votre navigateur ne supporte pas la lecture de vidéos.
                              </video>
                            )
                          ) : (
                            <div className="w-full h-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar bg-slate-50">
                              {(item.media && item.media.length > 0 ? item.media : [item.processedUrl]).map((img: string, idx: number) => (
                                <img 
                                  key={idx} 
                                  src={img || undefined} 
                                  className="w-full h-full object-cover snap-center flex-shrink-0" 
                                  alt={`${item.title}-${idx}`} 
                                />
                              ))}
                              {item.media && item.media.length > 1 && (
                                <div className="absolute top-4 right-4 bg-gold px-2.5 py-1 rounded text-[8px] font-black text-black uppercase tracking-widest shadow-xl">
                                  {item.media.length} PHOTOS
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Comments & Metrics Panel */}
                    <div className="px-6 sm:px-8 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center text-[10px] sm:text-xs font-bold text-slate-500 w-full gap-2 sm:gap-0">
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="flex items-center gap-1.5"><Eye size={12} className="text-slate-400" /> {item.views || 0} vues</span>
                        <MediaLikes newsId={item.id} initialLikes={item.likes || 0} />
                        <NewsComments newsId={item.id} />
                      </div>
                      {item.processedUrl && (
                        <a href={item.processedUrl} target="_blank" rel="noreferrer" className="text-gold flex items-center gap-1 pb-0.5 border-b border-transparent hover:border-gold transition-all">
                          En savoir plus <ChevronRight size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Mini Gallery */}
      <section id="fleet-gallery" className="max-w-7xl mx-auto px-8 py-12">
        <div className="flex flex-col items-center space-y-12">
          <div className="space-y-4 max-w-2xl text-center">
            <h3 className="text-black text-[9px] font-extrabold tracking-[0.4em] uppercase opacity-40">Média & Expérience</h3>
            <h4 className="text-xl font-extrabold tracking-tighter text-black leading-[0.9] italic uppercase">
              NOTRE FLOTTE EN IMAGES.
            </h4>
            <p className="text-slate-500 text-sm">Découvrez l'élégance et la sécurité de nos navires Mugote 1, 2 et 3.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 w-full">
            {galleryImages.length > 0 ? (
              galleryImages.slice(0, 12).map((img, i) => (
                <div key={img.id} className="aspect-square rounded-xl overflow-hidden border border-slate-100 shadow-sm opacity-80 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => onNavigate('gallery')}>
                  <img src={img.processedUrl || undefined} className="w-full h-full object-cover" alt={img.title} />
                </div>
              ))
            ) : (
              [
                "https://images.unsplash.com/photo-1544551763-46a013bb70d5",
                "https://images.unsplash.com/photo-1559139225-8216b8e8303e",
                "https://images.unsplash.com/photo-1559308662135-7d472288924b",
                "https://images.unsplash.com/photo-1569336415962-a4bd9f67c07a"
              ].map((url, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden border border-slate-100 shadow-sm opacity-80 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => onNavigate('gallery')}>
                  <img src={`${url}?q=80&w=1000&auto=format&fit=crop`} className="w-full h-full object-cover" />
                </div>
              ))
            )}
          </div>
          <button onClick={() => onNavigate('gallery')} className="px-8 py-3 bg-black text-white text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all">Voir la galerie</button>
        </div>
      </section>

      {/* Classes Preview */}
      <section id="prices" className="max-w-7xl mx-auto px-8 bg-slate-50 py-10 -mx-8">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-4">
          <h3 className="text-black text-[9px] font-bold uppercase tracking-[0.4em] opacity-40">Séléctionnez votre confort</h3>
          <h4 className="text-2xl font-extrabold tracking-tighter text-black uppercase italic">Tarifications</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {[
            { 
              name: "1ère Classe", 
              price: `${PRICES['1ère Classe']}$`, 
              features: ["Service standard", "Sûr & Rapide"],
              img: "https://images.unsplash.com/photo-1599308662135-7d472288924b?q=80&w=2070&auto=format&fit=crop"
            },
            { 
              name: "2ème Classe", 
              price: `${PRICES['2ème Classe']}$`, 
              features: ["Sièges confortables", "Espace ventilé"],
              img: "https://images.unsplash.com/photo-1569336415962-a4bd9f67c07a?q=80&w=2070&auto=format&fit=crop"
            },
            { 
              name: "3ème Classe", 
              price: `${PRICES['3ème Classe']}$`, 
              features: ["Économique", "Sûr & Robuste"],
              img: "https://images.unsplash.com/photo-1559139225-8216b8e8303e?q=80&w=2070&auto=format&fit=crop"
            },
            { 
              name: "VIP", 
              price: `${PRICES['VIP']}$`, 
              features: ["Salon Climatisé", "Salon VIP", "Priorité"],
              img: "https://images.unsplash.com/photo-1520264184863-ad1b4ae2399a?q=80&w=2070&auto=format&fit=crop"
            },
          ].map((cls, i) => (
            <div key={i} className="bg-white p-2 rounded-[24px] border border-slate-100 shadow-lg shadow-slate-200/40 flex flex-col group h-full">
              <div className="h-40 rounded-[18px] overflow-hidden relative">
                <img src={cls.img} alt={cls.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black text-white rounded-full text-[8px] font-bold tracking-widest">
                  {cls.price} USD
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col items-center">
                <h5 className="text-base font-extrabold text-black mb-3 uppercase tracking-tighter italic">{cls.name}</h5>
                <ul className="space-y-2 mb-6 flex-1">
                  {cls.features.map((f, j) => (
                    <li key={j} className="flex items-center justify-center gap-2 text-slate-500 text-[8px] font-bold uppercase tracking-widest">
                      <div className="w-1 h-1 bg-black rounded-full" /> {f}
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={onBook}
                  className="w-full py-2.5 bg-black text-white rounded-lg text-[8px] font-extrabold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md shadow-black/10"
                >
                  Réserver
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
}

const SHIP_CLASS_CAPACITIES: Record<ShipName, Record<TravelClass, number>> = {
  'Mugote 1': { 'VIP': 10, '1ère Classe': 25, '2ème Classe': 60, '3ème Classe': 120 },
  'Mugote 2': { 'VIP': 15, '1ère Classe': 35, '2ème Classe': 80, '3ème Classe': 150 },
  'Mugote 3': { 'VIP': 20, '1ère Classe': 45, '2ème Classe': 100, '3ème Classe': 180 }
};

function Booking({ onReserved, user, onLoginRequest }: { onReserved: (res: Reservation) => void, user: FirebaseUser | null, onLoginRequest: () => void }) {
  const [formData, setFormData] = useState({
    fullName: '',
    lastName: '',
    phone: '',
    email: '',
    identityNum: '',
    momoOperator: 'Airtel Money',
    itinerary: 'Bukavu-Goma' as Itinerary,
    ship: 'Mugote 1' as ShipName,
    travelDate: '',
    departureTime: '07:30',
    travelClass: '2ème Classe' as TravelClass,
    passengersCount: 1,
    paymentMethod: 'Mobile Money',
    transactionId: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const [bookedCount, setBookedCount] = useState<Record<TravelClass, number>>({
    'VIP': 0,
    '1ère Classe': 0,
    '2ème Classe': 0,
    '3ème Classe': 0
  });

  useEffect(() => {
    if (!formData.travelDate || !formData.ship) return;
    const q = query(
      collection(db, 'reservations'),
      where('travelDate', '==', formData.travelDate),
      where('ship', '==', formData.ship)
    );
    const unsub = onSnapshot(q, (snap) => {
      const counts: Record<TravelClass, number> = {
        'VIP': 0,
        '1ère Classe': 0,
        '2ème Classe': 0,
        '3ème Classe': 0
      };
      snap.forEach(d => {
        const data = d.data();
        if (data.status !== 'REJECTED') {
          const tc = data.travelClass as TravelClass;
          if (counts[tc] !== undefined) {
            counts[tc] += (data.passengersCount || 1);
          }
        }
      });
      setBookedCount(counts);
    }, (error) => {
      console.warn("Could not load real-time quotas", error);
    });
    return () => unsub();
  }, [formData.travelDate, formData.ship]);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({ 
        ...prev, 
        fullName: user.displayName || '', 
        email: user.email || '',
        phone: user.phoneNumber || prev.phone
      }));
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);

    // Validations
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      setErrorLocal("Veuillez entrer un nom valide (au moins 2 lettres).");
      return;
    }
    if (!formData.lastName.trim() || formData.lastName.trim().length < 2) {
      setErrorLocal("Veuillez entrer un post-nom valide (au moins 2 lettres).");
      return;
    }
    if (formData.identityNum.trim() && formData.identityNum.trim().length < 4) {
      setErrorLocal("La pièce d'identité doit contenir au moins 4 caractères si elle est renseignée.");
      return;
    }

    const cleanTravelDate = formData.travelDate.trim();
    if (!cleanTravelDate) {
      setErrorLocal("Veuillez sélectionner une date de voyage.");
      return;
    }

    // Extraction components locally to verify correctly under any local/UTC shift
    const [year, month, day] = cleanTravelDate.split('-').map(Number);
    const selectedDateMidnight = new Date(year, month - 1, day);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    if (selectedDateMidnight < todayMidnight) {
      setErrorLocal("La date de voyage ne peut pas être passée. Veuillez choisir la date d'aujourd'hui ou une date future.");
      return;
    }

    if (formData.passengersCount < 1) {
      setErrorLocal("Le nombre de passagers doit être au moins de 1.");
      return;
    }

    // Quota capacity check
    const maxCapacity = SHIP_CLASS_CAPACITIES[formData.ship]?.[formData.travelClass] || 100;
    const currentBooked = bookedCount[formData.travelClass] || 0;
    const remaining = maxCapacity - currentBooked;
    if (formData.passengersCount > remaining) {
      setErrorLocal(`Désolé, il ne reste plus que ${remaining >= 0 ? remaining : 0} place(s) disponible(s) en ${formData.travelClass} pour ce voyage sur ${formData.ship} le ${formData.travelDate}. (Capacité max: ${maxCapacity} places)`);
      return;
    }

    // Validation du numéro congolais ou international (plus flexible)
    const cleanPhone = formData.phone.replace(/[\s\-\(\)\.]/g, '');
    const phoneRegex = /^(\+243|0)[89][0-9]{8}$/;
    const generalPhoneRegex = /^\+?[0-9]{9,15}$/;
    
    if (!cleanPhone) {
      setErrorLocal("Un numéro de téléphone Mobile Money est obligatoire.");
      return;
    }

    if (!phoneRegex.test(cleanPhone) && !generalPhoneRegex.test(cleanPhone)) {
      setErrorLocal("Le numéro de téléphone n'est pas valide. Exemple de format valide: 0991234567 ou +243991234567");
      return;
    }

    if (!user) {
      onLoginRequest();
      return;
    }
    setSubmitting(true);
    
    const amount = PRICES[formData.travelClass] * formData.passengersCount;
    
    // We auto-generate a temporary pending transactionId structure to satisfy the collection structure
    const tempTxnId = `TEMP-MUG-PAY-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const resData: Reservation = {
      ...formData,
      userId: user.uid,
      status: 'PENDING',
      amount,
      transactionId: tempTxnId,
      createdAt: Date.now(),
      ticketId: ''
    };

    try {
      const docRef = await addDoc(collection(db, 'reservations'), resData);
      
      // Assurer la création de l'utilisateur dans 'users' et 'users_list' pour qu'il soit immédiatement répertorié
      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: formData.email.trim() || 'Anonyme',
          displayName: `${formData.fullName.trim()} ${formData.lastName.trim()}`.trim() || 'Passager',
          phone: formData.phone.trim() || '',
          isAnonymous: false,
          lastLogin: serverTimestamp(),
          isLocalSyncOnly: (user as any).isLocalSyncOnly ?? false
        }, { merge: true });

        await setDoc(doc(db, 'users_list', user.uid), {
          uid: user.uid,
          email: formData.email.trim() || 'Anonyme',
          displayName: `${formData.fullName.trim()} ${formData.lastName.trim()}`.trim() || 'Passager',
          phone: formData.phone.trim() || '',
          isAnonymous: false,
          lastLogin: serverTimestamp(),
          isLocalSyncOnly: (user as any).isLocalSyncOnly ?? false,
          usageCount: increment(1)
        }, { merge: true });
        console.log("Passenger synchronized to users and users_list collections successfully on booking creation.");
      } catch (userErr) {
        console.warn("Non-blocking passenger sync to users_list failed:", userErr);
      }

      onReserved({ ...resData, id: docRef.id });
    } catch (error: any) {
      console.error("Firestore reservation error:", error);
      setErrorLocal(error.message || "Échec de l'enregistrement de votre réservation. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto py-12 px-4"
    >
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-12 items-start">
          {/* Form in Tabular Style */}
          <div className="flex-1 w-full space-y-2 lg:space-y-8">
            <div className="space-y-1 lg:space-y-2 border-l-4 border-gold pl-3 lg:pl-6 py-0.5 lg:py-2">
              <h2 className="text-xl lg:text-4xl font-black tracking-tighter text-black uppercase italic leading-none">Embarquement</h2>
              <div className="text-slate-500 font-bold tracking-[0.2em] text-[7px] lg:text-[9px] uppercase flex items-center gap-1.5 lg:gap-2">
                <div className="w-1 h-1 lg:w-1.5 lg:h-1.5 bg-maritime rounded-full animate-pulse" /> 
                Réservation de place
              </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-[16px] sm:rounded-[32px] border border-slate-200 shadow-xl lg:shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-black text-white p-2.5 lg:p-6">
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className="w-7 h-7 sm:w-10 sm:h-10 bg-gold/20 rounded-lg lg:rounded-xl flex items-center justify-center text-gold">
                    <Ship size={14} className="sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <p className="text-[6px] sm:text-[9px] font-black uppercase tracking-widest opacity-60 leading-none mb-0.5 lg:mb-1">Navigation</p>
                    <p className="text-[10px] sm:text-lg font-black uppercase tracking-tighter italic">Formulaire Mugote</p>
                  </div>
                </div>
              </div>

              {errorLocal && (
                <div className="mx-4 lg:mx-8 mt-4 lg:mt-8 p-4 lg:p-6 bg-rose-50 border border-rose-100 rounded-xl sm:rounded-2xl flex items-start gap-3 text-left">
                  <AlertCircle size={20} className="text-rose-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-rose-600 text-[10px] lg:text-xs font-black uppercase tracking-[0.15em]">Validation Rejetée</p>
                    <p className="text-rose-500 text-[10px] lg:text-xs font-bold uppercase leading-relaxed tracking-wide">{errorLocal}</p>
                  </div>
                </div>
              )}

              <div className="divide-y divide-slate-100">
                {/* Identification */}
                <div className="flex flex-col sm:flex-row group transition-colors hover:bg-slate-50/50">
                  <div className="p-2 lg:p-6 sm:border-r border-slate-100 bg-slate-50/30 sm:w-[150px] lg:w-[200px] shrink-0">
                    <div className="flex flex-col gap-0.5 lg:gap-1">
                      <label className="text-[8px] lg:text-[10px] font-black uppercase text-maritime tracking-widest flex items-center gap-1.5 lg:gap-2">
                        <User size={10} className="text-gold" /> Identité
                      </label>
                    </div>
                  </div>
                  <div className="p-2.5 lg:p-6 flex-1 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 lg:gap-4">
                      <input 
                        required
                        type="text" 
                        value={formData.fullName}
                        onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full px-3 py-1.5 lg:px-5 lg:py-3 bg-slate-50 border-2 border-maritime/30 rounded-lg lg:rounded-2xl focus:outline-none focus:ring-4 focus:ring-gold/10 focus:border-gold transition-all font-bold text-[11px] lg:text-sm text-black"
                        placeholder="NOM"
                      />
                      <input 
                        required
                        type="text" 
                        value={formData.lastName}
                        onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full px-3 py-1.5 lg:px-5 lg:py-3 bg-slate-50 border-2 border-maritime/30 rounded-lg lg:rounded-2xl focus:outline-none focus:ring-4 focus:ring-gold/10 focus:border-gold transition-all font-bold text-[11px] lg:text-sm text-black"
                        placeholder="POST-NOM"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] lg:text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 mb-1">
                        Pièce d'Identité (Facultatif - Carte d'Électeur / Passeport / Permis de conduire)
                      </label>
                      <input 
                        type="text" 
                        value={formData.identityNum}
                        onChange={e => setFormData({ ...formData, identityNum: e.target.value })}
                        className="w-full px-3 py-1.5 lg:px-5 lg:py-3 bg-slate-50 border-2 border-maritime/30 rounded-lg lg:rounded-2xl focus:outline-none focus:ring-4 focus:ring-gold/10 focus:border-gold transition-all font-bold text-[11px] lg:text-sm uppercase text-black"
                        placeholder="EX: N° CARTE D'ÉLECTEUR OU PASSEPORT"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact & Mobile Money */}
                <div className="flex flex-col sm:flex-row group transition-colors hover:bg-slate-50/50">
                  <div className="p-2 lg:p-6 sm:border-r border-slate-100 bg-slate-50/30 sm:w-[150px] lg:w-[200px] shrink-0">
                    <div className="flex flex-col gap-0.5 lg:gap-1">
                      <label className="text-[8px] lg:text-[10px] font-black uppercase text-maritime tracking-widest flex items-center gap-1.5 lg:gap-2">
                        <Smartphone size={10} className="text-gold" /> Mobile Money
                      </label>
                    </div>
                  </div>
                  <div className="p-2.5 lg:p-6 flex-1 space-y-4">
                    <div>
                      <label className="block text-[8px] lg:text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 mb-2">
                        Choisir l'Opérateur du Paiement Push
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { name: 'Airtel Money', style: 'border-rose-100 hover:border-rose-500 bg-rose-50 text-rose-700 font-extrabold', activeStyle: 'bg-rose-600 text-white border-rose-600 shadow-md' },
                          { name: 'Orange Money', style: 'border-orange-100 hover:border-orange-500 bg-orange-50 text-orange-700 font-extrabold', activeStyle: 'bg-orange-650 text-white border-orange-650 shadow-md' },
                          { name: 'M-Pesa', style: 'border-emerald-100 hover:border-emerald-500 bg-emerald-50 text-emerald-700 font-extrabold', activeStyle: 'bg-emerald-600 text-white border-emerald-600 shadow-md' }
                        ].map(op => {
                          const isSel = formData.momoOperator === op.name;
                          return (
                            <button
                              key={op.name}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, momoOperator: op.name, paymentMethod: op.name }))}
                              className={cn(
                                "py-2 px-1 rounded-xl border text-[9px] sm:text-xs font-black uppercase tracking-wider transition-all text-center flex items-center justify-center cursor-pointer",
                                isSel ? op.activeStyle : op.style
                              )}
                            >
                              {op.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[8px] lg:text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 mb-1">
                        Numéro Mobile Money (pour confirmer le STK Push sur votre mobile)
                      </label>
                      <input 
                        required
                        type="tel" 
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-1.5 lg:px-5 lg:py-3 bg-slate-50 border-2 border-maritime/30 rounded-lg lg:rounded-2xl focus:outline-none focus:ring-4 focus:ring-gold/10 focus:border-gold transition-all font-mono font-black text-[11px] lg:text-sm text-maritime"
                        placeholder="Ex: 0991234567 ou +243991234567"
                      />
                    </div>
                  </div>
                </div>

                {/* Destination */}
                <div className="flex flex-col sm:flex-row group transition-colors hover:bg-slate-50/50">
                  <div className="p-2 lg:p-6 sm:border-r border-slate-100 bg-slate-50/30 sm:w-[150px] lg:w-[200px] shrink-0">
                    <div className="flex flex-col gap-0.5 lg:gap-1">
                      <label className="text-[8px] lg:text-[10px] font-black uppercase text-maritime tracking-widest flex items-center gap-1.5 lg:gap-2">
                        <MapPin size={10} className="text-gold" /> Destination
                      </label>
                    </div>
                  </div>
                  <div className="p-2.5 lg:p-6 flex-1">
                    <select 
                      value={formData.itinerary}
                      onChange={e => setFormData({ ...formData, itinerary: e.target.value as Itinerary })}
                      className="w-full px-3 py-2 lg:px-6 lg:py-4 bg-maritime border-2 lg:border-4 border-gold/30 text-white rounded-lg lg:rounded-2xl focus:outline-none focus:ring-4 ring-gold/20 transition-all font-black uppercase tracking-widest text-[7px] lg:text-[11px] appearance-none cursor-pointer"
                    >
                      <option value="Bukavu-Goma">Bukavu (Sud) → Goma (Nord)</option>
                      <option value="Goma-Bukavu">Goma (Nord) → Bukavu (Sud)</option>
                    </select>
                  </div>
                </div>

                {/* Schedule */}
                <div className="flex flex-col sm:flex-row group transition-colors hover:bg-slate-50/50">
                  <div className="p-2 lg:p-6 sm:border-r border-slate-100 bg-slate-50/30 sm:w-[150px] lg:w-[200px] shrink-0">
                    <div className="flex flex-col gap-0.5 lg:gap-1">
                      <label className="text-[8px] lg:text-[10px] font-black uppercase text-maritime tracking-widest flex items-center gap-1.5 lg:gap-2">
                        <Calendar size={10} className="text-gold" /> Calendrier
                      </label>
                    </div>
                  </div>
                  <div className="p-2.5 lg:p-6 flex-1 space-y-2 lg:space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 lg:gap-4">
                      <input 
                        required
                        type="date" 
                        value={formData.travelDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setFormData({ ...formData, travelDate: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-gold/10 focus:border-gold transition-all font-mono font-black text-[10px] lg:text-sm"
                      />
                      <select 
                        value={formData.departureTime}
                        onChange={e => setFormData({ ...formData, departureTime: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-gold/10 focus:border-gold transition-all font-mono font-black text-[10px] lg:text-sm cursor-pointer"
                      >
                        <option value="07:30">MATIN (07:30)</option>
                        <option value="18:00">SOIR (18:00)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Ship Selection */}
                <div className="flex flex-col sm:flex-row group transition-colors hover:bg-slate-50/50">
                  <div className="p-2 lg:p-6 sm:border-r border-slate-100 bg-slate-50/30 sm:w-[150px] lg:w-[200px] shrink-0">
                    <div className="flex flex-col gap-0.5 lg:gap-1">
                      <label className="text-[8px] lg:text-[10px] font-black uppercase text-maritime tracking-widest flex items-center gap-1.5 lg:gap-2">
                        <Anchor size={10} className="text-gold" /> Navire
                      </label>
                    </div>
                  </div>
                  <div className="p-2.5 lg:p-6 flex-1">
                    <div className="grid grid-cols-3 gap-1.5 lg:gap-3">
                      {(['Mugote 1', 'Mugote 2', 'Mugote 3'] as ShipName[]).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData({ ...formData, ship: s })}
                          className={cn(
                            "p-1.5 lg:p-3 rounded-lg lg:rounded-xl border-2 transition-all font-black uppercase tracking-widest text-[7px] lg:text-[9px] relative",
                            formData.ship === s 
                              ? "border-black bg-black text-white shadow-lg" 
                              : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Travel Class */}
                <div className="flex flex-col sm:flex-row group transition-colors hover:bg-slate-50/50">
                  <div className="p-2 lg:p-6 sm:border-r border-slate-100 bg-slate-50/30 sm:w-[150px] lg:w-[200px] shrink-0">
                    <div className="flex flex-col gap-0.5 lg:gap-1">
                      <label className="text-[8px] lg:text-[10px] font-black uppercase text-maritime tracking-widest flex items-center gap-1.5 lg:gap-2">
                        <CheckCircle size={10} className="text-gold" /> Confort
                      </label>
                    </div>
                  </div>
                  <div className="p-2.5 lg:p-6 flex-1">
                    <div className="grid grid-cols-2 lg:grid-cols-2 gap-1 lg:gap-3">
                      {(['1ère Classe', '2ème Classe', '3ème Classe', 'VIP'] as TravelClass[]).map(c => {
                        const clsColor = CLASS_COLORS[c];
                        const isActive = formData.travelClass === c;
                        
                        const maxCap = SHIP_CLASS_CAPACITIES[formData.ship]?.[c] || 100;
                        const currentBookedCount = bookedCount[c] || 0;
                        const remSeats = maxCap - currentBookedCount;

                        const labelName = c === '3ème Classe' ? 'Économique' : c === '2ème Classe' ? 'Standard (2e)' : c === '1ère Classe' ? '1ère Classe' : 'VIP';
                        
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setFormData({ ...formData, travelClass: c })}
                            className={cn(
                              "p-1.5 lg:p-4 rounded-lg lg:rounded-3xl border-2 transition-all text-center flex flex-col items-center justify-center group relative overflow-hidden active:scale-95",
                              isActive 
                                ? "border-transparent text-white shadow-md lg:shadow-lg" 
                                : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                            )}
                            style={{ 
                              backgroundColor: isActive ? clsColor.main : undefined,
                            }}
                          >
                            <p className={cn("text-[6px] lg:text-[8px] font-black uppercase tracking-tighter leading-none mb-0.5 lg:mb-1", isActive ? "text-white" : "text-slate-400")}>{c} ({labelName})</p>
                            <p className={cn("text-[10px] lg:text-sm font-black font-mono leading-none", isActive ? "text-white" : "text-black")}>{PRICES[c]}$</p>
                            
                            {formData.travelDate ? (
                              <p className={cn("text-[6px] lg:text-[7px] font-black uppercase mt-1 px-1.5 py-0.5 rounded-full tracking-widest", isActive ? "text-white bg-white/20" : remSeats <= 5 ? "text-rose-600 bg-rose-50 border border-rose-100" : "text-slate-500 bg-slate-200/50")}>
                                {remSeats <= 0 ? "⚠️ Complet" : `${remSeats} places dispo`}
                              </p>
                            ) : (
                              <p className={cn("text-[6px] lg:text-[7px] font-bold uppercase mt-1 px-1.5 py-0.5 rounded-full tracking-widest", isActive ? "text-white bg-white/20" : "text-slate-400 bg-slate-100")}>
                                Capacité : {maxCap}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Passengers */}
                <div className="flex flex-col sm:flex-row group transition-colors hover:bg-slate-50/50">
                  <div className="p-2 lg:p-6 sm:border-r border-slate-100 bg-slate-50/30 sm:w-[150px] lg:w-[200px] shrink-0">
                    <div className="flex flex-col gap-0.5 lg:gap-1">
                      <label className="text-[8px] lg:text-[10px] font-black uppercase text-maritime tracking-widest flex items-center gap-1.5 lg:gap-2">
                        <Users size={10} className="text-gold" /> Billets
                      </label>
                    </div>
                  </div>
                  <div className="p-2.5 lg:p-6 flex-2 flex flex-col sm:flex-row items-center gap-2 lg:gap-6">
                    <div className="bg-slate-100 rounded-lg lg:rounded-xl p-0.5 lg:p-1 flex items-center gap-0.5 lg:gap-1 shadow-inner w-full sm:w-auto justify-between">
                      <button type="button" onClick={() => setFormData(p => ({...p, passengersCount: Math.max(1, p.passengersCount - 1)}))} className="w-7 h-7 lg:w-12 lg:h-12 flex items-center justify-center bg-white rounded-md shadow-sm active:scale-95 transition-all font-black text-sm lg:text-lg text-maritime">-</button>
                      <span className="w-8 lg:w-14 text-center text-sm lg:text-xl font-black font-mono text-maritime">{formData.passengersCount}</span>
                      <button type="button" onClick={() => setFormData(p => ({...p, passengersCount: Math.min(10, p.passengersCount + 1)}))} className="w-7 h-7 lg:w-12 lg:h-12 flex items-center justify-center bg-maritime text-white rounded-md shadow-lg active:scale-95 transition-all font-black text-sm lg:text-lg">+</button>
                    </div>
                  </div>
                </div>
              </div>

               {/* Submission Row */}
              <div className="bg-slate-50/80 p-4 lg:p-10 text-center">
                <div className="max-w-md mx-auto space-y-4 lg:space-y-6">
                   <div className="space-y-3 lg:space-y-4">
                      <div className="flex justify-between items-center bg-white p-3 lg:p-6 rounded-xl lg:rounded-3xl border-2 border-dashed border-maritime/20 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gold" />
                              <div className="text-left">
                                <p className="text-[8px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Résumé</p>
                                <p className="text-[10px] lg:text-sm font-black text-maritime font-mono">{formData.passengersCount}x {PRICES[formData.travelClass]}$</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[8px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">TOTAL</p>
                                <p className="text-xl lg:text-3xl font-black text-maritime font-mono tracking-tighter">{PRICES[formData.travelClass] * formData.passengersCount}$</p>
                              </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-left">
                              <Smartphone size={16} className="text-indigo-600 flex-shrink-0 mt-0.5 animate-pulse" />
                              <p className="text-[8px] lg:text-[10px] font-bold leading-relaxed text-indigo-900 uppercase tracking-[0.05em]">
                                Système de paiement automatisé. En cliquant ci-dessous, la requête de paiement Mobile Money USSD / STK Push sera instantanément lancée sur votre téléphone.
                              </p>
                            </div>
                         </div>

                         <button 
                            disabled={submitting}
                            type="submit"
                            className="w-full py-4 lg:py-5 bg-maritime hover:bg-[#002255] text-white text-[10px] lg:text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 rounded-xl lg:rounded-2xl relative overflow-hidden group border-2 border-gold/10 hover:border-gold/30"
                          >
                            <span className="relative z-10">{submitting ? "Initiation du paiement..." : "Réserver et payer le billet"}</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-gold via-transparent to-gold opacity-0 group-hover:opacity-20 transition-opacity" />
                          </button>
                      </div>
                </div>
            </form>
          </div>


          {/* Right side: Digital Boarding Pass Preview (GLASS VERSION) */}
          <div className="w-full lg:w-[400px]">
            <div className={cn(
               "relative p-5 lg:p-8 shadow-2xl rounded-[30px] lg:rounded-[40px] overflow-hidden border transition-all duration-700",
               formData.travelClass === '1ère Classe' || formData.travelClass === 'VIP' ? "bg-slate-900 text-white border-gold/30" :
               formData.travelClass === '2ème Classe' ? "bg-maritime text-white border-white/10" :
               "bg-emerald-900 text-white border-emerald-500/30"
            )}>
              {/* Glass Effect Overlays */}
              <div className="absolute inset-0 backdrop-blur-md bg-white/5 z-0" />
              <div className="absolute top-0 right-0 w-32 h-32 lg:w-64 lg:h-64 bg-white/10 rounded-full blur-3xl -mr-16 lg:-mr-32 -mt-16 lg:-mt-32 animate-pulse" />
              <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-white/20 via-transparent to-transparent rotate-12 pointer-events-none" />
              
              <div className="relative z-10 space-y-6 lg:space-y-10">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className={cn(
                      "text-[8px] lg:text-[10px] font-black uppercase tracking-[0.3em]",
                      formData.travelClass === '2ème Classe' ? "text-white/60" : "text-gold"
                    )}>Digital Ticket</p>
                    <h3 className="text-xl lg:text-2xl font-black uppercase tracking-tighter italic leading-none">AMR MUGOTE</h3>
                  </div>
                  <div className="w-10 h-10 lg:w-14 lg:h-14 bg-white/10 rounded-xl lg:rounded-2xl flex items-center justify-center border border-white/20 backdrop-blur-xl">
                    <Anchor className={formData.travelClass === '3ème Classe' ? "text-emerald-400" : "text-gold"} size={18} />
                  </div>
                </div>

                <div className="space-y-6 lg:space-y-10">
                  <div className="flex items-center gap-4 lg:gap-6">
                    <div className="flex-1">
                      <p className="text-[7px] lg:text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">De / From</p>
                      <p className="text-base lg:text-xl font-black uppercase tracking-tighter truncate">{formData.itinerary.split('-')[0]}</p>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-6 lg:w-10 h-[2px] bg-white/20" />
                      <Ship size={12} className="text-gold" />
                      <div className="w-6 lg:w-10 h-[2px] bg-white/20" />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-[7px] lg:text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">À / To</p>
                      <p className="text-base lg:text-xl font-black uppercase tracking-tighter truncate">{formData.itinerary.split('-')[1]}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 lg:gap-8 border-y border-white/10 py-5 lg:py-8">
                    <div className="space-y-1">
                      <p className="text-[7px] lg:text-[9px] font-black text-white/40 uppercase tracking-widest">Date</p>
                      <p className="text-xs lg:text-sm font-black font-mono text-gold">{formData.travelDate || '... / ...'}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[7px] lg:text-[9px] font-black text-white/40 uppercase tracking-widest">Heure</p>
                      <p className="text-xs lg:text-sm font-black font-mono">{formData.departureTime || '...:...'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[7px] lg:text-[9px] font-black text-white/40 uppercase tracking-widest">Bateau</p>
                      <p className="text-xs lg:text-sm font-black italic">{formData.ship}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[7px] lg:text-[9px] font-black text-white/40 uppercase tracking-widest">Classe</p>
                      <p className={cn(
                        "text-xs lg:text-sm font-black uppercase",
                        formData.travelClass === '1ère Classe' || formData.travelClass === 'VIP' ? "text-gold" :
                        formData.travelClass === '3ème Classe' ? "text-emerald-400" : "text-white"
                      )}>{formData.travelClass.split(' ')[0]}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <div className="space-y-1">
                        <p className="text-[7px] lg:text-[9px] font-black text-white/40 uppercase tracking-widest">Client</p>
                        <p className="text-[10px] lg:text-xs font-black uppercase truncate max-w-[100px] lg:max-w-[150px]">{formData.fullName || 'Passager'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[7px] lg:text-[9px] font-black text-gold uppercase tracking-widest mb-0.5">Total</p>
                      <p className="text-2xl lg:text-4xl font-black font-mono tracking-tighter">
                        {PRICES[formData.travelClass] * formData.passengersCount}<span className="text-[10px] opacity-50">$</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 lg:pt-10 border-t border-dashed border-white/20 flex flex-col items-center gap-3 lg:gap-4 text-center">
                  <div className="space-y-1 lg:space-y-2 mb-1">
                    <p className="text-[7px] lg:text-[8px] font-black text-gold/60 uppercase tracking-[0.2em]">Note Importante</p>
                    <p className="text-[7px] lg:text-[8px] font-bold text-white/40 leading-relaxed uppercase">
                      Remboursement 24h avant départ (-25%)
                    </p>
                  </div>
                  <div className="space-y-0.5 lg:space-y-1">
                    <p className="text-[6px] lg:text-[7px] font-black text-white/30 uppercase tracking-widest">Support</p>
                    <p className="text-[8px] lg:text-[9px] font-black text-gold/80">{CONTACT_NUMBERS[0]}</p>
                  </div>
                  <div className="w-full h-8 lg:h-12 bg-white/5 rounded-lg lg:rounded-xl border border-white/5 overflow-hidden flex">
                    {[...Array(30)].map((_, i) => (
                      <div key={i} className={cn("flex-1 h-full", i % 2 === 0 ? "bg-white/10" : "bg-transparent")} />
                    ))}
                  </div>
                  <p className="text-[6px] lg:text-[8px] font-black uppercase tracking-[0.3em] text-white/20">#MUG-{Math.random().toString(36).substring(2, 6).toUpperCase()}</p>
                </div>
              </div>

              {/* Decorative circles to mimic ticket notches */}
              <div className="absolute left-0 top-[65%] -translate-x-1/2 w-6 lg:w-8 h-6 lg:h-8 bg-[#f8fafc] rounded-full" />
              <div className="absolute right-0 top-[65%] translate-x-1/2 w-6 lg:w-8 h-6 lg:h-8 bg-[#f8fafc] rounded-full" />
            </div>
          </div>

        </div>
    </motion.div>
  );
}

function Payment({ reservation, onComplete, siteSettings }: { reservation: Reservation | null, onComplete: () => void, siteSettings: any }) {
  const [step, setStep] = useState<'processing' | 'stk-input' | 'stk-validating' | 'success'>('processing');
  const [pin, setPin] = useState('');
  const [momoTransactionId, setMomoTransactionId] = useState('');
  const [generatedTicketId, setGeneratedTicketId] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [secRemaining, setSecRemaining] = useState(3);

  if (!reservation) return null;

  // Sync / default operator styling
  const operatorName = reservation.momoOperator || 'M-Pesa';
  const operatorColors: Record<string, { bg: string, text: string, accent: string }> = {
    'M-Pesa': { bg: 'bg-[#E11B22]', text: 'text-white', accent: 'bg-[#C11016]' },
    'Airtel Money': { bg: 'bg-[#FF0000]', text: 'text-white', accent: 'bg-[#CC0000]' },
    'Orange Money': { bg: 'bg-[#F28500]', text: 'text-black', accent: 'bg-[#E07400]' }
  };
  const currentOpStyle = operatorColors[operatorName] || { bg: 'bg-slate-800', text: 'text-white', accent: 'bg-slate-900' };

  // Timer loop for processing state at the beginning
  useEffect(() => {
    if (step === 'processing') {
      const interval = setInterval(() => {
        setSecRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setStep('stk-input');
            return 3;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step]);

  const handleKeyClick = (num: string) => {
    setErrorLocal(null);
    if (pin.length < 6) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleStkSubmit = async () => {
    if (pin.length < 4) {
      setErrorLocal("Veuillez saisir votre code secret Momo (4 chiffres minimum).");
      return;
    }

    setStep('stk-validating');
    setErrorLocal(null);

    try {
      // 1. Generate unique local operator reference ID
      const localRef = `MOM-${operatorName.substring(0,3).toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      setMomoTransactionId(localRef);

      // 2. Generate unique Ticket ID with strict loop checking in Firestore
      let uniqueTicketId = '';
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 15) {
        const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
        uniqueTicketId = `AMR-${randomHex}`;
        const q = query(collection(db, 'reservations'), where('ticketId', '==', uniqueTicketId));
        const qSnap = await getDocs(q);
        if (qSnap.empty) {
          isUnique = true;
        }
        attempts++;
      }

      if (!uniqueTicketId) {
        uniqueTicketId = `AMR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      }

      setGeneratedTicketId(uniqueTicketId);

      // 3. Update reservation document status directly to VALIDATED
      const docRef = doc(db, 'reservations', reservation.id!);
      await updateDoc(docRef, {
        status: 'VALIDATED',
        ticketId: uniqueTicketId,
        transactionId: localRef,
        validatedAt: Date.now(),
        momoOperator: operatorName
      });

      // 4. Trigger automatic background ticket download for optimal UX!
      const updatedRes: Reservation = {
        ...reservation,
        status: 'VALIDATED',
        ticketId: uniqueTicketId,
        transactionId: localRef,
        momoOperator: operatorName
      };
      
      try {
        await generateTicket(updatedRes, siteSettings || { homeBg: '' });
      } catch (err) {
        console.warn("Could not auto-trigger ticket PDF generation:", err);
      }

      setStep('success');
    } catch (err: any) {
      console.error("Simulation database update error:", err);
      setErrorLocal(err.message || "Erreur lors de la validation du paiement.");
      setStep('stk-input');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto px-4 py-6"
    >
      <AnimatePresence mode="wait">
        
        {/* Step 1: Processing */}
        {step === 'processing' && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-slate-900 border border-slate-800 rounded-[35px] sm:rounded-[50px] p-8 sm:p-16 text-center text-white space-y-8 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-80 h-80 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-maritime/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-8 max-w-lg mx-auto">
              <div className="w-24 h-24 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center mx-auto shadow-xl">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full border-4 border-gold/30" />
                  <div className="w-12 h-12 rounded-full border-4 border-gold border-t-transparent animate-spin" />
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-gold text-[10px] font-black tracking-[0.4em] uppercase">PASSERELLE DE PAIEMENT</span>
                <h3 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter italic leading-none">INITIATION DU PAIEMENT</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                  Appel de l'API de l'opérateur <span className="text-gold font-black">{operatorName}</span> pour le numéro <span className="text-white font-black">{reservation.phone}</span>...
                </p>
              </div>

              <div className="space-y-2 bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-6 text-left">
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                  <span>Opérateur</span>
                  <span className="text-white">{operatorName}</span>
                </div>
                <div className="h-px bg-white/5 my-2" />
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                  <span>Numéro</span>
                  <span className="text-white font-mono">{reservation.phone}</span>
                </div>
                <div className="h-px bg-white/5 my-2" />
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                  <span>Montant</span>
                  <span className="text-gold font-mono">{reservation.amount}.00$</span>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <div className="w-2 h-2 bg-gold rounded-full animate-ping" />
                <p className="text-[9px] font-black tracking-[0.3em] uppercase text-white/50">
                  Affichage du push sur votre écran dans {secRemaining}s...
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Smartphone STK Push Input Screen */}
        {step === 'stk-input' && (
          <motion.div 
            key="stk-input"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
          >
            {/* Left Column: Explanatory Context Card */}
            <div className="lg:col-span-5 space-y-6 text-left">
              <div className="space-y-2">
                <span className="text-slate-400 text-[10px] font-black tracking-[0.3em] uppercase block">SIMULATEUR SÉCURISÉ</span>
                <h2 className="text-2xl sm:text-4xl font-black text-maritime uppercase tracking-tighter leading-none italic">
                  CONTRÔLE DE SÉCURITÉ OPÉRATEUR
                </h2>
                <div className="h-1.5 w-16 bg-gold rounded-full" />
              </div>

              <p className="text-xs font-medium text-slate-600 leading-relaxed uppercase">
                Pour des questions de sécurité et de simplification, vous devez valider la requête de paiement STK / PUSH reçue sur la carte SIM de votre téléphone. 
              </p>

              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-3">
                <h4 className="text-[10px] font-black text-[#001233] uppercase tracking-wider flex items-center gap-2">
                  <Smartphone size={14} className="text-[#001233]" /> COMMENT PROCÉDER ?
                </h4>
                <ul className="space-y-1.5 text-[9px] font-bold text-indigo-900 list-disc list-inside leading-relaxed uppercase">
                  <li>Regardez le simulateur de smartphone à droite.</li>
                  <li>Une boîte de dialogue de paiement PIN s'est ouverte.</li>
                  <li>Saisissez votre code PIN secret sur le clavier virtuel.</li>
                  <li>Cliquez sur "CONFIRMER LES FONDS".</li>
                </ul>
              </div>

              {errorLocal && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase tracking-wide">
                  {errorLocal}
                </div>
              )}
            </div>

            {/* Right Column: Visual Interactive Physical Smartphone Mockup */}
            <div className="lg:col-span-7 flex justify-center">
              <div className="w-[330px] h-[670px] bg-slate-900 rounded-[50px] p-3 shadow-2xl border-4 border-slate-700 relative flex flex-col overflow-hidden">
                
                {/* Camera punch-hole notch */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-30 flex items-center justify-center">
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-slate-800" />
                </div>

                {/* Speaker mesh & buttons decoratives */}
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-700 rounded-full" />
                <div className="absolute -left-1 top-24 w-1 h-12 bg-slate-800 rounded-r-md" />
                <div className="absolute -left-1 top-40 w-1 h-12 bg-slate-800 rounded-r-md" />
                <div className="absolute -right-1 top-32 w-1 h-16 bg-slate-800 rounded-l-md" />

                {/* Phone screen canvas */}
                <div className="flex-1 bg-slate-950 rounded-[42px] overflow-hidden border border-slate-800 relative p-4 flex flex-col justify-between pt-10">
                  
                  {/* Smartphone top status bar bar */}
                  <div className="flex justify-between items-center text-[9px] font-black text-slate-300 font-mono px-3 absolute top-3 left-0 w-full z-25">
                    <span>12:24</span>
                    <div className="flex items-center gap-1.5">
                      <span>4G LTE</span>
                      <div className="w-5 h-2.5 bg-slate-400 rounded-sm relative p-0.5">
                        <div className="w-full h-full bg-slate-300 rounded-xs" />
                      </div>
                    </div>
                  </div>

                  {/* Operator branding background header */}
                  <div className={cn("p-4 rounded-3xl mt-4 text-center space-y-1 py-6", currentOpStyle.bg, currentOpStyle.text)}>
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-80">SÉCURISÉ PAR</p>
                    <h4 className="text-lg font-black tracking-tighter italic uppercase">{operatorName} Payment Gateway</h4>
                  </div>

                  {/* STK Push simulated USSD dialog */}
                  <div className="my-auto bg-slate-800/95 border border-slate-700 rounded-3xl p-5 shadow-2xl text-left space-y-4">
                    <div className="flex justify-between items-center text-[8px] font-black text-gold uppercase tracking-wider">
                      <span>Message Réseau SIM</span>
                      <span className="font-mono text-white/50">{reservation.momoOperator} STK v2.1</span>
                    </div>

                    <div className="h-px bg-slate-700" />

                    <p className="text-[10px] font-bold text-white uppercase leading-normal tracking-wide">
                      Souhaitez-vous payer le montant de <span className="text-gold font-black font-mono">{reservation.amount}.00 USD</span> pour votre billet electronique chez AMR MUGOTE ?
                    </p>

                    <div className="space-y-2 text-center pt-2">
                      <p className="text-[8px] text-slate-400 font-black uppercase">Entrez votre code secret</p>
                      
                      {/* Password dots panel */}
                      <div className="flex justify-center gap-3">
                        {[0, 1, 2, 3, 4, 5].map((idx) => (
                          <div key={idx} className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-lg text-gold font-mono">
                            {pin.length > idx ? "•" : ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Realistic Touch Button Keypad panel */}
                  <div className="space-y-2 pb-2">
                    <div className="grid grid-cols-3 gap-2 justify-center max-w-[240px] mx-auto">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleKeyClick(key)}
                          className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center font-black text-white text-base font-mono border border-slate-700 shadow-md"
                        >
                          {key}
                        </button>
                      ))}
                      
                      {/* Left: Back / Clear button */}
                      <button
                        type="button"
                        onClick={handleBackspace}
                        className="w-12 h-12 rounded-full bg-slate-900 hover:bg-rose-950/20 active:scale-95 transition-all text-xs font-black text-rose-500 uppercase font-sans border border-rose-950/40"
                      >
                        EFFACER
                      </button>

                      <button
                        type="button"
                        onClick={() => handleKeyClick('0')}
                        className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center font-black text-white text-base font-mono border border-slate-700"
                      >
                        0
                      </button>

                      {/* Right: Validation confirmation button */}
                      <button
                        type="button"
                        onClick={handleStkSubmit}
                        className="w-12 h-12 rounded-full bg-emerald-700 hover:bg-emerald-600 active:scale-95 transition-all text-[8px] font-black text-white uppercase leading-none font-sans shadow-lg shadow-emerald-950/40"
                      >
                        VALIDER
                      </button>
                    </div>

                    <div className="text-center pt-2">
                      <p className="text-[6px] font-black text-slate-500 uppercase tracking-[0.3em]">Simulation Physique AMR-TECH</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: STK validating spinner progress */}
        {step === 'stk-validating' && (
          <motion.div 
            key="stk-validating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-[50px] p-16 text-center text-white space-y-8 shadow-2xl"
          >
            <div className="max-w-md mx-auto space-y-6">
              <div className="w-20 h-20 bg-slate-800 border border-slate-700 rounded-3xl flex items-center justify-center mx-auto shadow-xl">
                <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="space-y-3">
                <span className="text-gold text-[10px] font-black tracking-[0.4em] uppercase">VÉRIFICATION</span>
                <h3 className="text-2xl font-black uppercase tracking-tighter italic">TRAITEMENT EN COURS</h3>
                <p className="text-xs text-slate-400 font-bold leading-relaxed uppercase">
                  Contact de l'opérateur mobile pour le débit instantané des fonds. Votre billet est en cours d'écriture dans la base de données...
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 4: SUCCESS Boarding Pass & Automatic Ticket PDF */}
        {step === 'success' && (
          <motion.div 
            key="success"
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left"
          >
            {/* Left column: Ticket validation board */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white rounded-[35px] border border-slate-200 shadow-xl p-8 sm:p-10 text-center space-y-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-gold to-maritime" />
                
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle size={44} className="animate-bounce" />
                </div>

                <div className="space-y-2">
                  <span className="text-emerald-600 text-[10px] font-black tracking-[0.4em] uppercase block">PAIEMENT REÇU & CONFIRMÉ</span>
                  <h2 className="text-2xl sm:text-3xl font-black text-maritime uppercase tracking-tighter italic leading-none">
                    TRANSACTION VALIDÉE AVEC SUCCÈS
                  </h2>
                </div>

                <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl text-[10px] sm:text-xs font-medium text-emerald-900 leading-relaxed uppercase max-w-md mx-auto">
                  Votre codesecret a été accepté et les fonds ont été confirmés. Votre billet valide avec QR code a été enregistré directement sur cet appareil !
                </div>

                <div className="space-y-4 pt-4">
                  {/* Action 1: Real PDF download button */}
                  <button
                    onClick={async () => {
                      const finalRes: Reservation = {
                        ...reservation,
                        status: 'VALIDATED',
                        ticketId: generatedTicketId,
                        transactionId: momoTransactionId,
                        momoOperator: operatorName
                      };
                      await generateTicket(finalRes, siteSettings);
                    }}
                    className="w-full py-5 bg-gold hover:bg-[#e0b400] text-maritime hover:scale-[1.01] active:scale-95 font-black uppercase tracking-[0.25em] rounded-2xl shadow-lg transition-all text-xs flex items-center justify-center gap-3"
                  >
                    <Download size={16} />
                    Télécharger le Billet (PDF)
                  </button>

                  {/* Action 2: Navigate dashboard */}
                  <button
                    onClick={onComplete}
                    className="w-full py-4 bg-[#001233] hover:bg-slate-900 text-white font-black uppercase tracking-[0.2em] rounded-2xl transition-all text-[11px] flex items-center justify-center gap-2"
                  >
                    <Ticket size={14} />
                    Accéder à mon espace Billets
                  </button>
                </div>
              </div>
            </div>

            {/* Right column: High-fidelity interactive Boarding Pass Printable component view */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-[340px] bg-[#001233] rounded-[30px] shadow-2xl relative overflow-hidden text-white border border-white/10 flex flex-col justify-between">
                
                {/* Visual Glass highlights */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />

                {/* Top sector */}
                <div className="p-6 space-y-6 relative z-10">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[7px] font-black text-gold uppercase tracking-widest leading-none">Billet Électronique</p>
                      <h4 className="text-sm font-black uppercase tracking-tighter italic">AMR MUGOTE</h4>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
                      <Anchor size={14} className="text-gold" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Itinerary lines direction */}
                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                      <div>
                        <p className="text-[7px] font-black text-white/50 uppercase">DE / FROM</p>
                        <p className="text-xl font-black uppercase tracking-tighter">{reservation.itinerary.split('-')[0]}</p>
                      </div>
                      <div className="text-center font-bold text-gold text-xs px-2 animate-pulse">⚓</div>
                      <div className="text-right">
                        <p className="text-[7px] font-black text-white/50 uppercase">À / TO</p>
                        <p className="text-xl font-black uppercase tracking-tighter">{reservation.itinerary.split('-')[1] || 'Goma'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div>
                        <p className="text-[7px] font-black text-white/40 uppercase">PASSAGER / CLIENT</p>
                        <p className="text-xs font-black uppercase truncate">{reservation.fullName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[7px] font-black text-white/40 uppercase">CLASSE / CLASS</p>
                        <p className="text-xs font-black text-gold uppercase leading-normal">{reservation.travelClass}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-left border-t border-white/5 pt-3">
                      <div>
                        <p className="text-[7px] font-black text-white/40 uppercase">SIÈGES / ADULT(S)</p>
                        <p className="text-xs font-black font-mono">{reservation.passengersCount}x Billet(s)</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[7px] font-black text-white/40 uppercase">STATUT BILLET</p>
                        <span className="inline-block px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-black text-emerald-400 uppercase rounded">VALIDÉ</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Separation cutouts mimicking real tickets */}
                <div className="flex items-center justify-between px-0 relative my-2">
                  <div className="w-5 h-10 bg-[#f8fafc] rounded-r-full -ml-[1px] border border-l-0 border-slate-200" />
                  <div className="flex-1 border-t border-dashed border-white/10 mx-2" />
                  <div className="w-5 h-10 bg-[#f8fafc] rounded-l-full -mr-[1px] border border-r-0 border-slate-200" />
                </div>

                {/* Bottom barcode sector */}
                <div className="p-6 bg-slate-950/40 flex flex-col items-center gap-4 text-center rounded-b-[30px]">
                  
                  {/* Dynamic generated QR code */}
                  <div className="p-3 bg-white rounded-2xl shadow-xl inline-block border-2 border-gold/40">
                    <QRCodeSVG 
                      value={JSON.stringify({
                        id: reservation.id,
                        ticketId: generatedTicketId,
                        client: reservation.fullName,
                        voyage: reservation.itinerary,
                        class: reservation.travelClass,
                        amount: reservation.amount,
                        date: formatDate(Date.now())
                      })} 
                      size={120} 
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-500 uppercase font-mono">CODE ID UNIQUE BILLET</p>
                    <p className="text-sm font-black font-mono tracking-wider text-gold">{generatedTicketId}</p>
                    <p className="text-[7px] font-black text-white/30 uppercase font-mono">REF: {momoTransactionId}</p>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
}

function Dashboard({ siteSettings, onNavigate, schedules, isAdmin, isAdminUnlocked, setIsAdminUnlocked, setUser }: { siteSettings?: { homeBg: string, homeDetail: string }, onNavigate: (page: string) => void, schedules: any[], isAdmin: boolean, isAdminUnlocked: boolean, setIsAdminUnlocked: (val: boolean) => void, setUser?: (u: any) => void }) {
  const [tab, setTab] = useState<'reservations' | 'users' | 'fleet' | 'media' | 'settings' | 'messages' | 'schedules' | 'scanner'>('reservations');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [fleetList, setFleetList] = useState<any[]>([]);
  const [scheduleForm, setScheduleForm] = useState({ id: '', from: '', to: '', time: '', ship: '', days: '' });
  const [boatForm, setBoatForm] = useState({ id: '', name: '', capacity: 0, description: '', imageUrl: '' });
  const [editMediaId, setEditMediaId] = useState<string | null>(null);
  const [adminCode, setAdminCode] = useState('');
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [newAdminCode, setNewAdminCode] = useState((siteSettings as any)?.adminCode || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [newsList, setNewsList] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [cleaningGarbage, setCleaningGarbage] = useState(false);
  const [selectedConv, setSelectedConv] = useState<any | null>(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, validated: 0, validatedRevenue: 0, validatedPassengers: 0 });
  const [newMedia, setNewMedia] = useState({ 
    title: '', 
    desc: '', 
    url: '', 
    type: 'image' as 'image' | 'video' | 'text', 
    media: [] as string[],
    pendingFiles: [] as File[]
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  
  const bgInputRef = useRef<HTMLInputElement>(null);
  const detailInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const isVid = (u: string) => {
    const l = (u || '').toLowerCase();
    return l.includes('.mp4') || l.includes('.mov') || l.includes('.avi') || l.includes('.webm') || 
           l.includes('.mkv') || l.includes('.3gp') || l.includes('.m4v') || l.includes('.quicktime') ||
           l.includes('video') || l.includes('youtube.com') || l.includes('youtu.be') || l.includes('vimeo.com');
  };

  const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.6): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
          }, 'image/jpeg', quality);
        };
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const incoming = Array.from(files) as File[];
    
    // 1. Add to pending and show previews immediately
    setNewMedia(prev => ({ ...prev, pendingFiles: [...prev.pendingFiles, ...incoming] }));
    const newPreviews = incoming.map((file: File) => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...newPreviews]);

    // 2. START UPLOADING IMMEDIATELY IN THE BACKGROUND
    // This happens while the user is typing the title or description
    incoming.forEach(async (file, idx) => {
      try {
        const path = `news/${Date.now()}_${idx}_${file.name.replace(/\s+/g, '_')}`;
        let blob: File | Blob = file;
        
        // Ultra-fast aggressive compression for images only
        if (file.type.startsWith('image/') && file.type !== 'image/gif') {
          try {
            blob = await compressImage(file, 800, 0.4); // Very small for max speed
          } catch (e) {
            console.warn("Fast compression failed", e);
          }
        }
        
        const url = await uploadToStorage(blob, path);
        
        // Move from pending to confirmed media immediately when done
        setNewMedia(prev => ({
          ...prev,
          media: [...prev.media, url],
          pendingFiles: prev.pendingFiles.filter(f => f !== file)
        }));
      } catch (err) {
        console.error("Silent background upload failed:", err);
        // Silently remove from pending on error
        setNewMedia(prev => ({
          ...prev,
          pendingFiles: prev.pendingFiles.filter(f => f !== file)
        }));
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'homeBg' | 'homeDetail') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(target);
    
    try {
      const file = files[0];
      const path = `settings/${target}_${Date.now()}`;
      
      let finalFile: File | Blob = file;
      if (file.type.startsWith('image/')) {
        finalFile = await compressImage(file);
      }

      const downloadUrl = await uploadToStorage(finalFile, path);
      await setDoc(doc(db, 'settings', 'site'), { [target]: downloadUrl }, { merge: true });
      alert("Paramètre mis à jour avec succès !");
    } catch (error) {
      console.error("Upload error:", error);
      alert("Erreur lors de l'envoi du fichier.");
      handleFirestoreError(error, OperationType.UPDATE, 'settings');
    } finally {
      setUploading(null);
    }
  };

  useEffect(() => {
    if (!isAdminUnlocked) return;

    // Reservations Listener
    const qRes = query(collection(db, 'reservations'));
    const unsubRes = onSnapshot(qRes, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data() as Reservation, id: doc.id }));
      // Client-side sort
      data.sort((a: any, b: any) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
      setReservations(data);
      const validatedRes = data.filter(r => r.status === 'VALIDATED');
      setStats({
        total: data.length,
        pending: data.filter(r => r.status === 'PENDING').length,
        validated: validatedRes.length,
        validatedRevenue: validatedRes.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
        validatedPassengers: validatedRes.reduce((sum, r) => sum + (Number(r.passengersCount) || 1), 0)
      });
    });

    // Users List Listener - listens to both users_list and users collections and merges them in real-time
    let firestoreUsersList: any[] = [];
    let firestoreMainUsers: any[] = [];

    const handleMergeUsers = (ulist: any[], mlist: any[]) => {
      const mergedMap = new Map<string, any>();
      
      mlist.forEach(u => {
        const key = u.uid || u.id;
        if (key) {
          mergedMap.set(key, { ...u, uid: key });
        }
      });
      
      ulist.forEach(u => {
        const key = u.uid || u.id;
        if (key) {
          const existing = mergedMap.get(key) || {};
          mergedMap.set(key, {
            ...existing,
            ...u,
            uid: key,
            usageCount: u.usageCount || existing.usageCount || 1
          });
        }
      });

      const merged = Array.from(mergedMap.values());
      setUsersList(merged);
    };

    const qUsers = query(collection(db, 'users_list'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      firestoreUsersList = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
      handleMergeUsers(firestoreUsersList, firestoreMainUsers);
    }, (err) => {
      console.warn("Background users_list snapshot listener error:", err);
    });

    const qMainUsers = query(collection(db, 'users'));
    const unsubMainUsers = onSnapshot(qMainUsers, (snapshot) => {
      firestoreMainUsers = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
      handleMergeUsers(firestoreUsersList, firestoreMainUsers);
    }, (err) => {
      console.warn("Background users snapshot listener error:", err);
    });

    // News/Media Listener - No server-side orderBy to catch all legacy docs
    const qNews = query(collection(db, 'news'), limit(1000));
    const unsubNews = onSnapshot(qNews, (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        const type = (data.type || '').toLowerCase();
        const url = data.processedUrl || data.url || data.videoUrl || data.imageUrl || data.image || data.video || data.contentUrl || '';
        const isVideo = type === 'video' || !!(data.videoUrl || data.video) || (url && (url.toLowerCase().match(/\.(mp4|webm|ogg|mov|mkv|3gp|m4v|avi)(\?.*)?$/i) || url.toLowerCase().includes('youtube.com') || url.toLowerCase().includes('youtu.be') || url.toLowerCase().includes('vimeo.com') || (url.toLowerCase().includes('firebasestorage.googleapis.com') && (url.toLowerCase().includes('.mov') || url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('video') || url.toLowerCase().includes('.webm') || url.toLowerCase().includes('.avi')))));
        
        // Use a very robust date fallback
        const sortDate = data.publishedAt || data.createdAt || data.updatedAt || { seconds: 0 };

        return {
          ...data,
          id: doc.id,
          processedUrl: url,
          processedType: isVideo ? 'video' : (type === 'text' && !url ? 'text' : 'image'),
          processedDesc: data.desc || data.content || data.description || data.text || '',
          sortDate
        };
      }).filter((item: any) => item.title && item.title.trim() !== "");

      setNewsList(items.sort((a, b) => {
        const ta = a.sortDate?.seconds || 0;
        const tb = b.sortDate?.seconds || 0;
        return tb - ta;
      }));
    });

    // Conversations Listener
    const qConv = query(collection(db, 'conversations'));
    const unsubConv = onSnapshot(qConv, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
      items.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setConversations(items);
    });

    // Fleet Listener
    const qFleet = query(collection(db, 'fleet'));
    const unsubFleet = onSnapshot(qFleet, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
      items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setFleetList(items);
    });

    return () => { unsubRes(); unsubUsers(); unsubMainUsers(); unsubNews(); unsubConv(); unsubFleet(); };
  }, [isAdminUnlocked]);

  const getSecondsFromCreatedAt = (createdAt: any): number => {
    if (!createdAt) return Math.floor(Date.now() / 1000);
    if (typeof createdAt === 'number') {
      return createdAt > 100000000000 ? Math.floor(createdAt / 1000) : createdAt;
    }
    if (createdAt.seconds !== undefined) {
      return createdAt.seconds;
    }
    if (typeof createdAt.getTime === 'function') {
      return Math.floor(createdAt.getTime() / 1000);
    }
    if (createdAt.toDate && typeof createdAt.toDate === 'function') {
      return Math.floor(createdAt.toDate().getTime() / 1000);
    }
    const parsed = Date.parse(createdAt);
    if (!isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }
    return Math.floor(Date.now() / 1000);
  };

  useEffect(() => {
    if (!isAdminUnlocked || reservations.length === 0 || usersList.length === 0) return;

    // Background Repairing of missing historical users
    const syncMissingUsers = async () => {
      for (const r of reservations) {
        if (!r.userId) continue;
        const exists = usersList.some(u => 
          u.uid === r.userId || 
          (u.email && r.email && u.email.toLowerCase() === r.email.toLowerCase()) ||
          (u.phone && r.phone && u.phone === r.phone)
        );

        if (!exists) {
          console.log("Background repairing: Synchronizing missing historical user from reservation:", r.userId);
          const nameVal = `${r.fullName || ''} ${r.lastName || ''}`.trim() || 'Passager';
          const emailVal = r.email || `${r.phone || r.userId}@mugote.com`;
          const phoneVal = r.phone || '';

          try {
            const secs = getSecondsFromCreatedAt(r.createdAt);
            await setDoc(doc(db, 'users', r.userId), {
              uid: r.userId,
              email: emailVal,
              displayName: nameVal,
              phone: phoneVal,
              photoURL: '',
              isAnonymous: false,
              lastLogin: { seconds: secs },
              isLocalSyncOnly: true
            }, { merge: true });

            await setDoc(doc(db, 'users_list', r.userId), {
              uid: r.userId,
              email: emailVal,
              displayName: nameVal,
              phone: phoneVal,
              isAnonymous: false,
              lastLogin: { seconds: secs },
              isLocalSyncOnly: true,
              usageCount: 1
            }, { merge: true });
          } catch (err) {
            console.warn("Could not repair sync user:", err);
          }
        }
      }
    };

    const timer = setTimeout(() => {
      syncMissingUsers();
    }, 2000);

    return () => clearTimeout(timer);
  }, [isAdminUnlocked, reservations, usersList]);

  const handleAdminUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);
    setAdminLoading(true);
    
    try {
      const cleanEmail = adminEmailInput.trim().toLowerCase();
      const cleanPassword = adminPasswordInput;

      if (!cleanEmail) {
        throw new Error("L'adresse e-mail administrative est requise.");
      }

      if (!cleanPassword) {
        throw new Error("Le mot de passe d'administration est requis.");
      }

      if (cleanEmail === getAdminEmail().toLowerCase() && cleanPassword === getAdminPassword()) {
        // Authentifier également en arrière-plan avec Firebase Auth pour accorder les privilèges Firestore
        try {
          await signInWithEmailAndPassword(auth, getAdminEmail(), getAdminPassword());
          console.log("Firebase Auth admin session initiated successfully.");
        } catch (authErr: any) {
          if (authErr.code === 'auth/user-not-found') {
            try {
              await createUserWithEmailAndPassword(auth, getAdminEmail(), getAdminPassword());
              console.log("Firebase Auth admin account created successfully.");
            } catch (signUpErr) {
              console.warn("Could not automatically sign up admin in Firestore:", signUpErr);
            }
          } else {
            console.warn("Underlying Firebase Auth admin sign-in skipped:", authErr);
          }
        }

        const adminUser = {
          uid: 'admin_mugote',
          displayName: 'Administrateur Mugote',
          email: getAdminEmail(),
          phone: '0000000000',
          isAnonymous: false,
          photoURL: ''
        };
        
        localStorage.setItem('mugote_local_user', JSON.stringify(adminUser));
        localStorage.setItem('mugote_admin_session', 'true');
        
        if (setUser) {
          setUser(adminUser);
        }
        
        setIsAdminUnlocked(true);
      } else {
        throw new Error("Identifiants incorrects : Adresse e-mail ou mot de passe d'administration invalide.");
      }
    } catch (err: any) {
      console.error("Admin unlock auth failed:", err);
      setAdminAuthError(err.message || "Erreur d'authentification.");
    } finally {
      setAdminLoading(false);
    }
  };

  const getUnifiedUsers = () => {
    const list = [...usersList];
    reservations.forEach(r => {
      if (!r.userId) return;
      const exists = list.some(u => 
        u.uid === r.userId || 
        u.id === r.userId ||
        (u.phone && r.phone && u.phone === r.phone) ||
        (u.email && r.email && u.email.toLowerCase() === r.email.toLowerCase())
      );
      if (!exists) {
        list.push({
          id: r.userId,
          uid: r.userId,
          displayName: `${r.fullName} ${r.lastName}`.trim() || 'Passager',
          phone: r.phone || '',
          email: r.email || 'Anonyme',
          isAnonymous: false,
          lastLogin: r.createdAt ? { seconds: getSecondsFromCreatedAt(r.createdAt) } : null,
          usageCount: 1,
          isVirtualFromReservation: true
        });
      }
    });

    // Sort to show the newest logged-in users first
    list.sort((a, b) => {
      const getSeconds = (ts: any) => {
        if (!ts) return 0;
        if (ts.seconds !== undefined) return ts.seconds;
        if (ts._seconds !== undefined) return ts._seconds;
        if (typeof ts === 'number') return ts;
        const parsed = Date.parse(ts);
        return isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
      };
      return getSeconds(b.lastLogin) - getSeconds(a.lastLogin);
    });

    return list;
  };

  const getFilteredUnifiedUsers = () => {
    const unified = getUnifiedUsers();
    if (!userSearchTerm.trim()) return unified;
    const term = userSearchTerm.toLowerCase();
    return unified.filter(u => 
      (u.displayName || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.phone || '').toLowerCase().includes(term) ||
      (u.uid || u.id || '').toLowerCase().includes(term)
    );
  };

  const copyToClipboard = (type: 'reservations' | 'users') => {
    let text = "";
    if (type === 'users') {
      text = "Email, Derniere Connexion\n";
      getUnifiedUsers().forEach(u => {
        text += `${u.email}, ${u.lastLogin ? (u.lastLogin.seconds ? new Date(u.lastLogin.seconds * 1000).toLocaleString() : new Date(u.lastLogin).toLocaleString()) : 'N/A'}\n`;
      });
    } else {
      text = "Client, Itinerance, Date, Status, Transaction\n";
      reservations.forEach(r => {
        text += `${r.fullName}, ${r.itinerary}, ${r.travelDate}, ${r.status}, ${r.transactionId || 'N/A'}\n`;
      });
    }
    navigator.clipboard.writeText(text);
    alert("Liste copiée dans le presse-papier !");
  };

  const exportCSV = (type: 'reservations' | 'users') => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (type === 'users') {
      csvContent += "Email,DerniereConnexion\n";
      getUnifiedUsers().forEach(u => {
        csvContent += `${u.email},${u.lastLogin ? (u.lastLogin.seconds ? new Date(u.lastLogin.seconds * 1000).toISOString() : new Date(u.lastLogin).toISOString()) : 'N/A'}\n`;
      });
    } else {
      csvContent += "Client,Itinerance,Date,Status,Transaction\n";
      reservations.forEach(r => {
        csvContent += `${r.fullName},${r.itinerary},${r.travelDate},${r.status},${r.transactionId || 'N/A'}\n`;
      });
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mugote_export_${type}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading('media_publish');
    
    // Fast simulated progress: reach ~98% in ~4 seconds
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 98) {
          clearInterval(progressInterval);
          return 98;
        }
        return prev + 2; 
      });
    }, 80);

    try {
      if (newMedia.pendingFiles.length > 0) {
        let waitAttempts = 0;
        while (newMedia.pendingFiles.length > 0 && waitAttempts < 10) {
          await new Promise(r => setTimeout(r, 400));
          waitAttempts++;
        }
      }

      if (!newMedia.title && newMedia.media.length === 0 && !newMedia.url) {
          clearInterval(progressInterval);
          alert("Veuillez sélectionner un fichier ou entrer un texte.");
          setUploading(null);
          return;
      }
      
      const uploadedUrls = [...newMedia.media];
      let finalType = newMedia.type;
      const finalUrl = uploadedUrls[0] || newMedia.url || '';

      if (uploadedUrls.length > 0) {
        finalType = isVid(uploadedUrls[0]) ? 'video' : 'image';
      } else if (newMedia.url) {
        finalType = isVid(newMedia.url) ? 'video' : 'image';
      }
      const finalTitle = newMedia.title || `Publication du ${new Date().toLocaleDateString()}`;
      const finalDesc = newMedia.desc || '';

      const mediaData: any = {
        title: finalTitle,
        desc: finalDesc,
        content: finalDesc,
        url: finalUrl,
        imageUrl: finalType === 'image' ? finalUrl : '',
        videoUrl: finalType === 'video' ? finalUrl : '',
        type: finalType,
        media: uploadedUrls,
        updatedAt: serverTimestamp(),
        publishedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        processedUrl: finalUrl,
        processedType: finalType,
        processedDesc: finalDesc,
        authorId: auth.currentUser?.uid,
        authorEmail: auth.currentUser?.email,
      };

      if (!editMediaId) {
        mediaData.viewsCount = 0;
        mediaData.commentsCount = 0;
      }

      if (editMediaId) {
        await updateDoc(doc(db, 'news', editMediaId), mediaData);
      } else {
        await addDoc(collection(db, 'news'), mediaData);
      }
      
      setUploadProgress(100);
      clearInterval(progressInterval);
      
      alert("FÉLICITATIONS ! Votre contenu a été publié avec succès. 🎉");
      
      previewUrls.forEach(url => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
      setNewMedia({ title: '', desc: '', url: '', type: 'image', media: [], pendingFiles: [] });
      setPreviewUrls([]);
      setEditMediaId(null);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
      
      onNavigate('news');
      
    } catch (error: any) {
      console.error("Publication error:", error);
      let errorMessage = "Problème de connexion.";
      if (error.code === 'storage/retry-limit-exceeded') {
        errorMessage = "Le téléchargement a pris trop de temps (timeout). Vérifiez votre connexion internet et réessayez.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      alert("Erreur lors de la publication : " + errorMessage);
    } finally {
      setUploading(null);
      setUploadProgress(0);
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.from || !scheduleForm.to || !scheduleForm.time) {
      alert("Veuillez remplir les champs obligatoires.");
      return;
    }
    try {
      const data = { ...scheduleForm, updatedAt: serverTimestamp() };
      if (scheduleForm.id) {
        await updateDoc(doc(db, 'schedules', scheduleForm.id), data);
      } else {
        delete (data as any).id;
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'schedules'), data);
      }
      setScheduleForm({ id: '', from: '', to: '', time: '', ship: '', days: '' });
      alert("Horaire enregistré avec succès !");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de l'horaire.");
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm("Supprimer cet horaire ?")) return;
    try {
      await deleteDoc(doc(db, 'schedules', id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditMedia = (m: any) => {
    setNewMedia({
      title: m.title || '',
      desc: m.processedDesc || '',
      url: m.processedUrl || '',
      type: m.processedType as any,
      media: m.media || [],
      pendingFiles: []
    });
    setPreviewUrls([]);
    setEditMediaId(m.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancellationAction = async (reservationId: string, action: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'reservations', reservationId), {
        cancellationStatus: action,
        status: action === 'approved' ? 'ANNULÉ' : 'VALIDATED',
        cancellationProcessedAt: serverTimestamp()
      });
      alert(action === 'approved' ? "Annulation approuvée. Le billet est marqué comme ANNULÉ." : "Demande de remboursement rejetée.");
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, 'reservations');
    }
  };

  const handleAction = async (resId: string, action: 'VALIDATED' | 'REJECTED') => {
    try {
      let ticketId = '';
      if (action === 'VALIDATED') {
        let isUnique = false;
        while (!isUnique) {
          const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
          ticketId = `AMR-${randomId}`;
          
          // Verify uniqueness in DB
          const q = query(collection(db, 'reservations'), where('ticketId', '==', ticketId));
          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty) {
            isUnique = true;
          }
        }
      }

      await updateDoc(doc(db, 'reservations', resId), {
        status: action,
        validatedAt: action === 'VALIDATED' ? Date.now() : null,
        validatedBy: auth.currentUser?.uid,
        ticketId: action === 'VALIDATED' ? ticketId : ''
      });
    } catch (error) {
      console.error("Action failed", error);
      handleFirestoreError(error, action === 'VALIDATED' ? OperationType.UPDATE : OperationType.UPDATE, `reservations/${resId}`);
    }
  };

  const handleDeleteMedia = async (id: string) => {
    if (window.confirm("Voulez-vous vraiment supprimer ce média ?")) {
      try {
        await deleteDoc(doc(db, 'news', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'news');
      }
    }
  };

  const handleCleanGarbage = async () => {
    if (window.confirm("Voulez-vous lancer un nettoyage automatique de la base de données ? Cela analysera l'ensemble des publications existantes et supprimera définitivement toutes les ordures ou publications corrompues (publications vides, sans titre ou sans contenu valide).")) {
      setCleaningGarbage(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'news'));
        let deletedCount = 0;
        for (const document of querySnapshot.docs) {
          const data = document.data();
          const title = data.title || '';
          const desc = data.desc || data.content || data.description || data.text || '';
          const url = data.processedUrl || data.url || data.videoUrl || data.imageUrl || data.image || data.video || data.contentUrl || '';
          
          const isCorrupt = !title.trim() || (!url.trim() && !desc.trim());
          if (isCorrupt) {
            await deleteDoc(doc(db, 'news', document.id));
            deletedCount++;
          }
        }
        alert(`Nettoyage terminé avec succès ! ${deletedCount} publication(s) vide(s) ou corrompue(s) ont été nettoyée(s).`);
      } catch (error) {
        console.error("Clean garbage error:", error);
        alert("Erreur lors du nettoyage de la base de données : " + (error instanceof Error ? error.message : String(error)));
      } finally {
        setCleaningGarbage(false);
      }
    }
  };

  const handleDeleteReservation = async (id: string) => {
    if (window.confirm("Voulez-vous vraiment supprimer cette réservation ?")) {
      try {
        await deleteDoc(doc(db, 'reservations', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'reservations');
      }
    }
  };

  const handleBoatAction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!boatForm.name || boatForm.capacity < 0) {
        alert("Nom et capacité positive requis.");
        return;
      }

      const boatData = {
        name: boatForm.name,
        capacity: Number(boatForm.capacity),
        description: boatForm.description,
        imageUrl: boatForm.imageUrl,
        updatedAt: serverTimestamp()
      };

      if (boatForm.id) {
        await updateDoc(doc(db, 'fleet', boatForm.id), boatData);
        alert("Bateau mis à jour !");
      } else {
        await addDoc(collection(db, 'fleet'), boatData);
        alert("Bateau ajouté à la flotte !");
      }
      setBoatForm({ id: '', name: '', capacity: 0, description: '', imageUrl: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'fleet');
    }
  };

  const handleDeleteBoat = async (id: string) => {
    if (window.confirm("Voulez-vous vraiment retirer ce bateau de la flotte ?")) {
      try {
        await deleteDoc(doc(db, 'fleet', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'fleet');
      }
    }
  };

  const generatePDF = (res: Reservation) => {
    generateTicket(res, siteSettings || { homeBg: '' });
  };

  const filteredReservations = reservations.filter(res => {
    const search = searchTerm.toLowerCase();
    return (
      res.fullName?.toLowerCase().includes(search) ||
      res.lastName?.toLowerCase().includes(search) ||
      res.phone?.toLowerCase().includes(search) ||
      res.transactionId?.toLowerCase().includes(search) ||
      res.ticketId?.toLowerCase().includes(search) ||
      res.id?.toLowerCase().includes(search)
    );
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-12 relative"
    >
      <button 
        onClick={() => onNavigate('home')} 
        className="absolute top-0 right-0 p-3 bg-slate-100 text-slate-400 hover:text-black rounded-xl transition-all z-20"
        title="Retour Accueil"
      >
        <X size={20} />
      </button>

      <div className="flex flex-col items-center gap-10 border-b border-slate-200 pb-12 text-center">
        {!isAdminUnlocked ? (
          <div className="max-w-md w-full p-10 bg-white rounded-[32px] border border-slate-200 shadow-2xl mt-12 text-left">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <ShieldCheck size={40} />
            </div>
            <h3 className="text-xl font-extrabold uppercase tracking-tighter mb-2 italic text-maritime text-center">Accès Base de Données</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 leading-relaxed text-center">
              Saisissez l'Adresse E-mail administrative et le Mot de Passe d'Administration pour continuer.
            </p>
            <form onSubmit={handleAdminUnlockSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Adresse E-mail Administrative</label>
                <input 
                  type="email"
                  placeholder="birekeidea@gmail.com"
                  value={adminEmailInput}
                  onChange={e => setAdminEmailInput(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-500 text-sm font-bold"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Mot de Passe d'Administration</label>
                <input 
                  type="password"
                  placeholder="••••••••"
                  value={adminPasswordInput}
                  onChange={e => setAdminPasswordInput(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-500 text-sm font-bold"
                  required
                />
              </div>

              {adminAuthError && (
                <p className="text-rose-500 text-[10px] font-black uppercase text-center bg-rose-50 py-3 rounded-xl border border-rose-100 animate-shake">
                  {adminAuthError}
                </p>
              )}

              <button 
                type="submit"
                disabled={adminLoading}
                className="w-full py-4.5 bg-emerald-600 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-600/20 active:scale-95 hover:bg-emerald-700 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {adminLoading ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="border-2 border-white/33 border-t-white w-4 h-4 rounded-full" />
                    Connexion en cours...
                  </>
                ) : (
                  "Valider mes identifiants"
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tighter uppercase text-black leading-none">Administration</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { id: 'reservations', label: 'Réservations', icon: Ticket },
                { id: 'scanner', label: 'Scanner Port', icon: Camera },
                { id: 'users', label: 'Utilisateurs', icon: Users },
                { id: 'fleet', label: 'Flotte', icon: Anchor },
                { id: 'schedules', label: 'Horaires', icon: Clock },
                { id: 'messages', label: 'Discussions', icon: MessageSquare },
                { id: 'media', label: 'Médias', icon: ImagePlus },
                { id: 'settings', label: 'Paramètres', icon: Settings }
              ].map(t => (
                <button 
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                    tab === t.id ? "bg-black text-white shadow-lg shadow-black/20" : "text-slate-400 hover:text-black hover:bg-slate-100"
                  )}
                >
                  <t.icon size={14} /> {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isAdminUnlocked && (
        <>
          <div className="mt-8">
        
        {tab === 'reservations' && (
          <div className="space-y-6 w-full max-w-5xl mx-auto px-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-wrap justify-center gap-4">
                {[
                  { label: "Total Réservations", val: stats.total, color: "bg-black text-white" },
                  { label: "En attente", val: stats.pending, color: "bg-amber-100 text-amber-700 border border-amber-200" },
                  { label: "Validées", val: stats.validated, color: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
                  { label: "Passagers Validés", val: stats.validatedPassengers, color: "bg-blue-100 text-blue-700 border border-blue-200" },
                  { label: "Recettes (USD)", val: `${stats.validatedRevenue}$`, color: "bg-gold/10 text-gold-700 border-2 border-gold/30" }
                ].map((s, i) => (
                  <div key={i} className={cn("px-4 lg:px-8 py-3 lg:py-4 rounded-2xl text-center min-w-[120px] lg:min-w-[140px]", s.color)}>
                    <p className="text-[7px] lg:text-[9px] font-extrabold uppercase tracking-widest opacity-60 mb-1">{s.label}</p>
                    <p className="text-sm lg:text-xl font-extrabold font-mono tracking-tighter leading-none">{s.val}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 print:hidden">
                <button 
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-maritime text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2"
                >
                   <Printer size={14} /> Imprimer Liste
                </button>
                <button 
                  onClick={() => copyToClipboard('reservations')}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
                >
                   Copier Liste
                </button>
                <button 
                  onClick={() => exportCSV('reservations')}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
                >
                   Exporter CSV
                </button>
              </div>
              
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Rechercher par nom, tel, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-100 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 focus:bg-white transition-all text-sm font-bold"
                />
              </div>
            </div>

            {/* Recent Media Quick Look */}
            {newsList.length > 0 && (
              <div className="max-w-5xl mx-auto px-10">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Dernières Publications</h4>
                  <button onClick={() => setTab('media')} className="text-[9px] font-black text-gold uppercase tracking-widest hover:underline">Gérer tout</button>
                </div>
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-10 px-10">
                  {newsList.slice(0, 12).map(m => (
                    <div key={m.id} className="flex-shrink-0 w-32 group cursor-pointer" onClick={() => setTab('media')}>
                      <div className="aspect-square rounded-2xl overflow-hidden border border-slate-200 relative mb-2">
                        {m.type === 'video' ? (
                          <video 
                            src={m.url || undefined} 
                            className="w-full h-full object-cover" 
                            muted
                            playsInline
                            autoPlay
                            loop
                          />
                        ) : m.type === 'image' ? (
                          <img src={m.url || undefined} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-50 flex items-center justify-center"><FileText size={16} className="text-slate-300" /></div>
                        )}
                        <div className="absolute top-1 right-1">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            m.type === 'video' ? "bg-emerald-500" : m.type === 'image' ? "bg-gold" : "bg-indigo-500"
                          )} />
                        </div>
                      </div>
                      <p className="text-[8px] font-black text-black uppercase truncate italic">{m.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
        {tab === 'scanner' ? (
          <AdminScannerView reservations={reservations} />
        ) : tab === 'reservations' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-10 py-6 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Client (Nom Complet)</th>
                  <th className="px-10 py-6 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Détails Voyage</th>
                  <th className="px-10 py-6 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 text-center">Paiement</th>
                  <th className="px-10 py-6 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 text-center">Embarquement</th>
                  <th className="px-10 py-6 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredReservations.map(res => (
                  <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-black font-extrabold text-sm">
                          {res.fullName[0].toUpperCase()}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-extrabold text-black uppercase tracking-tight">{res.fullName} {res.lastName}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-1">{res.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-4">
                        <div className="text-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                          <p className="text-[10px] font-bold text-black uppercase italic">{res.itinerary.split('-')[0]}</p>
                          <ChevronRight size={10} className="mx-auto text-gold" />
                          <p className="text-[10px] font-bold text-black uppercase italic">{res.itinerary.split('-')[1]}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-black">{res.travelDate}</p>
                          <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">{res.ship} • {res.travelClass} • {res.passengersCount} PAX</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-center">
                      <div className={cn(
                        "inline-block px-4 py-2 rounded-xl border relative group",
                        res.transactionId ? "bg-emerald-50 border-emerald-100" : "bg-slate-100 border-slate-200"
                      )}>
                        <p className="text-[10px] font-black text-maritime uppercase tracking-widest mb-0.5">Montant</p>
                        <p className="text-xl font-black text-black font-mono">{res.amount}$</p>
                        {res.transactionId && (
                          <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[7px] font-black px-2 py-0.5 rounded-full animate-bounce shadow-lg">
                            PAYÉ
                          </div>
                        )}
                      </div>
                      {res.transactionId && (
                        <div className="mt-3 space-y-1">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ID Transaction</p>
                          <p className="text-[10px] font-bold text-emerald-600 font-mono bg-emerald-50 inline-block px-2 py-0.5 rounded-md border border-emerald-100 italic">{res.transactionId}</p>
                        </div>
                      )}
                      <div className="mt-3">
                        <span className={cn(
                          "px-3 py-1 text-[8px] font-bold uppercase tracking-widest rounded-full border",
                          res.status === 'PENDING' && "bg-amber-50 text-amber-600 border-amber-200",
                          res.status === 'VALIDATED' && "bg-emerald-50 text-emerald-600 border-emerald-200",
                          res.status === 'REJECTED' && "bg-rose-50 text-rose-600 border-rose-200"
                        )}>
                          {res.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className={cn(
                          "px-3 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-full border",
                          res.boardingStatus === 'BOARDED' 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200" 
                            : "bg-slate-100 text-slate-400 border-slate-200"
                        )}>
                          {res.boardingStatus === 'BOARDED' ? '🚢 EMBARQUÉ' : 'Non embarqué'}
                        </span>
                        {res.status === 'VALIDATED' && (
                          <button
                            onClick={async () => {
                              const isCurrentlyBoarded = res.boardingStatus === 'BOARDED';
                              const newStatus = isCurrentlyBoarded ? 'PENDING' : 'BOARDED';
                              try {
                                await updateDoc(doc(db, 'reservations', res.id!), {
                                  boardingStatus: newStatus,
                                  boardedAt: newStatus === 'BOARDED' ? Date.now() : null
                                });
                              } catch (err: any) {
                                console.warn("Could not update boarding status in table", err);
                              }
                            }}
                            className="text-[8px] font-black uppercase tracking-widest text-[#0047AB] hover:underline"
                          >
                            {res.boardingStatus === 'BOARDED' ? 'Débarquer' : 'Embarquer'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <div className="flex justify-end gap-3 flex-wrap">
                        {(res as any).cancellationRequested && (res as any).cancellationStatus === 'pending' ? (
                          <div className="flex items-center gap-2 bg-rose-50 p-2 rounded-xl border border-rose-100">
                             <p className="text-[8px] font-black text-rose-600 uppercase px-2 italic">Annulation demandée</p>
                             <button 
                              onClick={() => handleCancellationAction(res.id!, 'approved')}
                              className="px-3 py-1.5 bg-emerald-600 text-white text-[8px] font-black rounded-lg shadow-md hover:bg-emerald-700"
                            >
                              APPROUVER
                            </button>
                            <button 
                              onClick={() => handleCancellationAction(res.id!, 'rejected')}
                              className="px-3 py-1.5 bg-rose-600 text-white text-[8px] font-black rounded-lg shadow-md hover:bg-rose-700"
                            >
                              REJETER
                            </button>
                          </div>
                        ) : (
                          <>
                            {res.status === 'PENDING' && (
                              <>
                                <button 
                                  onClick={() => handleAction(res.id!, 'VALIDATED')} 
                                  className="px-4 py-2 flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all rounded-xl shadow-sm border border-emerald-100 text-[9px] font-black uppercase tracking-widest"
                                >
                                  <CheckCircle2 size={14} /> Valider
                                </button>
                                <button 
                                  onClick={() => handleAction(res.id!, 'REJECTED')} 
                                  className="px-4 py-2 flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all rounded-xl shadow-sm border border-rose-100 text-[9px] font-black uppercase tracking-widest"
                                >
                                  <X size={14} /> Rejeter
                                </button>
                              </>
                            )}
                            {res.status === 'VALIDATED' && (
                              <button onClick={() => generatePDF(res)} className="px-6 py-2.5 bg-maritime text-white hover:bg-maritime-dark transition-all rounded-xl text-[9px] font-extrabold uppercase tracking-widest shadow-lg shadow-maritime/20 flex items-center gap-2">
                                <Printer size={14} /> Imprimer
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteReservation(res.id!)}
                              className="px-4 py-2 flex items-center gap-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all rounded-xl border border-transparent hover:border-rose-100 text-[9px] font-black uppercase tracking-widest"
                            >
                              <Trash2 size={14} /> Supprimer
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reservations.length === 0 && <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">Aucun passager enregistré.</div>}
          </div>
        ) : tab === 'users' ? (
          <div className="p-12 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter italic">Liste des Utilisateurs</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Suivi et métriques de connexion des membres enregistrés</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => copyToClipboard('users')}
                  className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all cursor-pointer"
                >
                   Copier Liste
                </button>
                <button 
                  onClick={() => exportCSV('users')}
                  className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all cursor-pointer"
                >
                   Exporter CSV
                </button>
              </div>
            </div>

            {/* Statistiques d'Utilisation / Connexion */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { 
                  label: "Utilisateurs Connus", 
                  val: getUnifiedUsers().length, 
                  desc: "Membres authentifiés et passagers",
                  color: "border-sky-100 bg-sky-50/20 text-sky-600"
                },
                { 
                  label: "Connexions Totales", 
                  val: getUnifiedUsers().reduce((sum, u) => sum + (Number(u.usageCount) || 1), 0), 
                  desc: "Fréquence globale d'utilisation accumulée",
                  color: "border-emerald-100 bg-emerald-50/20 text-emerald-600"
                },
                { 
                  label: "Avec Réservation", 
                  val: getUnifiedUsers().filter(u => reservations.some(r => r.userId === u.uid || (u.phone && r.phone === u.phone))).length, 
                  desc: "Passagers actifs avec billets",
                  color: "border-purple-100 bg-purple-50/20 text-purple-600"
                },
                { 
                  label: "Activité Récente", 
                  val: getUnifiedUsers().filter(u => u.lastLogin).length, 
                  desc: "Membres avec historique enregistré",
                  color: "border-amber-100 bg-amber-50/20 text-amber-600"
                }
              ].map((s, idx) => (
                <div key={idx} className={`p-6 bg-white border rounded-[24px] shadow-sm flex flex-col justify-between ${s.color}`}>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{s.label}</span>
                    <span className="text-4xl font-extrabold tracking-tighter uppercase leading-none block">{s.val}</span>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-3 leading-tight">{s.desc}</p>
                </div>
              ))}
            </div>

            {/* Barre de Recherche Multi-critères */}
            <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
              <div className="relative w-full md:flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Rechercher par Nom, Téléphone, E-mail, Identifiant UID..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-black transition-all"
                />
              </div>
              {userSearchTerm && (
                <button 
                  onClick={() => setUserSearchTerm('')}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-black hover:bg-slate-150 px-4 py-2 rounded-xl transition-all"
                >
                  Effacer
                </button>
              )}
            </div>

            {/* Tableau principal des Utilisateurs */}
            <div className="overflow-x-auto border border-slate-100 rounded-[24px] bg-white shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 text-left">Utilisateur & Identifiants</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 text-left">Dernière Connexion</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 text-left">Activité / Billets</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 text-left">Compte Vérifié</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {getFilteredUnifiedUsers().map((u, i) => {
                    const userReservations = reservations.filter(r => r.userId === u.uid || (u.phone && r.phone === u.phone));
                    const totalRes = userReservations.length;
                    const validatedResCount = userReservations.filter(r => r.status === 'VALIDATED').length;
                    const pendingResCount = userReservations.filter(r => r.status === 'PENDING').length;
                    const cleanUid = u.uid || u.id || 'N/A';

                    return (
                      <tr key={u.id || cleanUid} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                              {u.photoURL ? (
                                <img src={u.photoURL || undefined} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-100 shadow-sm" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-maritime/5 flex items-center justify-center text-maritime">
                                  <User size={16} />
                                </div>
                              )}
                            <div className="flex flex-col gap-1">
                               <span className="text-sm font-black uppercase tracking-tight italic">{u.displayName || 'Utilisateur'}</span>
                               <div className="flex flex-wrap items-center gap-2">
                                 {u.phone && (
                                   <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-maritime/5 text-maritime rounded-md border border-maritime/10">
                                     Tél: {u.phone}
                                   </span>
                                 )}
                                 <span className="text-[9.5px] font-mono text-slate-400">{u.email || 'Anonyme'}</span>
                               </div>
                               
                               {/* Affichage explicite des identifiants (UID) avec bouton de copie */}
                               <div className="flex items-center gap-2 mt-1">
                                 <span className="text-[9px] font-mono select-all bg-slate-50 text-slate-500 border border-slate-200/60 px-2 py-0.5 rounded-md flex items-center gap-1.5" title="Identifiant Firebase UID">
                                   <span className="text-slate-400 font-bold">UID:</span> {cleanUid}
                                 </span>
                                 <button
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     navigator.clipboard.writeText(cleanUid);
                                     alert(`Identifiant UID spécifié pour ${u.displayName || 'ce visiteur'} copié avec succès !`);
                                   }}
                                   className="p-1 hover:bg-slate-100 text-slate-400 hover:text-black rounded transition-all focus:outline-none cursor-pointer"
                                   title="Copier l'identifiant pour vos archives administratives"
                                 >
                                   <Copy size={11} />
                                 </button>
                               </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            {u.lastLogin ? (u.lastLogin.seconds ? new Date(u.lastLogin.seconds * 1000).toLocaleString() : new Date(u.lastLogin).toLocaleString()) : 'N/A'}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10.5px] font-black px-2 py-0.5 bg-sky-50 text-maritime rounded-md border border-slate-150 self-start">
                              {totalRes} billet{totalRes > 1 || totalRes === 0 ? 's' : ''}
                            </span>
                            {totalRes > 0 && (
                              <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                                {validatedResCount} validé(s) | {pendingResCount} en attente
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                        {u.emailVerified ? (
                          <span className="text-[8px] font-black uppercase px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100">OUI</span>
                        ) : (
                          <span className="text-[8px] font-black uppercase px-2 py-1 bg-slate-50 text-slate-400 rounded-md border border-slate-200">NON</span>
                        )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {getFilteredUnifiedUsers().length === 0 && (
                <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                  {userSearchTerm ? "Aucun utilisateur ne correspond à votre recherche." : "Aucun utilisateur enregistré."}
                </div>
              )}
            </div>
          </div>
        ) : tab === 'fleet' ? (
          <div className="p-12 space-y-12">
            <div className="bg-slate-50 p-10 rounded-[32px] border border-slate-100 max-w-4xl mx-auto">
              <h3 className="text-xl font-black uppercase tracking-tighter mb-8 italic flex items-center gap-3">
                <Anchor className="text-maritime" size={24} /> 
                {boatForm.id ? 'Modifier le Bateau' : 'Ajouter un Nouveau Bateau'}
              </h3>
              <form onSubmit={handleBoatAction} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Nom du Bateau</label>
                    <input 
                      required
                      value={boatForm.name}
                      onChange={e => setBoatForm({...boatForm, name: e.target.value})}
                      className="w-full px-6 py-3 border border-slate-200 rounded-xl focus:border-maritime outline-none text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Capacité (PAX)</label>
                    <input 
                      type="number"
                      required
                      value={boatForm.capacity}
                      onChange={e => setBoatForm({...boatForm, capacity: Number(e.target.value)})}
                      className="w-full px-6 py-3 border border-slate-200 rounded-xl focus:border-maritime outline-none text-sm font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                   <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Image du Navire</label>
                    <div className="flex gap-2">
                      <input 
                        value={boatForm.imageUrl}
                        onChange={e => setBoatForm({...boatForm, imageUrl: e.target.value})}
                        className="flex-1 px-6 py-3 border border-slate-200 rounded-xl focus:border-maritime outline-none text-xs font-mono"
                        placeholder="URL Image (ou chargez ci-contre)"
                      />
                      <input 
                        type="file"
                        className="hidden"
                        id="fleet-upload"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                             setUploading('fleet_img');
                             try {
                               const blob = await compressImage(file);
                               const url = await uploadToStorage(blob, `fleet/${Date.now()}_${file.name}`);
                               setBoatForm(prev => ({ ...prev, imageUrl: url }));
                             } catch (e) {
                               console.error(e);
                             } finally {
                               setUploading(null);
                             }
                          }
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => document.getElementById('fleet-upload')?.click()}
                        className="px-4 bg-slate-50 border border-slate-200 rounded-xl text-maritime hover:bg-slate-100 transition-all font-bold text-[10px]"
                      >
                        {uploading === 'fleet_img' ? "..." : "Charger"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Description</label>
                    <textarea 
                      value={boatForm.description}
                      onChange={e => setBoatForm({...boatForm, description: e.target.value})}
                      className="w-full px-6 py-3 border border-slate-200 rounded-xl focus:border-maritime outline-none text-xs font-bold h-[104px] resize-none"
                    />
                  </div>
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <button className="flex-1 py-4 bg-maritime text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-maritime/20 hover:scale-[1.02] transition-all">
                    {boatForm.id ? 'Mettre à Jour' : 'Ajouter à la Flotte'}
                  </button>
                  {boatForm.id && (
                    <button 
                      type="button"
                      onClick={() => setBoatForm({ id: '', name: '', capacity: 0, description: '', imageUrl: '' })}
                      className="px-8 py-4 bg-slate-100 text-slate-400 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-200"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="space-y-6">
              <h3 className="text-2xl font-black uppercase tracking-tighter italic">La Flotte Actuelle</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {fleetList.map(boat => (
                  <div key={boat.id} className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-xl shadow-slate-100 p-2">
                    <div className="aspect-[4/3] rounded-[24px] bg-slate-50 overflow-hidden relative mb-4">
                      {boat.imageUrl ? (
                        <img src={boat.imageUrl || undefined} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-maritime/5 text-maritime/20">
                          <Ship size={64} />
                        </div>
                      )}
                      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                        {boat.capacity} PAX
                      </div>
                    </div>
                    <div className="px-6 pb-6">
                      <h4 className="text-lg font-extrabold uppercase tracking-tighter italic mb-2">{boat.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest line-clamp-2 mb-6 h-8">{boat.description || 'Navire de transport sécurisé.'}</p>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setBoatForm(boat)}
                          className="flex-1 py-3 bg-slate-50 text-slate-600 hover:bg-black hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                        >
                          Modifier
                        </button>
                        <button 
                          onClick={() => handleDeleteBoat(boat.id)}
                          className="p-3 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {fleetList.length === 0 && (
                <div className="py-20 text-center">
                  <Anchor size={48} className="mx-auto text-slate-100 mb-4" />
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Aucun navire dans la liste.</p>
                </div>
              )}
            </div>
          </div>
        ) : tab === 'schedules' ? (
          <div className="p-12 space-y-12">
            <div className="bg-slate-50 p-10 rounded-[32px] border border-slate-100 max-w-4xl mx-auto shadow-inner">
               <h3 className="text-xl font-black uppercase tracking-tighter mb-8 italic flex items-center gap-3">
                 <Clock className="text-gold" size={24} /> {scheduleForm.id ? 'Modifier l\'Horaire' : 'Nouvel Horaire'}
               </h3>
               <form onSubmit={handleAddSchedule} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Ville de Départ</label>
                     <input value={scheduleForm.from} onChange={e => setScheduleForm({...scheduleForm, from: e.target.value})} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-gold font-bold text-xs" placeholder="Ex: Bukavu" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Destination</label>
                     <input value={scheduleForm.to} onChange={e => setScheduleForm({...scheduleForm, to: e.target.value})} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-gold font-bold text-xs" placeholder="Ex: Goma" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Heure de Départ</label>
                     <input value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-gold font-bold text-xs" placeholder="Ex: 07h30" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Bateau</label>
                     <input value={scheduleForm.ship} onChange={e => setScheduleForm({...scheduleForm, ship: e.target.value})} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-gold font-bold text-xs" placeholder="Ex: Mugote 1" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Fréquence/Jours</label>
                     <input value={scheduleForm.days} onChange={e => setScheduleForm({...scheduleForm, days: e.target.value})} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-gold font-bold text-xs" placeholder="Ex: Tous les jours" />
                  </div>
                  <div className="flex items-end gap-2">
                     <button type="submit" className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/20">
                       Publier Horaire
                     </button>
                     {scheduleForm.id && (
                        <button type="button" onClick={() => setScheduleForm({ id: '', from: '', to: '', time: '', ship: '', days: '' })} className="p-4 bg-slate-200 text-slate-600 rounded-2xl">
                          <X size={20} />
                        </button>
                     )}
                  </div>
               </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {schedules.map((s, i) => (
                <div key={i} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 flex gap-2">
                    <button onClick={() => setScheduleForm(s)} className="w-10 h-10 bg-slate-50 text-slate-400 hover:bg-black hover:text-white rounded-xl flex items-center justify-center transition-all border border-slate-100"><Edit size={16} /></button>
                    <button onClick={() => deleteSchedule(s.id)} className="w-10 h-10 bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white rounded-xl flex items-center justify-center transition-all border border-slate-100"><Trash2 size={16} /></button>
                  </div>
                  <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-maritime mb-8 border border-slate-100">
                    <Clock size={32} />
                  </div>
                  <div className="flex items-center gap-6 mb-8">
                     <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-300 uppercase mb-2 tracking-widest">DÉPART</p>
                        <p className="text-2xl font-black uppercase italic tracking-tighter text-black">{s.from}</p>
                     </div>
                     <div className="w-10 h-px bg-slate-100" />
                     <div className="flex-1 text-right">
                        <p className="text-[10px] font-black text-slate-300 uppercase mb-2 tracking-widest">ARRIVÉE</p>
                        <p className="text-2xl font-black uppercase italic tracking-tighter text-black">{s.to}</p>
                     </div>
                  </div>
                  <div className="pt-8 border-t border-slate-50 flex justify-between items-center bg-slate-50/30 -mx-8 px-8 -mb-8 py-6">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Heure Locale</span>
                        <span className="text-3xl font-mono font-black text-gold leading-none mt-1">{s.time}</span>
                     </div>
                     <div className="text-right">
                         <p className="text-[11px] font-black text-maritime uppercase tracking-tighter italic">{s.ship || 'Tous Navires'}</p>
                         <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{s.days || 'Quotidien'}</p>
                     </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : tab === 'media' ? (
          <div className="p-12 space-y-16">
            <div className="max-w-4xl mx-auto">
              <div className="bg-slate-50 p-10 rounded-[32px] border border-slate-100 mb-12 shadow-inner">
                <div className="mb-8">
                  <h3 className="text-xl font-black text-maritime uppercase tracking-tighter italic mb-2">
                    {editMediaId ? 'Modifier la Publication' : 'Publication Rapide'}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Postez vos photos, vidéos ou messages instantanément</p>
                </div>
                
                <form onSubmit={handleAddMedia} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <div className="flex flex-col gap-4">
                        <input 
                          type="file" 
                          ref={mediaInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                          accept="image/*,video/*"
                          multiple
                        />
                        <button 
                          type="button"
                          onClick={() => mediaInputRef.current?.click()}
                          className={cn(
                            "w-full aspect-[16/6] border-4 border-dashed rounded-[32px] transition-all flex flex-col items-center justify-center gap-4 uppercase tracking-[0.2em] shadow-xl group",
                            (newMedia.media.length > 0 || previewUrls.length > 0) ? "border-emerald-400 bg-emerald-50 text-emerald-600" : "border-slate-200 bg-white text-slate-300 hover:border-maritime hover:text-maritime hover:bg-slate-50"
                          )}
                        >
                          <div className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center transition-all",
                            (newMedia.media.length > 0 || previewUrls.length > 0) ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-maritime group-hover:text-white"
                          )}>
                            {(newMedia.media.length > 0 || previewUrls.length > 0) ? <Check size={32} /> : <Camera size={32} />}
                          </div>
                          <div className="text-center">
                            <span className="text-[11px] font-black block">
                              {(newMedia.media.length > 0 || previewUrls.length > 0) ? `${newMedia.media.length + previewUrls.length} Fichiers sélectionnés` : "Sélectionner Photos / Vidéos"}
                            </span>
                            <span className="text-[8px] opacity-60">Glissez-déposez ou cliquez ici</span>
                          </div>
                        </button>
                        
                        {(newMedia.media.length > 0 || previewUrls.length > 0) && (
                          <div className="flex gap-3 p-4 bg-white/50 rounded-2xl border border-slate-100 overflow-x-auto no-scrollbar scroll-smooth">
                            {/* Previously uploaded media items */}
                            {newMedia.media.map((url, i) => {
                              const isVideoUrl = isVid(url);
                              return (
                                <div key={`existing-${i}`} className="relative group flex-shrink-0">
                                  <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-sm bg-slate-50 flex items-center justify-center">
                                    {isVideoUrl ? (
                                      <video src={url || undefined} className="w-full h-full object-cover" muted playsInline />
                                    ) : (
                                      <img src={url || undefined} className="w-full h-full object-cover" />
                                    )}
                                  </div>
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      const next = [...newMedia.media];
                                      next.splice(i, 1);
                                      setNewMedia(prev => ({ ...prev, media: next }));
                                    }}
                                    className="absolute -top-1 -right-1 bg-rose-500 text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-all border border-white z-10"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              );
                            })}
                            {/* New files to be uploaded */}
                            {previewUrls.map((url, i) => {
                              const file = newMedia.pendingFiles[i];
                              const isVideoFile = file?.type?.startsWith('video/') || 
                                                  ['.mp4', '.mov', '.avi', '.webm', '.mkv'].some(ext => file?.name?.toLowerCase().endsWith(ext)) ||
                                                  isVid(url);
                              return (
                                <div key={`pending-${i}`} className="relative group flex-shrink-0">
                                  <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm bg-slate-50 flex items-center justify-center">
                                    {isVideoFile ? (
                                      <video src={url || undefined} className="w-full h-full object-cover" muted playsInline />
                                    ) : (
                                      <img src={url || undefined} className="w-full h-full object-cover" />
                                    )}
                                  </div>
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      const nextPreviews = [...previewUrls];
                                      nextPreviews.splice(i, 1);
                                      setPreviewUrls(nextPreviews);
                                      const nextFiles = [...newMedia.pendingFiles];
                                      nextFiles.splice(i, 1);
                                      setNewMedia(prev => ({ ...prev, pendingFiles: nextFiles }));
                                    }}
                                    className="absolute -top-1 -right-1 bg-rose-500 text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-all border border-white z-10"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6 flex flex-col justify-between">
                      <div className="space-y-4">
                        <input 
                          placeholder="Titre (ex: Mugote 2 à l'embarcadère)"
                          value={newMedia.title}
                          onChange={e => setNewMedia({...newMedia, title: e.target.value})}
                          className="w-full px-8 py-5 bg-white border border-slate-100 rounded-[20px] focus:outline-none focus:ring-4 focus:ring-maritime/5 transition-all text-sm font-bold uppercase tracking-tight italic"
                        />
                        <textarea 
                          placeholder="Écrivez une description ou un message ici..."
                          value={newMedia.desc}
                          onChange={e => setNewMedia({...newMedia, desc: e.target.value})}
                          className="w-full px-8 py-6 bg-white border border-slate-100 rounded-[24px] focus:outline-none focus:ring-4 focus:ring-maritime/5 transition-all text-sm font-medium leading-relaxed resize-none h-40"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-200/50 flex flex-col md:flex-row gap-4 items-center">
                    <button 
                      type="submit"
                      disabled={uploading === 'media_publish'}
                      className={cn(
                        "flex-1 w-full py-6 rounded-[24px] text-xs font-black uppercase tracking-[0.4em] shadow-2xl transition-all flex items-center justify-center min-w-[200px] border-b-4",
                        uploading === 'media_publish'
                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" 
                          : "bg-black text-white border-slate-700 hover:scale-[1.02] active:scale-95 shadow-black/30"
                      )}
                    >
                      {uploading === 'media_publish' ? (
                        <div className="flex flex-col items-center gap-2">
                           <div className="flex items-center gap-3 text-gold">
                             <div className="w-5 h-5 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
                             <span className="text-[10px] font-black uppercase tracking-widest animate-pulse italic">
                               Publication en cours... {uploadProgress > 0 ? `${uploadProgress}%` : ''}
                             </span>
                           </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                           <Rocket size={24} className="text-gold" />
                           <span>Publier Maintenant</span>
                        </div>
                      )}
                    </button>
                    {editMediaId && (
                      <button 
                        type="button"
                        onClick={() => {
                          setEditMediaId(null);
                          setNewMedia({ title: '', desc: '', url: '', type: 'image', media: [], pendingFiles: [] });
                          setPreviewUrls([]);
                        }}
                        className="px-10 py-6 text-slate-400 font-bold uppercase tracking-widest text-[10px] rounded-[24px] hover:bg-slate-200 transition-all"
                      >
                        Annuler modification
                      </button>
                    )}
                  </div>
                </form>
              </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Contenus en Ligne ({newsList.length})</h4>
                <div className="flex gap-3">
                  <button 
                    onClick={handleCleanGarbage}
                    disabled={cleaningGarbage}
                    className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 px-4 py-2 rounded-full hover:bg-rose-100 transition-all border border-rose-200"
                  >
                    {cleaningGarbage ? "Nettoyage..." : "🗑️ Nettoyer Ordures"}
                  </button>
                  <button 
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-maritime bg-maritime/5 px-4 py-2 rounded-full hover:bg-maritime/10 transition-all border border-maritime/10"
                  >
                    <RotateCw size={12} /> Actualiser tout
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {newsList.map(m => (
                  <div key={m.id} className="group relative aspect-[4/5] rounded-3xl overflow-hidden bg-slate-50 border border-slate-200 shadow-sm transition-all hover:shadow-2xl hover:shadow-slate-200 hover:-translate-y-1">
                    <div className="absolute top-3 left-3 z-10 flex gap-2">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[7px] font-black uppercase tracking-[0.2em] shadow-lg backdrop-blur-md border border-white/20",
                        m.processedType === 'video' ? "bg-emerald-500 text-white" : m.processedType === 'text' ? "bg-indigo-500 text-white" : "bg-white/90 text-black"
                      )}>
                        {m.processedType}
                      </span>
                    </div>
                    {m.processedType === 'video' ? (
                      isEmbedVideo(m.processedUrl) ? (
                        <iframe 
                          src={getEmbedUrl(m.processedUrl) + "?mute=1"} 
                          className="w-full h-full border-0 pointer-events-none" 
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          title={m.title}
                        />
                      ) : (
                        <video 
                          src={m.processedUrl || undefined} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                          controls
                          muted
                          playsInline
                        />
                      )
                    ) : m.processedType === 'text' ? (
                      <div className="p-8 h-full flex flex-col justify-center text-center bg-white">
                        <FileText size={32} className="mx-auto text-maritime opacity-10 mb-4" />
                        <p className="text-xs font-black uppercase leading-tight line-clamp-4 tracking-tight italic">"{m.title}"</p>
                      </div>
                    ) : (
                      <img src={m.processedUrl || undefined} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    )}
                    <div className="absolute inset-0 bg-maritime/90 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center p-8 text-center space-y-6 backdrop-blur-[2px]">
                      <div className="space-y-2">
                        <p className="text-[11px] font-black text-white uppercase tracking-tighter leading-tight italic">{m.title}</p>
                        <p className="text-[8px] font-bold text-white/60 uppercase tracking-widest line-clamp-1">{m.processedDesc.substring(0, 30)}...</p>
                      </div>
                      
                      <div className="flex flex-col items-center gap-4 w-full">
                        <div className="flex gap-4 text-[9px] font-black text-white/90 uppercase tracking-[0.2em] bg-white/10 px-4 py-2 rounded-full border border-white/10">
                          <span className="flex items-center gap-1.5"><Eye size={12} className="text-gold" /> {m.views || 0}</span>
                          <span className="w-[1px] h-3 bg-white/20" />
                          <div className="flex items-center gap-1.5"><MessageSquare size={12} className="text-gold" /> {m.commentsCount || 0}</div>
                        </div>

                        <div className="flex gap-3">
                          <button onClick={() => handleEditMedia(m)} className="w-12 h-12 bg-white text-maritime rounded-2xl flex items-center justify-center hover:bg-gold hover:text-black transition-all shadow-xl hover:scale-110 active:scale-90">
                            <Edit size={18} />
                          </button>
                          <button onClick={() => handleDeleteMedia(m.id)} className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center hover:bg-rose-600 transition-all shadow-xl hover:scale-110 active:scale-90">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : tab === 'messages' ? (
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[600px]">
            <div className="md:col-span-4 border-r border-slate-100 bg-slate-50/20">
               <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-md">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Conversations Actives</h3>
               </div>
               {conversations.length === 0 ? (
                 <div className="p-10 text-center opacity-30 mt-20">
                   <MessageSquare className="mx-auto mb-4" size={40} />
                   <p className="text-[10px] font-bold uppercase tracking-widest">Aucune discussion</p>
                 </div>
               ) : (
                 conversations.map(c => (
                   <button 
                     key={c.id}
                     onClick={() => setSelectedConv(c)}
                     className={cn(
                       "w-full p-6 text-left border-b border-slate-50 hover:bg-white transition-all flex gap-4 relative",
                       selectedConv?.id === c.id ? "bg-white border-l-4 border-l-black" : ""
                     )}
                   >
                     <div className="w-10 h-10 rounded-2xl bg-black text-white flex-shrink-0 flex items-center justify-center font-black text-xs uppercase shadow-lg shadow-black/10">
                       {c.userName?.charAt(0)}
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-center mb-1">
                         <h4 className="text-[11px] font-black uppercase truncate text-maritime">{c.userName}</h4>
                         <span className="text-[8px] font-bold text-slate-400">{formatDate(c.updatedAt)}</span>
                       </div>
                       <p className="text-[10px] text-slate-500 truncate italic font-medium">{c.lastMessage || 'Nouvelle conversation'}</p>
                       {c.adminUnreadCount > 0 && (
                         <div className="absolute top-6 right-6 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-rose-500/50 shadow-lg"></div>
                       )}
                     </div>
                   </button>
                 ))
               )}
            </div>
            <div className="md:col-span-8 flex flex-col h-[600px] bg-slate-50/30">
              {selectedConv ? (
                <AdminChatView conversation={selectedConv} />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center space-y-6 opacity-10">
                  <MessageSquareText size={80} />
                  <p className="text-sm font-black uppercase tracking-[0.5em]">Sélectionnez un passager</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-12 space-y-12">
            <div className="max-w-xl space-y-8">
              <div>
                <h3 className="text-2xl font-extrabold text-maritime uppercase tracking-tighter mb-2 italic">Charte Visuelle</h3>
                <p className="text-xs text-slate-500 leading-relaxed uppercase tracking-tight">Gestion des visuels emblématiques de la plateforme Mugote.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Fond d'écran Accueil</p>
                  <div className="aspect-video rounded-[32px] bg-slate-100 overflow-hidden relative border border-slate-200 group shadow-md">
                    {siteSettings?.homeBg && <img src={siteSettings.homeBg || undefined} className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-[2px]">
                      <input type="file" ref={bgInputRef} className="hidden" onChange={e => handleFileUpload(e, 'homeBg')} accept="image/*" />
                      <button onClick={() => bgInputRef.current?.click()} className="px-6 py-2.5 bg-white text-maritime text-[10px] font-bold rounded-xl shadow-xl uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                        {uploading === 'homeBg' ? "Téléchargement..." : "Remplacer"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Visuel de Détail</p>
                  <div className="aspect-video rounded-[32px] bg-slate-100 overflow-hidden relative border border-slate-200 group shadow-md">
                    {siteSettings?.homeDetail && <img src={siteSettings.homeDetail || undefined} className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-[2px]">
                      <input type="file" ref={detailInputRef} className="hidden" onChange={e => handleFileUpload(e, 'homeDetail')} accept="image/*" />
                      <button onClick={() => detailInputRef.current?.click()} className="px-6 py-2.5 bg-white text-maritime text-[10px] font-bold rounded-xl shadow-xl uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                        {uploading === 'homeDetail' ? "Téléchargement..." : "Remplacer"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Admin Code Update Section */}
              <div className="pt-8 border-t border-slate-100 flex flex-col gap-6">
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Code de Sécurité Administrateur</h4>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed max-w-sm mb-4">
                    Ce code protège l'accès aux panels de validation et de gestion de la flotte de la console d'administration.
                  </p>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      if (!newAdminCode.trim()) {
                        alert("Le code ne peut pas être vide.");
                        return;
                      }
                      await updateDoc(doc(db, 'settings', 'site'), {
                        adminCode: newAdminCode.trim()
                      });
                      alert("Code de sécurité mis à jour avec succès !");
                    } catch (error) {
                      console.error("Error updating admin code:", error);
                      alert("Erreur lors de la mise à jour du code de sécurité.");
                    }
                  }} className="flex gap-4 max-w-md">
                    <input 
                      required
                      type="text"
                      className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs uppercase tracking-widest font-black text-center focus:outline-none focus:border-black"
                      placeholder="Nouveau Code Sécu"
                      value={newAdminCode}
                      onChange={e => setNewAdminCode(e.target.value)}
                    />
                    <button type="submit" className="px-6 py-3.5 bg-black text-white hover:bg-slate-800 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all font-sans cursor-pointer">
                      Mettre à Jour
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </>
)}
</motion.div>
  );
}

function GalleryView({ siteSettings }: { siteSettings: any }) {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'video' | 'image' | 'text'>('all');

  useEffect(() => {
    const q = query(collection(db, 'news'), limit(1000));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        const type = (data.type || '').toLowerCase();
        const url = data.processedUrl || data.url || data.videoUrl || data.imageUrl || data.image || data.video || data.contentUrl || '';
        const isVideo = type === 'video' || !!(data.videoUrl || data.video) || (url && (url.toLowerCase().match(/\.(mp4|webm|ogg|mov|mkv|3gp|m4v|avi)(\?.*)?$/i) || url.toLowerCase().includes('youtube.com') || url.toLowerCase().includes('youtu.be') || url.toLowerCase().includes('vimeo.com') || (url.toLowerCase().includes('firebasestorage.googleapis.com') && (url.toLowerCase().includes('.mov') || url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('video') || url.toLowerCase().includes('.webm') || url.toLowerCase().includes('.avi')))));

        return {
          ...data,
          id: doc.id,
          processedUrl: url,
          processedType: isVideo ? 'video' : (type === 'text' && !url ? 'text' : 'image'),
          processedDesc: data.desc || data.content || data.description || data.text || '',
          sortDate: data.publishedAt || data.updatedAt || data.createdAt || { seconds: 0 }
        };
      }).filter((item: any) => item.title && item.title.trim() !== "");

      setMedia(items.sort((a, b) => {
        const ta = a.sortDate?.seconds || 0;
        const tb = b.sortDate?.seconds || 0;
        return tb - ta;
      }));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredMedia = filter === 'all' ? media : media.filter(m => m.processedType === filter);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12 bg-slate-950 p-4 md:p-12 rounded-[40px] border border-white/5 shadow-2xl">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-extrabold tracking-tighter uppercase italic text-white underline decoration-gold/30 underline-offset-8">Galerie Officielle</h2>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold font-black">Expérience immersive Mugote</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {['all', 'video', 'image', 'text'].map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f as any)}
              className={cn(
                "px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                filter === f ? "bg-gold text-black scale-110 shadow-xl shadow-gold/10" : "text-slate-400 hover:text-white bg-white/5"
              )}
            >
              {f === 'all' ? 'Tout' : f === 'video' ? 'Vidéos' : f === 'image' ? 'Photos' : 'Textes'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 animate-pulse text-[10px] font-black uppercase tracking-widest">Initialisation du flux...</div>
      ) : filteredMedia.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-[10px] font-black uppercase tracking-widest border border-dashed border-white/15 rounded-3xl">Aucun contenu trouvé dans cette catégorie</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredMedia.map((m, i) => (
            <motion.div 
              layout
              key={m.id} 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-black border border-white/5 shadow-2xl rounded-3xl overflow-hidden flex flex-col group hover:border-gold transition-all duration-550"
            >
              <div className="aspect-[16/10] bg-slate-900 relative overflow-hidden">
                {m.processedType === 'video' ? (
                  <div className="w-full h-full relative">
                    {isEmbedVideo(m.processedUrl) ? (
                      <iframe 
                        src={getEmbedUrl(m.processedUrl)} 
                        className="w-full h-full border-0 bg-transparent" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={m.title}
                      />
                    ) : (
                      <video 
                        src={m.processedUrl || undefined} 
                        className="w-full h-full object-cover"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    )}
                    <div className="absolute top-4 right-4 z-10 pointer-events-none">
                       <div className="w-8 h-8 rounded-full bg-gold/90 text-black flex items-center justify-center shadow-lg animate-pulse">
                         <Video size={14} />
                       </div>
                    </div>
                  </div>
                ) : m.processedType === 'image' ? (
                  <div className="w-full h-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar bg-slate-900">
                    {(m.media && m.media.length > 0 ? m.media : [m.processedUrl]).map((img: string, idx: number) => (
                      <img 
                        key={idx} 
                        src={img || undefined} 
                        className="w-full h-full object-cover snap-center flex-shrink-0 transition-transform duration-700 group-hover:scale-110" 
                        alt={`${m.title}-${idx}`} 
                      />
                    ))}
                    {m.media && m.media.length > 1 && (
                      <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[8px] font-black text-white uppercase tracking-widest">
                        {m.media.length} Photos
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-black text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gold opacity-50" />
                    <MessageSquareText size={32} className="text-gold mb-4 opacity-20" />
                    <p className="text-white text-[11px] font-bold uppercase tracking-widest line-clamp-6 leading-relaxed opacity-80 italic">"{m.processedDesc}"</p>
                  </div>
                )}
              </div>
              <div className="p-8 flex-1 flex flex-col bg-gradient-to-b from-[#001233]/10 to-transparent">
                <div className="mb-4">
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter leading-none italic group-hover:text-gold transition-colors">{m.title}</h3>
                  <div className="h-1 w-8 bg-gold/20 mt-2 rounded-full" />
                </div>
                <p className="text-white/60 text-[10px] font-bold leading-relaxed line-clamp-2 italic">{m.processedDesc}</p>
                <div className="mt-8 pt-4 border-t border-white/5 flex flex-wrap justify-between items-center text-[8px] font-black uppercase tracking-wider gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1.5 text-slate-400"><Clock size={10} /> {m.publishedAt ? (m.publishedAt.seconds ? new Date(m.publishedAt.seconds * 1000).toLocaleDateString() : new Date(m.publishedAt).toLocaleDateString()) : 'N/A'}</span>
                    <span className="flex items-center gap-1.5 text-slate-400"><Eye size={10} /> {m.views || 0} vues</span>
                    <MediaLikes newsId={m.id} initialLikes={m.likes || 0} />
                  </div>
                  <NewsComments newsId={m.id} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function NewsComments({ newsId }: { newsId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'news', newsId, 'comments'));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
      items.sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
      setComments(items);
      setCount(snapshot.size);
    });
    return unsub;
  }, [newsId]);

  // View increment logic
  useEffect(() => {
    const incrementView = async () => {
      const viewedKey = `viewed_${newsId}`;
      if (!localStorage.getItem(viewedKey)) {
        try {
          await updateDoc(doc(db, 'news', newsId), {
            views: increment(1),
            viewsCount: increment(1)
          });
          localStorage.setItem(viewedKey, 'true');
        } catch (e) {
          console.error("Failed to increment views", e);
        }
      }
    };
    incrementView();
  }, [newsId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newComment.trim()) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'news', newsId, 'comments'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Utilisateur',
        text: newComment,
        createdAt: serverTimestamp()
      });
      // Increment comment count on parent doc
      await updateDoc(doc(db, 'news', newsId), {
        commentsCount: increment(1)
      });
      setNewComment('');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `news/${newsId}/comments`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 hover:text-gold transition-colors"
      >
        <MessageCircle size={12} className="text-gold" /> {count} commentaires
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
          >
            <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-[32px] overflow-hidden flex flex-col max-h-[80vh] shadow-2xl">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
                <h4 className="text-sm font-black uppercase tracking-widest text-white italic">Commentaires</h4>
                <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {comments.length === 0 ? (
                  <div className="text-center py-12 opacity-20">
                    <MessageCircle size={40} className="mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Aucun commentaire pour le moment</p>
                  </div>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="space-y-2 group">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-gold uppercase italic">{c.userName}</span>
                        <span className="text-[8px] font-bold text-white/20 uppercase">{c.createdAt ? new Date(c.createdAt.seconds * 1000).toLocaleString() : 'Envoi...'}</span>
                      </div>
                      <p className="text-xs text-white/70 leading-relaxed font-medium bg-white/5 p-3 rounded-2xl group-hover:bg-white/10 transition-colors">{c.text}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 border-t border-white/5 bg-black/20">
                {auth.currentUser ? (
                  <form onSubmit={handleSubmit} className="relative">
                    <input 
                      required
                      placeholder="Votre commentaire..."
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-gold text-white text-xs font-medium pr-16"
                    />
                    <button 
                      disabled={submitting || !newComment.trim()}
                      className="absolute right-2 top-2 bottom-2 px-4 bg-gold text-black rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:scale-105 active:scale-95 transition-all"
                    >
                      {submitting ? "..." : "Publier"}
                    </button>
                  </form>
                ) : (
                  <div className="text-center py-2 bg-rose-500/10 rounded-xl border border-rose-500/20">
                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Connectez-vous pour commenter</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MediaLikes({ newsId, initialLikes = 0 }: { newsId: string, initialLikes?: number }) {
  const [likes, setLikes] = useState(initialLikes);
  const [hasLiked, setHasLiked] = useState(false);

  useEffect(() => {
    setHasLiked(localStorage.getItem(`liked_${newsId}`) === 'true');
    const unsub = onSnapshot(doc(db, 'news', newsId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.likes !== undefined) {
          setLikes(data.likes);
        } else if (data.likesCount !== undefined) {
          setLikes(data.likesCount);
        }
      }
    });
    return unsub;
  }, [newsId]);

  const handleLike = async () => {
    const likedKey = `liked_${newsId}`;
    const currentlyLiked = localStorage.getItem(likedKey) === 'true';
    try {
      if (currentlyLiked) {
        await updateDoc(doc(db, 'news', newsId), {
          likes: increment(-1),
          likesCount: increment(-1)
        });
        localStorage.removeItem(likedKey);
        setHasLiked(false);
      } else {
        await updateDoc(doc(db, 'news', newsId), {
          likes: increment(1),
          likesCount: increment(1)
        });
        localStorage.setItem(likedKey, 'true');
        setHasLiked(true);
      }
    } catch (e) {
      console.error("Error liking item:", e);
    }
  };

  return (
    <button 
      onClick={handleLike}
      className="flex items-center gap-1.5 hover:text-rose-500 text-slate-400 hover:scale-105 active:scale-95 transition-all cursor-pointer font-extrabold uppercase text-[10px] tracking-widest bg-transparent border-0"
    >
      <Heart size={12} className={hasLiked ? "text-rose-500 fill-rose-500 scale-110" : "text-slate-400"} />
      <span>{likes || 0} Likes</span>
    </button>
  );
}

function NewsView() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'news'), limit(1000));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        const type = (data.type || '').toLowerCase();
        const url = data.processedUrl || data.url || data.videoUrl || data.imageUrl || data.image || data.video || data.contentUrl || '';
        const isVideo = type === 'video' || !!(data.videoUrl || data.video) || (url && (url.toLowerCase().match(/\.(mp4|webm|ogg|mov|mkv|3gp|m4v|avi)(\?.*)?$/i) || url.toLowerCase().includes('youtube.com') || url.toLowerCase().includes('youtu.be') || url.toLowerCase().includes('vimeo.com') || (url.toLowerCase().includes('firebasestorage.googleapis.com') && (url.toLowerCase().includes('.mov') || url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('video') || url.toLowerCase().includes('.webm') || url.toLowerCase().includes('.avi')))));

        return {
          ...data,
          id: doc.id,
          processedUrl: url,
          processedType: isVideo ? 'video' : (type === 'text' && !url ? 'text' : 'image'),
          processedDesc: data.desc || data.content || data.description || data.text || '',
          sortDate: data.publishedAt || data.updatedAt || data.createdAt || { seconds: 0 }
        };
      }).filter((item: any) => item.title && item.title.trim() !== "");

      setNews(items.sort((a, b) => {
        const ta = a.sortDate?.seconds || 0;
        const tb = b.sortDate?.seconds || 0;
        return tb - ta;
      }));
      setLoading(false);
    }, (error) => {
      console.error("News view error:", error);
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12 bg-slate-950 p-8 rounded-[32px] border border-white/5 shadow-2xl">
      <div className="border-b border-white/10 pb-6 text-center">
        <h2 className="text-xl font-extrabold tracking-tighter uppercase mb-1.5 italic text-white underline decoration-gold/30 underline-offset-8">Flux d'Actualités</h2>
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Informations officielles et mises à jour système</p>
      </div>
      
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Chargement...</div>
      ) : news.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Aucune actualité publiée.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {news.map((n, i) => (
            <div key={i} className="bg-black border border-white/5 shadow-2xl shadow-black/50 rounded-xl overflow-hidden group hover:border-gold transition-all flex flex-col text-center items-center">
              <div className="p-8 flex-1 flex flex-col justify-between w-full items-center">
                <div className="space-y-4 w-full flex flex-col items-center">
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.3em] text-gold block text-center">{n.processedType === 'text' ? 'Actualité' : n.processedType === 'image' ? 'Photo' : 'Vidéo'}</span>
                  <h3 className="text-xl font-extrabold tracking-tighter leading-none text-white group-hover:text-gold transition-colors italic text-center mx-auto">{n.title}</h3>
                  <p className="text-white/60 text-xs font-medium leading-relaxed text-center mx-auto max-w-md">{n.processedDesc}</p>
                  <div className="flex flex-wrap items-center justify-center gap-4 text-[9px] font-black uppercase tracking-widest text-white/30 pt-4 border-t border-white/5 w-full">
                    <span className="flex items-center gap-1.5"><Eye size={12} className="text-gold" /> {n.views || 0} vues</span>
                    <MediaLikes newsId={n.id} initialLikes={n.likes || 0} />
                    <NewsComments newsId={n.id} />
                  </div>
                </div>
              </div>
              {(n.processedUrl || n.processedType === 'text') && (
                <div className="h-72 overflow-hidden flex items-center justify-center border-t border-white/5 relative w-full">
                  {n.processedType === 'video' ? (
                    <video 
                      key={n.processedUrl}
                      src={n.processedUrl || undefined}
                      className="w-full h-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                    >
                      {n.processedUrl ? (
                        <>
                          <source src={n.processedUrl} type="video/mp4" />
                          <source src={n.processedUrl} type="video/quicktime" />
                          <source src={n.processedUrl} type="video/webm" />
                        </>
                      ) : null}
                      Votre navigateur ne supporte pas la lecture de vidéos.
                    </video>
                  ) : n.processedType === 'image' ? (
                    <div className="w-full h-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar bg-transparent">
                      {(n.media && n.media.length > 0 ? n.media : [n.processedUrl]).map((img: string, idx: number) => (
                        <img 
                          key={idx} 
                          src={img || undefined} 
                          className="w-full h-full object-cover snap-center flex-shrink-0 transition-transform group-hover:scale-105" 
                          alt={`${n.title}-${idx}`} 
                        />
                      ))}
                      {n.media && n.media.length > 1 && (
                        <div className="absolute top-4 right-4 bg-gold px-2 py-1 rounded text-[8px] font-black text-black uppercase tracking-widest shadow-xl">
                          {n.media.length} PHOTOS
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-10 text-center space-y-4">
                      <FileText size={32} className="mx-auto text-gold opacity-20" />
                      <p className="text-white text-sm font-medium leading-relaxed max-w-md italic line-clamp-6">"{n.processedDesc}"</p>
                    </div>
                  )}
                </div>
              )}
                    <div className="px-5 py-4 border-t border-white/5 bg-white/5 flex flex-col sm:flex-row justify-between items-center text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-slate-500 gap-2 sm:gap-0">
                      <span>{n.publishedAt ? (n.publishedAt.seconds ? new Date(n.publishedAt.seconds * 1000).toLocaleDateString() : new Date(n.publishedAt).toLocaleDateString()) : 'N/A'}</span>
                      {n.processedUrl && (
                        <a href={n.processedUrl} target="_blank" className="text-gold flex items-center gap-1.5 hover:translate-x-1 transition-transform">En savoir plus <ChevronRight size={12} /></a>
                      )}
                    </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function MyTickets({ user, siteSettings }: { user: FirebaseUser | null, siteSettings: { homeBg: string } }) {
  const [tickets, setTickets] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'reservations'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTickets(snapshot.docs.map(doc => ({ ...doc.data() as Reservation, id: doc.id })));
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  const generateTicketPDF = async (res: Reservation) => {
    generateTicket(res, siteSettings);
  };

  const handleRequestCancellation = async (resId: string) => {
    if (!window.confirm("Voulez-vous vraiment demander l'annulation de cette réservation ? Cette demande sera soumise à l'approbation de l'administrateur.")) return;
    try {
      await updateDoc(doc(db, 'reservations', resId), {
        cancellationRequested: true,
        cancellationStatus: 'pending',
        cancellationRequestedAt: serverTimestamp()
      });
      alert("Demande d'annulation envoyée avec succès.");
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, 'reservations');
    }
  };

  if (!user) return <div className="p-10 sm:p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px] sm:text-xs">Connectez-vous pour voir vos billets.</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 sm:space-y-10">
      <div className="border-b border-slate-200 pb-4 sm:pb-6 text-center">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tighter uppercase mb-1 sm:mb-1.5 italic">Mes Billets</h2>
        <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-slate-400 font-bold px-4">Historique de vos réservations et billets digitaux</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {loading ? (
          <div className="col-span-2 text-center py-10 sm:py-16 text-slate-400 animate-pulse uppercase text-[8px] sm:text-[10px] font-bold tracking-widest">Chargement...</div>
        ) : tickets.length === 0 ? (
          <div className="col-span-2 text-center py-10 sm:py-16 text-slate-400 uppercase text-[8px] sm:text-[10px] font-bold tracking-widest border border-dashed border-slate-200 rounded-xl mx-4">Aucun billet trouvé.</div>
        ) : (
          tickets.map(res => {
            let classCardStyle = "bg-white border-slate-100 shadow-sm";
            let classStubStyle = "bg-slate-50 border-slate-100";
            
            if (res.travelClass === 'VIP') {
              classCardStyle = "bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-amber-500/10 border-amber-300 shadow-amber-500/5 hover:border-amber-400";
              classStubStyle = "bg-amber-600/10 border-amber-200/55";
            } else if (res.travelClass === '1ère Classe') {
              classCardStyle = "bg-gradient-to-br from-blue-600/5 via-indigo-600/2 to-indigo-600/5 border-blue-200 shadow-sm hover:border-blue-400";
              classStubStyle = "bg-blue-600/10 border-blue-200/55";
            } else if (res.travelClass === '2ème Classe') {
              classCardStyle = "bg-gradient-to-br from-cyan-600/5 via-teal-600/2 to-teal-600/5 border-teal-200 shadow-sm hover:border-teal-400";
              classStubStyle = "bg-cyan-600/10 border-teal-200/55";
            } else {
              classCardStyle = "bg-gradient-to-br from-slate-100/50 via-zinc-50/10 to-slate-100/50 border-slate-200 shadow-sm hover:border-slate-350";
              classStubStyle = "bg-slate-100/60 border-slate-200/55";
            }

            return (
              <div key={res.id} className={cn("border rounded-xl overflow-hidden flex flex-col sm:flex-row transition-all hover:shadow-md group mx-0 sm:mx-0 relative", classCardStyle)}>
                <div className={cn("w-full sm:w-28 flex flex-row sm:flex-col items-center justify-center p-4 border-b sm:border-b-0 sm:border-r gap-4 sm:gap-0", classStubStyle)}>
                  {res.status === 'VALIDATED' ? (
                    <QRCodeSVG value={`https://${window.location.host}/?verify=${res.id}`} size={64} className="sm:size-16" />
                  ) : (
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-100 flex items-center justify-center text-slate-300 rounded-lg border border-slate-200">
                      <QrCode size={24} className="sm:w-8 sm:h-8" />
                    </div>
                  )}
                  <p className="text-[7px] font-bold uppercase tracking-widest text-slate-500 sm:mt-3 text-center">DGM Verify</p>
                </div>
                <div className="flex-1 p-4 sm:p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full border-2 border-white bg-slate-100 overflow-hidden shrink-0 shadow-sm">
                          <img 
                            referrerPolicy="no-referrer"
                            src={(siteSettings as any)?.homeDetail || "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop"} 
                            className="w-full h-full object-cover" 
                            alt="Mugote Lac"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                             <h3 className="text-xs sm:text-sm font-extrabold tracking-tighter uppercase truncate text-slate-800">{res.fullName} {res.lastName}</h3>
                             <span className="text-[8px] sm:text-[9px] font-mono text-slate-400">#{res.ticketId || 'ID-'+res.id?.substring(0,6).toUpperCase()}</span>
                          </div>
                          <div className="mt-1">
                            <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full text-white" 
                                  style={{ backgroundColor: CLASS_COLORS[res.travelClass]?.main || '#ccc' }}>
                              {res.travelClass}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3.5 space-y-1">
                        <p className="text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-tight">{res.travelDate} • {res.departureTime} • {res.ship}</p>
                        {res.transactionId && (
                          <p className="text-[7px] text-slate-400 font-mono italic">TX: {res.transactionId}</p>
                        )}
                      </div>
                    </div>
                    <span className={cn(
                      "text-[7px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 border rounded-sm flex-shrink-0",
                      res.status === 'VALIDATED' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : 
                      res.status === 'PENDING' ? "bg-amber-50 text-amber-600 border-amber-200" : 
                      "bg-red-50 text-red-600 border-red-200"
                    )}>
                      {res.status}
                    </span>
                  </div>
                <div className="flex items-end justify-between pt-3 sm:pt-4 border-t border-slate-50 gap-2">
                  <div className="text-left min-w-0">
                    <p className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Itinéraire</p>
                    <p className="text-[9px] sm:text-[11px] font-extrabold text-maritime uppercase truncate">{res.itinerary}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total</p>
                    <p className="text-sm sm:text-base font-extrabold text-maritime mono tracking-tighter">{res.amount}$</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {res.status === 'VALIDATED' && !(res as any).cancellationRequested && (
                      <button 
                        onClick={() => generateTicketPDF(res)}
                        className="px-3 sm:px-4 py-1.5 bg-maritime text-white text-[7px] sm:text-[8px] font-bold uppercase tracking-widest rounded-lg hover:bg-maritime-dark transition-all flex-shrink-0 shadow-md"
                      >
                        Billet
                      </button>
                    )}
                    {['VALIDATED', 'PENDING'].includes(res.status) && !(res as any).cancellationRequested && (
                      <button 
                        onClick={() => handleRequestCancellation(res.id!)}
                        className="px-3 sm:px-4 py-1.5 border border-rose-200 text-rose-500 text-[7px] sm:text-[8px] font-bold uppercase tracking-widest rounded-lg hover:bg-rose-50 transition-all flex-shrink-0"
                      >
                        Annuler
                      </button>
                    )}
                    {(res as any).cancellationRequested && (res as any).cancellationStatus === 'pending' && (
                      <span className="px-3 py-1.5 bg-rose-50 text-rose-500 text-[6px] sm:text-[7px] font-black uppercase tracking-widest rounded-lg border border-rose-100 flex items-center gap-1">
                        <Clock size={8} /> En attente d'annulation
                      </span>
                    )}
                    {(res as any).cancellationStatus === 'approved' && (
                      <span className="px-3 py-1.5 bg-rose-100 text-rose-700 text-[6px] sm:text-[7px] font-black uppercase tracking-widest rounded-lg border border-rose-200">
                        Annulation Approuvée
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })
        )}
      </div>
    </motion.div>
  );
}

function VerificationView({ id, onClose }: { id: string, onClose: () => void }) {
  const [res, setRes] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'reservations', id));
        if (docSnap.exists()) {
          setRes(docSnap.data() as Reservation);
        }
      } catch (error) {
        console.error("Verification failed", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [id]);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto py-6 sm:py-12 px-4 shadow-none">
      <div className="bg-white border border-slate-200 shadow-2xl rounded-sm overflow-hidden border-t-8 border-maritime">
        <div className="p-6 sm:p-12 text-center border-b border-slate-100">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-maritime/5 text-maritime rounded-sm flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <ShieldCheck size={32} className="sm:size-10" />
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold tracking-tighter uppercase mb-1 sm:mb-2">Vérification de Billet</h2>
          <p className="text-[9px] sm:text-[11px] uppercase tracking-widest text-slate-400 font-bold">Système Officiel AMR MUGOTE / DGM</p>
        </div>

        <div className="p-6 sm:p-12 space-y-6 sm:space-y-8">
          {loading ? (
            <div className="text-center py-6 sm:py-10 animate-pulse text-slate-400 uppercase text-[10px] sm:text-xs font-bold tracking-widest">Recherche...</div>
          ) : !res ? (
            <div className="text-center py-6 sm:py-10 text-red-500 uppercase text-xs sm:text-sm font-extrabold tracking-widest">
              Alerte : Billet Invalide
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                <div className="col-span-1 sm:col-span-2 border-b border-slate-50 pb-4 sm:border-0 sm:pb-0">
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Statut</p>
                  <span className={cn(
                    "inline-block px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-extrabold uppercase tracking-widest border rounded-sm",
                    res.status === 'VALIDATED' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200"
                  )}>
                    {res.status === 'VALIDATED' ? 'OFFICIELLEMENT VALIDÉ' : 'EN ATTENTE'}
                  </span>
                </div>
                <div>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">Ticket ID</p>
                  <p className="text-sm sm:text-lg font-extrabold mono tracking-tighter uppercase">#{res.ticketId || 'N/A'}</p>
                </div>
                <div className="pt-4 sm:pt-6 border-t border-slate-50 sm:border-0 sm:pt-0">
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">Passager</p>
                  <p className="text-lg sm:text-2xl font-extrabold tracking-tighter uppercase truncate">{res.fullName} {res.lastName}</p>
                </div>
                <div className="pt-4 sm:pt-6 border-t border-slate-50">
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">Itinéraire</p>
                  <p className="text-base sm:text-lg font-extrabold tracking-tighter uppercase">{res.itinerary}</p>
                </div>
                <div className="pt-4 sm:pt-6 border-t border-slate-50">
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">Bateau</p>
                  <p className="text-base sm:text-lg font-extrabold tracking-tighter uppercase">{res.ship}</p>
                </div>
                <div className="pt-4 sm:pt-6 border-t border-slate-50">
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">Date</p>
                  <p className="text-base sm:text-lg font-extrabold mono tracking-tighter">{res.travelDate}</p>
                </div>
                <div className="pt-4 sm:pt-6 border-t border-slate-50">
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">Montant</p>
                  <p className="text-base sm:text-lg font-extrabold tracking-tighter uppercase">{res.amount}.00 $</p>
                </div>
                {res.transactionId && (
                  <div className="pt-4 sm:pt-6 border-t border-slate-50 col-span-1 sm:col-span-2">
                    <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">ID Transaction (Confirmé)</p>
                    <p className="text-sm sm:text-base font-extrabold font-mono tracking-widest text-maritime bg-slate-50 p-2 border border-slate-100 rounded-lg">{res.transactionId}</p>
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-6 bg-slate-50 border border-slate-100 rounded-sm overflow-hidden">
                <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 sm:mb-4">Empreinte Digitale</p>
                <div className="text-[8px] sm:text-[10px] mono text-slate-600 break-all space-y-1">
                  <p>ID: {res.id}</p>
                  <p>TX: {res.transactionId}</p>
                  <p>USR: {res.userId?.substring(0,10)}...</p>
                </div>
              </div>
            </>
          )}

          <button 
            onClick={onClose}
            className="w-full py-4 bg-slate-900 text-white text-[9px] sm:text-[10px] font-extrabold uppercase tracking-[0.3em] rounded-sm hover:bg-black transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function playBeep(success: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (success) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1000, ctx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.12);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    console.warn("Audio Context beep fail", e);
  }
}

interface AdminScannerViewProps {
  reservations: Reservation[];
}

function AdminScannerView({ reservations }: AdminScannerViewProps) {
  const [scannedRes, setScannedRes] = useState<Reservation | null>(null);
  const [manualId, setManualId] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scannedList, setScannedList] = useState<Reservation[]>([]);
  
  // Advanced Scan State Management
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'alert_reused' | 'alert_unpaid' | 'error_not_found'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const scanner = new Html5QrcodeScanner("admin-qr-reader", {
      fps: 10,
      qrbox: { width: 220, height: 220 },
      rememberLastUsedCamera: true,
      supportedScanTypes: [0] // Camera scan type only
    }, false);

    const onScanSuccess = (decodedText: string) => {
      console.log("Decoded QR:", decodedText);
      
      let id = decodedText;
      
      // Parse JSON if the QR contains JSON-structured text (e.g. from bottom ticket barcode)
      if (decodedText.startsWith('{') && decodedText.endsWith('}')) {
        try {
          const parsed = JSON.parse(decodedText);
          if (parsed.id) {
            id = parsed.id;
          }
        } catch (e) {
          console.warn("Could not parse JSON ticket payload from QR:", e);
        }
      } else if (decodedText.includes('verify=')) {
        try {
          const match = decodedText.match(/[?&]verify=([a-zA-Z0-9_\-]+)/);
          if (match && match[1]) {
            id = match[1];
          } else {
            const url = new URL(decodedText);
            id = url.searchParams.get('verify') || decodedText;
          }
        } catch {
          const parts = decodedText.split('verify=');
          if (parts[1]) {
            id = parts[1].split('&')[0];
          }
        }
      }

      handleSearch(id);
    };

    const onScanFailure = (error: any) => {
      // Quietly ignore frame scan logs
    };

    scanner.render(onScanSuccess, onScanFailure);

    return () => {
      scanner.clear().catch(err => console.warn("Scanner shutdown notice:", err));
    };
  }, [reservations]);

  const handleSearch = async (id: string) => {
    if (!id || !id.trim()) return;
    const cleanId = id.trim();
    
    setLoading(true);
    setSearchError(null);
    setScanStatus('idle');
    setStatusMessage('');

    try {
      // 1. Instantly check locally + retrieve freshets snapshot from the database to prevent duplicate bypasses
      const foundInProps = reservations.find(r => r.id === cleanId || r.ticketId === cleanId);
      const targetId = foundInProps?.id || cleanId;
      
      const docRef = doc(db, 'reservations', targetId);
      const docSnap = await getDoc(docRef);
      
      let ticketData: any = null;
      if (docSnap.exists()) {
        ticketData = { ...docSnap.data(), id: docSnap.id };
      } else if (foundInProps) {
        ticketData = foundInProps;
      }
      
      if (!ticketData) {
        setScanStatus('error_not_found');
        setStatusMessage(`Billet ou identifiant "${cleanId}" introuvable ou invalide dans la base d'administration.`);
        setScannedRes(null);
        setSearchError(`Code billet introuvable.`);
        playBeep(false);
        return;
      }
      
      setScannedRes(ticketData);

      // 2. Perform the strict requirements validation: exists, paid/validated, and not used yet
      const isPaid = ticketData.status === 'VALIDATED';
      const isAlreadyUsed = ticketData.boardingStatus === 'BOARDED';

      if (!isPaid) {
        // Condition: Payment validation fails
        setScanStatus('alert_unpaid');
        setStatusMessage("EMBARQUEMENT REFUSÉ : Le paiement de cette réservation n'est pas validé. Veuillez orienter le passager vers le guichet.");
        playBeep(false);
        return;
      }

      if (isAlreadyUsed) {
        // Condition: Fraud security check fails (already boarded)
        setScanStatus('alert_reused');
        const formattedDate = ticketData.boardedAt ? new Date(ticketData.boardedAt).toLocaleString() : 'N/A';
        setStatusMessage(`ALERTE DANGER FRAUDE : Ce billet a déjà été utilisé pour l'embarquement le ${formattedDate}. Double accès strictement interdit !`);
        playBeep(false);
        return;
      }

      // 3. Automated marking as completed & used to secure transit
      const updateTimestamp = Date.now();
      await updateDoc(doc(db, 'reservations', ticketData.id), {
        boardingStatus: 'BOARDED',
        boardedAt: updateTimestamp
      });

      const updatedTicket = {
        ...ticketData,
        boardingStatus: 'BOARDED' as const,
        boardedAt: updateTimestamp
      };

      setScannedRes(updatedTicket);
      setScanStatus('success');
      setStatusMessage("ACCÈS ACCORDÉ : Billet valide et payé ! Passager autorisé à embarquer, billet marqué comme utilisé avec succès.");
      setScannedList(prev => [updatedTicket, ...prev.filter(x => x.id !== updatedTicket.id)]);
      playBeep(true);

    } catch (err: any) {
      console.error("Scanning process failed:", err);
      setScanStatus('error_not_found');
      setStatusMessage(`Erreur de connexion instantanée lors de la vérification : ${err.message}`);
      playBeep(false);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.trim()) {
      handleSearch(manualId);
    }
  };

  // Revert/Cancel boarding function for administrative override
  const handleCancelBoarding = async (ticket: Reservation) => {
    if (!ticket || !ticket.id) return;
    const confirmRevert = window.confirm(`Voulez-vous annuler l'embarquement de ${ticket.fullName} et réactiver ce billet ?`);
    if (!confirmRevert) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'reservations', ticket.id), {
        boardingStatus: 'PENDING',
        boardedAt: null
      });

      const restoredTicket = {
        ...ticket,
        boardingStatus: 'PENDING' as any,
        boardedAt: undefined
      };

      if (scannedRes && scannedRes.id === ticket.id) {
        setScannedRes(restoredTicket);
        setScanStatus('idle');
        setStatusMessage('L\'embarquement a été annulé par l\'administrateur. Le billet est à nouveau actif.');
      }

      setScannedList(prev => prev.map(x => x.id === ticket.id ? restoredTicket : x));
      alert("Embarquement annulé avec succès. Billet réactivé.");
    } catch (err: any) {
      console.error("Revert boarding failed:", err);
      alert("Erreur lors de l'annulation de l'embarquement : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-10 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b pb-4 border-slate-100">
        <div className="text-left">
          <h3 className="text-xl sm:text-2xl font-black uppercase text-maritime tracking-tight italic">Scanner d'embarquement (Vérification et Embargo Fraude)</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 leading-relaxed">
            Système d'embarquement lacustre automatique connecté en temps réel • Validation en 1 clic
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">Aiguillage optique actif</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Camera vision interface */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-950 p-4 rounded-[28px] border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col items-center">
            <span className="text-[#eab308] text-[7px] font-black tracking-[0.3em] uppercase mb-2">Lecteur Vidéo QR Code</span>
            
            <div id="admin-qr-reader" className="w-full max-w-xs aspect-square bg-[#0c101a] rounded-xl overflow-hidden border border-slate-800 shadow-inner">
            </div>

            <div className="w-full pt-3 text-center text-[7px] font-black text-slate-500 uppercase tracking-widest">
              <span>Positionnez le QR Code du client face à l'objectif</span>
            </div>
          </div>

          {/* Saisie manuelle de secours */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3 text-left">
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Recherche Manuelle Secours</p>
            <form onSubmit={handleManualSearchSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Identifiant ou ID du Billet..."
                value={manualId}
                onChange={e => setManualId(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-gold font-bold text-[10px]"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-slate-900 text-white uppercase text-[8px] font-black tracking-widest rounded-lg hover:bg-black transition-all"
              >
                Vérifier
              </button>
            </form>
            {searchError && (
              <p className="text-[9px] text-rose-500 font-bold uppercase tracking-wide leading-tight">{searchError}</p>
            )}
          </div>
        </div>

        {/* Right Column: Processing logs & visual indicators */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Main Visual Scan Response Banner */}
          {scanStatus !== 'idle' && (
            <div className={cn(
              "p-5 rounded-2xl border-2 text-left flex flex-col sm:flex-row items-start gap-4 transition-all duration-300",
              scanStatus === 'success' && "bg-emerald-50/70 border-emerald-500 text-emerald-900",
              scanStatus === 'alert_reused' && "bg-rose-50 border-rose-500 text-rose-900 animate-bounce",
              scanStatus === 'alert_unpaid' && "bg-amber-50 border-amber-500 text-amber-900",
              scanStatus === 'error_not_found' && "bg-slate-100 border-slate-350 text-slate-800",
              scanStatus === 'loading' && "bg-sky-50 border-sky-400 text-sky-950"
            )}>
              <div className="flex-shrink-0 mt-0.5">
                {scanStatus === 'success' && <CheckCircle2 className="text-emerald-600" size={28} />}
                {scanStatus === 'alert_reused' && <AlertCircle className="text-rose-600" size={28} />}
                {scanStatus === 'alert_unpaid' && <AlertCircle className="text-[#eab308]" size={28} />}
                {scanStatus === 'error_not_found' && <AlertCircle className="text-slate-500" size={28} />}
                {scanStatus === 'loading' && <RotateCw className="text-sky-500 animate-spin" size={28} />}
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-widest leading-none">
                  {scanStatus === 'success' && "EMBARQUEMENT ACCORDÉ"}
                  {scanStatus === 'alert_reused' && "ALERTE FRAUDE DÉTECTÉE"}
                  {scanStatus === 'alert_unpaid' && "RÈGLEMENT DE PAIEMENT REQUIS"}
                  {scanStatus === 'error_not_found' && "TENTATIVE INVALIDE"}
                  {scanStatus === 'loading' && "VÉRIFICATION INSTANTANÉE..."}
                </h4>
                <p className="text-xs font-bold leading-normal">{statusMessage}</p>
              </div>
            </div>
          )}

          {scannedRes ? (
            <div className="bg-white border-2 border-slate-900 rounded-[24px] p-5 sm:p-6 space-y-4 shadow-lg relative overflow-hidden text-left">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-gold to-[#0047AB]" />
              
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="space-y-1">
                  <span className={cn(
                    "px-2.5 py-0.5 text-[7px] font-black uppercase tracking-widest rounded-md border inline-block",
                    scannedRes.boardingStatus === 'BOARDED' 
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                      : scannedRes.status === 'VALIDATED' 
                      ? "bg-[#eab308]/10 text-amber-600 border-[#eab308]/20 animate-pulse"
                      : "bg-rose-50 text-rose-500 border-rose-100"
                  )}>
                    {scannedRes.boardingStatus === 'BOARDED' ? '🚢 EMBARQUÉ & SÉCURISÉ' : 'Non embarqué'}
                  </span>
                  <h4 className="text-lg font-black uppercase tracking-tight text-slate-900 leading-tight">{scannedRes.fullName} {scannedRes.lastName}</h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Tél Contact: {scannedRes.phone || 'Non renseigné'}</p>
                </div>
                <div className="text-left sm:text-right flex-shrink-0">
                  <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Identifiant du Billet</p>
                  <p className="text-sm font-black text-gold font-mono tracking-wider">{scannedRes.ticketId || scannedRes.id?.substring(0,8).toUpperCase()}</p>
                </div>
              </div>

              <div className="h-px bg-slate-100 my-2" />

              {/* Status Compliance Checklist */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-[10px] font-bold uppercase transition-all">
                <h5 className="text-[8px] font-black text-slate-400 tracking-wider">Spécifications d'Accréditation</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    <span className="text-slate-800">1. Billet Trouvé</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {scannedRes.status === 'VALIDATED' ? (
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle size={13} className="text-rose-500 shrink-0" />
                    )}
                    <span className={scannedRes.status === 'VALIDATED' ? "text-slate-800" : "text-rose-600"}>
                      2. Payé ({scannedRes.status})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {scannedRes.boardingStatus === 'BOARDED' ? (
                      <AlertCircle size={13} className="text-rose-500 shrink-0" />
                    ) : (
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    )}
                    <span className={scannedRes.boardingStatus === 'BOARDED' ? "text-rose-600" : "text-slate-800"}>
                      {scannedRes.boardingStatus === 'BOARDED' ? "3. Déjà Utilisé !" : "3. Non Utilisé"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Ticket details layout */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[10px] lg:text-xs pt-1">
                <div>
                  <p className="text-[7px] font-bold uppercase text-slate-400 tracking-wider">Itinéraire</p>
                  <p className="font-black text-slate-900 uppercase italic">{scannedRes.itinerary}</p>
                </div>
                <div>
                  <p className="text-[7px] font-bold uppercase text-slate-400 tracking-wider">Navire Assigné</p>
                  <p className="font-black text-slate-900 uppercase">{scannedRes.ship}</p>
                </div>
                <div>
                  <p className="text-[7px] font-bold uppercase text-slate-400 tracking-wider">Classe Voyage</p>
                  <p className="font-black text-slate-900 uppercase">{scannedRes.travelClass}</p>
                </div>
                <div>
                  <p className="text-[7px] font-bold uppercase text-slate-400 tracking-wider">Nombre de Places</p>
                  <p className="font-black text-slate-900 font-mono">{scannedRes.passengersCount} PAX</p>
                </div>
                <div>
                  <p className="text-[7px] font-bold uppercase text-slate-400 tracking-wider">Date Prévue</p>
                  <p className="font-black text-slate-900 font-mono">{scannedRes.travelDate}</p>
                </div>
                <div>
                  <p className="text-[7px] font-bold uppercase text-slate-400 tracking-wider">Vérification de Flux</p>
                  <span className={cn(
                    "font-black text-[8px] px-1.5 py-0.5 rounded border inline-block uppercase tracking-wider",
                    scannedRes.status === 'VALIDATED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-500 border-rose-100"
                  )}>
                    {scannedRes.status === 'VALIDATED' ? "💸 Payé & Validé" : "❌ Paiement En Attente"}
                  </span>
                </div>
              </div>

              {/* Boarding Stamp if boarded */}
              {scannedRes.boardingStatus === 'BOARDED' && (
                <div className="pt-2">
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center space-y-1">
                    <p className="text-[10px] font-extrabold text-emerald-700 uppercase">✓ EMBARQUEMENT CONFIRMÉ & SÉCURISÉ</p>
                    {scannedRes.boardedAt && (
                      <p className="text-[7.5px] font-bold text-emerald-500 uppercase tracking-widest font-mono">
                        Validé le {new Date(scannedRes.boardedAt).toLocaleDateString()} à {new Date(scannedRes.boardedAt).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[24px] p-10 flex flex-col items-center justify-center text-center space-y-3 opacity-60 text-slate-400">
              <Camera size={36} className="animate-pulse text-slate-300" />
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 animate-pulse">En attente de scan...</p>
                <p className="text-[8px] font-bold uppercase tracking-wide max-w-xs mx-auto text-slate-400 leading-normal">
                  Passez le QR Code de réservation ou introduisez l'ID manuellement pour lancer la validation automatique sécurisée
                </p>
              </div>
            </div>
          )}

          {/* Scanned List Session history */}
          <div className="space-y-2 text-left pt-2">
            <div className="flex justify-between items-center">
              <h5 className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Embarquements Validés (Session Locale)</h5>
              {scannedList.length > 0 && (
                <span className="text-[8px] font-bold text-emerald-500 px-2 py-0.5 bg-emerald-50 rounded border border-emerald-100">{scannedList.length} PASSAGERS</span>
              )}
            </div>
            {scannedList.length === 0 ? (
              <p className="text-[8px] font-bold uppercase italic text-slate-400 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-100">Aucun embarquement validé durant cette session.</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {scannedList.map((sc, i) => (
                  <div key={sc.id || i} className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-100 rounded-lg flex justify-between items-center text-[10px] font-bold uppercase transition-all">
                    <div>
                      <p className="text-slate-900 font-extrabold">{sc.fullName} {sc.lastName}</p>
                      <p className="text-[7.5px] text-slate-400 font-mono mt-0.5">{sc.ship} • {sc.travelClass} • {sc.passengersCount} PAX</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[6.5px] font-black tracking-widest rounded inline-block">
                          ✓ EMBARQUÉ
                        </span>
                        {sc.boardedAt && (
                          <p className="text-[6px] text-slate-400 font-mono mt-0.5">{new Date(sc.boardedAt).toLocaleTimeString()}</p>
                        )}
                      </div>
                      
                      {/* Administrative Rollback Button */}
                      <button
                        onClick={() => handleCancelBoarding(sc)}
                        className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-500 border border-rose-100 hover:border-rose-200 text-[6.5px] font-semibold rounded transition-all cursor-pointer"
                        title="Annuler l'embarquement et réactiver le billet"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

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
  Search,
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
  PhoneCall
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { GoogleGenAI } from "@google/genai";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
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
  increment
} from 'firebase/firestore';
import { Reservation, TravelClass, Itinerary, ShipName } from './types';
import { cn, formatDate, formatPrice } from './lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

// --- Types ---
type Page = 'home' | 'booking' | 'payment' | 'dashboard' | 'tickets' | 'news' | 'gallery';

// --- Constants ---
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
const generateTicket = async (res: Reservation, siteSettings: { homeBg: string }) => {
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
        // Fallback to a placeholder if image fails to load
        const fallback = new Image();
        fallback.src = "https://images.unsplash.com/photo-1559139225-8216b8e8303e?q=80&w=2070&auto=format&fit=crop";
        resolve(fallback);
      };
      img.src = url;
    });
  };

  try {
    const bgImg = await loadImage(siteSettings.homeBg);
    
    // Background Image
    pdf.setGState(new (pdf as any).GState({ opacity: 0.15 }));
    pdf.addImage(bgImg, 'JPEG', 0, 0, w, h);
    pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

    // Header
    pdf.setFillColor(0, 18, 51);
    pdf.rect(0, 0, w, 40, 'F');
    
    // Logo / Name
    pdf.setTextColor(255, 195, 0); // Gold
    pdf.setFont("helvetica", "bolditalic");
    pdf.setFontSize(18);
    pdf.text("ETS AMR MUGOTE ET SES FRERES", w / 2, 20, { align: 'center' });
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text("SERVICES DE NAVIGATION LACUSTRE & LOGISTIQUE", w / 2, 26, { align: 'center' });
    
    // CLASS BRANDING SECTION (Dynamic color based on travel class)
    const color = CLASS_COLORS[res.travelClass] || CLASS_COLORS['2ème Classe'];
    pdf.setFillColor(color.rgb[0], color.rgb[1], color.rgb[2]);
    pdf.rect(0, 40, w, 15, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${res.travelClass.toUpperCase()} - BILLET OFFICIEL`, w / 2, 50, { align: 'center' });

    // Ticket ID Badge with dynamic color background
    pdf.setFillColor(color.rgb[0], color.rgb[1], color.rgb[2]);
    pdf.roundedRect(w - 60, 60, 50, 10, 2, 2, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text(`#${res.ticketId}`, w - 35, 66.5, { align: 'center' });

    // Main Details
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
      pdf.setTextColor(100, 100, 100);
      pdf.text(label.toUpperCase(), x, y);
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(color.rgb[0], color.rgb[1], color.rgb[2]); // Using class color
      pdf.text(String(value).toUpperCase(), x, y + 5);
    }

    // Row 1: Nom & Post-nom
    drawField("Nom", res.fullName, 20, 75);
    drawField("Post-nom", res.lastName || '-', 70, 75);
    drawDivider(85);

    // Row 2: Bateau & Classe
    drawField("Bateau", res.ship, 20, 92);
    drawField("Classe Choisie", res.travelClass, 70, 92);
    drawDivider(102);

    // Row 3: Itinéraire
    drawField("Itinérance (Route)", res.itinerary.replace('-', ' > '), 20, 109);
    drawDivider(119);

    // Row 4: Date & Heure
    drawField("Date", res.travelDate, 20, 126);
    drawField("Heure de Départ", res.departureTime || '07:20', 70, 126);
    drawDivider(136);

    // Row 5: Montant
    drawField("Montant Payé", `${res.amount}.00 USD`, 20, 143);
    drawField("ID Transaction", res.transactionId || 'A VALIDER', 70, 143);
    drawDivider(153);

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
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [currentReservation, setCurrentReservation] = useState<Reservation | null>(null);
  const [siteSettings, setSiteSettings] = useState({ 
    homeBg: 'https://images.unsplash.com/photo-1559139225-8216b8e8303e?q=80&w=2070&auto=format&fit=crop',
    homeDetail: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop',
    logo: '' // Fallback for the "baton" (mugote) image
  });

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
      setUser(u);
      if (u) {
        setIsAdmin(u.email === 'birekeidea@gmail.com');
        try {
          // Auto-promote the specific project owner to admin for testing
          if (u.email === 'birekeidea@gmail.com') {
            await setDoc(doc(db, 'admins', u.uid), {
              uid: u.uid,
              email: u.email,
              role: 'ADMIN'
            }, { merge: true });
          }
          
          // Track user list for admin with last login
          await setDoc(doc(db, 'users_list', u.uid), {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName || '',
            lastLogin: serverTimestamp(),
            emailVerified: u.emailVerified
          }, { merge: true });

          // Auto-create user profile if it doesn't exist
          await setDoc(doc(db, 'users', u.uid), {
            uid: u.uid,
            email: u.email,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (error) {
          console.warn("Background auth-sync failed safely:", error);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => { unsubscribe(); settingsUnsub(); };
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = () => signOut(auth);

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

  return (
    <div className="min-h-screen bg-bg flex flex-col font-sans relative overflow-hidden text-center items-center">
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-[0.05]"></div>
      
      <header className="w-full bg-white z-[60] relative">
        <div className="w-full h-44 md:h-64 relative overflow-hidden">
          <img 
            src={siteSettings.homeBg} 
            className="w-full h-full object-cover" 
            alt="Mugote Fleet Background"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1559139225-8216b8e8303e?q=80&w=2070&auto=format&fit=crop';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-black/40"></div>
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full text-center px-4">
            <p className="text-white text-xs md:text-base font-black uppercase tracking-[0.6em] drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">
              L'excellence du transport lacustre au Kivu
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col items-center justify-center relative -mt-16 bg-white rounded-t-[50px] shadow-[0_-20px_50px_-15px_rgba(0,0,0,0.15)]">
          <div className="flex flex-col items-center gap-6 cursor-pointer group" onClick={() => setCurrentPage('home')}>
            <div className="w-32 h-32 md:w-48 md:h-48 rounded-full border-[8px] border-white shadow-2xl overflow-hidden shadow-black/40 transition-all group-hover:scale-105 mb-2 relative ring-1 ring-slate-100 flex items-center justify-center bg-white">
              <img 
                src={siteSettings.logo || siteSettings.homeDetail || "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop"} 
                className="w-full h-full object-cover" 
                alt="Logo Mugote"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop';
                }}
              />
            </div>
            <div className="text-center space-y-3">
              <h1 className="text-2xl md:text-4xl font-black tracking-tighter leading-none italic uppercase">
                <span className="text-maritime">ETS AMR</span> <span className="text-gold">MUGOTE</span> <span className="text-maritime-dark">ET SES FRERES</span>
              </h1>
              <div className="flex items-center justify-center gap-4">
                <div className="h-[2px] w-12 md:w-24 bg-gold/50"></div>
                <p className="text-xs md:text-sm font-black tracking-[0.3em] text-slate-900 uppercase italic">
                  VOYAGER EN TOUTE SÉCURITÉ
                </p>
                <div className="h-[2px] w-12 md:w-24 bg-gold/50"></div>
              </div>
            </div>
          </div>
          
          <div className="absolute right-8 top-10 flex items-center gap-4">
             <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-4 bg-maritime text-white rounded-2xl shadow-xl hover:bg-black transition-all">
                <Menu size={24} />
             </button>
             {user ? (
               <div className="flex items-center gap-3">
                 <div className="hidden md:block text-right">
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Connecté</p>
                   <p className="text-xs font-black text-maritime">{user.displayName}</p>
                 </div>
                 <button onClick={logout} className="p-4 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all border border-slate-100 hover:border-rose-100 shadow-md">
                   <LogOut size={20} />
                 </button>
               </div>
            ) : (
              <button onClick={login} className="px-8 py-3 bg-maritime text-white rounded-2xl shadow-xl hover:bg-maritime-dark transition-all text-xs font-black uppercase tracking-widest flex items-center gap-3 border border-white/20">
                <User size={18} /> Connexion
              </button>
            )}
          </div>
        </div>

        {/* Decorative separator */}
        <div className="w-full h-2 bg-gradient-to-r from-transparent via-gold/20 to-transparent"></div>
      </header>

      <nav className="sticky top-0 z-50 bg-[#001233] w-full border-b border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
            {[
              { id: 'home', label: 'ACCUEIL' },
              { id: 'booking', label: 'RÉSERVER' },
              { id: 'tickets', label: 'BILLETS' },
              { id: 'news', label: 'JOURNAL' },
              { id: 'gallery', label: 'FLOTTE' },
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
                    "rounded-xl font-black uppercase tracking-[0.2em] transition-all duration-300 border relative group",
                    isDashboard ? "px-6 py-3.5 text-[11px] md:text-sm" : "px-4 py-3 text-[10px] md:text-xs",
                    currentPage === item.id 
                      ? isDashboard 
                        ? "bg-emerald-600 text-white border-emerald-400 shadow-xl shadow-emerald-500/30 scale-105 ring-2 ring-emerald-500/50"
                        : "bg-gold text-maritime border-gold shadow-xl shadow-gold/30 scale-105" 
                      : isDashboard
                        ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/50 hover:bg-emerald-600 hover:text-white hover:scale-110 shadow-lg shadow-emerald-900/20"
                        : "bg-white/5 text-white/50 border-white/5 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

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
                      src={siteSettings.logo || siteSettings.homeDetail} 
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
              {[
                { id: 'home', label: 'ACCUEIL' },
                { id: 'booking', label: 'RÉSERVER' },
                { id: 'tickets', label: 'MES BILLETS' },
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
              })}
            </div>

            <div className="pt-12 space-y-6">
              {!user ? (
                <button onClick={() => { setIsMenuOpen(false); login(); }} className="w-full py-6 bg-gold text-maritime font-black rounded-2xl uppercase tracking-[0.2em] text-xs shadow-xl shadow-gold/20">
                  CONNEXION CLIENT
                </button>
              ) : (
                <div className="p-6 bg-white/5 rounded-2xl flex items-center justify-between border border-white/10">
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">PROFIL ACTIF</p>
                    <p className="font-bold text-white text-lg">{user.displayName}</p>
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

      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-6 relative z-10 text-center">
        <AnimatePresence mode="wait">
          {verifyId ? (
            <VerificationView id={verifyId} onClose={() => { setVerifyId(null); window.history.pushState({}, '', '/'); }} />
          ) : (
            <>
              {currentPage === 'home' && <Home onBook={() => setCurrentPage('booking')} onNavigate={setCurrentPage} siteSettings={siteSettings} />}
              {currentPage === 'booking' && <Booking onReserved={(res) => { setCurrentReservation(res); setCurrentPage('payment'); }} user={user} />}
              {currentPage === 'payment' && <Payment reservation={currentReservation} onComplete={() => setCurrentPage('tickets')} />}
              {currentPage === 'dashboard' && <Dashboard siteSettings={siteSettings} onNavigate={setCurrentPage} />}
              {currentPage === 'tickets' && <MyTickets user={user} siteSettings={siteSettings} />}
              {currentPage === 'news' && <NewsView />}
              {currentPage === 'gallery' && <GalleryView siteSettings={siteSettings} />}
            </>
          )}
        </AnimatePresence>
      </main>

      <footer className="bg-[#003135] py-20 px-8 mt-12 w-full text-center relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/20 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-gold/10 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2" />
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
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.6em]">
              © {new Date().getFullYear()} ETS AMR MUGOTE ET SES FRERES • NAVIGATION LACUSTRE
            </p>
          </div>
        </div>
      </footer>
      <ChatWidget user={user} />
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
    const q = query(collection(db, 'conversations', conversation.id, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ ...d.data(), id: d.id })));
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
    <div className="flex flex-col h-full bg-white/50 backdrop-blur-xl">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/80">
        <div>
          <h4 className="text-[11px] font-black uppercase text-black tracking-widest">{conversation.userName}</h4>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{conversation.userEmail}</p>
        </div>
        <div className="px-4 py-1.5 bg-slate-100 rounded-full text-[8px] font-black uppercase text-slate-500 tracking-widest">Connecté</div>
      </div>
      <div className="flex-1 overflow-y-auto p-10 space-y-4">
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
    const q = query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ ...d.data(), id: d.id })));
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
    if (!inputText.trim() || sending || !convId || !user) return;

    const text = inputText;
    setInputText('');
    setSending(true);

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
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

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
               {messages.length === 0 ? (
                 <div className="text-center py-20 space-y-4 opacity-20">
                   <MessageSquareText size={48} className="mx-auto" />
                   <p className="text-[10px] font-bold uppercase tracking-[.3em]">Posez vos questions !</p>
                 </div>
               ) : (
                 messages.map((m, i) => (
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

function Home({ onBook, onNavigate, siteSettings }: { onBook: () => void, onNavigate: (page: string) => void, siteSettings?: { homeBg: string, homeDetail: string } }) {
  const [media, setMedia] = useState<any[]>([]);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);

  const settings = siteSettings || { 
    homeBg: 'https://images.unsplash.com/photo-1559139225-8216b8e8303e?q=80&w=2070&auto=format&fit=crop',
    homeDetail: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop',
    logo: ''
  };

  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('publishedAt', 'desc'), limit(12));
    const unsub = onSnapshot(q, (snapshot) => {
      setMedia(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          // Extremely robust mapping to support all historical naming conventions
          processedUrl: data.url || data.videoUrl || data.imageUrl || data.image || data.video || data.contentUrl || '',
          processedType: (data.type || (data.videoUrl || data.video ? 'video' : (data.imageUrl || data.image ? 'image' : 'text'))).toLowerCase(),
          processedDesc: data.desc || data.content || data.description || data.text || ''
        };
      }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'news'));

    const qGallery = query(collection(db, 'news'), where('type', '==', 'image'), orderBy('publishedAt', 'desc'), limit(8));
    const unsubGallery = onSnapshot(qGallery, (snapshot) => {
      setGalleryImages(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          processedUrl: data.url || data.imageUrl
        };
      }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'news'));

    return () => {
      unsub();
      unsubGallery();
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
            {[
              { from: "Bukavu", to: "Goma", time: "07:30 AM" },
              { from: "Goma", to: "Bukavu", time: "07:30 AM" },
            ].map((it, i) => (
              <div key={i} className="flex flex-col items-center justify-center p-5 bg-black border border-white/10 rounded-2xl shadow-sm space-y-4 transition-transform hover:scale-[1.02]">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mb-1">Départ</p>
                    <p className="text-lg font-extrabold text-white uppercase italic">{it.from}</p>
                  </div>
                  <ChevronRightCircle size={24} className="text-white opacity-20" />
                  <div className="text-center">
                    <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mb-1">Arrivée</p>
                    <p className="text-lg font-extrabold text-white uppercase italic">{it.to}</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/10 w-full flex flex-col items-center gap-1">
                  <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest leading-none">Horaire Matinal</p>
                  <p className="text-lg font-mono font-bold text-gold flex items-center gap-2">
                     <Clock3 size={16} /> {it.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* News Highlight */}
      {media.length > 0 && (
        <section id="news-feed" className="bg-black py-12 -mx-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
          <div className="max-w-7xl mx-auto px-8 relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
              <div className="space-y-3">
                <h3 className="text-gold text-[9px] font-extrabold tracking-[0.4em] uppercase">Journal de Bord</h3>
                <h4 className="text-xl font-extrabold tracking-tighter text-white leading-none uppercase text-center md:text-left">ACTUALITÉS NAVALES</h4>
              </div>
              <button onClick={() => onNavigate('news')} className="text-white text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all">Détails <ChevronRight size={14} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {media.map((item: any, i) => (
                <div key={i} className="group cursor-pointer">
                  <div className="aspect-[4/5] rounded-2xl overflow-hidden mb-4 relative">
                    {item.processedType === 'video' ? (
                      <div className="w-full h-full relative">
                        <video 
                          src={item.processedUrl || undefined} 
                          className="w-full h-full object-cover" 
                          muted 
                          loop 
                          autoPlay 
                          playsInline
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-all">
                          <Play size={32} className="text-white opacity-80 shadow-2xl group-hover:scale-150 transition-transform" />
                        </div>
                        <div className="absolute top-4 right-4 bg-gold px-2 py-0.5 rounded text-[7px] font-black uppercase text-black">Vidéo</div>
                      </div>
                    ) : item.processedType === 'image' ? (
                      <img src={item.processedUrl || undefined} alt={item.title} className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110" />
                    ) : (
                      <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center border border-white/5 relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gold opacity-30" />
                        <FileText size={20} className="text-gold opacity-30 mb-4" />
                        <p className="text-white text-[10px] font-bold uppercase tracking-[0.2em] line-clamp-6 leading-relaxed">
                          {item.processedDesc}
                        </p>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-maritime-dark/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h5 className="text-white text-lg font-bold mb-1.5 group-hover:text-gold transition-colors uppercase tracking-tight">{item.title}</h5>
                  <p className="text-white/40 text-xs line-clamp-2 leading-relaxed">{item.processedDesc}</p>
                </div>
              ))}
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            {galleryImages.length > 0 ? (
              galleryImages.slice(0, 4).map((img, i) => (
                <div key={img.id} className="aspect-square rounded-xl overflow-hidden border border-slate-100 shadow-sm opacity-80 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => onNavigate('gallery')}>
                  <img src={img.processedUrl} className="w-full h-full object-cover" alt={img.title} />
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

function Booking({ onReserved, user }: { onReserved: (res: Reservation) => void, user: FirebaseUser | null }) {
  const [formData, setFormData] = useState({
    fullName: '',
    lastName: '',
    phone: '',
    email: '',
    itinerary: 'Bukavu-Goma' as Itinerary,
    ship: 'Mugote 1' as ShipName,
    travelDate: '',
    departureTime: '07:30',
    travelClass: '2ème Classe' as TravelClass,
    passengersCount: 1,
    paymentMethod: 'Airtel Money'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({ ...prev, fullName: user.displayName || '', email: user.email || '' }));
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      alert("Veuillez entrer un nom valide.");
      return;
    }
    if (!formData.lastName.trim() || formData.lastName.trim().length < 2) {
      alert("Veuillez entrer un post-nom valide.");
      return;
    }

    const selectedDate = new Date(formData.travelDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!formData.travelDate || selectedDate < today) {
      alert("La date de voyage ne peut pas être passée.");
      return;
    }

    if (formData.passengersCount < 1) {
      alert("Le nombre de passagers doit être au moins 1.");
      return;
    }

    // Validation du numéro congolais (+243 suivi de 9 chiffres)
    // On retire les espaces pour la validation
    const cleanPhone = formData.phone.replace(/\s/g, '');
    const phoneRegex = /^\+243[0-9]{9}$/;
    
    if (!phoneRegex.test(cleanPhone)) {
      alert("Numéro non valide. Veuillez entrer un numéro congolais au format +243XXXXXXXXX (exemple: +243991234567)");
      return;
    }

    if (!user) {
      alert("Veuillez vous connecter pour réserver.");
      return;
    }
    setSubmitting(true);
    
    const amount = PRICES[formData.travelClass] * formData.passengersCount;
    
    const resData: Reservation = {
      ...formData,
      userId: user.uid,
      status: 'PENDING',
      amount,
      transactionId: '',
      createdAt: Date.now(),
      ticketId: 'Ticket-' + Math.random().toString(36).substring(2, 8).toUpperCase()
    };

    try {
      const docRef = await addDoc(collection(db, 'reservations'), resData);
      onReserved({ ...resData, id: docRef.id });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reservations');
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
        <div className="flex flex-col lg:flex-row gap-12 items-start">
          {/* Form in Tabular Style */}
          <div className="flex-1 w-full space-y-8">
            <div className="space-y-2 border-l-4 border-gold pl-6 py-2">
              <h2 className="text-4xl font-black tracking-tighter text-black uppercase italic leading-none">Embarquement</h2>
              <div className="text-slate-500 font-bold tracking-[0.2em] text-[9px] uppercase flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-maritime rounded-full animate-pulse" /> 
                Remplissez le tableau pour réserver votre place
              </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-[32px] border border-slate-200 shadow-2xl overflow-hidden">
              <table className="w-full border-collapse">
                <tbody>
                  {/* Header row */}
                  <tr className="bg-black text-white">
                    <th colSpan={2} className="p-6 text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gold/20 rounded-xl flex items-center justify-center text-gold">
                          <Ship size={20} />
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest opacity-60 leading-none mb-1">Navigation</p>
                          <p className="text-lg font-black uppercase tracking-tighter italic">Formulaire Officiel Mugote</p>
                        </div>
                      </div>
                    </th>
                  </tr>

                  {/* Identification */}
                  <tr className="border-b border-slate-100 group transition-colors hover:bg-slate-50/50">
                    <td className="p-6 border-r border-slate-100 bg-slate-50/30 w-[160px] md:w-[200px]">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-maritime tracking-widest flex items-center gap-2">
                          <User size={14} className="text-gold" /> Identité
                          <Cat size={12} className="text-rose-400 animate-bounce" />
                        </label>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Nom complet du voyageur</p>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input 
                          required
                          type="text" 
                          value={formData.fullName}
                          onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                          className="w-full px-5 py-3 bg-slate-50 border-2 border-maritime/30 rounded-2xl focus:outline-none focus:ring-4 focus:ring-gold/10 focus:border-gold transition-all font-bold text-sm"
                          placeholder="NOM"
                        />
                        <input 
                          required
                          type="text" 
                          value={formData.lastName}
                          onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                          className="w-full px-5 py-3 bg-slate-50 border-2 border-maritime/30 rounded-2xl focus:outline-none focus:ring-4 focus:ring-gold/10 focus:border-gold transition-all font-bold text-sm"
                          placeholder="POST-NOM"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Contact & Payment */}
                  <tr className="border-b border-slate-100 group transition-colors hover:bg-slate-50/50">
                    <td className="p-6 border-r border-slate-100 bg-slate-50/30">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-maritime tracking-widest flex items-center gap-2">
                          <Phone size={14} className="text-gold" /> Contact
                        </label>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Numéro de téléphone</p>
                      </div>
                    </td>
                    <td className="p-6">
                      <input 
                        required
                        type="tel" 
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-5 py-3 bg-slate-50 border-2 border-maritime/30 rounded-2xl focus:outline-none focus:ring-4 focus:ring-gold/10 focus:border-gold transition-all font-mono font-black text-sm text-maritime"
                        placeholder="+243 999 999 999"
                        title="Veuillez entrer un numéro congolais valide (+243 suivi de 9 chiffres)"
                      />
                    </td>
                  </tr>

                  {/* Voyage Details */}
                  <tr className="border-b border-slate-100 group transition-colors hover:bg-slate-50/50">
                    <td className="p-6 border-r border-slate-100 bg-slate-50/30">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-maritime tracking-widest flex items-center gap-2">
                          <MapPin size={14} className="text-gold" /> Destination
                        </label>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Itinéraire choisi</p>
                      </div>
                    </td>
                    <td className="p-6">
                      <select 
                        value={formData.itinerary}
                        onChange={e => setFormData({ ...formData, itinerary: e.target.value as Itinerary })}
                        className="w-full px-6 py-4 bg-maritime border-4 border-gold/30 text-white rounded-2xl focus:outline-none focus:ring-4 ring-gold/20 transition-all font-black uppercase tracking-widest text-[11px] appearance-none cursor-pointer"
                      >
                        <option value="Bukavu-Goma">Bukavu (Sud) → Goma (Nord)</option>
                        <option value="Goma-Bukavu">Goma (Nord) → Bukavu (Sud)</option>
                      </select>
                    </td>
                  </tr>

                  {/* Schedule */}
                  <tr className="border-b border-slate-100 group transition-colors hover:bg-slate-50/50">
                    <td className="p-6 border-r border-slate-100 bg-slate-50/30">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-maritime tracking-widest flex items-center gap-2">
                          <Calendar size={14} className="text-gold" /> Calendrier
                        </label>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Date & Heure de départ</p>
                      </div>
                    </td>
                    <td className="p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input 
                          required
                          type="date" 
                          value={formData.travelDate}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={e => setFormData({ ...formData, travelDate: e.target.value })}
                          className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-gold/10 focus:border-gold transition-all font-mono font-black text-sm"
                        />
                        <select 
                          value={formData.departureTime}
                          onChange={e => setFormData({ ...formData, departureTime: e.target.value })}
                          className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-gold/10 focus:border-gold transition-all font-mono font-black text-sm cursor-pointer"
                        >
                          <option value="07:30">MATIN (07:30)</option>
                          <option value="18:00">SOIR (18:00)</option>
                        </select>
                      </div>
                    </td>
                  </tr>

                  {/* Ship Selection */}
                  <tr className="border-b border-slate-100 group transition-colors hover:bg-slate-50/50">
                    <td className="p-6 border-r border-slate-100 bg-slate-50/30">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-maritime tracking-widest flex items-center gap-2">
                          <Anchor size={14} className="text-gold" /> Navire
                        </label>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Sélection de la flotte</p>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="grid grid-cols-3 gap-3">
                        {(['Mugote 1', 'Mugote 2', 'Mugote 3'] as ShipName[]).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setFormData({ ...formData, ship: s })}
                            className={cn(
                              "p-3 rounded-xl border-2 transition-all font-black uppercase tracking-widest text-[9px] relative",
                              formData.ship === s 
                                ? "border-black bg-black text-white shadow-xl shadow-black/20" 
                                : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                            )}
                          >
                            {s}
                            {formData.ship === s && <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gold rounded-full flex items-center justify-center text-black font-black text-[8px]">✓</div>}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>

                  {/* Travel Class */}
                  <tr className="border-b border-slate-100 group transition-colors hover:bg-slate-50/50">
                    <td className="p-6 border-r border-slate-100 bg-slate-50/30">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-maritime tracking-widest flex items-center gap-2">
                          <CheckCircle size={14} className="text-gold" /> Confort
                          <Cat size={12} className="text-indigo-400 animate-pulse" />
                        </label>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Niveau de service</p>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {(['1ère Classe', '2ème Classe', '3ème Classe', 'VIP'] as TravelClass[]).map(c => {
                          const clsColor = CLASS_COLORS[c];
                          const isActive = formData.travelClass === c;
                          
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setFormData({ ...formData, travelClass: c })}
                              className={cn(
                                "p-4 rounded-3xl border-2 transition-all text-center flex flex-col items-center justify-center group relative overflow-hidden active:scale-95 hover:scale-105 hover:shadow-xl",
                                isActive 
                                  ? "border-transparent text-white shadow-2xl scale-105" 
                                  : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                              )}
                              style={{ 
                                backgroundColor: isActive ? clsColor.main : undefined,
                                boxShadow: isActive ? `0 20px 25px -5px ${clsColor.light}, 0 8px 10px -6px ${clsColor.light}` : undefined
                              }}
                            >
                              <p className={cn("text-[8px] font-black uppercase tracking-tighter leading-none mb-1", isActive ? "text-white" : "text-slate-400")}>{c}</p>
                              <p className={cn("text-xs font-black font-mono", isActive ? "text-white" : "text-black")}>{PRICES[c]}$</p>
                              {isActive && <div className="absolute top-0 right-0 p-1 opacity-20"><Ship size={24} /></div>}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>

                  {/* Passengers */}
                  <tr className="border-b border-slate-100 group transition-colors hover:bg-slate-50/50">
                    <td className="p-6 border-r border-slate-100 bg-slate-50/30">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-maritime tracking-widest flex items-center gap-2">
                          <Users size={14} className="text-gold" /> Billets
                        </label>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Nombre de passagers</p>
                      </div>
                    </td>
                    <td className="p-6 flex items-center gap-6">
                      <div className="bg-slate-100 rounded-2xl p-1 flex items-center gap-1 shadow-inner">
                        <button type="button" onClick={() => setFormData(p => ({...p, passengersCount: Math.max(1, p.passengersCount - 1)}))} className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all font-black text-xl text-maritime">-</button>
                        <span className="w-14 text-center text-xl font-black font-mono text-maritime">{formData.passengersCount}</span>
                        <button type="button" onClick={() => setFormData(p => ({...p, passengersCount: Math.min(10, p.passengersCount + 1)}))} className="w-12 h-12 flex items-center justify-center bg-maritime text-white rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all font-black text-xl">+</button>
                      </div>
                      <div className="flex-1 text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Capacité Max</p>
                        <p className="text-[10px] font-black text-maritime">10 PERSONNES / GROUPE</p>
                      </div>
                    </td>
                  </tr>

                  {/* Submission Row */}
                  <tr className="bg-slate-50/80">
                    <td colSpan={2} className="p-10 text-center">
                      <div className="max-w-md mx-auto space-y-6">
                         <div className="space-y-4">
                            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border-2 border-dashed border-maritime/20 shadow-sm relative overflow-hidden group">
                              <div className="absolute top-0 left-0 w-1 h-full bg-gold" />
                              <div className="text-left">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Résumé de la commande</p>
                                <p className="text-sm font-black text-maritime font-mono">{formData.passengersCount} Billets x {PRICES[formData.travelClass]}.00$</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">TOTAL</p>
                                <p className="text-3xl font-black text-maritime font-mono tracking-tighter">{PRICES[formData.travelClass] * formData.passengersCount}.00$</p>
                              </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-2xl text-left border border-amber-100">
                              <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                              <p className="text-[10px] font-bold leading-relaxed text-amber-900 uppercase tracking-[0.05em]">
                                Votre réservation sera validée après confirmation du paiement mobile sur le numéro <span className="font-black text-black">099 428 64 69</span>.
                              </p>
                            </div>
                         </div>

                         <button 
                            disabled={submitting}
                            type="submit"
                            className="w-full py-5 bg-maritime text-white text-xs font-black uppercase tracking-[0.3em] shadow-2xl shadow-maritime/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 rounded-2xl relative overflow-hidden group"
                          >
                            <span className="relative z-10">{submitting ? "Traitement..." : `Confirmer & Payer ${PRICES[formData.travelClass] * formData.passengersCount}$`}</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-gold via-transparent to-gold opacity-0 group-hover:opacity-20 transition-opacity" />
                          </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </form>
          </div>

          {/* Right side: Digital Boarding Pass Preview (GLASS VERSION) */}
          <div className="w-full lg:w-[400px] sticky top-32">
            <div className={cn(
               "relative p-8 shadow-2xl rounded-[40px] overflow-hidden border transition-all duration-700",
               formData.travelClass === '1ère Classe' || formData.travelClass === 'VIP' ? "bg-slate-900 text-white border-gold/30" :
               formData.travelClass === '2ème Classe' ? "bg-maritime text-white border-white/10" :
               "bg-emerald-900 text-white border-emerald-500/30"
            )}>
              {/* Glass Effect Overlays */}
              <div className="absolute inset-0 backdrop-blur-md bg-white/5 z-0" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 animate-pulse" />
              <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-white/20 via-transparent to-transparent rotate-12 pointer-events-none" />
              
              <div className="relative z-10 space-y-10">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className={cn(
                      "text-[10px] font-black uppercase tracking-[0.3em]",
                      formData.travelClass === '2ème Classe' ? "text-white/60" : "text-gold"
                    )}>Digital Ticket</p>
                    <h3 className="text-2xl font-black uppercase tracking-tighter italic">AMR MUGOTE</h3>
                  </div>
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 backdrop-blur-xl">
                    <Anchor className={formData.travelClass === '3ème Classe' ? "text-emerald-400" : "text-gold"} size={24} />
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="flex items-center gap-6">
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">De / From</p>
                      <p className="text-xl font-black uppercase tracking-tighter truncate">{formData.itinerary.split('-')[0]}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-10 h-[2px] bg-white/20" />
                      <Ship size={14} className="text-gold" />
                      <div className="w-10 h-[2px] bg-white/20" />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">À / To</p>
                      <p className="text-xl font-black uppercase tracking-tighter truncate">{formData.itinerary.split('-')[1]}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 border-y border-white/10 py-8">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Date</p>
                      <p className="text-sm font-black font-mono text-gold">{formData.travelDate || '... / ...'}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Heure</p>
                      <p className="text-sm font-black font-mono">{formData.departureTime || '...:...'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Bateau</p>
                      <p className="text-sm font-black italic">{formData.ship}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Classe</p>
                      <p className={cn(
                        "text-sm font-black uppercase",
                        formData.travelClass === '1ère Classe' || formData.travelClass === 'VIP' ? "text-gold" :
                        formData.travelClass === '3ème Classe' ? "text-emerald-400" : "text-white"
                      )}>{formData.travelClass.split(' ')[0]}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Client</p>
                        <p className="text-xs font-black uppercase truncate max-w-[150px]">{formData.fullName || 'Passager'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-gold uppercase tracking-widest mb-1">Montant Total</p>
                      <p className="text-4xl font-black font-mono tracking-tighter">
                        {PRICES[formData.travelClass] * formData.passengersCount}<span className="text-sm opacity-50">$</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-10 border-t border-dashed border-white/20 flex flex-col items-center gap-4 text-center">
                  <div className="space-y-2 mb-2">
                    <p className="text-[8px] font-black text-gold/60 uppercase tracking-[0.2em]">Note Importante</p>
                    <p className="text-[8px] font-bold text-white/40 leading-relaxed uppercase">
                      Remboursement 24h avant la date de départ avec une réduction de 25%
                    </p>
                  </div>
                  <div className="space-y-1 mb-4">
                    <p className="text-[7px] font-black text-white/30 uppercase tracking-widest">Contact Support</p>
                    <p className="text-[9px] font-black text-gold/80">{CONTACT_NUMBERS.join(' / ')}</p>
                  </div>
                  <div className="w-full h-12 bg-white/5 rounded-xl border border-white/5 overflow-hidden flex">
                    {[...Array(30)].map((_, i) => (
                      <div key={i} className={cn("flex-1 h-full", i % 2 === 0 ? "bg-white/10" : "bg-transparent")} />
                    ))}
                  </div>
                  <p className="text-[8px] font-black uppercase tracking-[0.5em] text-white/20">ID TICKET #ID-{(formData.fullName?.substring(0,3) || 'MUG').toUpperCase()}-{Math.random().toString(36).substring(2, 6).toUpperCase()}</p>
                </div>
              </div>

              {/* Decorative circles to mimic ticket notches */}
              <div className="absolute left-0 top-[65%] -translate-x-1/2 w-8 h-8 bg-[#f8fafc] rounded-full" />
              <div className="absolute right-0 top-[65%] translate-x-1/2 w-8 h-8 bg-[#f8fafc] rounded-full" />
            </div>
          </div>
        </div>
    </motion.div>
  );
}

function Payment({ reservation, onComplete }: { reservation: Reservation | null, onComplete: () => void }) {
  const [step, setStep] = useState<'init' | 'processing' | 'success'>('init');
  const [submitting, setSubmitting] = useState(false);
  const [transactionId, setTransactionId] = useState('');

  if (!reservation) return null;

  const handleManualConfirm = async (id: string) => {
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'reservations', reservation.id!), {
        transactionId: id,
        status: 'PENDING'
      });
      onComplete();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reservations/${reservation.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const startStkPush = () => {
    setStep('processing');
    // Simulate real STK Push timing
    setTimeout(() => {
      const mockId = `MUG-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      setTransactionId(mockId);
      setStep('success');
    }, 4000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-xl mx-auto"
    >
      <AnimatePresence mode="wait">
        {step === 'init' && (
          <motion.div 
            key="init"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="bg-maritime p-10 text-white text-center space-y-4">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto border border-white/20">
                <PhoneCall size={32} className="text-gold" />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter italic">Paiement Mobile</h2>
                <p className="text-[10px] font-bold text-white/60 tracking-[0.2em] uppercase">M-Pesa • Airtel Money • Orange Money</p>
              </div>
            </div>

            <div className="p-10 space-y-8">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex justify-between items-center">
                <div className="text-left">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Montant à payer</p>
                  <p className="text-3xl font-black text-maritime font-mono">{reservation.amount}.00$</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Passager</p>
                  <p className="text-xs font-black uppercase italic">{reservation.fullName}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl text-left border border-amber-100">
                  <AlertCircle size={20} className="text-amber-500 flex-shrink-0" />
                  <p className="text-[10px] font-black text-amber-900 uppercase">
                    Une notification apparaîtra sur votre téléphone <span className="text-black font-black">{reservation.phone}</span> pour confirmer le paiement.
                  </p>
                </div>

                <button 
                  disabled={step === 'processing' || submitting}
                  onClick={startStkPush}
                  className="w-full py-6 bg-maritime text-white font-black uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-maritime/30 hover:scale-[1.02] active:scale-95 transition-all text-xs disabled:opacity-50"
                >
                  {step === 'processing' ? (
                    <div className="flex items-center justify-center gap-2">
                       <Ship size={16} className="animate-bounce" />
                       Patientez...
                    </div>
                  ) : "Lancer le paiement direct"}
                </button>
                
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                  <div className="relative flex justify-center text-[8px] font-black uppercase tracking-widest text-slate-400 px-2 bg-white">Ou entrez l'ID manuellement</div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Code reçu par SMS après paiement</p>
                    <input 
                      type="text" 
                      placeholder="Ex: MP240512.1345.B12345"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-gold transition-all font-mono font-bold text-center text-maritime"
                    />
                  </div>
                  <button 
                    disabled={!transactionId || submitting}
                    onClick={() => handleManualConfirm(transactionId)}
                    className="w-full py-4 border-2 border-slate-100 text-slate-400 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all text-[10px]"
                  >
                    Confirmer manuellement
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="bg-black rounded-[40px] p-12 text-center text-white space-y-8 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gold via-transparent to-transparent"></div>
            </div>

            <div className="relative z-10 space-y-8">
              <div className="w-24 h-24 bg-white/5 rounded-[32px] border border-white/10 flex items-center justify-center mx-auto shadow-2xl">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Ship size={48} className="text-gold" />
                </motion.div>
              </div>

              <div className="space-y-4">
                <h3 className="text-3xl font-black uppercase tracking-tighter italic">Demande Envoyée</h3>
                <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">Consultez votre téléphone {reservation.phone}</p>
              </div>

              <div className="max-w-xs mx-auto p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-gold italic">Notification Flash</p>
                <p className="text-sm font-medium leading-relaxed">
                  "Voulez-vous payer {reservation.amount}.00$ à ETS AMR MUGOTE ? Entrez votre code Secret"
                </p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-3 h-3 rounded-full border-2 border-white/20" />
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-40">Attente du signal SIM...</p>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div 
            key="success"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[40px] p-12 text-center space-y-8 shadow-2xl border-4 border-emerald-500"
          >
            <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[32px] flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
              <CheckCircle size={56} />
            </div>

            <div className="space-y-4">
              <h3 className="text-3xl font-black uppercase tracking-tighter italic">Paiement Reçu !</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Transaction {transactionId}</p>
            </div>

            <div className="bg-slate-50 p-8 rounded-3xl space-y-6">
              <div className="flex justify-between items-center text-sm font-black uppercase">
                <span className="text-slate-400 text-[10px]">ID Transaction</span>
                <span className="font-mono text-maritime">{transactionId}</span>
              </div>
              <div className="border-t border-slate-200 pt-6">
                <p className="text-[11px] font-bold text-slate-600 leading-relaxed uppercase">
                  Votre paiement a été détecté automatiquement. Votre billet sera généré et validé par un administrateur dans quelques instants.
                </p>
              </div>
            </div>

            <button 
              onClick={() => handleManualConfirm(transactionId)}
              className="w-full py-6 bg-black text-white font-black uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-95 transition-all text-xs"
            >
              Voir mon billet
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Dashboard({ siteSettings, onNavigate }: { siteSettings?: { homeBg: string, homeDetail: string }, onNavigate: (page: string) => void }) {
  const [tab, setTab] = useState<'reservations' | 'users' | 'fleet' | 'media' | 'settings' | 'messages'>('reservations');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [fleetList, setFleetList] = useState<any[]>([]);
  const [boatForm, setBoatForm] = useState({ id: '', name: '', capacity: 0, description: '', imageUrl: '' });
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [newsList, setNewsList] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<any | null>(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, validated: 0 });
  const [newMedia, setNewMedia] = useState({ title: '', desc: '', url: '', type: 'image' as 'image' | 'video' | 'text', media: [] as string[] });
  const [uploading, setUploading] = useState<string | null>(null);
  
  const bgInputRef = useRef<HTMLInputElement>(null);
  const detailInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'media' | 'homeBg' | 'homeDetail') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (target === 'media' && files.length > 1) {
      setUploading('media_load');
      const base64Promises = Array.from(files).map((file: File) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });
      const results = await Promise.all(base64Promises);
      setNewMedia(prev => ({ ...prev, media: results, url: results[0] }));
      setUploading(null);
      return;
    }

    const file = files[0];
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      if (target === 'media') {
        setNewMedia(prev => ({ ...prev, url: base64, media: [base64] }));
      } else {
        setUploading(target);
        try {
          await setDoc(doc(db, 'settings', 'site'), { [target]: base64 }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, 'settings');
        } finally {
          setUploading(null);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!isAdminUnlocked) return;

    // Reservations Listener
    const qRes = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'));
    const unsubRes = onSnapshot(qRes, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data() as Reservation, id: doc.id }));
      setReservations(data);
      setStats({
        total: data.length,
        pending: data.filter(r => r.status === 'PENDING').length,
        validated: data.filter(r => r.status === 'VALIDATED').length
      });
    });

    // Users List Listener
    const qUsers = query(collection(db, 'users_list'), orderBy('lastLogin', 'desc'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsersList(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    // News/Media Listener
    const qNews = query(collection(db, 'news'), orderBy('publishedAt', 'desc'));
    const unsubNews = onSnapshot(qNews, (snapshot) => {
      setNewsList(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          processedUrl: data.url || data.videoUrl || data.imageUrl || data.image || data.video || data.contentUrl || '',
          processedType: (data.type || (data.videoUrl || data.video ? 'video' : (data.imageUrl || data.image ? 'image' : 'text'))).toLowerCase(),
          processedDesc: data.desc || data.content || data.description || data.text || ''
        };
      }));
    });

    // Conversations Listener
    const qConv = query(collection(db, 'conversations'), orderBy('updatedAt', 'desc'));
    const unsubConv = onSnapshot(qConv, (snapshot) => {
      setConversations(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    // Fleet Listener
    const qFleet = query(collection(db, 'fleet'), orderBy('name', 'asc'));
    const unsubFleet = onSnapshot(qFleet, (snapshot) => {
      setFleetList(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    return () => { unsubRes(); unsubUsers(); unsubNews(); unsubConv(); unsubFleet(); };
  }, [isAdminUnlocked]);

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminCode === 'b012000b') {
      setIsAdminUnlocked(true);
    } else {
      alert("Code incorrect.");
    }
  };

  const copyToClipboard = (type: 'reservations' | 'users') => {
    let text = "";
    if (type === 'users') {
      text = "Email, Derniere Connexion\n";
      usersList.forEach(u => {
        text += `${u.email}, ${u.lastLogin ? new Date(u.lastLogin.seconds * 1000).toLocaleString() : 'N/A'}\n`;
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
      usersList.forEach(u => {
        csvContent += `${u.email},${u.lastLogin ? new Date(u.lastLogin.seconds * 1000).toISOString() : 'N/A'}\n`;
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
    try {
      // Basic validation: Title and desc are required
      if (!newMedia.title || !newMedia.desc) {
          alert("Titre et description sont requis.");
          return;
      }
      
      // If not text, URL/File is required
      if (newMedia.type !== 'text' && !newMedia.url) {
        alert("Veuillez sélectionner un fichier (image ou vidéo).");
        return;
      }

      await addDoc(collection(db, 'news'), {
        title: newMedia.title,
        desc: newMedia.desc,
        url: newMedia.url,
        type: newMedia.type,
        publishedAt: Date.now()
      });
      setNewMedia({ title: '', desc: '', url: '', type: 'image' });
      alert("Contenu publié avec succès !");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'news');
    }
  };

  const handleAction = async (resId: string, action: 'VALIDATED' | 'REJECTED') => {
    try {
      const ticketId = action === 'VALIDATED' ? `AMR-${Math.random().toString(36).substr(2, 6).toUpperCase()}` : '';
      await updateDoc(doc(db, 'reservations', resId), {
        status: action,
        validatedAt: Date.now(),
        validatedBy: auth.currentUser?.uid,
        ticketId
      });
    } catch (error) {
      console.error("Action failed", error);
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
          <div className="max-w-md w-full p-10 bg-white rounded-[32px] border border-slate-200 shadow-2xl">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <ShieldCheck size={40} />
            </div>
            <h3 className="text-xl font-extrabold uppercase tracking-tighter mb-6 italic">Accès Base de Données</h3>
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <input 
                type="password"
                placeholder="Entrez le code de sécurité"
                value={adminCode}
                onChange={e => setAdminCode(e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-500 font-mono text-center tracking-[0.5em] font-black"
                autoFocus
              />
              <button className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-600/20 hover:scale-105 transition-all">
                Déverrouiller
              </button>
            </form>
            <p className="mt-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Seul l'Administrateur peut accéder à cette section</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tighter uppercase text-black leading-none">Administration</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { id: 'reservations', label: 'Réservations', icon: Ticket },
                { id: 'users', label: 'Utilisateurs', icon: Users },
                { id: 'fleet', label: 'Flotte', icon: Anchor },
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
        
        {isAdminUnlocked && tab === 'reservations' && (
          <div className="space-y-6 w-full max-w-5xl mx-auto px-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-wrap justify-center gap-4">
                {[
                  { label: "Total", val: stats.total, color: "bg-black text-white" },
                  { label: "Pending", val: stats.pending, color: "bg-amber-100 text-amber-700 border border-amber-200" },
                  { label: "Validés", val: stats.validated, color: "bg-emerald-100 text-emerald-700 border border-emerald-200" }
                ].map((s, i) => (
                  <div key={i} className={cn("px-8 py-4 rounded-2xl text-center min-w-[140px]", s.color)}>
                    <p className="text-[9px] font-extrabold uppercase tracking-widest opacity-60 mb-1">{s.label}</p>
                    <p className="text-xl font-extrabold font-mono tracking-tighter leading-none">{s.val}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
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
                  {newsList.slice(0, 5).map(m => (
                    <div key={m.id} className="flex-shrink-0 w-32 group cursor-pointer" onClick={() => setTab('media')}>
                      <div className="aspect-square rounded-2xl overflow-hidden border border-slate-200 relative mb-2">
                        {m.type === 'video' ? (
                          <video src={m.url} className="w-full h-full object-cover" />
                        ) : m.type === 'image' ? (
                          <img src={m.url} className="w-full h-full object-cover" />
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
      </div>

      <div className="bg-white rounded-[32px] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
        {tab === 'reservations' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-10 py-6 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Client (Nom Complet)</th>
                  <th className="px-10 py-6 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Détails Voyage</th>
                  <th className="px-10 py-6 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 text-center">Paiement</th>
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
                    <td className="px-10 py-8 text-right">
                      <div className="flex justify-end gap-3 flex-wrap">
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
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter italic">Liste des Utilisateurs</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Utilisateurs enregistrés sur la plateforme</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => copyToClipboard('users')}
                  className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                   Copier Liste
                </button>
                <button 
                  onClick={() => exportCSV('users')}
                  className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                   Exporter CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-[24px]">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Utilisateur</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Email</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Dernière Connexion</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Vérifié</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {usersList.map((u, i) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-maritime text-white flex items-center justify-center font-black text-[10px]">
                            {u.displayName ? u.displayName[0].toUpperCase() : u.email[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-bold text-black uppercase tracking-tight">{u.displayName || 'Utilisateur'}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-xs font-mono text-slate-500">{u.email}</span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {u.lastLogin ? new Date(u.lastLogin.seconds * 1000).toLocaleString() : 'N/A'}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        {u.emailVerified ? (
                          <span className="text-[8px] font-black uppercase px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100">OUI</span>
                        ) : (
                          <span className="text-[8px] font-black uppercase px-2 py-1 bg-slate-50 text-slate-400 rounded-md border border-slate-200">NON</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {usersList.length === 0 && <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">Aucun utilisateur enregistré.</div>}
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
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">URL Image (Optionnel)</label>
                    <input 
                      value={boatForm.imageUrl}
                      onChange={e => setBoatForm({...boatForm, imageUrl: e.target.value})}
                      className="w-full px-6 py-3 border border-slate-200 rounded-xl focus:border-maritime outline-none text-xs font-mono"
                      placeholder="https://..."
                    />
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
                        <img src={boat.imageUrl} className="w-full h-full object-cover" />
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
        ) : tab === 'media' ? (
          <div className="p-12 space-y-16">
            <div className="max-w-2xl">
              <h3 className="text-lg font-extrabold text-maritime uppercase tracking-tighter mb-8 italic">Publier une Actualité</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setUploading('media_publish');
                try {
                  await addDoc(collection(db, 'news'), { 
                    ...newMedia, 
                    publishedAt: Date.now() 
                  });
                  setNewMedia({ title: '', desc: '', url: '', type: 'image', media: [] });
                  alert("Publié !");
                } catch (e) { handleFirestoreError(e, OperationType.CREATE, 'news'); }
                finally { setUploading(null); }
              }} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    required
                    placeholder="Titre de l'article"
                    value={newMedia.title}
                    onChange={e => setNewMedia({...newMedia, title: e.target.value})}
                    className="px-6 py-3 border border-slate-200 rounded-xl focus:border-maritime outline-none text-sm font-bold"
                  />
                  <select 
                    value={newMedia.type}
                    onChange={e => setNewMedia({...newMedia, type: e.target.value as any})}
                    className="px-6 py-3 border border-slate-200 rounded-xl focus:border-maritime outline-none text-[11px] font-bold uppercase tracking-widest"
                  >
                    <option value="image">Format Photo</option>
                    <option value="video">Format Vidéo</option>
                    <option value="text">Format Texte</option>
                  </select>
                </div>
                <textarea 
                  required
                  placeholder="Description ou contenu textuel..."
                  value={newMedia.desc}
                  onChange={e => setNewMedia({...newMedia, desc: e.target.value})}
                  className="w-full px-6 py-4 border border-slate-200 rounded-xl focus:border-maritime outline-none h-32 text-sm leading-relaxed"
                />
                <div className="flex gap-4 items-center">
                  {newMedia.type !== 'text' && (
                    <div className="flex-1">
                      <input 
                        type="file" 
                        ref={mediaInputRef}
                        onChange={e => handleFileUpload(e, 'media')}
                        className="hidden"
                        accept={newMedia.type === 'video' ? "video/*" : "image/*"}
                        multiple={newMedia.type === 'image'}
                      />
                      <button 
                        type="button"
                        onClick={() => mediaInputRef.current?.click()}
                        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-bold text-slate-400 hover:border-maritime hover:text-maritime transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                      >
                        <ImagePlus size={16} /> 
                        {newMedia.media.length > 0 ? `${newMedia.media.length} fichier(s) chargé(s) ✓` : `Charger ${newMedia.type === 'video' ? 'la Vidéo' : 'la Photo'}`}
                      </button>
                    </div>
                  )}
                  <button 
                    disabled={uploading === 'media_publish' || uploading === 'media_load' || (newMedia.type !== 'text' && !newMedia.url && newMedia.media.length === 0)}
                    className="px-12 py-3 bg-maritime text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-maritime/20 hover:scale-105 transition-all disabled:opacity-50"
                  >
                    {uploading === 'media_publish' ? "Envoi..." : "Publier"}
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-6">
              <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Contenus en Ligne</h4>
              <div className="flex flex-wrap gap-6">
                {newsList.map(m => (
                  <div key={m.id} className="w-56 group relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200">
                    <div className="absolute top-2 left-2 z-10">
                      <span className={cn(
                        "px-2 py-1 rounded-md text-[7px] font-black uppercase tracking-widest shadow-sm",
                        m.processedType === 'video' ? "bg-emerald-500 text-white" : m.processedType === 'text' ? "bg-indigo-500 text-white" : "bg-white text-black"
                      )}>
                        {m.processedType}
                      </span>
                    </div>
                    {m.processedType === 'video' ? (
                      <video src={m.processedUrl || undefined} className="w-full h-full object-cover" controls />
                    ) : m.processedType === 'text' ? (
                      <div className="p-6 h-full flex flex-col justify-center text-center bg-white">
                        <FileText size={32} className="mx-auto text-maritime opacity-20 mb-3" />
                        <p className="text-[11px] font-extrabold uppercase leading-tight line-clamp-3">{m.title}</p>
                      </div>
                    ) : (
                      <img src={m.processedUrl || undefined} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-maritime/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 text-center space-y-4">
                      <p className="text-[10px] font-bold text-white uppercase tracking-widest">{m.title}</p>
                      
                      <div className="flex gap-4 text-[9px] font-black text-white/60 uppercase tracking-widest">
                        <span className="flex items-center gap-1"><Eye size={12} className="text-gold" /> {m.views || 0}</span>
                        <NewsComments newsId={m.id} />
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => handleDeleteMedia(m.id)} className="w-10 h-10 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-rose-600 transition-all border border-white/20">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : tab === 'messages' ? (
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[600px]">
            <div className="md:col-span-4 border-r border-slate-100 overflow-y-auto max-h-[600px] bg-slate-50/20">
               <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-md sticky top-0 z-10">
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
                    {siteSettings?.homeBg && <img src={siteSettings.homeBg} className="w-full h-full object-cover" />}
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
                    {siteSettings?.homeDetail && <img src={siteSettings.homeDetail} className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-[2px]">
                      <input type="file" ref={detailInputRef} className="hidden" onChange={e => handleFileUpload(e, 'homeDetail')} accept="image/*" />
                      <button onClick={() => detailInputRef.current?.click()} className="px-6 py-2.5 bg-white text-maritime text-[10px] font-bold rounded-xl shadow-xl uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                        {uploading === 'homeDetail' ? "Téléchargement..." : "Remplacer"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function GalleryView({ siteSettings }: { siteSettings: any }) {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'video' | 'image' | 'text'>('all');

  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('publishedAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setMedia(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          processedUrl: data.url || data.videoUrl || data.imageUrl || data.image || data.video || data.contentUrl || '',
          processedType: (data.type || (data.videoUrl || data.video ? 'video' : (data.imageUrl || data.image ? 'image' : 'text'))).toLowerCase(),
          processedDesc: data.desc || data.content || data.description || data.text || ''
        };
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
          <h2 className="text-4xl font-extrabold tracking-tighter uppercase italic text-white">Galerie Officielle</h2>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold font-black">Expérience immersive Mugote</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {['all', 'video', 'image', 'text'].map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f as any)}
              className={cn(
                "px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                filter === f ? "bg-white text-black scale-110 shadow-xl" : "text-white/40 hover:text-white bg-white/5"
              )}
            >
              {f === 'all' ? 'Tout' : f === 'video' ? 'Vidéos' : f === 'image' ? 'Photos' : 'Textes'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-white/20 animate-pulse text-[10px] font-black uppercase tracking-widest">Initialisation du flux...</div>
      ) : filteredMedia.length === 0 ? (
        <div className="text-center py-20 text-white/10 text-[10px] font-black uppercase tracking-widest border border-dashed border-white/5 rounded-3xl">Aucun contenu trouvé dans cette catégorie</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredMedia.map((m, i) => (
            <motion.div 
              layout
              key={m.id} 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/5 border border-white/10 shadow-2xl rounded-3xl overflow-hidden flex flex-col group hover:border-gold/50 transition-all duration-500"
            >
              <div className="aspect-[16/10] bg-slate-900 relative overflow-hidden">
                {m.processedType === 'video' ? (
                  <div className="w-full h-full relative">
                    <video 
                      src={m.processedUrl || undefined} 
                      className="w-full h-full object-cover"
                      poster={siteSettings.homeDetail}
                      controls
                    />
                    <div className="absolute top-4 right-4 z-10">
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
              <div className="p-8 flex-1 flex flex-col bg-gradient-to-b from-white/5 to-transparent">
                <div className="mb-4">
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter leading-none italic group-hover:text-gold transition-colors">{m.title}</h3>
                  <div className="h-1 w-8 bg-gold/20 mt-2 rounded-full" />
                </div>
                <p className="text-white/40 text-[10px] font-bold leading-relaxed line-clamp-2 italic">{m.processedDesc}</p>
                <div className="mt-8 pt-4 border-t border-white/5 flex justify-between items-center text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">
                  <span className="flex items-center gap-2"><Clock size={10} /> {m.publishedAt ? (m.publishedAt.seconds ? new Date(m.publishedAt.seconds * 1000).toLocaleDateString() : new Date(m.publishedAt).toLocaleDateString()) : 'N/A'}</span>
                  <Anchor size={12} className="opacity-50" />
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
    const q = query(collection(db, 'news', newsId, 'comments'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
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
            views: increment(1)
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

function NewsView() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('publishedAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setNews(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          processedUrl: data.url || data.videoUrl || data.imageUrl || data.image || data.video || data.contentUrl || '',
          processedType: (data.type || (data.videoUrl || data.video ? 'video' : (data.imageUrl || data.image ? 'image' : 'text'))).toLowerCase(),
          processedDesc: data.desc || data.content || data.description || data.text || ''
        };
      }));
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
            <div key={i} className="bg-black border border-white/5 shadow-2xl shadow-black/50 rounded-xl overflow-hidden group hover:border-gold transition-all flex flex-col">
              <div className="p-8 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.3em] text-gold">{n.processedType === 'text' ? 'Actualité' : n.processedType === 'image' ? 'Photo' : 'Vidéo'}</span>
                  <h3 className="text-xl font-extrabold tracking-tighter leading-none text-white group-hover:text-gold transition-colors italic">{n.title}</h3>
                  <p className="text-white/60 text-xs font-medium leading-relaxed">{n.processedDesc}</p>
                  <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-white/30 pt-4 border-t border-white/5">
                    <span className="flex items-center gap-1.5"><Eye size={12} className="text-gold" /> {n.views || 0} vues</span>
                    <NewsComments newsId={n.id} />
                  </div>
                </div>
              </div>
              {(n.processedUrl || n.processedType === 'text') && (
                <div className="h-72 overflow-hidden bg-slate-900/50 flex items-center justify-center border-t border-white/5 shadow-inner relative">
                  {n.processedType === 'video' ? (
                    <video 
                      src={n.processedUrl || undefined} 
                      className="w-full h-full object-contain"
                      controls
                      autoPlay={false}
                      muted={false}
                    />
                  ) : n.processedType === 'image' ? (
                    <div className="w-full h-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar bg-slate-900">
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
              <div className="px-8 py-4 border-t border-white/5 bg-white/5 flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-slate-500">
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

  if (!user) return <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">Connectez-vous pour voir vos billets.</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
      <div className="border-b border-slate-200 pb-6 text-center">
        <h2 className="text-2xl font-extrabold tracking-tighter uppercase mb-1.5 italic">Mes Billets</h2>
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Historique de vos réservations et billets digitaux</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 text-center py-16 text-slate-400 animate-pulse uppercase text-[10px] font-bold tracking-widest">Chargement...</div>
        ) : tickets.length === 0 ? (
          <div className="col-span-2 text-center py-16 text-slate-400 uppercase text-[10px] font-bold tracking-widest border border-dashed border-slate-200 rounded-xl">Aucun billet trouvé.</div>
        ) : (
          tickets.map(res => (
            <div key={res.id} className="bg-white border border-slate-100 shadow-sm rounded-xl overflow-hidden flex flex-col md:flex-row hover:border-maritime transition-all group">
              <div className="md:w-28 bg-slate-50 flex flex-col items-center justify-center p-4 border-b md:border-b-0 md:border-r border-slate-100">
                {res.status === 'VALIDATED' ? (
                  <QRCodeSVG value={`https://ais-pre-esphb55wsxkem3z7oxg5he-830128486045.europe-west2.run.app/?verify=${res.id}`} size={64} />
                ) : (
                  <div className="w-16 h-16 bg-slate-100 flex items-center justify-center text-slate-300">
                    <QrCode size={32} />
                  </div>
                )}
                <p className="text-[7px] font-bold uppercase tracking-widest text-slate-400 mt-3 text-center">DGM Verify</p>
              </div>
              <div className="flex-1 p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                       <h3 className="text-sm font-extrabold tracking-tighter uppercase">{res.fullName} {res.lastName}</h3>
                       <span className="text-[9px] font-mono text-slate-300">#{res.ticketId || 'ID-'+res.id?.substring(0,6).toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full text-white" 
                            style={{ backgroundColor: CLASS_COLORS[res.travelClass]?.main || '#ccc' }}>
                        {res.travelClass}
                      </span>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{res.travelDate} • {res.departureTime} • {res.ship}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-[7px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 border rounded-sm",
                    res.status === 'VALIDATED' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : 
                    res.status === 'PENDING' ? "bg-amber-50 text-amber-600 border-amber-200" : 
                    "bg-red-50 text-red-600 border-red-200"
                  )}>
                    {res.status}
                  </span>
                </div>
                <div className="flex items-end justify-between pt-4 border-t border-slate-50">
                  <div className="text-left">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Itinéraire</p>
                    <p className="text-[11px] font-extrabold text-maritime uppercase">{res.itinerary}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total</p>
                    <p className="text-base font-extrabold text-maritime mono tracking-tighter">{res.amount}$</p>
                  </div>
                  {res.status === 'VALIDATED' && (
                    <button 
                      onClick={() => generateTicketPDF(res)}
                      className="px-4 py-1.5 bg-maritime text-white text-[8px] font-bold uppercase tracking-widest rounded-lg hover:bg-maritime-dark transition-all"
                    >
                      Billet
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
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
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto py-12">
      <div className="bg-white border border-slate-200 shadow-2xl rounded-sm overflow-hidden border-t-8 border-maritime">
        <div className="p-12 text-center border-b border-slate-100">
          <div className="w-20 h-20 bg-maritime/5 text-maritime rounded-sm flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={40} />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tighter uppercase mb-2">Vérification de Billet</h2>
          <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">Système Officiel AMR MUGOTE / DGM</p>
        </div>

        <div className="p-12 space-y-8">
          {loading ? (
            <div className="text-center py-10 animate-pulse text-slate-400 uppercase text-xs font-bold tracking-widest">Recherche dans la base de données...</div>
          ) : !res ? (
            <div className="text-center py-10 text-red-500 uppercase text-sm font-extrabold tracking-widest">
              Alerte : Billet Non Trouvé ou Invalide
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Statut de Validité</p>
                  <span className={cn(
                    "inline-block px-4 py-2 text-xs font-extrabold uppercase tracking-widest border rounded-sm",
                    res.status === 'VALIDATED' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200"
                  )}>
                    {res.status === 'VALIDATED' ? 'OFFICIELLEMENT VALIDÉ' : 'EN ATTENTE DE CONTRÔLE'}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Ticket ID</p>
                  <p className="text-lg font-extrabold mono tracking-tighter uppercase">#{res.ticketId || 'N/A'}</p>
                </div>
                <div className="col-span-2 pt-6 border-t border-slate-50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Passager</p>
                  <p className="text-2xl font-extrabold tracking-tighter uppercase">{res.fullName} {res.lastName}</p>
                </div>
                <div className="pt-6 border-t border-slate-50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Itinéraire</p>
                  <p className="text-lg font-extrabold tracking-tighter uppercase">{res.itinerary}</p>
                </div>
                <div className="pt-6 border-t border-slate-50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bateau</p>
                  <p className="text-lg font-extrabold tracking-tighter uppercase">{res.ship}</p>
                </div>
                <div className="pt-6 border-t border-slate-50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Date de Voyage</p>
                  <p className="text-lg font-extrabold mono tracking-tighter">{res.travelDate}</p>
                </div>
                <div className="pt-6 border-t border-slate-50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Classe</p>
                  <p className="text-lg font-extrabold tracking-tighter uppercase">{res.travelClass}</p>
                </div>
                <div className="pt-6 border-t border-slate-50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Montant Payé</p>
                  <p className="text-lg font-extrabold tracking-tighter uppercase">{res.amount}.00 USD</p>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border border-slate-100 rounded-sm">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Empreinte Digitale Transactionnelle</p>
                <p className="text-[10px] mono text-slate-600 break-all leading-relaxed">
                  ID: {res.transactionId}<br />
                  USER: {res.userId}<br />
                  VALID_TS: {res.validatedAt ? new Date(res.validatedAt).toISOString() : 'NOT_VALIDATED'}
                </p>
              </div>
            </>
          )}

          <button 
            onClick={onClose}
            className="w-full py-4 bg-slate-900 text-white text-[10px] font-extrabold uppercase tracking-[0.3em] rounded-sm hover:bg-black transition-all"
          >
            Fermer le Panneau
          </button>
        </div>
      </div>
    </motion.div>
  );
}

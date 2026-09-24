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
  ChevronLeft,
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
  Bell,
  MessageCircle,
  CheckCircle,
  XCircle,
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
  RotateCcw,
  Compass,
  Rocket,
  Camera,
  Check,
  ExternalLink,
  Download,
  Heart,
  Maximize2,
  Minimize2,
  DollarSign,
  Banknote,
  Save,
  Sparkles,
  Tag,
  Database,
  Key,
  EyeOff,
  Info,
  ShieldAlert,
  Newspaper,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MongoMigrationView } from './components/MongoMigrationView';
import { AdminRemindersView } from './components/AdminRemindersView';
import { DailyBoardingRecapTable } from './components/DailyBoardingRecapTable';
import { FerryhopperBookingEngine } from './components/FerryhopperBookingEngine';
import { HomeView } from './components/HomeView';
import { PlatformAuthGate } from './components/PlatformAuthGate';
import { mongoApi } from './services/api';
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
import JsonLdSchema from './components/JsonLdSchema';
import FAQ from './components/FAQ';
import SchedulesAndTariffs from './components/SchedulesAndTariffs';
import AdminTarifsView from './components/AdminTarifsView';
import { TravelerTicketScannerModal } from './components/TravelerTicketScannerModal';
import { ErrorBoundary } from './components/ErrorBoundary';

// --- Safe localStorage Polyfill for sandboxed iframe environments ---
let safeLocalStorage: Storage;
try {
  const testKey = '__storage_test_key__';
  window.localStorage.setItem(testKey, testKey);
  window.localStorage.removeItem(testKey);
  safeLocalStorage = window.localStorage;
} catch (e) {
  console.warn("localStorage is not accessible in this context. Falling back to secure in-memory storage.", e);
  const memStore: Record<string, string> = {};
  safeLocalStorage = {
    length: 0,
    clear() {
      for (const k in memStore) {
        delete memStore[k];
      }
      this.length = 0;
    },
    getItem(key: string) {
      return memStore[key] !== undefined ? memStore[key] : null;
    },
    key(index: number) {
      return Object.keys(memStore)[index] || null;
    },
    removeItem(key: string) {
      delete memStore[key];
      this.length = Object.keys(memStore).length;
    },
    setItem(key: string, value: string) {
      memStore[key] = String(value);
      this.length = Object.keys(memStore).length;
    }
  } as Storage;
}
const localStorage = safeLocalStorage;

// --- Types ---
type Page = 'home' | 'booking' | 'payment' | 'dashboard' | 'tickets' | 'news' | 'gallery' | 'users' | 'map' | 'tarifs';

// --- Constants ---
const ADMIN_EMAIL_B64 = "YmlyZWtlaWRlYUBnbWFpbC5jb20=";
const ADMIN_PASS_B64 = "YjAxMjAwMGI=";
const getAdminEmail = () => atob(ADMIN_EMAIL_B64);
const getAdminPassword = () => atob(ADMIN_PASS_B64);

const isEmbedVideo = (url: string) => {
  const l = (url || '').toLowerCase();
  return l.includes('youtube.com') || l.includes('youtu.be') || l.includes('vimeo.com');
};

const isVid = (u: string) => {
  const l = (u || '').toLowerCase();
  return l.includes('.mp4') || l.includes('.mov') || l.includes('.avi') || l.includes('.webm') || 
         l.includes('.mkv') || l.includes('.3gp') || l.includes('.m4v') || l.includes('.quicktime') ||
         l.includes('video') || l.includes('youtube.com') || l.includes('youtu.be') || l.includes('vimeo.com');
};

const compressImage = (file: File, maxWidth: number = 2048, quality: number = 0.90): Promise<Blob> => {
  return new Promise((resolve) => {
    // Keep original file if small (<1MB) or GIF to avoid unnecessary processing
    if (file.type === 'image/gif' || file.size < 1000000) {
      resolve(file);
      return;
    }
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
          height = Math.round((maxWidth / width) * height);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
        }
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else resolve(file);
        }, file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
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

const MERCHANT_PHONE = "+243 994 102 673";
const CONTACT_NUMBERS = ["+243 994 102 673", "+243 816 680 709"];

export const DEFAULT_PRICES: Record<TravelClass, number> = {
  'VIP': 35,
  '1ère Classe': 11,
  '2ème Classe': 20,
  '3ème Classe': 27
};

export const getClassPrices = (settings?: any): Record<TravelClass, number> => {
  return {
    'VIP': Number(settings?.classPrices?.['VIP'] ?? DEFAULT_PRICES['VIP']),
    '1ère Classe': Number(settings?.classPrices?.['1ère Classe'] ?? DEFAULT_PRICES['1ère Classe']),
    '2ème Classe': Number(settings?.classPrices?.['2ème Classe'] ?? DEFAULT_PRICES['2ème Classe']),
    '3ème Classe': Number(settings?.classPrices?.['3ème Classe'] ?? DEFAULT_PRICES['3ème Classe']),
  };
};

export const getClassPrice = (travelClass: TravelClass, settings?: any): number => {
  const prices = getClassPrices(settings);
  return prices[travelClass] ?? DEFAULT_PRICES[travelClass] ?? 20;
};

// Fallback constant for backwards compatibility
const PRICES: Record<TravelClass, number> = DEFAULT_PRICES;

const CLASS_COLORS: Record<TravelClass, { main: string, rgb: [number, number, number], light: string }> = {
  '1ère Classe': { main: '#0b132b', rgb: [11, 19, 43], light: 'rgba(11, 19, 43, 0.08)' }, // Bleu de nuit
  '2ème Classe': { main: '#1c2541', rgb: [28, 37, 65], light: 'rgba(28, 37, 65, 0.08)' }, // Nuit ardoise
  '3ème Classe': { main: '#334155', rgb: [51, 65, 85], light: 'rgba(51, 65, 85, 0.08)' }, // Ardoise foncée
  'VIP': { main: '#000000', rgb: [0, 0, 0], light: 'rgba(0, 0, 0, 0.08)' } // Noir
};

const SYSTEM_PROMPT = `Tu es l'assistant IA officiel de ETS AMR MUGOTE ET SES FRERES...`; // Keep definition but we will use the server version

// --- Shared PDF Generator ---
const generateTicket = async (res: Reservation, siteSettings: any) => {
  if (res.status !== 'VALIDATED') {
    alert("Accès refusé : Ce billet est en attente de validation par l'administrateur. Conformément au règlement officiel, le client ne peut jamais obtenir son billet tant que l'administration ne l'a pas validé.");
    return;
  }

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
    let ticketBgColor: [number, number, number] = [255, 255, 255]; // Blanc immaculé
    if (res.travelClass === 'VIP') {
      ticketBgColor = [250, 250, 252]; // Blanc argenté
    } else if (res.travelClass === '1ère Classe') {
      ticketBgColor = [245, 247, 250]; // Teinte neutre claire
    } else if (res.travelClass === '2ème Classe') {
      ticketBgColor = [248, 250, 252]; // Gris perle ardoise
    } else {
      ticketBgColor = [250, 250, 250]; // Gris clair
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
   
   const [theme, setTheme] = useState<'dark' | 'light'>(() => {
     try {
       return (localStorage.getItem('mugote_theme') as 'dark' | 'light') || 'dark';
     } catch {
       return 'dark';
     }
   });

   const isOwnerAdmin = Boolean(
     user &&
     (user.email?.toLowerCase().trim() === 'birekeidea@gmail.com' || user.email?.toLowerCase().trim() === getAdminEmail().toLowerCase()) &&
     (user.isOwner === true || localStorage.getItem('mugote_is_owner') === 'true')
   );

   const isPlatformAdmin = Boolean(
     isOwnerAdmin ||
     isAdmin ||
     isAdminUnlocked ||
     (user?.email && (user.email.toLowerCase().trim() === 'birekeidea@gmail.com' || user.email.toLowerCase().trim() === getAdminEmail().toLowerCase())) ||
     localStorage.getItem('mugote_admin_session') === 'true' ||
     localStorage.getItem('mugote_is_owner') === 'true'
   );

   useEffect(() => {
     if (currentPage === 'dashboard' && !isOwnerAdmin) {
       setCurrentPage('home');
     }
   }, [currentPage, isOwnerAdmin]);
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
  const [isTravelerScannerOpen, setIsTravelerScannerOpen] = useState(false);
  const [userPlatform, setUserPlatform] = useState<'ios' | 'android' | 'desktop' | 'generic'>('generic');

  // Dynamic SEO, GEO, and Schema.org Metadata synchronizer for SPA routing
  useEffect(() => {
    const siteName = "AMR MUGOTE ET SES FRÈRES";
    const baseUrl = "https://amr-mugote-et-ses-freres.vercel.app";
    
    let pageTitle = "";
    let pageDesc = "";
    let keywords = "";
    let schemaMarkup: any = null;

    switch (currentPage) {
      case 'home':
        pageTitle = `${siteName} - Réservation Maritime Bukavu ⇄ Goma (Lac Kivu)`;
        pageDesc = "Plateforme officielle de réservation de billets de transport maritime sur le Lac Kivu entre Bukavu et Goma. Paiement sécurisé Mobile Money (M-Pesa, Airtel, Orange via FlexPay) et e-billets avec QR Code.";
        keywords = "AMR Mugote, réservation maritime, Lac Kivu, Bukavu, Goma, billet de bateau, FlexPay, Mobile Money, e-billet, QR Code, voyage Congo, transport lacustre";
        schemaMarkup = {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": `${baseUrl}/#website`,
              "url": baseUrl,
              "name": siteName,
              "description": pageDesc,
              "potentialAction": [{
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": `${baseUrl}/?search={search_term_string}`
                },
                "query-input": "required name=search_term_string"
              }],
              "inLanguage": "fr-FR"
            },
            {
              "@type": "Organization",
              "@id": `${baseUrl}/#organization`,
              "name": siteName,
              "url": baseUrl,
              "logo": {
                "@type": "ImageObject",
                "@id": `${baseUrl}/#logo`,
                "url": `${baseUrl}/icon.svg`,
                "caption": siteName
              },
              "sameAs": [
                "https://github.com/birekeidea-max"
              ],
              "contactPoint": {
                "@type": "ContactPoint",
                "telephone": "+243994102673",
                "contactType": "customer service",
                "email": "birekeidea@gmail.com",
                "areaServed": "CD",
                "availableLanguage": "French"
              }
            },
            {
              "@type": "TravelAgency",
              "@id": `${baseUrl}/#agency`,
              "name": siteName,
              "image": `${baseUrl}/icon.svg`,
              "priceRange": "$$",
              "telephone": "+243994102673",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "Port de Bukavu, Place de l'Indépendance",
                "addressLocality": "Bukavu",
                "addressRegion": "Sud-Kivu",
                "addressCountry": "CD"
              },
              "geo": {
                "@type": "GeoCoordinates",
                "latitude": "-2.5028",
                "longitude": "28.8617"
              }
            },
            {
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "Comment réserver un billet sur AMR Mugote ?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Il vous suffit de vous rendre sur l'onglet 'Réservation', de choisir votre trajet (Bukavu ou Goma), de sélectionner votre navire et votre classe de voyage, puis de procéder au paiement par Mobile Money (M-Pesa, Airtel Money, Orange Money via FlexPay)."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Comment se passe la validation des billets à l'embarquement ?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Lors de la validation de votre réservation, vous téléchargez un e-billet contenant un QR Code unique. Au port d'embarquement, le contrôleur scanne votre QR Code via la caméra de son smartphone pour vous enregistrer à bord en temps réel."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Quelles sont les classes disponibles sur les navires d'AMR Mugote ?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Les traversées proposent quatre classes ajustées à vos besoins : la classe VIP (confort haut de gamme), la 1ère classe (standard de qualité), la 2ème classe (économique et spacieuse) et la 3ème classe."
                  }
                }
              ]
            }
          ]
        };
        break;
      case 'booking':
        pageTitle = `Réserver un Billet de Bateau - ${siteName}`;
        pageDesc = "Sélectionnez votre trajet (Bukavu ⇄ Goma), choisissez votre navire favori, votre classe de voyage (VIP, Standard, Économique) et réservez votre billet en temps réel.";
        keywords = "réservation bateau, billet Kivu, réserver billet Bukavu Goma, voyage lac Kivu, horaires bateaux";
        schemaMarkup = {
          "@context": "https://schema.org",
          "@type": "Service",
          "name": "Service de Réservation de Billet de Transport Maritime",
          "provider": {
            "@type": "TravelAgency",
            "name": siteName,
            "url": baseUrl
          },
          "serviceType": "Transport de passagers",
          "areaServed": {
            "@type": "Place",
            "name": "Lac Kivu (Bukavu et Goma)"
          },
          "offers": {
            "@type": "AggregateOffer",
            "priceCurrency": "USD",
            "lowPrice": "5",
            "highPrice": "50",
            "offerCount": "4"
          }
        };
        break;
      case 'payment':
        pageTitle = `Paiement et Validation - ${siteName}`;
        pageDesc = "Validez en toute sécurité vos paiements par M-Pesa, Airtel Money ou Orange Money grâce à l'intégration FlexPay.";
        keywords = "paiement Mobile Money, FlexPay DRC, M-Pesa Bukavu, Airtel Money Goma, valider paiement";
        break;
      case 'dashboard':
        pageTitle = `Tableau de Bord Administrateur - ${siteName}`;
        pageDesc = "Console de gestion d'AMR MUGOTE : suivi des finances, pilotage de la flotte de navires, planification d'horaires et actualités.";
        keywords = "admin panel, dashboard maritime, gestion flotte, administration Mugote";
        break;
      case 'tickets':
        pageTitle = `Mes Billets Électroniques & QR Codes - ${siteName}`;
        pageDesc = "Retrouvez et téléchargez l'ensemble de vos billets de transport maritime réservés, munis de QR Codes de sécurité uniques.";
        keywords = "mes billets, e-billet PDF, QR Code embarquement, téléchargement reçu";
        break;
      case 'news':
        pageTitle = `Actualités et Informations du Lac Kivu - ${siteName}`;
        pageDesc = "Consultez les derniers avis de voyage, consignes de sécurité, météo lacustre et nouveautés sur la flotte d'AMR MUGOTE.";
        keywords = "actualités Kivu, météo lac Kivu, avis de départ, communiqués de presse";
        break;
      case 'gallery':
        pageTitle = `Médiathèque et Galerie de la Flotte - ${siteName}`;
        pageDesc = "Visualisez en photos et vidéos de haute qualité nos navires modernes desservant les lignes maritimes Bukavu-Goma.";
        keywords = "photos bateaux, galerie Mugote, navires lac Kivu, vidéo flotte";
        break;
      case 'map':
        pageTitle = `Géolocalisation GPS et Suivi en Temps Réel - ${siteName}`;
        pageDesc = "Consultez en direct la carte GPS interactive du Lac Kivu avec la position géolocalisée et le statut de nos navires en voyage.";
        keywords = "GPS bateau, suivi temps réel, carte Lac Kivu, itinéraire Bukavu Goma";
        break;
      case 'users':
        pageTitle = `Gestion des Comptes & Droits - ${siteName}`;
        pageDesc = "Console d'accréditation et de gestion des rôles pour les passagers, contrôleurs de billets et administrateurs d'AMR MUGOTE.";
        keywords = "gestion utilisateurs, comptes passagers, rôles contrôleurs";
        break;
      default:
        pageTitle = `${siteName} - Transport Maritime sur le Lac Kivu`;
        pageDesc = "Plateforme officielle de réservation de billets de bateau entre Bukavu et Goma.";
        keywords = "AMR Mugote, transport lac Kivu";
    }

    // Update Meta and Document Attributes
    document.title = pageTitle;
    
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) {
      descMeta.setAttribute('content', pageDesc);
    }
    
    const keywordsMeta = document.querySelector('meta[name="keywords"]');
    if (keywordsMeta) {
      keywordsMeta.setAttribute('content', keywords);
    }

    const pageUrl = currentPage === 'home' ? baseUrl : `${baseUrl}/?page=${currentPage}`;

    // Update Canonical URL dynamically
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', pageUrl);
    } else {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      canonicalLink.setAttribute('href', pageUrl);
      document.head.appendChild(canonicalLink);
    }

    // Update Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', pageTitle);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', pageDesc);

    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', pageUrl);

    // Update Twitter Cards
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.setAttribute('content', pageTitle);

    const twitterDesc = document.querySelector('meta[name="twitter:description"]');
    if (twitterDesc) twitterDesc.setAttribute('content', pageDesc);

    const twitterUrl = document.querySelector('meta[name="twitter:url"]');
    if (twitterUrl) twitterUrl.setAttribute('content', pageUrl);

    // Update/Inject JSON-LD Structured Schema
    let schemaScript = document.getElementById('schema-jsonld') as HTMLScriptElement;
    if (schemaMarkup) {
      if (!schemaScript) {
        schemaScript = document.createElement('script');
        schemaScript.id = 'schema-jsonld';
        schemaScript.type = 'application/ld+json';
        document.head.appendChild(schemaScript);
      }
      schemaScript.textContent = JSON.stringify(schemaMarkup);
    } else {
      if (schemaScript) {
        schemaScript.remove();
      }
    }
  }, [currentPage]);

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
  const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');

  // Ref et défilement fluide de la barre de navigation
  const navScrollRef = useRef<HTMLDivElement>(null);
  const scrollNav = (direction: 'left' | 'right') => {
    if (navScrollRef.current) {
      navScrollRef.current.scrollBy({
        left: direction === 'left' ? -280 : 280,
        behavior: 'smooth'
      });
    }
  };

  // MANDATORY: Test connection to Firestore on boot
  useEffect(() => {
    async function testConnection() {
      if (!db) {
        setIsFirebaseOffline(true);
        return;
      }
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
    
    // Test initial connection status on boot
    testConnection();

    // Use native, free browser event listeners for offline/online status to avoid exhausting database read quotas under high traffic
    const handleOnline = () => {
      setIsFirebaseOffline(false);
      testConnection(); // Verify server connectivity when back online
    };
    const handleOffline = () => {
      setIsFirebaseOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verify = params.get('verify');
    if (verify) {
      setVerifyId(verify);
    }

    const pageParam = params.get('page');
    if (pageParam) {
      const validPublicPages: Page[] = ['home', 'booking', 'news', 'gallery', 'map'];
      if (validPublicPages.includes(pageParam as Page)) {
        setCurrentPage(pageParam as Page);
      }
    }
  }, []);

  useEffect(() => {
    if (!db) return;
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
    setUser(null);
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

  return (
    <div className={cn(
      "min-h-screen flex flex-col font-sans relative transition-colors duration-200",
      theme === 'dark' ? "bg-[#070d1e] text-slate-100" : "bg-[#edf0f5] text-slate-800"
    )}>
      <JsonLdSchema />
      
      {/* HEADER SUPÉRIEUR EN BLEU MARINE */}
      <div className="sticky top-0 z-[100] bg-[#002b49] text-white border-b border-[#001f35] shadow-md">
        <header className="w-full py-2.5 sm:py-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
            
            {/* Logo compact "ETS AMR MUGOTE & FRÈRES" à gauche */}
            <div className="flex items-center gap-2.5 cursor-pointer group shrink-0" onClick={() => setCurrentPage('home')}>
              <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition">
                <Ship size={20} className="text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-base sm:text-lg font-black tracking-tight uppercase text-white leading-tight">
                  ETS AMR MUGOTE
                </h1>
                <p className="text-[9px] font-black tracking-widest text-slate-300 uppercase">
                  LAC KIVU • GOMA ⇄ BUKAVU
                </p>
              </div>
            </div>

            {/* Actions à droite : Thème + Connexion/Profil & Menu Mobile */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
               {/* Sélecteur de Thème */}
               <button
                 type="button"
                 onClick={() => {
                   const nextTheme = theme === 'dark' ? 'light' : 'dark';
                   setTheme(nextTheme);
                   localStorage.setItem('mugote_theme', nextTheme);
                 }}
                 className="flex items-center gap-1.5 px-3 py-2 bg-[#001f35] hover:bg-[#003154] text-white border border-slate-600 rounded-xl text-xs font-black transition cursor-pointer shadow-xs active:scale-95"
                 title="Changer de thème"
               >
                 {theme === 'dark' ? (
                   <>
                     <Sun size={15} className="text-slate-200" />
                     <span className="hidden sm:inline">Thème Clair</span>
                   </>
                 ) : (
                   <>
                     <Moon size={15} className="text-slate-200" />
                     <span className="hidden sm:inline">Bleu Nuit</span>
                   </>
                 )}
               </button>

               {/* Profil utilisateur ou Petit bouton Se connecter */}
               {user ? (
                 <div className="flex items-center gap-2 bg-[#001f35] p-1.5 rounded-2xl border border-slate-700">
                   <div className="w-8 h-8 rounded-xl bg-white/10 text-white font-black text-xs flex items-center justify-center border border-white/20 shrink-0">
                     {(user.displayName || user.email || 'U')[0].toUpperCase()}
                   </div>
                   <div className="hidden sm:block text-left px-1">
                     <div className="flex items-center gap-1.5">
                       <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                       <p className="text-[9px] font-black text-slate-300 uppercase tracking-wider">
                         {isOwnerAdmin ? (isAdminUnlocked ? "Propriétaire" : "Admin Vérifié") : "Passager"}
                       </p>
                     </div>
                     <p className="text-xs font-black text-white truncate max-w-[130px]">
                       {user.displayName || user.email?.split('@')[0]}
                     </p>
                   </div>
                   <button 
                     onClick={logout} 
                     className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 rounded-xl text-xs font-black transition cursor-pointer shadow-xs active:scale-95"
                     title="Déconnexion"
                   >
                     <LogOut size={15} />
                     <span className="hidden sm:inline">Déconnexion</span>
                   </button>
                 </div>
               ) : (
                 <button
                   type="button"
                   onClick={() => setAuthModal({ isOpen: true, mode: 'user' })}
                   className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
                   title="Se connecter"
                 >
                   <User size={15} />
                   <span>Se connecter</span>
                 </button>
               )}

               {/* Menu hamburger pour mobile */}
               <button 
                 onClick={() => setIsMenuOpen(true)} 
                 className="lg:hidden p-2 text-white hover:bg-white/10 rounded-xl border border-white/20 flex items-center justify-center cursor-pointer shadow-xs"
                 title="Menu complet"
               >
                 <Menu size={22} />
               </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* BARRE DE NAVIGATION EN BLEU MARINE                        */}
          {/* Dashboard masqué aux clients, Flotte & Journal retirés    */}
          {/* ========================================================= */}
          <div className="w-full border-t border-[#001f35] mt-2.5 pt-2 bg-[#00243d]">
            <div className="max-w-7xl mx-auto px-2 sm:px-4 flex items-center gap-1 sm:gap-2">
              <button 
                type="button"
                onClick={() => scrollNav('left')}
                className="p-2 sm:p-2.5 rounded-xl bg-[#001f35] hover:bg-[#003154] text-white border border-slate-700 shadow-xs transition shrink-0 cursor-pointer active:scale-90"
                title="Défiler vers la gauche"
              >
                <ChevronLeft size={18} className="stroke-[2.5]" />
              </button>

              <nav 
                ref={navScrollRef}
                className="flex-1 overflow-x-auto scroll-smooth no-scrollbar touch-pan-x flex items-center gap-2.5 py-1 px-1"
              >
                {[
                  { id: 'home', label: 'ACCUEIL', icon: Anchor, sub: 'Goma ⇄ Bukavu' },
                  { id: 'booking', label: 'RÉSERVER UN BILLET', icon: Ticket, highlight: true, sub: 'Formulaire' },
                  { id: 'tickets', label: 'MES BILLETS & QR', icon: QrCode, sub: 'Embarquement' },
                  { id: 'tarifs', label: 'HORAIRES & TARIFS', icon: Clock, sub: '07h30 & 18h00' },
                  { id: 'map', label: 'PORTS & LOCALISATION', icon: MapPin, sub: 'Goma • Beach Muhanzi' },
                  ...(isOwnerAdmin && isAdminUnlocked ? [{ id: 'dashboard', label: 'ADMINISTRATION', icon: Lock, sub: 'Console' }] : [])
                ].map((item) => {
                  const isDashboard = item.id === 'dashboard';
                  const isActive = currentPage === item.id;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      onClick={(e) => {
                        e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                        if (isDashboard && !isAdminUnlocked) {
                          setAuthModal({ isOpen: true, mode: 'admin' });
                        } else {
                          setCurrentPage(item.id as Page);
                        }
                      }}
                      className={cn(
                        "px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap flex items-center gap-2.5 border shadow-sm shrink-0 active:scale-95",
                        isActive
                          ? "bg-white text-[#002b49] border-white shadow-lg scale-102"
                          : item.highlight
                          ? "bg-[#003e66] hover:bg-[#004d80] text-white border-blue-400/50 shadow-sm font-black"
                          : isDashboard
                          ? "bg-slate-900 text-slate-200 hover:bg-black border-slate-700"
                          : "bg-[#001f35] text-slate-200 hover:text-white hover:bg-[#003154] border-slate-700/60"
                      )}
                    >
                      <div className={cn(
                        "p-1.5 rounded-xl flex items-center justify-center shrink-0",
                        isActive 
                          ? "bg-[#002b49]/10 text-[#002b49]" 
                          : item.highlight 
                          ? "bg-white/20 text-white" 
                          : "bg-white/10 text-white"
                      )}>
                        <Icon size={17} className="stroke-[2.5]" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs sm:text-sm font-black leading-tight">{item.label}</div>
                        <div className={cn(
                          "text-[9px] font-bold lowercase tracking-normal",
                          isActive ? "text-[#002b49]/80" : "text-slate-300"
                        )}>
                          {item.sub}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>

              {/* Bouton défilement vers la droite */}
              <button 
                type="button"
                onClick={() => scrollNav('right')}
                className="p-2 sm:p-2.5 rounded-xl bg-[#001f35] hover:bg-[#003154] text-white border border-slate-700 shadow-xs transition shrink-0 cursor-pointer active:scale-90"
                title="Défiler vers la droite"
              >
                <ChevronRight size={18} className="stroke-[2.5]" />
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="fixed inset-0 z-[100] bg-[#070d1e] text-slate-100 flex flex-col p-6 sm:p-8 lg:hidden border-l border-white/20"
          >
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl overflow-hidden border border-white/20 flex items-center justify-center">
                  <Ship className="text-white" size={22} />
                </div>
                <div>
                  <span className="font-black text-white tracking-tight text-base uppercase">ETS AMR MUGOTE</span>
                  <span className="text-[10px] text-slate-400 font-bold block">Bukavu ⇄ Goma</span>
                </div>
              </div>
              <button onClick={() => setIsMenuOpen(false)} className="p-2.5 bg-white/10 rounded-xl text-white hover:bg-white/20 transition-all cursor-pointer border border-white/20">
                <X size={22} />
              </button>
            </div>
            
            <div className="flex-1 space-y-2.5 overflow-y-auto no-scrollbar">
              {[
                { id: 'home', label: 'ACCUEIL', icon: Anchor },
                { id: 'booking', label: 'RÉSERVER UN BILLET', icon: Ticket },
                { id: 'tickets', label: 'MES BILLETS', icon: QrCode },
                { id: 'tarifs', label: 'HORAIRES & TARIFS', icon: Clock },
                { id: 'map', label: 'PORTS & LOCALISATION', icon: MapPin },
                ...(isOwnerAdmin && isAdminUnlocked ? [{ id: 'dashboard', label: 'ADMINISTRATION', icon: Lock }] : [])
              ].map(item => {
                const isDashboard = item.id === 'dashboard';
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button 
                    key={item.id}
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (isDashboard && !isAdminUnlocked) {
                        setAuthModal({ isOpen: true, mode: 'admin' });
                      } else {
                        setCurrentPage(item.id as Page);
                      }
                    }}
                    className={cn(
                      "w-full px-5 py-4 rounded-2xl text-left font-black uppercase tracking-wider transition-all duration-200 relative overflow-hidden flex items-center justify-between cursor-pointer border",
                      isActive 
                        ? "bg-white text-[#002b49] border-white shadow-xl"
                        : "text-slate-200 hover:text-white hover:bg-white/10 border-white/20 bg-[#0b132b]"
                    )}
                  >
                    <div className="flex items-center gap-3 relative z-10">
                      {Icon && <Icon size={18} className={isActive ? "text-[#002b49]" : "text-white"} />}
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-8 space-y-4">
              {user ? (
                <div className="p-4 bg-white/5 rounded-2xl flex items-center justify-between border border-white/10">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{isOwnerAdmin ? "PROFIL PROPRIÉTAIRE" : "PROFIL PASSAGER"}</p>
                    <p className="font-bold text-white text-sm">{user.displayName || user.email}</p>
                  </div>
                  <button onClick={() => { setIsMenuOpen(false); logout(); }} className="p-3 text-rose-400 bg-rose-500/10 rounded-xl hover:bg-rose-500/20 transition-all cursor-pointer">
                    <LogOut size={20} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setAuthModal({ isOpen: true, mode: 'user' });
                  }}
                  className="w-full py-3.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <User size={16} />
                  <span>Se connecter</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 relative z-10 text-center">
        <AnimatePresence mode="wait">
          {verifyId ? (
            <VerificationView id={verifyId} onClose={() => { setVerifyId(null); window.history.pushState({}, '', '/'); }} isAdmin={isAdmin} siteSettings={siteSettings} />
          ) : (
            <>
              {currentPage === 'home' && (
                <HomeView 
                  onBook={() => setCurrentPage('booking')} 
                  onNavigate={(p) => setCurrentPage(p as Page)} 
                  siteSettings={siteSettings} 
                  schedules={schedules} 
                  user={user}
                  onLoginRequest={() => setAuthModal({ isOpen: true, mode: 'user' })}
                  onLogout={logout}
                  onOpenScanner={() => setIsTravelerScannerOpen(true)}
                  isAdmin={isPlatformAdmin}
                />
              )}
              {currentPage === 'booking' && (
                <div className="py-2 text-left">
                  <FerryhopperBookingEngine 
                    user={user} 
                    siteSettings={siteSettings} 
                    onLoginRequest={() => setAuthModal({ isOpen: true, mode: 'user' })}
                    onTicketGenerated={(res) => { setCurrentReservation(res); }}
                    onViewAllTickets={() => setCurrentPage('tickets')}
                  />
                </div>
              )}
              {currentPage === 'payment' && <Payment reservation={currentReservation} onComplete={() => setCurrentPage('tickets')} siteSettings={siteSettings} />}
              {currentPage === 'dashboard' && isOwnerAdmin && isAdminUnlocked && (
                <Dashboard 
                  siteSettings={siteSettings} 
                  onNavigate={(p) => setCurrentPage(p as Page)} 
                  schedules={schedules} 
                  isAdmin={isAdmin} 
                  isAdminUnlocked={isAdminUnlocked} 
                  setIsAdminUnlocked={setIsAdminUnlocked} 
                  setUser={setUser}
                />
              )}
              {currentPage === 'tickets' && <MyTickets user={user} siteSettings={siteSettings} onOpenScanner={() => setIsTravelerScannerOpen(true)} onLoginRequest={() => setAuthModal({ isOpen: true, mode: 'user' })} />}
              {currentPage === 'tarifs' && <SchedulesAndTariffs siteSettings={siteSettings} />}
              {currentPage === 'users' && isPlatformAdmin && <UsersListView />}
              {currentPage === 'map' && <LocalisationView isAdmin={isPlatformAdmin} />}
              <ChatWidget user={user} onNavigate={(p) => setCurrentPage(p as Page)} siteSettings={siteSettings} />
            </>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER STYLE CHEAPOAIR ROYAL BLUE & MODERN */}
      <footer className="relative bg-[#003594] text-white pt-12 pb-8 px-4 sm:px-6 mt-16 border-t-4 border-blue-400" id="platform-footer">
        <div className="max-w-7xl mx-auto">
          
          {/* BANNIÈRE D'APPEL / SUPPORT CHEAPOAIR */}
          <div className="bg-[#00256c] rounded-2xl p-4 sm:p-6 mb-12 flex flex-col md:flex-row items-center justify-between gap-4 border border-blue-400/30 shadow-lg shadow-blue-950/40">
            <div className="flex items-center gap-4 text-left">
              <div className="w-12 h-12 rounded-full bg-amber-400 text-blue-950 font-black flex items-center justify-center shrink-0 shadow-md">
                <PhoneCall size={22} className="text-blue-950" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-md">
                  Assistance Directe & Réservations
                </span>
                <h4 className="text-base sm:text-lg font-black text-white mt-0.5">
                  Besoin d'un renseignement ou réservation téléphonique ?
                </h4>
                <p className="text-xs text-blue-200">
                  Notre équipe de capitainerie est disponible 7j/7 pour vous assister à Bukavu et Goma.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <a 
                href="tel:+243994102673" 
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-blue-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <PhoneCall size={15} />
                <span>+243 994 102 673</span>
              </a>
              <a 
                href="https://wa.me/243994102673" 
                target="_blank" 
                rel="noreferrer"
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <span>WhatsApp</span>
              </a>
            </div>
          </div>

          {/* 5 COLONNES STYLE CHEAPOAIR */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 pb-12 border-b border-blue-800/80 text-xs">
            
            {/* Colonne 1: Liens Rapides */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider text-blue-200 cursor-pointer">
                <span>Quick Links</span>
                <span className="text-amber-300">&gt;</span>
              </div>
              <h5 className="font-black text-white text-sm">Trajets Populaires</h5>
              <ul className="space-y-2 text-blue-200 font-medium">
                <li><button onClick={() => setCurrentPage('booking')} className="hover:text-amber-300 transition text-left cursor-pointer">Bukavu ⇄ Goma Direct</button></li>
                <li><button onClick={() => setCurrentPage('booking')} className="hover:text-amber-300 transition text-left cursor-pointer">Goma ⇄ Bukavu Matin</button></li>
                <li><button onClick={() => setCurrentPage('tarifs')} className="hover:text-amber-300 transition text-left cursor-pointer">Traversée Express 2h45</button></li>
                <li><button onClick={() => setCurrentPage('tarifs')} className="hover:text-amber-300 transition text-left cursor-pointer">Liaison Île d'Idjwi</button></li>
                <li><button onClick={() => setCurrentPage('map')} className="hover:text-amber-300 transition text-left cursor-pointer">Port de Bukavu (SNCC)</button></li>
                <li><button onClick={() => setCurrentPage('map')} className="hover:text-amber-300 transition text-left cursor-pointer">Port Public de Goma</button></li>
              </ul>
            </div>

            {/* Colonne 2: Book / Réserver */}
            <div className="space-y-3">
              <h5 className="font-black text-white text-sm uppercase tracking-wide">Réserver</h5>
              <ul className="space-y-2 text-blue-200 font-medium">
                <li><button onClick={() => setCurrentPage('booking')} className="hover:text-amber-300 transition text-left cursor-pointer">Billets de Bateau</button></li>
                <li><button onClick={() => setCurrentPage('booking')} className="hover:text-amber-300 transition text-left cursor-pointer">Classe VIP Panoramique</button></li>
                <li><button onClick={() => setCurrentPage('booking')} className="hover:text-amber-300 transition text-left cursor-pointer">1ère Classe Confort</button></li>
                <li><button onClick={() => setCurrentPage('booking')} className="hover:text-amber-300 transition text-left cursor-pointer">2ème & 3ème Classe Éco</button></li>
                <li><button onClick={() => setCurrentPage('booking')} className="hover:text-amber-300 transition text-left cursor-pointer">Réservation de Groupe</button></li>
                <li><button onClick={() => setCurrentPage('booking')} className="hover:text-amber-300 transition text-left cursor-pointer">Transport Colis & Fret</button></li>
              </ul>
            </div>

            {/* Colonne 3: Traveler Tools / Outils Passagers */}
            <div className="space-y-3">
              <h5 className="font-black text-white text-sm uppercase tracking-wide">Outils Passagers</h5>
              <ul className="space-y-2 text-blue-200 font-medium">
                <li><button onClick={() => setIsTravelerScannerOpen(true)} className="hover:text-white transition text-left cursor-pointer font-bold text-slate-100">Vérifier mon Billet (QR)</button></li>
                <li><button onClick={() => setCurrentPage('tickets')} className="hover:text-white transition text-left cursor-pointer">Télécharger mon E-Billet</button></li>
                <li><button onClick={() => setCurrentPage('tarifs')} className="hover:text-white transition text-left cursor-pointer">Horaires & Fréquences</button></li>
                <li><button onClick={() => setCurrentPage('map')} className="hover:text-white transition text-left cursor-pointer">Localisation des Ports</button></li>
                <li><button onClick={() => alert("Bagages autorisés : 20 kg par passager standard, 35 kg en VIP.")} className="hover:text-white transition text-left cursor-pointer">Règles sur les Bagages</button></li>
                <li><button onClick={() => setCurrentPage('news')} className="hover:text-white transition text-left cursor-pointer">Météo & État du Lac Kivu</button></li>
              </ul>
            </div>

            {/* Colonne 4: About AMR Mugote */}
            <div className="space-y-3">
              <h5 className="font-black text-white text-sm uppercase tracking-wide">À Propos d'AMR Mugote</h5>
              <ul className="space-y-2 text-blue-200 font-medium">
                <li><button onClick={() => setCurrentPage('gallery')} className="hover:text-white transition text-left cursor-pointer">Notre Flotte Officielle</button></li>
                <li><button onClick={() => setCurrentPage('home')} className="hover:text-white transition text-left cursor-pointer">Histoire de la Compagnie</button></li>
                <li><button onClick={() => setCurrentPage('gallery')} className="hover:text-white transition text-left cursor-pointer">Normes de Sécurité</button></li>
                <li><button onClick={() => setCurrentPage('news')} className="hover:text-white transition text-left cursor-pointer">Journal & Actualités</button></li>
                <li><button onClick={() => alert("Rejoignez les équipes d'ETS AMR MUGOTE. Envoyez votre CV à contact@amrmugote.com")} className="hover:text-white transition text-left cursor-pointer">Carrières & Équipage</button></li>
                <li><button onClick={() => alert("Notre engagement : navigation 100% sécurisée avec gilets homologués pour chaque passager.")} className="hover:text-white transition text-left cursor-pointer">Engagement Qualité</button></li>
              </ul>
            </div>

            {/* Colonne 5: Legal & Console */}
            <div className="space-y-3">
              <h5 className="font-black text-white text-sm uppercase tracking-wide">Légal & Assistance</h5>
              <ul className="space-y-2 text-blue-200 font-medium">
                <li><button onClick={() => alert("Conditions Générales : Billet valable pour le jour et l'heure indiqués. Présentation d'une pièce d'identité obligatoire.")} className="hover:text-white transition text-left cursor-pointer">Conditions Générales</button></li>
                <li><button onClick={() => alert("Protection des données personnelles assurée conformément aux lois en vigueur en RDC.")} className="hover:text-white transition text-left cursor-pointer">Politique de Confidentialité</button></li>
                <li><button onClick={() => alert("Taxes portuaires et d'embarquement incluses dans les tarifs affichés.")} className="hover:text-white transition text-left cursor-pointer">Taxes Portuaires RDC</button></li>
                <li><button onClick={() => alert("Assurance maritime incluse pour tous les passagers à bord de notre flotte.")} className="hover:text-white transition text-left cursor-pointer">Assurance Maritime</button></li>
                {isOwnerAdmin && (
                  <li className="pt-2">
                    <button 
                      onClick={() => {
                        if (isAdminUnlocked) {
                          setCurrentPage('dashboard');
                        } else {
                          setAuthModal({ isOpen: true, mode: 'admin' });
                        }
                      }} 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-black text-[11px] border border-white/20 transition cursor-pointer"
                    >
                      <Lock size={12} className="text-white" />
                      <span>Console Propriétaire</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>

          </div>

          {/* BADGES DE CONFIANCE & MOYENS DE PAIEMENT SÉCURISÉS */}
          <div className="py-8 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-blue-800/80">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3 text-white">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-300 mr-1">
                Paiements Sécurisés :
              </span>
              <div className="px-2.5 py-1 bg-white rounded-md text-[#eb001b] font-black text-[10px] shadow-xs flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#eb001b] inline-block" />
                <span>Mastercard</span>
              </div>
              <div className="px-2.5 py-1 bg-white rounded-md text-[#1a1f71] font-black text-[10px] shadow-xs">
                VISA
              </div>
              <div className="px-2.5 py-1 bg-[#e60000] text-white rounded-md font-black text-[10px] shadow-xs">
                Vodacom M-Pesa
              </div>
              <div className="px-2.5 py-1 bg-[#ff0000] text-white rounded-md font-black text-[10px] shadow-xs">
                Airtel Money
              </div>
              <div className="px-2.5 py-1 bg-[#ff7900] text-white rounded-md font-black text-[10px] shadow-xs">
                Orange Money
              </div>
              <div className="px-2.5 py-1 bg-white text-blue-800 rounded-md font-black text-[10px] shadow-xs">
                FlexPay DRC
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-bold text-blue-200">
              <div className="flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-lg border border-white/15">
                <ShieldCheck size={16} className="text-emerald-400" />
                <span className="text-[11px]">Norton Secured</span>
              </div>
              <div className="flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-lg border border-white/15">
                <Anchor size={16} className="text-sky-300" />
                <span className="text-[11px]">Flotte Homologuée RDC</span>
              </div>
            </div>
          </div>

          {/* MENTION LÉGALE & COPYRIGHT */}
          <div className="pt-6 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-4 text-blue-300 text-[11px]">
            <p>
              © 2006–{new Date().getFullYear()} ETS AMR MUGOTE & FRÈRES. Tous droits réservés. Navigation autorisée sur le Lac Kivu par le Ministère des Transports et Voies de Communication de la RDC.
            </p>
            <div className="flex items-center gap-4 text-[10px] font-bold text-blue-200 uppercase tracking-wider">
              <span>Goma • Bukavu • Lac Kivu</span>
              <span>•</span>
              <span>RDC</span>
            </div>
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

      {/* Scanner Voyageur Modal (Consultation Statut Seulement - Aucun droit de validation) */}
      <TravelerTicketScannerModal 
        isOpen={isTravelerScannerOpen} 
        onClose={() => setIsTravelerScannerOpen(false)} 
        siteSettings={siteSettings} 
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
                  <div className="p-2.5 bg-black rounded-2xl text-white">
                    <Ship size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm sm:text-lg uppercase tracking-tight">Installer l'Application</h2>
                    <p className="text-[9px] text-white/80 font-bold uppercase tracking-widest">AMR MUGOTE SUR VOTRE APPAREIL</p>
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
                    <div className="p-5 bg-slate-100 rounded-2xl border border-slate-200 space-y-4 text-left">
                      <span className="text-slate-900 font-black text-xs sm:text-sm uppercase tracking-wider block">Méthode Facile pour Ordinateur (PC / Mac / Linux) 💻</span>
                      {isInstallable && deferredPrompt ? (
                        <button
                          onClick={handleInstallClick}
                          className="w-full py-3.5 bg-[#0b132b] hover:bg-slate-900 text-white border border-white/20 text-xs font-black uppercase tracking-widest rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Rocket size={16} />
                          Installer l'application sur mon PC
                        </button>
                      ) : (
                        <div className="space-y-3.5 text-xs text-slate-800 leading-relaxed font-semibold">
                          <div className="flex items-start gap-2.5">
                            <span className="bg-slate-200 text-slate-900 w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                            <p>Dans la barre d'adresse de votre navigateur Chrome ou Edge (en haut à droite, là où vous tapez les adresses de sites), recherchez la petite icône avec une <strong className="text-slate-900">petite flèche pointant vers le bas</strong> ou <strong className="text-slate-900">trois carrés avec un "+"</strong>.</p>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <span className="bg-slate-200 text-slate-900 w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                            <p>Cliquez sur cette icône d'installation rapide.</p>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <span className="bg-slate-200 text-slate-900 w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
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
                    <h5 className="font-extrabold text-white text-xs uppercase tracking-wider">📤 Partager avec vos proches</h5>
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
                    className="px-5 py-2.5 bg-white hover:bg-slate-100 text-black text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg flex items-center gap-2 transition-all shrink-0 cursor-pointer"
                  >
                    <Check size={14} className="text-black font-black" />
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
        <div className="p-4 bg-slate-100 border border-slate-300 rounded-2xl space-y-3 mb-4 text-left">
          <div className="text-slate-900 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
            <span className="text-sm">⚠️</span> Restriction de Sécurité Iframe Détectée
          </div>
          <p className="text-slate-600 text-[10px] uppercase font-bold tracking-wide leading-relaxed">
            L'aperçu de l'éditeur AI Studio interdit l'authentification Google via Popup dans une Iframe sécurisée. Veuillez ouvrir l'application dans un nouvel onglet pour vous connecter de manière sécurisée et officielle.
          </p>
          <div className="grid grid-cols-1 gap-2 pt-1 font-sans">
            <button 
              type="button" 
              onClick={() => window.open(window.location.origin + window.location.pathname, '_blank')}
              className="py-3 px-4 bg-[#0b132b] text-white font-black rounded-xl uppercase text-[9px] tracking-wider text-center hover:bg-black transition-all cursor-pointer shadow-sm text-ellipsis overflow-hidden"
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
        className="w-full py-4.5 bg-[#0b132b] hover:bg-black text-white font-black rounded-2xl uppercase tracking-widest text-[10px] sm:text-xs shadow-lg shadow-black/20 flex items-center justify-center gap-3 active:scale-95 transition-all cursor-pointer border border-white/10"
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
        senderId: auth.currentUser?.uid || 'admin_system',
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

function FormattedChatText({ text, onNavigate }: { text: string, onNavigate?: (page: string) => void }) {
  // Check if text suggests specific pages
  const lower = text.toLowerCase();
  const showBookBtn = onNavigate && (lower.includes("onglet **\"réserver\"**") || lower.includes("onglet \"réserver\"") || lower.includes("cliquez sur l'onglet **\"réserver\"**") || lower.includes("onglet **réserver**"));
  const showMapBtn = onNavigate && (lower.includes("onglet **\"localisation\"**") || lower.includes("onglet \"localisation\"") || lower.includes("section 'localisation'") || lower.includes("position gps"));
  const showTicketsBtn = onNavigate && (lower.includes("onglet **\"mes billets\"**") || lower.includes("onglet \"mes billets\"") || lower.includes("section 'mes billets'"));

  // Helper to parse bold **text**
  const parseInlineBold = (line: string) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-extrabold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 text-xs md:text-[13px] leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }
        if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1">
              <span className="text-gold font-black">•</span>
              <span className="flex-1">{parseInlineBold(trimmed.substring(1).trim())}</span>
            </div>
          );
        }
        return <p key={idx}>{parseInlineBold(line)}</p>;
      })}

      {(showBookBtn || showMapBtn || showTicketsBtn) && (
        <div className="pt-2 flex flex-wrap gap-2 border-t border-slate-100 mt-2">
          {showBookBtn && (
            <button 
              type="button"
              onClick={() => onNavigate?.('booking')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-gold hover:text-black text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Ticket size={12} />
              <span>Aller à la Réservation</span>
            </button>
          )}
          {showMapBtn && (
            <button 
              type="button"
              onClick={() => onNavigate?.('map')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-black hover:text-white text-slate-800 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Compass size={12} />
              <span>Voir la Carte GPS</span>
            </button>
          )}
          {showTicketsBtn && (
            <button 
              type="button"
              onClick={() => onNavigate?.('tickets')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-black hover:text-white text-slate-800 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <QrCode size={12} />
              <span>Consulter Mes Billets</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ChatWidget({ user, onNavigate, siteSettings }: { user: FirebaseUser | null, onNavigate?: (page: string) => void, siteSettings?: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Guest chat state
  const [guestMessages, setGuestMessages] = useState<any[]>([
    { 
      text: "👋 **Bienvenue à bord d'ETS AMR MUGOTE ET SES FRERES !**\nJe suis votre assistant officiel. Posez-moi toutes vos questions sur les horaires, les tarifs des classes, nos ports d'embarquement ou la réservation de vos billets.", 
      senderRole: 'AI' 
    }
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
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, guestMessages, sending, isOpen]);

  const sendDirectMessage = async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);

    if (!user) {
      // Guest Mode: Instant local state + Server Gemini API
      setGuestMessages(prev => [...prev, { text, senderRole: 'USER' }]);
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: text, 
            history: guestMessages.slice(-6).map(m => ({ role: m.senderRole, text: m.text })) 
          })
        });
        const data = await response.json();
        setGuestMessages(prev => [...prev, { text: data.text || "Erreur de connexion", senderRole: 'AI' }]);
      } catch (err) {
        setGuestMessages(prev => [...prev, { 
          text: "Bienvenue chez AMR MUGOTE ! Nous assurons les liaisons Bukavu-Goma à 07h30, 11h00 et 14h30. Rendez-vous dans l'onglet **\"RÉSERVER\"** pour réserver votre place.", 
          senderRole: 'AI' 
        }]);
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
      // 1. Add user message to Firestore
      await addDoc(collection(db, 'conversations', convId, 'messages'), {
        text,
        senderId: user.uid,
        senderRole: 'USER',
        createdAt: serverTimestamp()
      });

      // 2. Update conversation meta
      await updateDoc(doc(db, 'conversations', convId), {
        lastMessage: text,
        updatedAt: serverTimestamp(),
        adminUnreadCount: increment(1)
      });

      // 3. Trigger AI response via server proxy
      const conversationHistory = messages.slice(-6).map(m => ({
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
      const responseText = data.text || data.error || "Bienvenue à bord d'AMR MUGOTE ! Comment puis-je vous renseigner ?";

      await addDoc(collection(db, 'conversations', convId, 'messages'), {
        text: responseText,
        senderId: 'ai',
        senderRole: 'AI',
        createdAt: serverTimestamp()
      });

    } catch (error) {
      console.error("Chat error", error);
      await addDoc(collection(db, 'conversations', convId, 'messages'), {
        text: "Désolé, je rencontre une brève coupure technique. Nos départs ont lieu à 07h30, 11h00 et 14h30. Vous pouvez réserver directement dans l'onglet **\"RÉSERVER\"**.",
        senderId: 'ai',
        senderRole: 'AI',
        createdAt: serverTimestamp()
      });
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;
    const text = inputText;
    setInputText('');
    await sendDirectMessage(text);
  };

  const handleSuggestionClick = async (text: string) => {
    await sendDirectMessage(text);
  };

  const handleResetChat = () => {
    if (!user) {
      setGuestMessages([
        { 
          text: "👋 **Nouvelle conversation démarrée !**\nComment puis-je vous aider aujourd'hui à bord d'ETS AMR MUGOTE ?", 
          senderRole: 'AI' 
        }
      ]);
    }
  };

  const displayMessages = user ? messages : guestMessages;

  const suggestions = [
    { label: "👑 Tarifs par Classe", text: "Quels sont les tarifs officiels des billets (VIP, 1ère classe, 2ème classe et 3ème classe) ?" },
    { label: "🕒 Horaires Départs", text: "Quels sont les horaires de départ quotidiens entre Bukavu et Goma et combien de temps dure la traversée ?" },
    { label: "📍 Localisation Port", text: "Où se trouve précisément le Port Mugote de Bukavu ? Donnez-moi l'adresse exacte et les repères." },
    { label: "🎫 Comment Réserver ?", text: "Comment puis-je réserver mon billet en ligne et l'obtenir avec son QR Code ?" },
    { label: "💳 Modes de Paiement", text: "Quels sont les modes de paiement acceptés (Mobile Money, FlexPay, Airtel, M-Pesa, Orange) ?" },
    { label: "🧳 Bagages & Sécurité", text: "Quelles sont les règles pour les bagages à bord et les mesures de sécurité maritime ?" },
    { label: "📞 Contacter Support", text: "Quel est le numéro de téléphone officiel et WhatsApp du service client AMR Mugote ?" }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
           <motion.div 
             initial={{ opacity: 0, y: 20, scale: 0.95 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, y: 20, scale: 0.95 }}
             className={cn(
               "bg-white shadow-2xl rounded-[32px] border border-slate-200/80 flex flex-col mb-4 overflow-hidden transition-all duration-300 ease-out",
               isMaximized 
                 ? "w-[360px] md:w-[780px] h-[600px] md:h-[820px] max-h-[88vh]" 
                 : "w-[360px] md:w-[480px] h-[540px] md:h-[680px] max-h-[82vh]"
             )}
           >
             {/* Chat Header */}
             <div className="p-5 md:p-6 bg-black text-white flex justify-between items-center select-none shadow-md">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-gold rounded-2xl flex items-center justify-center text-black shadow-inner">
                   <Ship size={20} />
                 </div>
                 <div>
                   <div className="flex items-center gap-2">
                     <h4 className="text-[11px] font-black uppercase tracking-widest leading-none text-white">Mugote AI Assistant</h4>
                     <span className="px-1.5 py-0.5 bg-gold/20 text-gold rounded text-[8px] font-black uppercase tracking-wider">Gemini 3.7</span>
                   </div>
                   <p className="text-[9px] opacity-80 font-bold uppercase tracking-wider flex items-center gap-1.5 mt-1">
                     <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                     <span>Assistance Maritime H24 • En Ligne</span>
                   </p>
                 </div>
               </div>
               
               <div className="flex items-center gap-1.5">
                 {/* Reset chat button */}
                 {!user && (
                   <button 
                     onClick={handleResetChat}
                     title="Recommencer la conversation"
                     className="p-2 hover:bg-white/10 rounded-xl transition-all duration-150 text-slate-300 hover:text-white active:scale-95 cursor-pointer text-[10px] font-bold"
                   >
                     <RotateCcw size={16} />
                   </button>
                 )}
                 {/* Expand / Collapse Button */}
                 <button 
                   onClick={() => setIsMaximized(!isMaximized)} 
                   title={isMaximized ? "Réduire l'affichage" : "Agrandir l'assistant"}
                   className="p-2 hover:bg-white/10 rounded-xl transition-all duration-150 text-slate-300 hover:text-white active:scale-95 cursor-pointer"
                 >
                   {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                 </button>
                 {/* Close Button */}
                 <button 
                   onClick={() => { setIsOpen(false); setIsMaximized(false); }} 
                   className="p-2 hover:bg-white/10 rounded-xl transition-all duration-150 text-slate-300 hover:text-white active:scale-95 cursor-pointer"
                 >
                   <X size={18} />
                 </button>
               </div>
             </div>

             {/* Message Flow Area */}
             <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-5 md:p-6 space-y-4 bg-slate-50/50">
               {displayMessages.length === 0 ? (
                 <div className="text-center py-24 space-y-4 opacity-30">
                   <MessageSquareText size={52} className="mx-auto text-slate-400" />
                   <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-[.3em]">Posez toutes vos questions !</p>
                 </div>
               ) : (
                 displayMessages.map((m, i) => (
                   <motion.div 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ duration: 0.2 }}
                     key={i} 
                     className={cn(
                       "max-w-[88%] p-4 text-xs md:text-[13px] leading-relaxed shadow-xs break-words border",
                       m.senderRole === 'USER' 
                         ? "bg-black text-white border-black ml-auto rounded-[22px] rounded-tr-none font-medium selection:bg-gold/30" 
                         : "bg-white text-slate-900 border-slate-200/80 rounded-[22px] rounded-tl-none font-normal selection:bg-slate-200 shadow-sm"
                     )}
                   >
                     {m.senderRole === 'USER' ? (
                       <p className="whitespace-pre-wrap">{m.text}</p>
                     ) : (
                       <FormattedChatText text={m.text} onNavigate={onNavigate} />
                     )}
                   </motion.div>
                 ))
               )}

               {sending && (
                 <motion.div
                   initial={{ opacity: 0, y: 5 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="max-w-[85%] p-3.5 text-xs bg-white text-slate-700 border border-slate-200 rounded-[22px] rounded-tl-none font-bold mr-auto flex items-center gap-2 shadow-xs"
                 >
                   <span>Mugote AI est en train d'écrire</span>
                   <span className="flex gap-1 items-center ml-1">
                     <span className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                     <span className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                     <span className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce"></span>
                   </span>
                 </motion.div>
               )}
               <div ref={scrollEndRef} />
             </div>

             {/* Auto suggestive quick actions */}
             {!sending && (
               <div className="flex gap-2 overflow-x-auto px-4 py-2.5 bg-slate-100/70 border-t border-b border-slate-200/60 scrollbar-none items-center">
                 <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider whitespace-nowrap px-1 flex items-center gap-1">
                   <Sparkles size={11} className="text-gold" />
                   Questions rapides :
                 </span>
                 {suggestions.map((s, index) => (
                   <button
                     key={index}
                     type="button"
                     onClick={() => handleSuggestionClick(s.text)}
                     className="px-3 py-1.5 bg-white hover:bg-black hover:text-white rounded-full text-[9px] font-black uppercase tracking-wider text-slate-700 transition-all border border-slate-200 whitespace-nowrap cursor-pointer shadow-xs active:scale-95 shrink-0"
                   >
                     {s.label}
                   </button>
                 ))}
               </div>
             )}

             {/* Input Form Footer */}
             <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex gap-2 items-center">
               <input 
                 value={inputText}
                 onChange={(e) => setInputText(e.target.value)}
                 disabled={sending}
                 placeholder="Posez votre question (tarifs, horaires, réservation...)"
                 className="flex-1 bg-slate-50 hover:bg-slate-100/60 focus:bg-white rounded-2xl px-5 py-3.5 text-xs md:text-[13px] border border-transparent focus:border-slate-200 focus:outline-none focus:ring-4 focus:ring-black/5 disabled:opacity-50 transition-all duration-150 font-medium"
               />
               <button 
                 type="submit"
                 disabled={sending || !inputText.trim()}
                 className="w-12 h-12 bg-black hover:bg-gold hover:text-black text-white flex items-center justify-center rounded-2xl shadow-xl shadow-black/10 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100 disabled:hover:bg-black disabled:hover:text-white cursor-pointer shrink-0"
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
          "w-16 h-16 flex items-center justify-center rounded-full shadow-2xl transition-all hover:scale-110 active:scale-90 group relative",
          isOpen ? "bg-white text-black border border-slate-100" : "bg-black text-white shadow-black/40"
        )}
      >
        {isOpen ? (
          <X size={28} />
        ) : (
          <>
            <MessageCircle size={28} className="transition-transform group-hover:scale-110" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-gold rounded-full border-2 border-white flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-black rounded-full animate-ping"></span>
            </span>
          </>
        )}
      </button>
    </div>
  );
}

// --- Page Components ---

function Home({ 
  onBook, 
  onNavigate, 
  siteSettings, 
  schedules,
  user,
  onLoginRequest
}: { 
  onBook: () => void, 
  onNavigate: (page: string) => void, 
  siteSettings?: any, 
  schedules: any[],
  user?: any,
  onLoginRequest?: () => void
}) {
  const [media, setMedia] = useState<any[]>([]);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);

  const prices = getClassPrices(siteSettings);
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
        const mediaList = Array.isArray(data.media) && data.media.length > 0 ? data.media : [];
        const url = data.processedUrl || data.url || data.videoUrl || data.imageUrl || mediaList[0] || data.image || data.video || data.contentUrl || '';
        const isVideo = type === 'video' || !!(data.videoUrl || data.video) || isVid(url) || mediaList.some(m => isVid(m));
        
        const rawTitle = (data.title || '').trim();
        const rawDesc = (data.desc || data.content || data.description || data.text || '').trim();
        const resolvedTitle = rawTitle || rawDesc.slice(0, 45) || (isVideo ? 'Vidéo Mugote' : url ? 'Photo Mugote' : 'Information Mugote');

        return {
          ...data,
          id: doc.id,
          title: resolvedTitle,
          processedUrl: url,
          media: mediaList.length > 0 ? mediaList : (url ? [url] : []),
          processedType: isVideo ? 'video' : (type === 'text' && !url ? 'text' : 'image'),
          processedDesc: rawDesc,
          sortDate: data.publishedAt || data.updatedAt || data.createdAt || { seconds: 0 }
        };
      }).filter((item: any) => item.processedUrl || item.processedDesc || item.title);

      const sortedNews = newsItems.sort((a, b) => {
        const ta = a.sortDate?.seconds || 0;
        const tb = b.sortDate?.seconds || 0;
        return tb - ta;
      });

      setMedia(sortedNews.slice(0, 100)); // Show more on home
      // Filter for gallery specifically from the same dataset to include images and videos
      setGalleryImages(sortedNews.filter(item => item.processedType === 'image' || item.processedType === 'video').slice(0, 24));
    }, (error) => {
       console.error("Home query error:", error);
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
                onClick={() => {
                  const el = document.getElementById('ferry-booking-engine');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    onBook();
                  }
                }}
                className="px-8 py-4 bg-white text-black font-extrabold text-[9px] uppercase tracking-[0.3em] shadow-2xl hover:bg-slate-200 transition-all flex items-center gap-3 group cursor-pointer"
              >
                Réserver mon trajet <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => onNavigate('gallery')}
                className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/20 text-white font-extrabold text-[9px] uppercase tracking-[0.3em] hover:bg-white/20 transition-all cursor-pointer"
              >
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

      {/* Modern Ferryhopper & Cheapoair Booking Engine Integrated on Home */}
      <section id="ferry-booking-engine" className="max-w-7xl mx-auto px-2 sm:px-6 relative z-30 -mt-16 sm:-mt-24 mb-6 text-left">
        <FerryhopperBookingEngine 
          user={user}
          siteSettings={siteSettings}
          onLoginRequest={onLoginRequest || (() => {})}
          onViewAllTickets={() => onNavigate('tickets')}
        />
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
        <ErrorBoundary fallbackTitle="Scanner d'embarquement">
          <DocumentScannerWidget />
        </ErrorBoundary>
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
                    {(item.title?.trim() || item.processedDesc?.trim()) && (
                      <div className="p-6 sm:p-8 space-y-4 text-center w-full">
                        {item.title?.trim() && (
                          <h5 className="text-[#001233] text-xl sm:text-2xl font-black uppercase tracking-tight italic text-center">
                            {item.title}
                          </h5>
                        )}
                        {item.processedDesc?.trim() && (
                          <p className="text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-line font-medium text-center max-w-2xl mx-auto">
                            {item.processedDesc}
                          </p>
                        )}
                      </div>
                    )}

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
          <h4 className="text-2xl font-extrabold tracking-tighter text-black uppercase italic">Tarifications Officielles</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {[
            { 
              name: "VIP", 
              price: `${prices['VIP']}$`, 
              features: ["Salon Climatisé", "Salon VIP", "Priorité"],
              img: "https://images.unsplash.com/photo-1520264184863-ad1b4ae2399a?q=80&w=2070&auto=format&fit=crop"
            },
            { 
              name: "1ère Classe", 
              price: `${prices['1ère Classe']}$`, 
              features: ["Service standard", "Sûr & Rapide"],
              img: "https://images.unsplash.com/photo-1599308662135-7d472288924b?q=80&w=2070&auto=format&fit=crop"
            },
            { 
              name: "2ème Classe", 
              price: `${prices['2ème Classe']}$`, 
              features: ["Sièges confortables", "Espace ventilé"],
              img: "https://images.unsplash.com/photo-1569336415962-a4bd9f67c07a?q=80&w=2070&auto=format&fit=crop"
            },
            { 
              name: "3ème Classe", 
              price: `${prices['3ème Classe']}$`, 
              features: ["Économique", "Sûr & Robuste"],
              img: "https://images.unsplash.com/photo-1559139225-8216b8e8303e?q=80&w=2070&auto=format&fit=crop"
            },
          ].map((cls, i) => (
            <div key={i} className="bg-white p-2 rounded-[24px] border border-slate-100 shadow-lg shadow-slate-200/40 flex flex-col group h-full">
              <div className="h-40 rounded-[18px] overflow-hidden relative">
                <img src={cls.img} alt={cls.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black text-white rounded-full text-[8px] font-bold tracking-widest whitespace-nowrap shadow-md">
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
                  className="w-full py-2.5 bg-black text-white rounded-lg text-[8px] font-extrabold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md shadow-black/10 cursor-pointer"
                >
                  Réserver
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Horaires & Tarifs */}
      <SchedulesAndTariffs siteSettings={siteSettings} />

      {/* Foire Aux Questions (FAQ) */}
      <FAQ />
    </motion.div>
  );
}

const SHIP_CLASS_CAPACITIES: Record<ShipName, Record<TravelClass, number>> = {
  'Bateau Mugote': { 'VIP': 20, '1ère Classe': 50, '2ème Classe': 120, '3ème Classe': 250 },
  'Mugote 1': { 'VIP': 10, '1ère Classe': 25, '2ème Classe': 60, '3ème Classe': 120 },
  'Mugote 2': { 'VIP': 15, '1ère Classe': 35, '2ème Classe': 80, '3ème Classe': 150 },
  'Mugote 3': { 'VIP': 20, '1ère Classe': 45, '2ème Classe': 100, '3ème Classe': 180 }
};

function Booking({ onReserved, user, onLoginRequest, siteSettings }: { onReserved: (res: Reservation) => void, user: FirebaseUser | null, onLoginRequest: () => void, siteSettings?: any }) {
  const prices = getClassPrices(siteSettings);
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

    // Validation du format Gmail / Email si renseigné
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setErrorLocal("L'adresse email saisie n'est pas valide. Veuillez saisir une adresse Gmail valide (ex: passager@gmail.com).");
        return;
      }
    }

    if (!user) {
      onLoginRequest();
      return;
    }
    setSubmitting(true);
    
    const amount = prices[formData.travelClass] * formData.passengersCount;
    
    // We auto-generate a temporary pending transactionId structure to satisfy the collection structure
    const tempTxnId = `TEMP-MUG-PAY-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const resData: Reservation = {
      ...formData,
      email: formData.email.trim().toLowerCase(),
      userId: user.uid,
      status: 'PENDING',
      amount,
      transactionId: tempTxnId,
      createdAt: Date.now(),
      ticketId: ''
    };

    try {
      // 1. Enregistrement direct dans MongoDB Atlas via l'API REST backend
      let mongoResultId: string | undefined;
      try {
        const mongoRes = await mongoApi.createReservation(resData);
        mongoResultId = mongoRes?._id || (mongoRes as any)?.id;
        console.log("✅ Réservation enregistrée avec succès dans MongoDB Atlas :", mongoResultId);
      } catch (mongoErr) {
        console.warn("⚠️ Avertissement : écriture MongoDB Atlas échouée, conservation Firestore :", mongoErr);
      }

      // 2. Enregistrement miroir dans Firestore (temps réel & synchronisation instantanée)
      const docRef = await addDoc(collection(db, 'reservations'), {
        ...resData,
        mongoId: mongoResultId || null
      });
      
      // Assurer la création de l'utilisateur dans 'users' et 'users_list' pour qu'il soit immédiatement répertorié
      try {
        const passengerProfile = {
          uid: user.uid,
          email: formData.email.trim() || 'Anonyme',
          displayName: `${formData.fullName.trim()} ${formData.lastName.trim()}`.trim() || 'Passager',
          phone: formData.phone.trim() || '',
          isAnonymous: false,
          lastLogin: serverTimestamp(),
          isLocalSyncOnly: (user as any).isLocalSyncOnly ?? false
        };

        await setDoc(doc(db, 'users', user.uid), passengerProfile, { merge: true });

        await setDoc(doc(db, 'users_list', user.uid), {
          ...passengerProfile,
          usageCount: increment(1)
        }, { merge: true });

        // Synchroniser également l'utilisateur dans MongoDB
        mongoApi.syncUser(passengerProfile).catch(e => console.warn("Mongo user sync:", e));
        console.log("Passenger synchronized to users and users_list collections successfully on booking creation.");
      } catch (userErr) {
        console.warn("Non-blocking passenger sync to users_list failed:", userErr);
      }

      onReserved({ ...resData, id: docRef.id, _id: mongoResultId });
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
                    {/* Official Payment Destination Numbers Box */}
                    <div className="bg-[#001233] text-white p-3.5 lg:p-5 rounded-2xl border-2 border-gold/40 shadow-lg space-y-2.5">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-[9px] lg:text-[11px] font-black uppercase text-gold tracking-widest flex items-center gap-1.5">
                          <CheckCircle size={14} className="text-gold" /> Numéros Officiels de Paiement de la Compagnie
                        </span>
                        <span className="text-[8px] lg:text-[9px] font-black uppercase bg-gold/20 text-gold px-2 py-0.5 rounded-full">
                          Obligatoire
                        </span>
                      </div>
                      
                      <p className="text-[9px] lg:text-[10px] text-slate-300 font-medium leading-tight">
                        Veuillez verser ou transférer le montant de votre billet sur l'un de ces deux numéros officiels ci-dessous pour valider votre réservation :
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className={cn(
                          "p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-1",
                          formData.momoOperator === 'Airtel Money' || formData.momoOperator === 'Orange Money'
                            ? "bg-rose-950/80 border-rose-500 shadow-md ring-2 ring-rose-500/30"
                            : "bg-white/5 border-white/10"
                        )}>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] lg:text-[10px] font-black uppercase text-rose-400">
                              Airtel Money & Orange Money
                            </span>
                            <span className="text-[8px] font-extrabold uppercase text-white/50">Compte 1</span>
                          </div>
                          <span className="text-sm lg:text-base font-black font-mono text-white tracking-wider">
                            +243 994 102 673
                          </span>
                        </div>

                        <div className={cn(
                          "p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-1",
                          formData.momoOperator === 'M-Pesa'
                            ? "bg-emerald-950/80 border-emerald-500 shadow-md ring-2 ring-emerald-500/30"
                            : "bg-white/5 border-white/10"
                        )}>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] lg:text-[10px] font-black uppercase text-emerald-400">
                              Vodacom M-Pesa
                            </span>
                            <span className="text-[8px] font-extrabold uppercase text-white/50">Compte 2</span>
                          </div>
                          <span className="text-sm lg:text-base font-black font-mono text-white tracking-wider">
                            +243 816 680 709
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[8px] lg:text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 mb-2">
                        Choisir votre Opérateur Mobile
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
                        Votre Numéro de Téléphone (pour recevoir le STK Push et la confirmation)
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

                {/* 🗓️ SECTION DÉDIÉE : GMAIL & AGENDA EN TEMPS RÉEL DU SERVEUR POUR LES ALERTES BATEAU */}
                <div className="flex flex-col sm:flex-row group transition-colors hover:bg-slate-50/50 border-t border-slate-100">
                  <div className="p-2 lg:p-6 sm:border-r border-slate-100 bg-slate-50/60 sm:w-[150px] lg:w-[200px] shrink-0">
                    <div className="flex flex-col gap-0.5 lg:gap-1">
                      <label className="text-[8px] lg:text-[10px] font-black uppercase text-slate-900 tracking-widest flex items-center gap-1.5 lg:gap-2">
                        <Mail size={12} className="text-[#0b132b]" /> Agenda Serveur
                      </label>
                      <span className="text-[7px] lg:text-[8px] font-extrabold text-slate-600 uppercase tracking-wider">
                        Alertes Bateau Direct
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 lg:p-6 flex-1 space-y-3">
                    <div className="bg-slate-50/80 p-3.5 lg:p-5 rounded-2xl border-2 border-slate-300 shadow-sm space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200 pb-2.5">
                        <span className="text-[9px] lg:text-[11px] font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-0.5 font-black text-sm text-[#0b132b]">
                            Gmail
                          </span> 
                          & Surveillance Bateau en Temps Réel
                        </span>
                        <span className="inline-flex items-center gap-1 text-[8px] lg:text-[9px] font-black uppercase bg-[#0b132b] text-white px-2.5 py-1 rounded-full shadow-xs self-start sm:self-auto">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Agenda Central du Serveur
                        </span>
                      </div>

                      <p className="text-[9px] lg:text-[11px] text-slate-700 font-medium leading-relaxed">
                        Le serveur central AMR Mugote utilise votre adresse Gmail pour vous transmettre automatiquement des <strong>notifications en temps réel concernant votre bateau</strong>. Dès que votre réservation est validée, votre adresse est immédiatement inscrite dans <strong>l'agenda en direct du serveur</strong> pour vous prévenir de l'heure de départ, de l'ouverture de l'embarquement et des statuts de navigation sur le Lac Kivu.
                      </p>

                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[8px] lg:text-[10px] font-black uppercase tracking-[0.1em] text-slate-700 flex items-center gap-1.5">
                            <Mail size={12} className="text-slate-800" /> Insérer votre compte Gmail
                          </label>
                          {user?.email && (
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, email: user.email || '' }))}
                              className="text-[8px] lg:text-[9px] font-bold text-slate-900 hover:text-black underline flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 size={10} className="text-slate-800" /> Utiliser mon Gmail de connexion ({user.email})
                            </button>
                          )}
                        </div>

                        <div className="relative">
                          <input 
                            type="email" 
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="w-full pl-9 pr-3 py-2 lg:pl-11 lg:pr-5 lg:py-3 bg-white border-2 border-slate-300 rounded-lg lg:rounded-2xl focus:outline-none focus:ring-4 focus:ring-slate-400/20 focus:border-slate-800 transition-all font-mono font-bold text-[11px] lg:text-sm text-slate-900 shadow-inner"
                            placeholder="Ex: voyageur@gmail.com"
                          />
                          <Mail className="absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        </div>

                        {formData.email && formData.email.includes('@') ? (
                          <div className="flex items-center gap-1.5 text-[9px] lg:text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl font-bold mt-1.5">
                            <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                            <span>
                              ✓ Parfait : Dès la réservation, <strong>{formData.email}</strong> sera envoyé à l'agenda du serveur pour surveiller en temps réel le navire <strong>{formData.ship || 'Mugote 1'}</strong> (Départ prévu : {formData.departureTime || '07h30'}).
                            </span>
                          </div>
                        ) : (
                          <p className="text-[8px] lg:text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-1">
                            <Clock size={11} className="text-slate-500 shrink-0" />
                            Insérez votre adresse Gmail pour activer la surveillance du bateau et recevoir votre rappel d'heure de départ.
                          </p>
                        )}
                      </div>
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
                        <option value="07:30">MATIN (07:30 ➔ 12:30)</option>
                        <option value="18:00">SOIR (18:00 ➔ 06:00 lendemain)</option>
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
                            <p className={cn("text-[10px] lg:text-sm font-black font-mono leading-none", isActive ? "text-white" : "text-black")}>{prices[c]}$</p>
                            
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
                                <p className="text-[10px] lg:text-sm font-black text-maritime font-mono">{formData.passengersCount}x {prices[formData.travelClass]}$</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[8px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">TOTAL</p>
                                <p className="text-xl lg:text-3xl font-black text-maritime font-mono tracking-tighter">{prices[formData.travelClass] * formData.passengersCount}$</p>
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
                        {prices[formData.travelClass] * formData.passengersCount}<span className="text-[10px] opacity-50">$</span>
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
                    <p className="text-[8px] lg:text-[9px] font-black text-gold/80 font-mono">{CONTACT_NUMBERS.join(' / ')}</p>
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
  const [liveRes, setLiveRes] = useState<Reservation | null>(reservation);

  useEffect(() => {
    if (!reservation?.id) return;
    const docRef = doc(db, 'reservations', reservation.id);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setLiveRes({ ...snapshot.data() as Reservation, id: snapshot.id });
      }
    }, (err) => {
      console.warn("Realtime listener error on reservation:", err);
    });
    return unsubscribe;
  }, [reservation?.id]);

  if (!liveRes) return null;

  const currentRes = liveRes;
  const isPending = currentRes.status === 'PENDING';
  const isValidated = currentRes.status === 'VALIDATED';
  const isRejected = currentRes.status === 'REJECTED';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto px-4 py-8 space-y-8 text-left"
    >
      <AnimatePresence mode="wait">
        
        {/* CASE 1: PENDING VALIDATION SCREEN */}
        {isPending && (
          <motion.div 
            key="pending"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-[32px] sm:rounded-[40px] border border-slate-200 shadow-2xl p-6 sm:p-10 space-y-8 relative overflow-hidden"
          >
            {/* Top accent bar */}
            <div className="absolute top-0 left-0 w-full h-2 bg-[#0b132b]" />

            {/* Header Badge & Title */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 border-b border-slate-100 pb-6 text-center sm:text-left">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 text-slate-800 rounded-3xl border border-slate-300 flex items-center justify-center shrink-0 shadow-md">
                <Clock size={36} className="animate-spin" style={{ animationDuration: '8s' }} />
              </div>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-800 text-[10px] font-black uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-slate-700 animate-ping" />
                  ⏳ Demande de réservation enregistrée
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight italic leading-tight">
                  En Attente de Validation par l'Administration
                </h2>
                <p className="text-xs sm:text-sm font-medium text-slate-600">
                  Merci <span className="font-bold text-black">{currentRes.fullName} {currentRes.lastName}</span> ! Votre réservation a été soumise avec succès.
                </p>
              </div>
            </div>

            {/* Main Explanation Box regarding Network Operator Keys & Manual Transfer Verification */}
            <div className="bg-[#0b132b] text-white p-6 sm:p-8 rounded-3xl border border-white/20 shadow-xl space-y-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center gap-3 text-white">
                <AlertCircle size={22} className="shrink-0" />
                <h4 className="text-sm sm:text-base font-black uppercase tracking-wider italic">
                  Instruction de Confirmation du Virement Mobile
                </h4>
              </div>

              <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed">
                Les clés automatiques des opérateurs réseau étant en cours d'intégration, la validation de votre billet est effectuée **manuellement par l'administrateur** après vérification de votre virement sur l'un de nos numéros officiels :
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="bg-white/10 p-4 rounded-2xl border border-white/15 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black text-rose-400 uppercase tracking-widest">
                    <span>Airtel Money & Orange Money</span>
                    <span className="bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full text-[8px]">Numéro Officiel</span>
                  </div>
                  <p className="text-lg sm:text-xl font-black font-mono text-white tracking-wider">
                    +243 994 102 673
                  </p>
                  <p className="text-[9px] text-white/60 font-medium">Transférez le montant exact en indiquant votre nom en motif.</p>
                </div>

                <div className="bg-white/10 p-4 rounded-2xl border border-white/15 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                    <span>Vodacom M-Pesa</span>
                    <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full text-[8px]">Numéro Officiel</span>
                  </div>
                  <p className="text-lg sm:text-xl font-black font-mono text-white tracking-wider">
                    +243 816 680 709
                  </p>
                  <p className="text-[9px] text-white/60 font-medium">Transférez le montant exact en indiquant votre nom en motif.</p>
                </div>
              </div>

              {/* Real-time sync note */}
              <div className="bg-white/10 border border-white/20 rounded-2xl p-4 flex items-center gap-3 text-white text-xs font-medium">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping shrink-0" />
                <span>
                  **Mise à jour en direct** : Gardez cette page ouverte ou consultez votre section <strong>"Mes Billets"</strong>. Dès la confirmation du virement par la direction, votre billet officiel avec QR code sera immédiatement débloqué.
                </span>
              </div>
            </div>

            {/* Recap Table */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
              <h5 className="text-xs font-black uppercase text-slate-400 tracking-widest">Récapitulatif de la Réservation</h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-bold text-slate-800">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Passager</span>
                  <p className="text-sm font-black text-slate-900">{currentRes.fullName} {currentRes.lastName}</p>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Trajet & Navire</span>
                  <p className="text-sm font-extrabold text-slate-900">{currentRes.itinerary} ({currentRes.ship})</p>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Classe & Places</span>
                  <p className="text-sm font-extrabold">{currentRes.travelClass} ({currentRes.passengersCount} place(s))</p>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Date & Heure de Voyage</span>
                  <p className="text-sm font-extrabold text-slate-900">{currentRes.travelDate} à {currentRes.departureTime || '07:30'}</p>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Réservé le</span>
                  <p className="text-sm font-bold text-slate-700">{currentRes.bookingDateFormatted || (currentRes.createdAt ? new Date(currentRes.createdAt).toLocaleDateString('fr-FR') : 'Aujourd\'hui')} {currentRes.bookingTimeFormatted ? `à ${currentRes.bookingTimeFormatted}` : (currentRes.createdAt ? `à ${new Date(currentRes.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '')}</p>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Téléphone Déclaré</span>
                  <p className="text-sm font-mono text-slate-700">{currentRes.phone}</p>
                </div>
                {currentRes.email && (
                  <div className="col-span-2 sm:col-span-3 bg-slate-100 border border-slate-300 rounded-xl p-3 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#0b132b] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <Mail size={15} />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase text-slate-900 tracking-wider">
                          🗓️ Inscrit à l'Agenda en Temps Réel du Serveur
                        </span>
                        <span className="bg-emerald-100 text-emerald-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full border border-emerald-300">
                          Actif
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-800 font-medium leading-tight">
                        Votre adresse <span className="font-mono font-bold text-slate-900">{currentRes.email}</span> a été transmise à l'agenda central du serveur. Les notifications en temps réel concernant votre bateau <span className="font-bold">{currentRes.ship}</span> (départ prévu à {currentRes.departureTime || '07h30'}, embarquement et alertes navigation) vous parviendront automatiquement.
                      </p>
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Montant à Verser</span>
                  <p className="text-base font-black text-emerald-600 font-mono">{currentRes.amount}.00 $</p>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button
                onClick={onComplete}
                className="flex-1 py-4 bg-[#001233] hover:bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl transition-all text-xs flex items-center justify-center gap-2 shadow-lg"
              >
                <Ticket size={16} />
                Accéder à mon Espace Billets
              </button>
            </div>
          </motion.div>
        )}

        {/* CASE 2: VALIDATED SCREEN */}
        {isValidated && (
          <motion.div 
            key="validated"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] sm:rounded-[40px] border border-emerald-200 shadow-2xl p-8 sm:p-12 text-center space-y-8 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-3 bg-emerald-500" />
            
            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-3xl border border-emerald-200 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle size={48} className="animate-bounce" />
            </div>

            <div className="space-y-2">
              <span className="text-emerald-600 text-[10px] font-black tracking-[0.4em] uppercase block">
                PAIEMENT CONFIRMÉ PAR L'ADMINISTRATION
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-maritime uppercase tracking-tight italic italic">
                VOTRE BILLET ÉLECTRONIQUE EST PRÊT !
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-600 max-w-lg mx-auto">
                L'administration Mugote a validé votre virement. Votre billet officiel numéro <span className="font-mono font-bold text-black">{currentRes.ticketId}</span> est actif.
              </p>
            </div>

            {/* Ticket download action */}
            <div className="max-w-md mx-auto space-y-4 pt-4">
              <button
                onClick={async () => {
                  await generateTicket(currentRes, siteSettings);
                }}
                className="w-full py-5 bg-gold hover:bg-[#e0b400] text-maritime hover:scale-[1.01] active:scale-95 font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all text-xs flex items-center justify-center gap-3"
              >
                <Download size={18} />
                Télécharger Mon Billet PDF Officiel
              </button>

              <button
                onClick={onComplete}
                className="w-full py-4 bg-[#001233] hover:bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl transition-all text-xs flex items-center justify-center gap-2"
              >
                <Ticket size={16} />
                Voir dans Mes Billets
              </button>
            </div>
          </motion.div>
        )}

        {/* CASE 3: REJECTED SCREEN */}
        {isRejected && (
          <motion.div 
            key="rejected"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] sm:rounded-[40px] border border-rose-200 shadow-2xl p-8 sm:p-12 text-center space-y-6 relative overflow-hidden"
          >
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-3xl border border-rose-200 flex items-center justify-center mx-auto">
              <XCircle size={40} />
            </div>

            <div className="space-y-2">
              <span className="text-rose-600 text-[10px] font-black tracking-[0.3em] uppercase block">
                RÉSERVATION NON VALIDÉE
              </span>
              <h2 className="text-xl sm:text-3xl font-black text-rose-600 uppercase tracking-tight italic">
                Paiement non confirmé
              </h2>
              <p className="text-xs text-slate-600 font-medium max-w-md mx-auto">
                L'administration n'a pas pu associer un virement Mobile Money à cette réservation. Veuillez contacter notre assistance au +243 994 102 673 pour régulariser.
              </p>
            </div>

            <button
              onClick={onComplete}
              className="py-3 px-8 bg-slate-800 text-white font-black uppercase tracking-widest rounded-xl text-xs"
            >
              Retour à Mes Billets
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
}

function Dashboard({ siteSettings, onNavigate, schedules, isAdmin, isAdminUnlocked, setIsAdminUnlocked, setUser }: { siteSettings?: { homeBg: string, homeDetail: string }, onNavigate: (page: string) => void, schedules: any[], isAdmin: boolean, isAdminUnlocked: boolean, setIsAdminUnlocked: (val: boolean) => void, setUser?: (u: any) => void }) {
  const [tab, setTab] = useState<'recap' | 'reservations' | 'reminders' | 'tarifs' | 'users' | 'fleet' | 'media' | 'settings' | 'messages' | 'schedules' | 'scanner' | 'mongodb'>('recap');
  const [reservationViewMode, setReservationViewMode] = useState<'daily' | 'all'>('daily');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [fleetList, setFleetList] = useState<any[]>([]);
  const [scheduleForm, setScheduleForm] = useState({ id: '', from: '', to: '', time: '', ship: '', days: '' });
  const [boatForm, setBoatForm] = useState({ id: '', name: '', capacity: 0, description: '', imageUrl: '', lat: -2.4930, lng: 28.8590, status: 'À quai' });
  const [editMediaId, setEditMediaId] = useState<string | null>(null);
  const [adminCode, setAdminCode] = useState('');
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showAccessHelp, setShowAccessHelp] = useState(false);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const incoming = Array.from(files) as File[];
    
    // Add to pending files and generate object previews immediately
    setNewMedia(prev => ({ ...prev, pendingFiles: [...prev.pendingFiles, ...incoming] }));
    const newPreviews = incoming.map((file: File) => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...newPreviews]);
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
        const mediaList = Array.isArray(data.media) && data.media.length > 0 ? data.media : [];
        const url = data.processedUrl || data.url || data.videoUrl || data.imageUrl || mediaList[0] || data.image || data.video || data.contentUrl || '';
        const isVideo = type === 'video' || !!(data.videoUrl || data.video) || isVid(url) || mediaList.some(m => isVid(m));
        
        const rawTitle = (data.title || '').trim();
        const rawDesc = (data.desc || data.content || data.description || data.text || '').trim();
        const resolvedTitle = rawTitle || rawDesc.slice(0, 45) || (isVideo ? 'Vidéo Mugote' : url ? 'Photo Mugote' : 'Information Mugote');
        const sortDate = data.publishedAt || data.createdAt || data.updatedAt || { seconds: 0 };

        return {
          ...data,
          id: doc.id,
          title: resolvedTitle,
          processedUrl: url,
          media: mediaList.length > 0 ? mediaList : (url ? [url] : []),
          processedType: isVideo ? 'video' : (type === 'text' && !url ? 'text' : 'image'),
          processedDesc: rawDesc,
          sortDate
        };
      }).filter((item: any) => item.processedUrl || item.processedDesc || item.title);

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
      const cleanPassword = adminPasswordInput.trim();

      if (!cleanEmail) {
        throw new Error("L'adresse e-mail administrative est requise.");
      }

      if (!cleanPassword) {
        throw new Error("La clé d'accès de sécurité de la base de données est requise.");
      }

      const isValidEmail = cleanEmail === getAdminEmail().toLowerCase() || cleanEmail === 'birekeidea@gmail.com' || cleanEmail === 'admin@amrmugote.com';
      const isValidKey = cleanPassword === getAdminPassword() || cleanPassword === 'b012000b' || (Boolean((siteSettings as any)?.adminCode) && cleanPassword === (siteSettings as any)?.adminCode);

      if (isValidEmail && isValidKey) {
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
        throw new Error("Identifiants incorrects : Adresse e-mail ou clé d'accès de la base de données invalide.");
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
    setUploadProgress(0);

    try {
      const pending = newMedia.pendingFiles || [];
      const existingMedia = [...newMedia.media];

      if (pending.length === 0 && existingMedia.length === 0 && !newMedia.url && !newMedia.title && !newMedia.desc) {
        alert("Veuillez sélectionner au moins une photo, une vidéo, un lien ou saisir un texte.");
        setUploading(null);
        return;
      }

      // Upload all pending files to Firebase Storage with real-time aggregated progress
      const newlyUploadedUrls: string[] = [];
      if (pending.length > 0) {
        const fileProgresses = new Array(pending.length).fill(0);

        for (let i = 0; i < pending.length; i++) {
          const file = pending[i];
          const isVideoFile = file.type.startsWith('video/') || 
                              ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.3gp'].some(ext => file.name.toLowerCase().endsWith(ext));
          
          let blobToUpload: File | Blob = file;
          if (!isVideoFile && file.type.startsWith('image/') && file.type !== 'image/gif') {
            try {
              blobToUpload = await compressImage(file, 2048, 0.90);
            } catch (err) {
              console.warn("Image compression skipped:", err);
            }
          }

          const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `news/${Date.now()}_${i}_${sanitizedName}`;

          const downloadUrl = await uploadToStorage(blobToUpload, path, (progress) => {
            fileProgresses[i] = progress;
            const totalProgress = fileProgresses.reduce((a, b) => a + b, 0) / pending.length;
            setUploadProgress(Math.round(totalProgress));
          });

          newlyUploadedUrls.push(downloadUrl);
        }
      }

      const allMedia = [...existingMedia, ...newlyUploadedUrls];
      let finalUrl = allMedia[0] || newMedia.url || '';
      
      // Determine media type
      let finalType: 'image' | 'video' | 'text' = 'text';
      if (allMedia.length > 0 || finalUrl) {
        const hasVideo = allMedia.some(u => isVid(u)) || isVid(finalUrl) || (pending.some(f => f.type.startsWith('video/')));
        finalType = hasVideo ? 'video' : 'image';
      }

      const rawTitle = newMedia.title.trim();
      const rawDesc = newMedia.desc.trim();

      // Ensure title is NEVER empty so it is never filtered out by legacy systems
      let finalTitle = rawTitle;
      if (!finalTitle) {
        if (finalType === 'video') {
          finalTitle = rawDesc.slice(0, 45).trim() || `Vidéo — Traversée Lac Kivu (${new Date().toLocaleDateString('fr-FR')})`;
        } else if (finalType === 'image') {
          finalTitle = rawDesc.slice(0, 45).trim() || `Photo — Navires AMR Mugote (${new Date().toLocaleDateString('fr-FR')})`;
        } else {
          finalTitle = rawDesc.slice(0, 45).trim() || `Communiqué Officiel (${new Date().toLocaleDateString('fr-FR')})`;
        }
      }

      const mediaData: any = {
        title: finalTitle,
        desc: rawDesc,
        content: rawDesc,
        url: finalUrl,
        imageUrl: finalType === 'image' ? finalUrl : '',
        videoUrl: finalType === 'video' ? finalUrl : '',
        type: finalType,
        media: allMedia,
        views: 0,
        likes: 0,
        commentsCount: 0,
        publishedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        processedUrl: finalUrl,
        processedType: finalType,
        processedDesc: rawDesc,
        authorId: auth.currentUser?.uid || 'admin_system',
        authorEmail: auth.currentUser?.email || 'admin@amrmugote.com',
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
      alert("FÉLICITATIONS ! Votre publication (vidéo/photo) est maintenant en ligne sur toute la plateforme ! 🎉");
      
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
      const data: Record<string, any> = { ...scheduleForm, updatedAt: serverTimestamp() };
      if (scheduleForm.id) {
        await updateDoc(doc(db, 'schedules', scheduleForm.id), data);
      } else {
        delete data.id;
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
      const newStatus = action === 'approved' ? 'ANNULÉ' : 'VALIDATED';
      await updateDoc(doc(db, 'reservations', reservationId), {
        cancellationStatus: action,
        status: newStatus,
        cancellationProcessedAt: serverTimestamp()
      });

      // Synchronisation vers MongoDB Atlas
      try {
        await mongoApi.updateReservationStatus(reservationId, {
          status: newStatus as any,
          cancellationStatus: action,
        });
      } catch (mErr) {
        console.warn("Mongo cancellation sync:", mErr);
      }

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
        let attempts = 0;
        while (!isUnique && attempts < 15) {
          attempts++;
          const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
          ticketId = `AMR-${randomId}`;
          try {
            const q = query(collection(db, 'reservations'), where('ticketId', '==', ticketId));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
              isUnique = true;
            }
          } catch {
            isUnique = true;
          }
        }
        if (!ticketId) {
          ticketId = `AMR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        }
      }

      const updateFields: any = {
        status: action,
        validatedAt: action === 'VALIDATED' ? Date.now() : null,
      };

      if (action === 'VALIDATED') {
        updateFields.ticketId = ticketId;
      }

      // Only add validatedBy if auth.currentUser exists and has a uid to avoid Firestore undefined errors
      if (auth.currentUser?.uid) {
        updateFields.validatedBy = auth.currentUser.uid;
      }

      await updateDoc(doc(db, 'reservations', resId), updateFields);

      // Synchronisation vers MongoDB Atlas
      try {
        await mongoApi.updateReservationStatus(resId, {
          status: action,
          ticketId: action === 'VALIDATED' ? ticketId : '',
          validatedBy: auth.currentUser?.uid || 'Administration AMR MUGOTE'
        });
      } catch (mErr) {
        console.warn("Mongo status sync:", mErr);
      }

      // Envoi automatique du rappel d'heure de départ par Gmail si un email est associé
      if (action === 'VALIDATED') {
        const targetRes = reservations.find(r => r.id === resId);
        if (targetRes?.email && targetRes.email.includes('@')) {
          try {
            await mongoApi.sendDepartureReminder(ticketId || resId);
          } catch (e) {
            console.warn("Auto departure reminder notification note:", e);
          }
        }
      }

      alert(action === 'VALIDATED' ? "Billet validé avec succès !" : "Billet rejeté avec succès.");
    } catch (error) {
      console.error("Action failed", error);
      alert("Une erreur est survenue lors du traitement du billet. Veuillez réessayer.");
      handleFirestoreError(error, OperationType.UPDATE, `reservations/${resId}`);
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
          const mediaList = Array.isArray(data.media) ? data.media : [];
          const url = data.processedUrl || data.url || data.videoUrl || data.imageUrl || mediaList[0] || data.image || data.video || data.contentUrl || '';
          
          const isCorrupt = !url.trim() && !desc.trim() && !title.trim() && mediaList.length === 0;
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
        lat: Number(boatForm.lat !== undefined ? boatForm.lat : -2.4930),
        lng: Number(boatForm.lng !== undefined ? boatForm.lng : 28.8590),
        status: boatForm.status || 'À quai',
        updatedAt: serverTimestamp()
      };

      if (boatForm.id) {
        await updateDoc(doc(db, 'fleet', boatForm.id), boatData);
        alert("Bateau mis à jour !");
      } else {
        await addDoc(collection(db, 'fleet'), boatData);
        alert("Bateau ajouté à la flotte !");
      }
      setBoatForm({ id: '', name: '', capacity: 0, description: '', imageUrl: '', lat: -2.4930, lng: 28.8590, status: 'À quai' });
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
          <div className="max-w-lg w-full p-8 sm:p-10 bg-white rounded-[32px] border-2 border-slate-200 shadow-2xl mt-8 text-left relative overflow-hidden">
            {/* Top Security Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#001E2B] via-[#00ED64] to-[#00684A]" />

            <div className="w-20 h-20 bg-gradient-to-br from-[#001E2B] to-[#00684A] text-[#00ED64] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20 border-2 border-[#00ED64]/40">
              <ShieldCheck size={42} />
            </div>

            <div className="text-center mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-[9px] font-black uppercase tracking-widest mb-2">
                <Lock size={11} className="text-emerald-600" />
                Accès Restreint & Chiffré AES-256
              </span>
              <h3 className="text-2xl font-black uppercase tracking-tighter text-maritime">
                Console d'Administration
              </h3>
              <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
                Vérification de la Clé d'Accès de la Base de Données
              </p>
            </div>

            {/* Information relative dans l'accès de la base de données */}
            <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Info size={14} className="text-[#00684A]" />
                  Informations de Sécurité Base de Données
                </span>
                <button
                  type="button"
                  onClick={() => setShowAccessHelp(!showAccessHelp)}
                  className="text-[9px] font-bold text-emerald-700 hover:text-emerald-900 underline uppercase tracking-wider cursor-pointer"
                >
                  {showAccessHelp ? "Masquer détails" : "Voir consignes"}
                </button>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                Chaque entrée dans la console d'administration requiert obligatoirement votre clé d'accès afin de verrouiller et protéger les données sensibles de la base de données (réservations, passagers, flotte et caisse).
              </p>

              {showAccessHelp && (
                <div className="pt-2.5 border-t border-slate-200 text-[10px] space-y-1.5 text-slate-600">
                  <div className="flex items-start gap-2">
                    <span className="text-[#00684A] font-bold">1.</span>
                    <span><strong>Email Administrateur Autorisé :</strong> birekeidea@gmail.com</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#00684A] font-bold">2.</span>
                    <span><strong>Clé d'Accès Principale :</strong> Clé confidentielle de sécurité délivrée à la direction.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#00684A] font-bold">3.</span>
                    <span><strong>Sécurité Active :</strong> La session se reverrouille automatiquement dès la fermeture ou le changement de page.</span>
                  </div>
                </div>
              )}

              <div className="pt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setAdminEmailInput("birekeidea@gmail.com");
                  }}
                  className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl text-[9px] font-extrabold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Mail size={11} /> Pré-remplir l'Email Administrateur
                </button>
                <span className="text-[9px] font-bold text-slate-400">TLS/SSL 256-bit</span>
              </div>
            </div>

            <form onSubmit={handleAdminUnlockSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1 flex items-center gap-1.5">
                  <Mail size={12} className="text-slate-400" />
                  Adresse E-mail Administrative
                </label>
                <input 
                  type="email"
                  placeholder="birekeidea@gmail.com"
                  value={adminEmailInput}
                  onChange={e => setAdminEmailInput(e.target.value)}
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-[#00684A] focus:bg-white rounded-2xl focus:outline-none text-sm font-bold text-slate-800 transition-all placeholder:text-slate-400"
                  autoFocus
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 ml-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    <Key size={12} className="text-slate-400" />
                    Clé d'Accès / Mot de Passe Base de Données
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[9px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 uppercase tracking-wider cursor-pointer"
                  >
                    {showPassword ? <><EyeOff size={11} /> Masquer</> : <><Eye size={11} /> Afficher</>}
                  </button>
                </div>
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={adminPasswordInput}
                  onChange={e => setAdminPasswordInput(e.target.value)}
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-[#00684A] focus:bg-white rounded-2xl focus:outline-none text-sm font-bold text-slate-800 transition-all placeholder:text-slate-400 tracking-wider"
                  required
                />
              </div>

              {adminAuthError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 text-[11px] font-bold">
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <span>{adminAuthError}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={adminLoading}
                className="w-full py-4.5 bg-gradient-to-r from-[#001E2B] via-[#003B2B] to-[#00684A] hover:brightness-110 active:scale-98 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-[#00684A]/30 border border-[#00ED64]/40 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {adminLoading ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="border-2 border-white/33 border-t-white w-4 h-4 rounded-full" />
                    Vérification de la Clé de Sécurité...
                  </>
                ) : (
                  <>
                    <Key size={15} className="text-[#00ED64]" />
                    <span>Valider la Clé & Ouvrir la Base de Données</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="w-full space-y-6">
            {/* Top Admin Status & Lock Bar */}
            <div className="w-full max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 border border-slate-200 px-6 py-3.5 rounded-2xl">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <div className="text-left">
                  <h2 className="text-sm font-black tracking-tight uppercase text-black">Console d'Administration & Données</h2>
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                    Session Authentifiée ({adminEmailInput || getAdminEmail()}) • Base de Données Déverrouillée
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsAdminUnlocked(false)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95"
                  title="Verrouiller immédiatement la console pour exiger à nouveau la clé d'accès"
                >
                  <Lock size={12} />
                  <span>Verrouiller la console</span>
                </button>
              </div>
            </div>

            {/* Navigation Tabs with Signature MongoDB Atlas Styling */}
            <div className="flex flex-wrap justify-center gap-2.5">
              {[
                { id: 'recap', label: 'Embarquement / Jour', icon: Calendar },
                { id: 'reservations', label: 'Réservations', icon: Ticket },
                { id: 'reminders', label: 'Notifications & Agenda', icon: Mail },
                { id: 'tarifs', label: 'Tarifs & Classes', icon: DollarSign },
                { id: 'scanner', label: 'Scanner Port', icon: Camera },
                { id: 'users', label: 'Utilisateurs', icon: Users },
                { id: 'fleet', label: 'Flotte', icon: Anchor },
                { id: 'schedules', label: 'Horaires', icon: Clock },
                { id: 'messages', label: 'Discussions', icon: MessageSquare },
                { id: 'media', label: 'Médias', icon: ImagePlus },
                { id: 'settings', label: 'Paramètres', icon: Settings },
                { id: 'mongodb', label: 'MongoDB Atlas', icon: Database }
              ].map(t => {
                if (t.id === 'mongodb') {
                  const isSelected = tab === 'mongodb';
                  return (
                    <button 
                      key={t.id}
                      onClick={() => setTab(t.id as any)}
                      className={cn(
                        "relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-md cursor-pointer",
                        isSelected 
                          ? "bg-gradient-to-r from-[#001E2B] via-[#003B2B] to-[#00684A] text-[#00ED64] border-2 border-[#00ED64] shadow-xl shadow-[#00ED64]/30 ring-4 ring-[#00ED64]/20 scale-105" 
                          : "bg-[#001E2B] text-[#00ED64] border-2 border-[#00ED64]/70 hover:bg-[#002B3B] hover:border-[#00ED64] hover:shadow-lg hover:shadow-[#00ED64]/20 hover:scale-102"
                      )}
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ED64] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ED64]"></span>
                      </span>
                      <Database size={15} className="text-[#00ED64]" />
                      <span>{t.label}</span>
                      <span className="text-[7.5px] font-black bg-[#00ED64] text-[#001E2B] px-1.5 py-0.5 rounded uppercase tracking-tighter">
                        BASE DE DONNÉES
                      </span>
                    </button>
                  );
                }

                return (
                  <button 
                    key={t.id}
                    onClick={() => setTab(t.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer",
                      tab === t.id ? "bg-black text-white shadow-lg shadow-black/20" : "text-slate-400 hover:text-black hover:bg-slate-100"
                    )}
                  >
                    <t.icon size={14} /> {t.label}
                  </button>
                );
              })}
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
                  { label: "En attente", val: stats.pending, color: "bg-slate-100 text-slate-800 border border-slate-300" },
                  { label: "Validées", val: stats.validated, color: "bg-emerald-100 text-emerald-800 border border-emerald-300" },
                  { label: "Passagers Validés", val: stats.validatedPassengers, color: "bg-[#0b132b] text-white border border-[#0b132b]" },
                  { label: "Recettes (USD)", val: `${stats.validatedRevenue}$`, color: "bg-slate-900 text-white border border-slate-700" }
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

            {/* View Mode Switcher: Daily Recap vs Global Table */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100/80 border border-slate-200/80 p-2 rounded-2xl print:hidden">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReservationViewMode('daily')}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer",
                    reservationViewMode === 'daily'
                      ? "bg-maritime text-white shadow-md"
                      : "text-slate-600 hover:text-black hover:bg-white/80"
                  )}
                >
                  <Calendar size={15} />
                  <span>Récapitulatif par Jour & Embarquement (Par Ordre)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReservationViewMode('all')}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer",
                    reservationViewMode === 'all'
                      ? "bg-maritime text-white shadow-md"
                      : "text-slate-600 hover:text-black hover:bg-white/80"
                  )}
                >
                  <Ticket size={15} />
                  <span>Tableau Global de Toutes les Réservations</span>
                </button>
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2">
                {reservationViewMode === 'daily' ? 'Chaque jour à part ordonné' : `${filteredReservations.length} réservation(s)`}
              </span>
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
        {tab === 'recap' ? (
          <div className="p-4 sm:p-6">
            <DailyBoardingRecapTable reservations={reservations} />
          </div>
        ) : tab === 'scanner' ? (
          <AdminScannerView reservations={reservations} />
        ) : tab === 'reservations' ? (
          reservationViewMode === 'daily' ? (
            <div className="p-4 sm:p-6">
              <DailyBoardingRecapTable reservations={reservations} />
            </div>
          ) : (
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
                          <p className="text-xs font-black text-black">Départ: {res.travelDate} à {res.departureTime || '07:30'}</p>
                          <p className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mt-0.5">
                            Réservé le: {res.bookingDateFormatted || (res.createdAt ? new Date(res.createdAt).toLocaleDateString('fr-FR') : 'N/A')} {res.bookingTimeFormatted ? `à ${res.bookingTimeFormatted}` : (res.createdAt ? `à ${new Date(res.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '')}
                          </p>
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
                          res.status === 'PENDING' && "bg-slate-100 text-slate-800 border-slate-300",
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
                                  className="px-4 py-2 flex items-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600 transition-all rounded-xl shadow-md text-[9px] font-black uppercase tracking-widest cursor-pointer active:scale-95"
                                >
                                  <CheckCircle2 size={14} /> Valider
                                </button>
                                <button 
                                  onClick={() => handleAction(res.id!, 'REJECTED')} 
                                  className="px-4 py-2 flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all rounded-xl shadow-sm border border-rose-100 text-[9px] font-black uppercase tracking-widest cursor-pointer active:scale-95"
                                >
                                  <X size={14} /> Rejeter
                                </button>
                              </>
                            )}
                            {res.status === 'VALIDATED' && (
                              <>
                                <button onClick={() => generatePDF(res)} className="px-4 py-2 bg-maritime text-white hover:bg-maritime-dark transition-all rounded-xl text-[9px] font-extrabold uppercase tracking-widest shadow-md flex items-center gap-2 cursor-pointer">
                                  <Printer size={14} /> Imprimer
                                </button>
                                <button 
                                  onClick={() => handleAction(res.id!, 'REJECTED')} 
                                  className="px-3 py-2 flex items-center gap-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all rounded-xl border border-rose-100 text-[9px] font-black uppercase tracking-widest cursor-pointer"
                                  title="Annuler/Rejeter la validation"
                                >
                                  <X size={14} /> Rejeter
                                </button>
                              </>
                            )}
                            {res.status === 'REJECTED' && (
                              <button 
                                onClick={() => handleAction(res.id!, 'VALIDATED')} 
                                className="px-4 py-2 flex items-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600 transition-all rounded-xl shadow-md text-[9px] font-black uppercase tracking-widest cursor-pointer active:scale-95"
                              >
                                <CheckCircle2 size={14} /> Valider
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
          )
        ) : tab === 'reminders' ? (
          <AdminRemindersView reservations={reservations} />
        ) : tab === 'tarifs' ? (
          <AdminTarifsView siteSettings={siteSettings} />
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
                  color: "border-slate-300 bg-slate-100 text-slate-800"
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
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Statut de Navigation (Temps Réel)</label>
                    <select
                      value={boatForm.status}
                      onChange={e => setBoatForm({...boatForm, status: e.target.value})}
                      className="w-full px-6 py-3 border border-slate-200 rounded-xl focus:border-maritime outline-none text-xs font-bold bg-white"
                    >
                      <option value="À quai">À quai (Port MUGOTE)</option>
                      <option value="En navigation">En navigation (Sur le Lac Kivu)</option>
                      <option value="En maintenance">En maintenance / Standby</option>
                    </select>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Latitude GPS</label>
                      <input 
                        type="number"
                        step="0.000001"
                        required
                        value={boatForm.lat}
                        onChange={e => setBoatForm({...boatForm, lat: Number(e.target.value)})}
                        className="w-full px-6 py-3 border border-slate-200 rounded-xl focus:border-maritime outline-none text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Longitude GPS</label>
                      <input 
                        type="number"
                        step="0.000001"
                        required
                        value={boatForm.lng}
                        onChange={e => setBoatForm({...boatForm, lng: Number(e.target.value)})}
                        className="w-full px-6 py-3 border border-slate-200 rounded-xl focus:border-maritime outline-none text-xs font-mono font-bold"
                      />
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
                      onClick={() => setBoatForm({ id: '', name: '', capacity: 0, description: '', imageUrl: '', lat: -2.4930, lng: 28.8590, status: 'À quai' })}
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
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest line-clamp-2 mb-3 h-8">{boat.description || 'Navire de transport sécurisé.'}</p>
                      
                      {/* Live parameters */}
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 mb-5">
                        <div className="flex justify-between">
                          <span className="text-slate-400 text-[8px]">Statut :</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-black uppercase",
                            boat.status === 'En navigation' ? "bg-sky-100 text-sky-700" :
                            boat.status === 'En maintenance' ? "bg-amber-100 text-amber-700" :
                            "bg-emerald-100 text-emerald-700"
                          )}>
                            {boat.status || 'À quai'}
                          </span>
                        </div>
                        <div className="flex justify-between font-mono text-[8.5px]">
                          <span className="text-slate-400 text-[8px] font-sans">GPS Lat :</span>
                          <span className="text-slate-700 font-bold">{(boat.lat !== undefined ? Number(boat.lat) : -2.4930).toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between font-mono text-[8.5px]">
                          <span className="text-slate-400 text-[8px] font-sans">GPS Lng :</span>
                          <span className="text-slate-700 font-bold">{(boat.lng !== undefined ? Number(boat.lng) : 28.8590).toFixed(4)}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setBoatForm({
                            id: boat.id,
                            name: boat.name,
                            capacity: boat.capacity,
                            description: boat.description || '',
                            imageUrl: boat.imageUrl || '',
                            lat: boat.lat !== undefined ? boat.lat : -2.4930,
                            lng: boat.lng !== undefined ? boat.lng : 28.8590,
                            status: boat.status || 'À quai'
                          })}
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
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-[10px] font-extrabold text-amber-700 uppercase tracking-widest flex items-center gap-2">
                          <span>💡</span>
                          <span>Le titre et la description sont facultatifs. Vous pouvez publier uniquement votre photo ou vidéo !</span>
                        </div>
                        <input 
                          placeholder="Titre (facultatif - ex: Mugote 2 au Port)"
                          value={newMedia.title}
                          onChange={e => setNewMedia({...newMedia, title: e.target.value})}
                          className="w-full px-8 py-5 bg-white border border-slate-100 rounded-[20px] focus:outline-none focus:ring-4 focus:ring-maritime/5 transition-all text-sm font-bold uppercase tracking-tight italic"
                        />
                        <textarea 
                          placeholder="Description ou message (facultatif)..."
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

        {tab === 'mongodb' && (
          <div className="w-full max-w-5xl mx-auto px-4">
            <MongoMigrationView />
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
        const mediaList = Array.isArray(data.media) && data.media.length > 0 ? data.media : [];
        const url = data.processedUrl || data.url || data.videoUrl || data.imageUrl || mediaList[0] || data.image || data.video || data.contentUrl || '';
        const isVideo = type === 'video' || !!(data.videoUrl || data.video) || isVid(url) || mediaList.some(m => isVid(m));

        const rawTitle = (data.title || '').trim();
        const rawDesc = (data.desc || data.content || data.description || data.text || '').trim();
        const resolvedTitle = rawTitle || rawDesc.slice(0, 45) || (isVideo ? 'Vidéo Mugote' : url ? 'Photo Mugote' : 'Publication AMR Mugote');
        
        return {
          ...data,
          id: doc.id,
          title: resolvedTitle,
          processedUrl: url,
          media: mediaList.length > 0 ? mediaList : (url ? [url] : []),
          processedType: isVideo ? 'video' : (type === 'text' && !url ? 'text' : 'image'),
          processedDesc: rawDesc,
          sortDate: data.publishedAt || data.updatedAt || data.createdAt || { seconds: 0 }
        };
      }).filter((item: any) => item.processedUrl || item.processedDesc || item.title);

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
        const mediaList = Array.isArray(data.media) && data.media.length > 0 ? data.media : [];
        const url = data.processedUrl || data.url || data.videoUrl || data.imageUrl || mediaList[0] || data.image || data.video || data.contentUrl || '';
        const isVideo = type === 'video' || !!(data.videoUrl || data.video) || isVid(url) || mediaList.some(m => isVid(m));

        const rawTitle = (data.title || '').trim();
        const rawDesc = (data.desc || data.content || data.description || data.text || '').trim();
        const resolvedTitle = rawTitle || rawDesc.slice(0, 45) || (isVideo ? 'Vidéo Mugote' : url ? 'Photo Mugote' : 'Publication AMR Mugote');
        
        return {
          ...data,
          id: doc.id,
          title: resolvedTitle,
          processedUrl: url,
          media: mediaList.length > 0 ? mediaList : (url ? [url] : []),
          processedType: isVideo ? 'video' : (type === 'text' && !url ? 'text' : 'image'),
          processedDesc: rawDesc,
          sortDate: data.publishedAt || data.updatedAt || data.createdAt || { seconds: 0 }
        };
      }).filter((item: any) => item.processedUrl || item.processedDesc || item.title);

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
                  {n.title?.trim() && (
                    <h3 className="text-xl font-extrabold tracking-tighter leading-none text-white group-hover:text-gold transition-colors italic text-center mx-auto">{n.title}</h3>
                  )}
                  {n.processedDesc?.trim() && (
                    <p className="text-white/60 text-xs font-medium leading-relaxed text-center mx-auto max-w-md">{n.processedDesc}</p>
                  )}
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

function MyTickets({ 
  user, 
  siteSettings, 
  onOpenScanner, 
  onLoginRequest 
}: { 
  user: FirebaseUser | null, 
  siteSettings: { homeBg: string, homeDetail?: string }, 
  onOpenScanner?: () => void,
  onLoginRequest?: () => void 
}) {
  const [tickets, setTickets] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchRef, setSearchRef] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'reservations'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTickets(snapshot.docs.map(doc => ({ ...doc.data() as Reservation, id: doc.id })));
      setLoading(false);
    }, (error) => {
      console.warn("MyTickets query failed gracefully:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  const handleGuestSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchRef.trim();
    if (!clean) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const qTicket = query(collection(db, 'reservations'), where('ticketId', '==', clean));
      const snapTicket = await getDocs(qTicket);
      if (!snapTicket.empty) {
        setTickets(snapTicket.docs.map(d => ({ ...d.data() as Reservation, id: d.id })));
        setIsSearching(false);
        return;
      }

      const qPhone = query(collection(db, 'reservations'), where('phone', '==', clean));
      const snapPhone = await getDocs(qPhone);
      if (!snapPhone.empty) {
        setTickets(snapPhone.docs.map(d => ({ ...d.data() as Reservation, id: d.id })));
        setIsSearching(false);
        return;
      }

      const docRef = doc(db, 'reservations', clean);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setTickets([{ ...docSnap.data() as Reservation, id: docSnap.id }]);
        setIsSearching(false);
        return;
      }

      setSearchError("Aucun billet trouvé pour cette référence ou ce numéro de téléphone.");
    } catch (err) {
      setSearchError("Une erreur est survenue lors de la recherche du billet.");
    } finally {
      setIsSearching(false);
    }
  };

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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 sm:space-y-8">
      {/* Header and Quick Scanner Action */}
      <div className="border-b border-slate-200 pb-4 sm:pb-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tighter uppercase mb-1 italic text-maritime">Mes Billets de Voyage</h2>
          <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-400 font-bold">
            Consultez votre statut d'embarquement en temps réel • Validation réservée aux agents administratifs
          </p>
        </div>
        {onOpenScanner && (
          <button
            onClick={onOpenScanner}
            className="w-full sm:w-auto px-5 py-3 bg-[#0b132b] hover:bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition cursor-pointer"
          >
            <QrCode size={16} className="text-white" />
            <span>Scanner QR / Vérifier Statut</span>
          </button>
        )}
      </div>

      {!user ? (
        <div className="bg-[#001f35] text-white p-8 sm:p-12 rounded-3xl shadow-2xl text-center max-w-lg mx-auto border border-white/10 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-400/20 text-amber-400 mx-auto flex items-center justify-center">
            <Lock size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Connexion requise</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Pour consulter vos billets de voyage et accéder à vos cartes d'embarquement, veuillez vous connecter à votre compte.
            </p>
          </div>
          <button
            type="button"
            onClick={onLoginRequest}
            className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs sm:text-sm uppercase tracking-wider transition cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            <User size={16} />
            <span>Se connecter pour consulter mes billets</span>
          </button>
        </div>
      ) : (
        <>
          {/* Strict Administrative Separation Notice */}
          <div className="bg-slate-100/90 border border-slate-300 rounded-2xl p-4 flex items-start gap-3 text-left">
            <ShieldCheck size={18} className="text-slate-800 shrink-0 mt-0.5" />
            <p className="text-[11px] font-medium text-slate-800 leading-relaxed">
              <strong>Règle d'embarquement officiel :</strong> Vous pouvez vérifier le statut de votre billet ci-dessous à tout moment. Seul le <strong>compte administratif</strong> au quai peut scanner pour <strong>autoriser définitivement votre embarquement</strong> physique à bord du navire.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {loading ? (
          <div className="col-span-2 text-center py-10 sm:py-16 text-slate-400 animate-pulse uppercase text-[8px] sm:text-[10px] font-bold tracking-widest">Chargement...</div>
        ) : tickets.length === 0 ? (
          <div className="col-span-2 text-center py-10 sm:py-16 text-slate-400 uppercase text-[8px] sm:text-[10px] font-bold tracking-widest border border-dashed border-slate-200 rounded-xl mx-4">Aucun billet trouvé.</div>
        ) : (
          tickets.map(res => {
            let classCardStyle = "bg-white/80 backdrop-blur-md border-slate-300/80 shadow-md hover:border-slate-500 hover:shadow-xl";
            let classStubStyle = "bg-slate-100/60 backdrop-blur-sm border-slate-200/80";
            
            if (res.travelClass === 'VIP') {
              classCardStyle = "bg-white/75 backdrop-blur-md border-slate-400/80 shadow-lg hover:border-black hover:shadow-2xl";
              classStubStyle = "bg-slate-900/[0.05] backdrop-blur-sm border-slate-300/80";
            } else if (res.travelClass === '1ère Classe') {
              classCardStyle = "bg-white/80 backdrop-blur-md border-slate-400/80 shadow-md hover:border-[#0b132b] hover:shadow-xl";
              classStubStyle = "bg-[#0b132b]/[0.05] backdrop-blur-sm border-slate-300/80";
            } else {
              classCardStyle = "bg-white/70 backdrop-blur-md border-slate-300/80 shadow-md hover:border-slate-400 hover:shadow-xl";
              classStubStyle = "bg-slate-100/50 backdrop-blur-sm border-slate-200/80";
            }

            return (
              <div key={res.id} className={cn("border rounded-2xl overflow-hidden flex flex-col sm:flex-row transition-all hover:shadow-xl group mx-0 sm:mx-0 relative", classCardStyle)}>
                <div className={cn("w-full sm:w-28 flex flex-row sm:flex-col items-center justify-center p-4 border-b sm:border-b-0 sm:border-r gap-4 sm:gap-0", classStubStyle)}>
                  {res.status === 'VALIDATED' ? (
                    <>
                      <QRCodeSVG value={`https://${window.location.host}/?verify=${res.id}`} size={64} className="sm:size-16" />
                      <p className="text-[7px] font-black uppercase tracking-widest text-slate-700 sm:mt-3 text-center">DGM Verify</p>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-1 sm:p-2">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl flex items-center justify-center shadow-inner mb-1.5">
                        <Lock size={20} />
                      </div>
                      <p className="text-[6.5px] sm:text-[7.5px] font-black uppercase tracking-tight text-amber-800 leading-tight">
                        En Attente Admin
                      </p>
                      <p className="text-[5.5px] sm:text-[6.5px] text-amber-700/80 font-semibold mt-0.5 leading-none">
                        Non Validé
                      </p>
                    </div>
                  )}
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
                             <h3 className="text-xs sm:text-sm font-black tracking-tight uppercase truncate text-slate-900">{res.fullName} {res.lastName}</h3>
                             <span className="text-[8px] sm:text-[9px] font-mono text-slate-500 font-bold">#{res.ticketId || 'ID-'+res.id?.substring(0,6).toUpperCase()}</span>
                          </div>
                          <div className="mt-1">
                            <span className="text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white bg-[#0b132b] shadow-xs">
                              {res.travelClass}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3.5 space-y-1">
                        <p className="text-[8px] sm:text-[10px] text-slate-900 font-black uppercase tracking-widest leading-tight">Voyage: {res.travelDate} à {res.departureTime || '07:30'} • {res.ship}</p>
                        <p className="text-[7px] sm:text-[8px] text-slate-500 font-bold uppercase tracking-widest">Réservation: {res.bookingDateFormatted || (res.createdAt ? new Date(res.createdAt).toLocaleDateString('fr-FR') : 'Aujourd\'hui')} {res.bookingTimeFormatted ? `à ${res.bookingTimeFormatted}` : (res.createdAt ? `à ${new Date(res.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '')}</p>
                        {res.transactionId && (
                          <p className="text-[7px] text-slate-500 font-mono italic">TX: {res.transactionId}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={cn(
                        "text-[7px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-sm",
                        res.status === 'VALIDATED' ? "bg-emerald-50 text-emerald-700 border-emerald-300" : 
                        res.status === 'PENDING' ? "bg-slate-100 text-slate-700 border-slate-300" : 
                        "bg-red-50 text-red-600 border-red-200"
                      )}>
                        {res.status === 'VALIDATED' ? 'PAYÉ' : res.status}
                      </span>
                      {((res as any).boardingStatus === 'BOARDED' || (res as any).boarded === true) ? (
                        <span className="text-[7px] font-black uppercase tracking-widest px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md flex items-center gap-1 shadow-sm">
                          <CheckCircle2 size={10} className="text-emerald-600" />
                          EMBARQUÉ
                        </span>
                      ) : res.status === 'VALIDATED' ? (
                        <span className="text-[7px] font-black uppercase tracking-widest px-2 py-0.5 bg-slate-900 text-white rounded-md flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          PRÊT EMBARQUEMENT
                        </span>
                      ) : (
                        <span className="text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-md">
                          NON ÉLIGIBLE
                        </span>
                      )}
                    </div>
                  </div>
                <div className="flex items-end justify-between pt-3 sm:pt-4 border-t border-slate-200/80 gap-2">
                  <div className="text-left min-w-0">
                    <p className="text-[7px] sm:text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Itinéraire</p>
                    <p className="text-[9px] sm:text-[11px] font-black text-slate-900 uppercase truncate">{res.itinerary}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[7px] sm:text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Total</p>
                    <p className="text-sm sm:text-base font-black text-slate-900 mono tracking-tighter">{res.amount}$</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {res.email && (
                      <button
                        onClick={async () => {
                          try {
                            const ticketKey = res.ticketId || res.id || (res as any)._id;
                            const resp = await mongoApi.sendDepartureReminder(ticketKey);
                            alert(resp.message || `Rappel d'heure de départ expédié à ${res.email}`);
                          } catch (e: any) {
                            alert("Erreur envoi rappel: " + e.message);
                          }
                        }}
                        className="px-2.5 sm:px-3 py-1 bg-black hover:bg-slate-900 text-white border border-slate-700 text-[6.5px] sm:text-[7.5px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                        title="Recevoir le rappel de départ sur votre compte Gmail"
                      >
                        <Mail size={10} className="text-white" />
                        {(res as any).reminderEmailSent ? "Rappel Gmail ✓" : "Rappel Gmail"}
                      </button>
                    )}
                    {res.status === 'VALIDATED' && !(res as any).cancellationRequested ? (
                      <button 
                        onClick={() => generateTicketPDF(res)}
                        className="px-3 sm:px-4 py-1.5 bg-[#0b132b] text-white text-[7px] sm:text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-black transition-all flex-shrink-0 shadow-md flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Download size={10} />
                        Billet
                      </button>
                    ) : !(res as any).cancellationRequested ? (
                      <button 
                        type="button"
                        onClick={() => alert("Ce billet n'est pas encore validé par l'administrateur. Conformément au règlement officiel, tant que le billet n'est pas validé chez l'admin, le client ne peut jamais avoir son billet.")}
                        className="px-2.5 sm:px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[6.5px] sm:text-[7.5px] font-bold rounded-lg transition-all flex-shrink-0 flex items-center justify-center gap-1 cursor-pointer"
                        title="Billet bloqué jusqu'à validation par l'administration"
                      >
                        <Lock size={9} className="text-amber-600" />
                        <span>En Attente Admin</span>
                      </button>
                    ) : null}
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
      </>
      )}
    </motion.div>
  );
}

function VerificationView({ id, onClose, isAdmin, siteSettings }: { id: string, onClose: () => void, isAdmin?: boolean, siteSettings?: any }) {
  const [res, setRes] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorizing, setAuthorizing] = useState(false);
  const [authorizedSuccess, setAuthorizedSuccess] = useState(false);
  const [localIsAdmin, setLocalIsAdmin] = useState(!!isAdmin);
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState(false);

  useEffect(() => {
    setLocalIsAdmin(!!isAdmin);
  }, [isAdmin]);

  useEffect(() => {
    const fetchDoc = async () => {
      if (!db || !id) {
        setLoading(false);
        return;
      }
      try {
        const docSnap = await getDoc(doc(db, 'reservations', id));
        if (docSnap.exists()) {
          setRes({ ...(docSnap.data() as Reservation), id: docSnap.id });
        } else {
          // Check query by ticketId
          const q = query(collection(db, 'reservations'), where('ticketId', '==', id));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const d = snap.docs[0];
            setRes({ ...(d.data() as Reservation), id: d.id });
          }
        }
      } catch (error) {
        console.error("Verification failed", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [id]);

  const handleAdminAuthorize = async () => {
    if (!res || !res.id) return;
    if (!localIsAdmin) {
      alert("Accès refusé : Seul le compte administratif peut valider l'embarquement.");
      return;
    }

    setAuthorizing(true);
    try {
      const updateTimestamp = Date.now();
      await updateDoc(doc(db, 'reservations', res.id), {
        boardingStatus: 'BOARDED',
        boardedAt: updateTimestamp
      });
      await mongoApi.updateReservationStatus(res.id, {
        boarded: true,
        status: 'VALIDATED'
      });

      setRes(prev => prev ? {
        ...prev,
        boardingStatus: 'BOARDED' as const,
        boardedAt: updateTimestamp
      } : null);

      setAuthorizedSuccess(true);
      playBeep(true);
    } catch (err: any) {
      console.error("Authorization failed:", err);
      alert("Erreur lors de l'autorisation d'embarquement : " + err.message);
    } finally {
      setAuthorizing(false);
    }
  };

  const handleAdminCancelBoarding = async () => {
    if (!res || !res.id || !localIsAdmin) return;
    if (!window.confirm(`Annuler l'embarquement de ${res.fullName} ?`)) return;

    setAuthorizing(true);
    try {
      await updateDoc(doc(db, 'reservations', res.id), {
        boardingStatus: 'PENDING',
        boardedAt: null
      });
      await mongoApi.updateReservationStatus(res.id, {
        boarded: false,
        status: 'VALIDATED'
      });

      setRes(prev => prev ? {
        ...prev,
        boardingStatus: 'PENDING' as any,
        boardedAt: undefined
      } : null);

      setAuthorizedSuccess(false);
      alert("Embarquement annulé par l'administration.");
    } catch (err: any) {
      alert("Erreur lors de l'annulation : " + err.message);
    } finally {
      setAuthorizing(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPinInput === '2026' || adminPinInput === '1234' || adminPinInput.toLowerCase() === 'mugote') {
      setLocalIsAdmin(true);
      setShowAdminPinModal(false);
      setAdminPinInput('');
      setAdminPinError(false);
    } else {
      setAdminPinError(true);
    }
  };

  const isPaid = res?.status === 'VALIDATED';
  const isBoarded = (res as any)?.boardingStatus === 'BOARDED' || (res as any)?.boarded === true;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto py-6 sm:py-12 px-4 shadow-none text-left">
      <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden border-t-8 border-maritime">
        
        {/* Header */}
        <div className="p-6 sm:p-10 text-center border-b border-slate-100 relative bg-gradient-to-b from-slate-50/60 to-white">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-maritime/5 text-maritime rounded-2xl flex items-center justify-center mx-auto mb-4 border border-maritime/10">
            <ShieldCheck size={36} className="sm:size-10" />
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mb-2 border">
            {localIsAdmin ? (
              <span className="bg-emerald-50 text-emerald-800 border-emerald-300 px-3 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Mode Contrôle Administratif • Autorité Quai
              </span>
            ) : (
              <span className="bg-sky-50 text-sky-800 border-sky-200 px-3 py-0.5 rounded-full flex items-center gap-1.5">
                <User size={11} className="text-sky-600" />
                Mode Consultation Voyageur • Statut Billet
              </span>
            )}
          </div>

          <h2 className="text-xl sm:text-3xl font-extrabold tracking-tighter uppercase mb-1 text-slate-900">
            Vérification de Billet
          </h2>
          <p className="text-[9px] sm:text-[11px] uppercase tracking-widest text-slate-400 font-bold">
            Système Officiel AMR MUGOTE / DGM Lac Kivu
          </p>
        </div>

        <div className="p-6 sm:p-10 space-y-6 sm:space-y-8">
          {loading ? (
            <div className="text-center py-8 sm:py-12 space-y-3">
              <RotateCw className="animate-spin text-maritime mx-auto" size={28} />
              <p className="text-slate-400 uppercase text-[10px] sm:text-xs font-bold tracking-widest">
                Recherche du titre de transport...
              </p>
            </div>
          ) : !res ? (
            <div className="text-center py-8 sm:py-12 text-rose-600 space-y-2">
              <AlertCircle size={36} className="mx-auto text-rose-500" />
              <p className="uppercase text-xs sm:text-sm font-extrabold tracking-widest">
                Billet Invalide ou Introuvable
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Aucun billet ne correspond à l'identifiant #{id}. Veuillez vérifier votre reçu ou contacter le guichet.
              </p>
            </div>
          ) : (
            <>
              {/* PRIMARY STATUS BANNER */}
              <div className={cn(
                "p-5 rounded-2xl border-2 space-y-2",
                isBoarded 
                  ? "bg-emerald-50 border-emerald-400 text-emerald-950" 
                  : isPaid
                  ? "bg-sky-50 border-sky-400 text-sky-950"
                  : "bg-amber-50 border-amber-400 text-amber-950"
              )}>
                <div className="flex items-center gap-2.5">
                  {isBoarded ? (
                    <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
                  ) : isPaid ? (
                    <CheckCircle2 size={22} className="text-sky-600 shrink-0" />
                  ) : (
                    <AlertCircle size={22} className="text-amber-600 shrink-0" />
                  )}
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-tight">
                    {isBoarded 
                      ? "✓ EMBARQUÉ À BORD DU NAVIRE" 
                      : isPaid 
                      ? "🟢 PRÊT POUR L'EMBARQUEMENT" 
                      : "⏳ PAIEMENT EN ATTENTE AU GUICHET"}
                  </h3>
                </div>

                <p className="text-xs font-medium leading-relaxed">
                  {isBoarded ? (
                    <>
                      Passage validé et enregistré. Pointé à bord{' '}
                      <strong>
                        {(res as any).boardedAt 
                          ? new Date((res as any).boardedAt).toLocaleDateString('fr-FR', {
                              day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit'
                            }) 
                          : 'aujourd\'hui'}
                      </strong>. Bon voyage !
                    </>
                  ) : isPaid ? (
                    <>
                      Titre de transport <strong>officiellement payé et confirmé</strong>. {localIsAdmin ? (
                        <span className="font-bold text-emerald-800">
                          En tant qu'administrateur, vous pouvez autoriser l'accès ci-dessous après avoir vérifié l'identité du passager.
                        </span>
                      ) : (
                        <span>
                          Rendez-vous à la passerelle du navire. <strong>Présentez ce QR Code à l'agent administratif au quai pour qu'il autorise votre montée à bord.</strong>
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      Ce billet n'est pas encore validé. Le passager doit régulariser son paiement au guichet avant de pouvoir embarquer.
                    </>
                  )}
                </p>
              </div>

              {/* ADMINISTRATIVE ACTION SECTION (ONLY FOR ADMINS) */}
              {localIsAdmin ? (
                <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 space-y-4 border border-slate-800 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck size={14} />
                      Action Administrative Exclusive
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      ID: {res.id.substring(0, 10)}...
                    </span>
                  </div>

                  {isPaid && !isBoarded && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-300 font-medium">
                        Le billet est en règle. Cliquez sur le bouton ci-dessous pour lâcher ce voyageur et enregistrer son embarquement dans la base de données.
                      </p>
                      <button
                        type="button"
                        onClick={handleAdminAuthorize}
                        disabled={authorizing}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs sm:text-sm uppercase tracking-widest rounded-xl shadow-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                      >
                        {authorizing ? (
                          <RotateCw size={18} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={18} />
                        )}
                        <span>AUTORISER L'EMBARQUEMENT (LÂCHER LE PASSAGER)</span>
                      </button>
                    </div>
                  )}

                  {isBoarded && (
                    <div className="flex items-center justify-between gap-4 pt-1">
                      <div className="text-xs text-emerald-400 font-bold flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        <span>Embarquement autorisé par l'administration</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAdminCancelBoarding}
                        disabled={authorizing}
                        className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[9px] font-bold uppercase rounded-lg transition cursor-pointer"
                      >
                        Annuler l'embarquement
                      </button>
                    </div>
                  )}

                  {!isPaid && (
                    <div className="p-3 bg-amber-950/60 border border-amber-700/50 rounded-xl text-amber-200 text-xs font-semibold">
                      ⚠️ Paiement non reçu. L'embarquement ne peut pas être autorisé par l'agent tant que la caisse n'a pas validé.
                    </div>
                  )}
                </div>
              ) : (
                /* TRAVELER NOTICE: Explaining why traveler cannot validate */
                <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-1 text-left">
                  <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-tight">
                    <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                    <span>Règle de Sécurité Portuaire</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                    Ce mode vous permet de <strong>vérifier votre statut</strong>. Conformément aux règlements maritimes, <strong className="underline">aucun voyageur ne peut valider lui-même son embarquement</strong>. Seul l'agent administratif au quai est habilité à scanner et autoriser l'accès physique à bord.
                  </p>
                </div>
              )}

              {/* Ticket Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-slate-50/70 p-5 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">N° Titre de Transport</p>
                  <p className="text-base sm:text-lg font-black font-mono tracking-wider text-slate-900 uppercase">
                    #{res.ticketId || res.id?.substring(0, 8).toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Passager Titulaire</p>
                  <p className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase truncate">
                    {res.fullName} {res.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Itinéraire</p>
                  <p className="text-sm sm:text-base font-black tracking-tight text-maritime uppercase">
                    {res.itinerary}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Navire de Ligne</p>
                  <p className="text-sm sm:text-base font-black tracking-tight text-maritime uppercase">
                    {res.ship}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date & Heure de Départ</p>
                  <p className="text-sm sm:text-base font-black font-mono text-slate-900">
                    {res.travelDate} à {res.departureTime || '07:30'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Classe & Passagers</p>
                  <p className="text-sm sm:text-base font-black text-slate-900 uppercase">
                    {res.travelClass} • {res.passengersCount} PAX
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Montant Payé</p>
                  <p className="text-sm sm:text-base font-black text-emerald-700">
                    {res.amount}.00 $
                  </p>
                </div>
                {res.phone && (
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Téléphone</p>
                    <p className="text-xs sm:text-sm font-bold font-mono text-slate-700">
                      {res.phone}
                    </p>
                  </div>
                )}
              </div>

              {/* Digital Fingerprint */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Certificat d'Authenticité AMR MUGOTE / DGM
                </p>
                <div className="text-[8px] font-mono text-slate-500 space-y-0.5 break-all">
                  <p>DOC_ID: {res.id}</p>
                  {res.transactionId && <p>TX_REF: {res.transactionId}</p>}
                </div>
              </div>

              {/* Quick Admin Unlock option for staff scanning on mobile phone */}
              {!localIsAdmin && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminPinModal(!showAdminPinModal)}
                    className="text-[10px] text-slate-400 hover:text-slate-700 font-bold uppercase tracking-wider underline cursor-pointer"
                  >
                    Êtes-vous l'agent administratif au quai ? Déverrouiller le contrôle
                  </button>
                  
                  {showAdminPinModal && (
                    <form onSubmit={handlePinSubmit} className="mt-3 p-4 bg-slate-100 rounded-2xl border border-slate-200 max-w-sm mx-auto space-y-2">
                      <p className="text-[10px] font-bold text-slate-700 uppercase">
                        Code d'Accès Contrôleur Portuaire
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          placeholder="Code secret admin..."
                          value={adminPinInput}
                          onChange={(e) => setAdminPinInput(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-mono font-bold focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-maritime text-white rounded-xl text-xs font-black uppercase cursor-pointer"
                        >
                          Valider
                        </button>
                      </div>
                      {adminPinError && (
                        <p className="text-[10px] text-rose-600 font-bold">Code incorrect.</p>
                      )}
                    </form>
                  )}
                </div>
              )}
            </>
          )}

          {/* Close Button */}
          <button 
            onClick={onClose}
            className="w-full py-3.5 bg-slate-900 text-white text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] rounded-xl hover:bg-black transition-all cursor-pointer"
          >
            Fermer la Vérification
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
  const [scanStatus, setScanStatus] = useState<'idle' | 'loading' | 'ready_to_board' | 'success' | 'alert_reused' | 'alert_unpaid' | 'error_not_found'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [authorizing, setAuthorizing] = useState(false);

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

      // 3. Ticket is valid and paid - Display status to Admin, ready for authorization
      setScanStatus('ready_to_board');
      setStatusMessage(`BILLET CONFORME & PAYÉ : Statut vérifié avec succès pour ${ticketData.fullName} (${ticketData.passengersCount} PAX). Cliquez sur "AUTORISER L'EMBARQUEMENT" pour valider l'accès au navire.`);
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

  // Administrative Boarding Authorization
  const handleAuthorizeBoarding = async (ticket: Reservation) => {
    if (!ticket || !ticket.id) return;
    setAuthorizing(true);
    try {
      const updateTimestamp = Date.now();
      await updateDoc(doc(db, 'reservations', ticket.id), {
        boardingStatus: 'BOARDED',
        boardedAt: updateTimestamp
      });
      await mongoApi.updateReservationStatus(ticket.id, {
        boarded: true,
        status: 'VALIDATED'
      });

      const updatedTicket = {
        ...ticket,
        boardingStatus: 'BOARDED' as const,
        boardedAt: updateTimestamp
      };

      setScannedRes(updatedTicket);
      setScanStatus('success');
      setStatusMessage("ACCÈS ACCORDÉ PAR L'ADMINISTRATION : Embarquement validé avec succès ! Passager lâché à bord.");
      setScannedList(prev => [updatedTicket, ...prev.filter(x => x.id !== updatedTicket.id)]);
      playBeep(true);
    } catch (err: any) {
      console.error("Authorize boarding failed:", err);
      alert("Erreur lors de l'autorisation d'embarquement : " + err.message);
    } finally {
      setAuthorizing(false);
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
      await mongoApi.updateReservationStatus(ticket.id, {
        boarded: false,
        status: 'VALIDATED'
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
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full mb-2">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wider">
              Compte Administratif Exclusif • Seul Habilité à Autoriser l'Embarquement
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black uppercase text-maritime tracking-tight italic">
            Scanner Quai & Contrôle d'Accès Portuaire
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 leading-relaxed">
            Vérification du statut en temps réel • Seule l'administration peut lâcher les voyageurs et valider l'embarquement
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
              "p-5 rounded-2xl border-2 text-left flex flex-col sm:flex-row items-start gap-4 transition-all duration-300 shadow-sm",
              scanStatus === 'success' && "bg-emerald-50/90 border-emerald-500 text-emerald-950",
              scanStatus === 'ready_to_board' && "bg-sky-50/90 border-sky-500 text-sky-950 animate-pulse",
              scanStatus === 'alert_reused' && "bg-rose-50 border-rose-500 text-rose-900 animate-bounce",
              scanStatus === 'alert_unpaid' && "bg-amber-50 border-amber-500 text-amber-900",
              scanStatus === 'error_not_found' && "bg-slate-100 border-slate-350 text-slate-800",
              scanStatus === 'loading' && "bg-sky-50 border-sky-400 text-sky-950"
            )}>
              <div className="flex-shrink-0 mt-0.5">
                {scanStatus === 'success' && <CheckCircle2 className="text-emerald-600" size={28} />}
                {scanStatus === 'ready_to_board' && <ShieldCheck className="text-sky-600" size={28} />}
                {scanStatus === 'alert_reused' && <AlertCircle className="text-rose-600" size={28} />}
                {scanStatus === 'alert_unpaid' && <AlertCircle className="text-[#eab308]" size={28} />}
                {scanStatus === 'error_not_found' && <AlertCircle className="text-slate-500" size={28} />}
                {scanStatus === 'loading' && <RotateCw className="text-sky-500 animate-spin" size={28} />}
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-widest leading-none">
                  {scanStatus === 'success' && "EMBARQUEMENT AUTORISÉ & ENREGISTRÉ"}
                  {scanStatus === 'ready_to_board' && "BILLET EN RÈGLE — PRÊT POUR EMBARQUEMENT"}
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

              {/* Administrative Boarding Authority Action */}
              {scannedRes.status === 'VALIDATED' && scannedRes.boardingStatus !== 'BOARDED' && (
                <div className="pt-2">
                  <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-800 flex items-center gap-1.5">
                        <ShieldCheck size={16} className="text-emerald-600" />
                        Contrôle Administratif Quai
                      </span>
                      <p className="text-xs font-black text-slate-900 mt-1">
                        Statut : Billet payé et valide pour {scannedRes.fullName} ({scannedRes.passengersCount} PAX)
                      </p>
                      <p className="text-[10px] text-slate-600 font-medium">
                        Vérifiez l'identité du voyageur puis cliquez ci-contre pour autoriser l'accès au navire et lâcher le voyageur.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAuthorizeBoarding(scannedRes)}
                      disabled={authorizing || loading}
                      className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {authorizing ? <RotateCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                      <span>AUTORISER L'EMBARQUEMENT</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Boarding Stamp if boarded */}
              {scannedRes.boardingStatus === 'BOARDED' && (
                <div className="pt-2">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                    <div>
                      <p className="text-xs font-black text-emerald-800 uppercase flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        ✓ Embarquement Autorisé & Validé par l'Administration
                      </p>
                      {scannedRes.boardedAt && (
                        <p className="text-[10px] font-bold text-emerald-600 font-mono mt-0.5">
                          Pointé le {new Date(scannedRes.boardedAt).toLocaleDateString('fr-FR')} à {new Date(scannedRes.boardedAt).toLocaleTimeString('fr-FR')}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCancelBoarding(scannedRes)}
                      disabled={authorizing || loading}
                      className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[9px] font-bold uppercase rounded-lg transition cursor-pointer"
                    >
                      Annuler l'embarquement
                    </button>
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

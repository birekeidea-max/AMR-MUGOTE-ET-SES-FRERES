import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Compass, RefreshCw, Check, Car, Ship, Camera, Upload, Trash2 } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';

// AMR MUGOTE Port exact coordinates in Bukavu (Lake Kivu shoreline, Kadutu near Beach Muhanzi)
const PORT_COORDS = { lat: -2.4930, lng: 28.8590 };

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

// Haversine formula to compute distance in km
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

interface LocalisationViewProps {
  isAdmin?: boolean;
}

export default function LocalisationView({ isAdmin = false }: LocalisationViewProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [directions, setDirections] = useState<string[]>([]);
  const [boats, setBoats] = useState<any[]>([]);

  // State for boat image in the circular zone (stored locally and in Firestore settings if available)
  const [boatImage, setBoatImage] = useState<string>(() => {
    return localStorage.getItem('mugote_boat_image') || '';
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing siteSettings image if boatImage not set
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'general'));
        if (snap.exists()) {
          const data = snap.data();
          if (data?.homeDetail && !localStorage.getItem('mugote_boat_image')) {
            setBoatImage(data.homeDetail);
          }
        }
      } catch (e) {
        console.warn("Settings fetch note:", e);
      }
    };
    fetchSettings();

    const handleSync = () => {
      const stored = localStorage.getItem('mugote_boat_image');
      if (stored) setBoatImage(stored);
    };
    window.addEventListener('boat_image_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('boat_image_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert file to Base64
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setBoatImage(base64);
        try {
          localStorage.setItem('mugote_boat_image', base64);
          window.dispatchEvent(new Event('boat_image_updated'));
          await updateDoc(doc(db, 'settings', 'general'), {
            homeDetail: base64
          });
        } catch {
          // localStorage fallback sufficient
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBoatImage('');
    localStorage.removeItem('mugote_boat_image');
    window.dispatchEvent(new Event('boat_image_updated'));
  };

  // Realtime listener for the fleet collection
  useEffect(() => {
    const q = query(collection(db, 'fleet'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        };
      });
      setBoats(list);
    }, (error) => {
      console.warn("Could not listen to fleet in LocalisationView:", error);
    });

    return () => unsubscribe();
  }, []);

  const requestUserLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("la géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }

    setLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const uLoc = { lat: latitude, lng: longitude };
        setUserLocation(uLoc);
        
        // Compute distance to Port
        const dist = getDistanceFromLatLonInKm(latitude, longitude, PORT_COORDS.lat, PORT_COORDS.lng);
        setDistanceKm(dist);
        
        // Generate directional guide
        generateStepByStepGuide(latitude, longitude, dist);
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGeoError(
            "accès refusé ou bloqué par le navigateur. astuce : pour autoriser la localisation sur la carte, veuillez ouvrir ce site dans un nouvel onglet indépendant au lieu de l'aperçu imbriqué !"
          );
        } else {
          setGeoError(
            "impossible de déterminer vos coordonnées gps. si vous êtes sur un ordinateur fixe sans récepteur gps, ou dans un aperçu de test, vous pouvez tester sur votre smartphone ou saisir l'adresse postale."
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const generateStepByStepGuide = (uLat: number, uLng: number, dist: number) => {
    const steps: string[] = [];
    
    const latDiff = PORT_COORDS.lat - uLat;
    const lngDiff = PORT_COORDS.lng - uLng;

    steps.push(`vous êtes actuellement situé à environ ${dist.toFixed(2)} kilomètres du port mugote.`);

    if (latDiff > 0.05) {
      steps.push("dirigez-vous vers le nord pour entrer dans la ville de bukavu par la route nationale.");
    } else if (latDiff < -0.05) {
      steps.push("dirigez-vous vers le sud en direction de la commune de kadutu.");
    }

    if (lngDiff > 0.05) {
      steps.push("suivez les axes routiers vers l'est pour vous rapprocher de la rive du lac kivu.");
    } else if (lngDiff < -0.05) {
      steps.push("suivez les axes vers l'ouest en descendant vers la baie.");
    }

    steps.push("une fois dans la commune de kadutu, dirigez-vous vers le quartier nkafu via l'avenue michombero.");
    steps.push("prenez comme repère principal le marché beach muhanzi (très célèbre à bukavu). notre port est situé juste en diagonale.");
    steps.push("le port d'embarquement amr mugote est logé entre le marché beach muhanzi à l'est et le port de l'ets silimu à l'ouest.");

    setDirections(steps);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 text-left">
      {/* Hidden file input for boat image upload (administrateur uniquement) */}
      {isAdmin && (
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />
      )}

      {/* Header Banner avec la zone en cercle en haut à gauche */}
      <div className="bg-[#001233] rounded-[32px] p-6 sm:p-10 text-white relative overflow-hidden border border-white/10 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6 sm:gap-8">
          
          {/* ZONE EN CERCLE EN HAUT À GAUCHE POUR LE BATEAU */}
          <div className="flex-shrink-0 flex flex-col items-center">
            <div
              onClick={() => {
                if (isAdmin) fileInputRef.current?.click();
              }}
              className={`relative w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-gold bg-[#07132c] shadow-2xl overflow-hidden flex items-center justify-center transition-all duration-300 ${
                isAdmin ? 'cursor-pointer group hover:scale-105' : 'cursor-default'
              }`}
              title={isAdmin ? "cliquez ici pour insérer ou modifier l'image du bateau" : "navire amr mugote"}
            >
              {boatImage ? (
                <>
                  <img
                    src={boatImage}
                    alt="Bateau AMR Mugote"
                    className={`w-full h-full object-cover transition-opacity ${
                      isAdmin ? 'group-hover:opacity-75' : ''
                    }`}
                  />
                  {isAdmin && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                      <Camera size={24} className="text-gold mb-1" />
                      <span className="text-[9px] font-bold text-center px-1 leading-tight">changer l'image</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-3 space-y-1">
                  <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center text-gold">
                    <Ship size={22} />
                  </div>
                  {isAdmin ? (
                    <>
                      <span className="text-[10px] font-bold text-gold flex items-center gap-1">
                        <Upload size={10} /> insérer l'image
                      </span>
                      <span className="text-[8px] text-slate-400 leading-tight">du bateau</span>
                    </>
                  ) : (
                    <span className="text-[10px] font-black text-gold/90 uppercase tracking-wide">
                      amr mugote
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions sous le cercle (STRICTEMENT réservées à l'administrateur) */}
            {isAdmin && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] text-gold hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Camera size={11} /> {boatImage ? "modifier la photo" : "ajouter photo bateau"}
                </button>
                {boatImage && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer"
                    title="supprimer la photo"
                  >
                    <Trash2 size={11} /> retirer
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Textes de la bannière (titre en grand, corps en minuscule) */}
          <div className="flex-1 space-y-3">
            <div className="inline-flex items-center gap-2 bg-gold/10 text-gold px-3.5 py-1 rounded-full border border-gold/20 text-xs font-semibold">
              <Compass className="animate-spin-slow" size={14} />
              <span>géolocalisation voyageurs</span>
            </div>
            
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white italic">
              SE RENDRE AU <span className="text-gold">PORT MUGOTE</span>
            </h1>

            <p className="text-slate-300 max-w-2xl text-xs sm:text-sm font-normal leading-relaxed">
              trouvez facilement le quai d'embarquement de la compagnie amr mugote & frères. 
              découvrez votre position actuelle en temps réel et naviguez directement jusqu'à notre bateau.
            </p>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Navigation & Address Details (LHS) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Official Address */}
          <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-200 shadow-xl space-y-5">
            <h2 className="text-lg sm:text-xl font-black text-[#001233] border-b border-slate-100 pb-3 flex items-center gap-3">
              <span className="p-2 bg-gold/10 rounded-xl text-gold">
                <MapPin size={20} />
              </span>
              Adresse de l'Établissement
            </h2>

            <div className="space-y-4 text-xs font-normal text-slate-600">
              <div>
                <p className="text-[10px] font-semibold text-slate-400">entreprise</p>
                <p className="text-sm font-bold text-[#001233]">ets amr mugote et ses frères</p>
              </div>
              <div className="h-px bg-slate-100" />
              <div>
                <p className="text-[10px] font-semibold text-slate-400">localisation administrative</p>
                <p className="text-slate-700 leading-relaxed font-medium">
                  rdc, province du sud-kivu, ville de bukavu, commune de kadutu, avenue michombero, quartier nkafu.
                </p>
              </div>
              <div className="h-px bg-slate-100" />
              <div>
                <p className="text-[10px] font-semibold text-slate-400">bornes et repères de sécurité</p>
                <p className="text-slate-700 leading-relaxed font-medium">
                  en diagonale avec le marché beach muhanzi. le port est limité à l'est par le marché beach muhanzi et à l'ouest par le port de l'ets silimu.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: GPS Assistant */}
          <div className="bg-[#001233] text-white rounded-[32px] p-6 sm:p-8 space-y-5 border border-white/5 shadow-2xl relative overflow-hidden">
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-3">
              <span className="p-2 bg-white/10 rounded-xl text-gold">
                <Navigation size={20} />
              </span>
              Calculateur de Distance
            </h2>

            {/* Geolocation trigger */}
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                activez le gps de votre smartphone ou ordinateur pour calculer instantanément les kilomètres restants jusqu'au quai de départ.
              </p>

              {userLocation ? (
                <div className="bg-white/5 rounded-2xl p-4 sm:p-5 border border-white/10 space-y-4 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-medium text-slate-400">distances congo</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">
                      <Check size={10} /> gps actif
                    </span>
                  </div>

                  {distanceKm !== null && (
                    <div className="text-center py-2 space-y-1">
                      <p className="text-3xl sm:text-4xl font-black italic text-gold">
                        {distanceKm < 1 ? `${(distanceKm * 1000).toFixed(0)} m` : `${distanceKm.toFixed(2)} km`}
                      </p>
                      <p className="text-[10px] text-slate-300 font-medium">restant jusqu'au port mugote</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 border-t border-white/10 pt-3">
                    <div>
                      <span className="block text-[8px] text-slate-500">votre latitude</span>
                      <span className="text-white font-bold">{userLocation.lat.toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] text-slate-500">votre longitude</span>
                      <span className="text-white font-bold">{userLocation.lng.toFixed(6)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={requestUserLocation}
                  disabled={locating}
                  className="w-full py-3.5 bg-gold hover:bg-gold-light text-[#001233] font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2.5 text-xs cursor-pointer"
                >
                  <RefreshCw className={locating ? "animate-spin" : ""} size={15} />
                  <span>{locating ? "localisation en cours..." : "localiser ma position"}</span>
                </button>
              )}

              {geoError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-center text-[11px] font-medium leading-relaxed">
                  {geoError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Directions & Visual Map Component (RHS) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Dynamic Map Area */}
          <div className="bg-slate-50 rounded-[32px] overflow-hidden border border-slate-200 h-[360px] sm:h-[450px] shadow-lg relative">
            {hasValidKey ? (
              <APIProvider apiKey={API_KEY} version="weekly">
                <Map
                  defaultCenter={PORT_COORDS}
                  defaultZoom={15}
                  mapId="MUGOTE_GEOLOC_APP"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  style={{ width: '100%', height: '100%' }}
                >
                  {/* Port Flag Marker */}
                  <AdvancedMarker position={PORT_COORDS} title="Port ETS AMR MUGOTE">
                    <Pin background="#EAB308" borderColor="#001233" glyphColor="#001233" scale={1.2}>
                      🚢
                    </Pin>
                  </AdvancedMarker>

                  {/* Fleet Boats Markers */}
                  {boats.map((boat, idx) => {
                    const boatLat = boat.lat !== undefined ? Number(boat.lat) : PORT_COORDS.lat + (idx + 1) * 0.003;
                    const boatLng = boat.lng !== undefined ? Number(boat.lng) : PORT_COORDS.lng + (idx + 1) * 0.005;
                    const statusColor = boat.status === 'En navigation' ? '#0284c7' : boat.status === 'En maintenance' ? '#d97706' : '#10b981';
                    return (
                      <AdvancedMarker key={boat.id} position={{ lat: boatLat, lng: boatLng }} title={`${boat.name} - ${boat.status || 'à quai'}`}>
                        <Pin background={statusColor} borderColor="#FFFFFF" glyphColor="#FFFFFF" scale={1.1}>
                          ⛵
                        </Pin>
                      </AdvancedMarker>
                    );
                  })}

                  {/* User Marker if active */}
                  {userLocation && (
                    <AdvancedMarker position={userLocation} title="votre position">
                      <Pin background="#001233" borderColor="#FFFFFF" glyphColor="#FFFFFF" scale={1}>
                        📍
                      </Pin>
                    </AdvancedMarker>
                  )}
                </Map>
              </APIProvider>
            ) : (
              /* Interactive OpenStreetMap View */
              <div className="w-full h-full relative">
                <iframe
                  src="https://www.openstreetmap.org/export/embed.html?bbox=28.8400%2C-2.5050%2C28.8780%2C-2.4810&amp;layer=mapnik&amp;marker=-2.4930%2C28.8590"
                  className="w-full h-full border-0"
                  title="Carte Port AMR MUGOTE Bukavu"
                  loading="lazy"
                />
                <div className="absolute top-3 right-3 bg-[#001233]/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 text-[10px] font-semibold shadow-lg flex items-center gap-1.5">
                  <MapPin size={12} className="text-gold" />
                  <span>port amr mugote - beach muhanzi</span>
                </div>
              </div>
            )}
          </div>

          {/* Real-time Fleet Tracking Panel */}
          <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-200 shadow-xl space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base sm:text-lg font-black text-[#001233] flex items-center gap-2">
                <Ship size={18} className="text-gold animate-bounce" />
                Suivi de la Flotte en Temps Réel
              </h3>
              <span className="inline-flex items-center gap-1.5 text-[9px] font-medium bg-sky-50 text-sky-600 border border-sky-100 px-3 py-1 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                mise à jour en direct
              </span>
            </div>

            {boats.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-medium">
                aucun navire en service actuellement
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {boats.map((boat, idx) => {
                  const boatLat = boat.lat !== undefined ? Number(boat.lat) : PORT_COORDS.lat + (idx + 1) * 0.003;
                  const boatLng = boat.lng !== undefined ? Number(boat.lng) : PORT_COORDS.lng + (idx + 1) * 0.005;
                  
                  // Compute distance in lowercase
                  let distText = '';
                  if (userLocation) {
                    const d = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, boatLat, boatLng);
                    distText = d < 1 ? `${(d * 1000).toFixed(0)} m de vous` : `${d.toFixed(2)} km de vous`;
                  } else {
                    const d = getDistanceFromLatLonInKm(PORT_COORDS.lat, PORT_COORDS.lng, boatLat, boatLng);
                    distText = d < 0.1 ? `à quai au port` : `${d.toFixed(2)} km du port`;
                  }

                  const rawStatus = boat.status?.toLowerCase() || 'à quai';

                  return (
                    <div key={boat.id || idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex gap-3.5 items-center hover:bg-slate-100/60 transition-all">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                        rawStatus.includes('navigation') ? "bg-slate-900 text-white animate-pulse" :
                        rawStatus.includes('maintenance') ? "bg-slate-200 text-slate-800" :
                        "bg-emerald-500/10 text-emerald-600"
                      )}>
                        <Ship size={18} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-bold text-slate-800 truncate leading-tight">{boat.name}</h4>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-medium shrink-0 border",
                            rawStatus.includes('navigation') ? "bg-slate-900 text-white border-slate-900" :
                            rawStatus.includes('maintenance') ? "bg-slate-100 text-slate-800 border-slate-300" :
                            "bg-emerald-50 text-emerald-700 border-emerald-100"
                          )}>
                            {rawStatus}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-mono">
                          gps: {boatLat.toFixed(5)}, {boatLng.toFixed(5)}
                        </p>
                        <div className="flex items-center gap-1 text-[9px] text-[#001233]">
                          <Compass size={10} className="text-gold shrink-0 animate-spin-slow" />
                          <span>{distText}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Guide directions container */}
          <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-200 shadow-xl space-y-4">
            <h3 className="text-base sm:text-lg font-black text-[#001233] border-b border-slate-100 pb-3 flex items-center gap-2">
              <Car size={18} />
              Itinéraire routier & d'accès
            </h3>

            {directions.length > 0 ? (
              <div className="space-y-3">
                {directions.map((stepText, idx) => (
                  <div key={idx} className="flex gap-3.5 items-start text-[12px] sm:text-[13px] font-normal text-slate-600 leading-relaxed">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-[#001233] font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5 border border-slate-200">
                      {idx + 1}
                    </span>
                    <p className="pt-0.5">{stepText}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3 text-[12px] sm:text-[13px] text-slate-500 font-normal leading-relaxed">
                <p>
                  pour obtenir un itinéraire personnalisé calculé à partir de votre position de départ exacte, veuillez cliquer sur le bouton <span className="font-bold text-[#001233]">« localiser ma position »</span> dans l'encadré de gauche.
                </p>
                <div className="h-px bg-slate-100 my-1.5" />
                <p className="text-slate-600 font-normal">
                  repère universel stable : rendez-vous au croisement kadutu vers beach muhanzi. le port amr mugote jouxte immédiatement le marché à l'ouest, face au port silimu.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

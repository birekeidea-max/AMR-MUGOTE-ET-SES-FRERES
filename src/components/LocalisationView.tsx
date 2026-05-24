import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Compass, Info, RefreshCw, Check, ShieldAlert, Map as MapIcon, Compass as CompassIcon, Car, ExternalLink } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

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

export default function LocalisationView() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [directions, setDirections] = useState<string[]>([]);

  // Geolocation is only requested when the user clicks the action button to comply with browser sandboxing
  useEffect(() => {
    // We do not auto-request on mount to avoid iframe sandbox blocks and console clutter
  }, []);

  const requestUserLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("La géolocalisation n'est pas supportée par votre navigateur.");
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
        console.groupCollapsed("ℹ️ Statut de la géolocalisation");
        console.info("L'accès natif a retourné un code de statut standard :", error.code, error.message);
        console.groupEnd();
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGeoError(
            "Accès refusé ou bloqué par le navigateur. Astuce : Pour autoriser la localisation sur la carte, veuillez ouvrir ce site dans un nouvel onglet indépendant (bouton en haut à droite) au lieu de l'aperçu imbriqué !"
          );
        } else {
          setGeoError(
            "Impossible de déterminer vos coordonnées GPS. Si vous êtes sur un ordinateur fixe sans récepteur GPS, ou dans un aperçu de test, vous pouvez tester sur votre smartphone ou saisir l'adresse postale."
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const generateStepByStepGuide = (uLat: number, uLng: number, dist: number) => {
    const steps: string[] = [];
    
    // Direct directions based on simple bounding logic relative to Port Mugote (-2.4930, 28.8590)
    const latDiff = PORT_COORDS.lat - uLat;
    const lngDiff = PORT_COORDS.lng - uLng;

    steps.push(`Vous êtes actuellement situé à environ ${dist.toFixed(2)} kilomètres du Port MUGOTE.`);

    if (latDiff > 0.05) {
      steps.push("Dirigez-vous vers le Nord pour entrer dans la ville de Bukavu par la route nationale.");
    } else if (latDiff < -0.05) {
      steps.push("Dirigez-vous vers le Sud en direction de la Commune de Kadutu.");
    }

    if (lngDiff > 0.05) {
      steps.push("Suivez les axes routiers vers l'Est pour vous rapprocher de la rive du Lac Kivu.");
    } else if (lngDiff < -0.05) {
      steps.push("Suivez les axes vers l'Ouest en descendant vers la baie.");
    }

    steps.push("Une fois dans la Commune de Kadutu, dirigez-vous vers le Quartier Nkafu via l'Avenue Michombero.");
    steps.push("Prenez comme repère principal le Marché Beach Muhanzi (très célèbre à Bukavu). Notre port est situé juste en diagonale.");
    steps.push("Le Port d'embarquement AMR MUGOTE est logé entre le marché Beach Muhanzi à l'Est et le port de l'ETS SILIMU à l'Ouest.");

    setDirections(steps);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-[#001233] rounded-[32px] p-6 sm:p-10 text-white relative overflow-hidden border border-white/10 shadow-2xl">
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-10 blur-sm">
          <MapIcon size={320} />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 bg-gold/10 text-gold px-4 py-1.5 rounded-full border border-gold/20 text-xs font-black tracking-widest uppercase">
            <Compass className="animate-spin-slow" size={12} />
            Géolocalisation Voyageurs
          </div>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight italic">
            SE RENDRE AU <span className="text-gold">PORT MUGOTE</span>
          </h1>
          <p className="text-slate-300 max-w-2xl text-xs sm:text-sm font-medium leading-relaxed uppercase">
            Trouvez facilement le quai d'embarquement de la compagnie <span className="text-white font-extrabold">AMR MUGOTE & FRÈRES</span>. 
            Découvrez votre position actuelle en temps réel et naviguez directement jusqu'à notre bateau.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Navigation & Address Details (LHS) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Official Address */}
          <div className="bg-white rounded-[32px] p-8 border border-slate-150 shadow-xl space-y-6">
            <h2 className="text-xl font-black uppercase tracking-tight text-[#001233] border-b border-slate-100 pb-4 flex items-center gap-3">
              <span className="p-2 bg-gold/10 rounded-xl text-gold">
                <MapPin size={22} />
              </span>
              Adresse de l'Établissement
            </h2>

            <div className="space-y-4 text-xs font-medium uppercase tracking-wider text-slate-500">
              <div>
                <p className="text-[10px] font-black text-slate-400">Entreprise</p>
                <p className="text-sm font-black text-[#001233]">ETS AMR MUGOTE et Ses Frères</p>
              </div>
              <div className="h-px bg-slate-100" />
              <div>
                <p className="text-[10px] font-black text-slate-400">Localisation Administrative</p>
                <p className="text-slate-800 leading-relaxed font-bold">
                  RDC, Province du Sud-Kivu, Ville de Bukavu, Commune de Kadutu, Avenue Michombero, Quartier Nkafu.
                </p>
              </div>
              <div className="h-px bg-slate-100" />
              <div>
                <p className="text-[10px] font-black text-slate-400">Bornes et Repères de Sécurité</p>
                <p className="text-slate-800 leading-relaxed font-bold">
                  En diagonale avec le marché <strong className="text-[#001233]">Beach Muhanzi</strong>. Le port est limité à l'est par le marché Beach Muhanzi et à l'ouest par le port de l'ETS SILIMU.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: GPS Assistant */}
          <div className="bg-[#001233] text-white rounded-[32px] p-8 space-y-6 border border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <CompassIcon size={120} />
            </div>

            <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-3">
              <span className="p-2 bg-white/10 rounded-xl text-gold">
                <Navigation size={22} />
              </span>
              Calculateur de Distance
            </h2>

            {/* Geolocation trigger */}
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed uppercase">
                Activez le GPS de votre smartphone ou ordinateur pour calculer instantanément les kilomètres restants jusqu'au quai de départ.
              </p>

              {userLocation ? (
                <div className="bg-white/5 rounded-2xl p-4 sm:p-5 border border-white/10 space-y-4 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400">DISTANCES CONGO</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">
                      <Check size={10} /> GPS ACTIF
                    </span>
                  </div>

                  {distanceKm !== null && (
                    <div className="text-center py-2 space-y-1">
                      <p className="text-3xl sm:text-4xl font-black italic text-gold">
                        {distanceKm < 1 ? `${(distanceKm * 1000).toFixed(0)} M` : `${distanceKm.toFixed(2)} KM`}
                      </p>
                      <p className="text-[10px] text-slate-300 tracking-widest uppercase font-bold">restant jusqu'au Port Mugote</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 border-t border-white/10 pt-4">
                    <div>
                      <span className="block text-[8px] uppercase tracking-wider text-slate-500">Votre Lat</span>
                      <span className="text-white font-bold">{userLocation.lat.toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] uppercase tracking-wider text-slate-500">Votre Lng</span>
                      <span className="text-white font-bold">{userLocation.lng.toFixed(6)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={requestUserLocation}
                  disabled={locating}
                  className="w-full py-4 bg-gold hover:bg-gold-light text-[#001233] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 text-xs"
                >
                  <RefreshCw className={locating ? "animate-spin" : ""} size={16} />
                  {locating ? "Localisation en cours..." : "Localiser ma position"}
                </button>
              )}

              {geoError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-center text-[11px] font-semibold leading-relaxed">
                  {geoError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Directions & Visual Map Component (RHS) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Dynamic Map Area */}
          <div className="bg-slate-50 rounded-[32px] overflow-hidden border border-slate-200 h-[380px] sm:h-[480px] shadow-lg relative">
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

                  {/* User Marker if active */}
                  {userLocation && (
                    <AdvancedMarker position={userLocation} title="Votre Position">
                      <Pin background="#001233" borderColor="#FFFFFF" glyphColor="#FFFFFF" scale={1}>
                        📍
                      </Pin>
                    </AdvancedMarker>
                  )}
                </Map>
              </APIProvider>
            ) : (
              /* Fallback GPS radar simulator and installation guide */
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-radial from-slate-100 to-slate-200 relative text-[#001233]">
                {/* Visual Compass Radar */}
                <div className="relative mb-6">
                  {/* Outer spinning ring */}
                  <div className="w-36 h-36 rounded-full border-4 border-dashed border-[#001233]/20 flex items-center justify-center animate-spin-slow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  {/* Inner glowing core */}
                  <div className="w-24 h-24 rounded-full bg-gold/10 border-4 border-gold text-gold flex items-center justify-center shadow-xl shadow-gold/10 relative">
                    <Compass size={40} className="animate-pulse" />
                  </div>
                </div>

                <div className="max-w-md space-y-4">
                  <h3 className="text-lg font-black uppercase tracking-tight text-[#001233]">Boussole GPS active</h3>
                  <p className="text-xs uppercase text-slate-500 tracking-wide font-medium leading-relaxed">
                    Visualisation radar orientée vers le <span className="font-extrabold text-[#001233]">Port MUGOTE de Bukavu</span>.
                  </p>
                  
                  {/* Distance bubble if GPS is loaded but maps API key is lacking */}
                  {userLocation && distanceKm !== null ? (
                    <div className="bg-gold/10 border border-gold/30 rounded-2xl p-4 text-center mt-2 max-w-sm mx-auto">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">M/V MUGOTE RADAR</p>
                      <p className="text-2xl font-black italic text-[#001233] mt-1">{distanceKm.toFixed(2)} KM</p>
                      <p className="text-[9px] text-[#001233]/70 font-semibold uppercase mt-1">Vous vous séparez du point d'embarquement</p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">
                      Activez votre localisation ci-contre pour afficher la boussole de guidage.
                    </p>
                  )}

                  {/* Secret guidance badge */}
                  <div className="inline-flex items-center gap-2 bg-slate-200/60 text-slate-600 font-extrabold text-[9px] uppercase px-3 py-1 rounded-lg border border-slate-300 mt-2">
                    <Info size={10} /> Carte Google désactivée (Clé API manquante)
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Guide directions container */}
          <div className="bg-white rounded-[32px] p-8 border border-slate-150 shadow-xl space-y-4">
            <h3 className="text-md font-black uppercase tracking-tight text-[#001233] border-b border-slate-100 pb-3 flex items-center gap-2">
              <Car size={18} />
              Itinéraire routier & d'accès
            </h3>

            {directions.length > 0 ? (
              <div className="space-y-3">
                {directions.map((stepText, idx) => (
                  <div key={idx} className="flex gap-4 items-start text-[12px] sm:text-[13px] font-medium text-slate-600 leading-relaxed uppercase">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-[#001233] font-black flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5 border border-slate-200">
                      {idx + 1}
                    </span>
                    <p className="pt-0.5">{stepText}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4 text-[12px] sm:text-[13px] text-slate-500 font-medium leading-relaxed uppercase">
                <p>
                  Pour obtenir un itinéraire personnalisé calculé à partir de votre position de départ exacte, veuillez cliquer sur le bouton <span className="font-extrabold text-[#001233]">« LOCALISER MA POSITION »</span> dans l'encadré de gauche.
                </p>
                <div className="h-px bg-slate-100 my-2" />
                <p className="font-bold text-slate-700">
                  Repère universel stable : Rendez-vous au croisement Kadutu vers Beach Muhanzi. Le port AMR MUGOTE jouxte immédiatement le marché à l'ouest, face au port SILIMU.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Key Setup Instructions for Developers if key is missing */}
      {!hasValidKey && (
        <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200 space-y-4">
          <div className="flex gap-3 items-start">
            <ShieldAlert className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="space-y-2">
              <h4 className="text-xs sm:text-sm font-black uppercase text-amber-800">
                Guide d'activation Google Maps
              </h4>
              <p className="text-[11px] text-amber-700 uppercase leading-relaxed font-semibold">
                Pour débloquer la carte routière Google interactive en direct à Bukavu, l'administrateur système peut renseigner son jeton Maps :
              </p>
              <ol className="text-[11px] text-amber-600 uppercase list-decimal list-inside space-y-1 pl-1 font-bold">
                <li>Générez une clé API sur Google Cloud console.</li>
                <li>Ouvrez les Paramètres (l'icône engrenage en haut à droite).</li>
                <li>Allez dans Secrets (Secrets) et ajoutez <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded text-[10px]">GOOGLE_MAPS_PLATFORM_KEY</code> avec le jeton de sécurité.</li>
                <li>L'application s'actualisera avec la carte satellite routière en temps réel !</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

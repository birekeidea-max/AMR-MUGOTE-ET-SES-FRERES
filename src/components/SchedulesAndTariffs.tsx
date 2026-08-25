import React from 'react';
import { Ship, Clock, Calendar, MapPin, ArrowRight } from 'lucide-react';
import { TravelClass } from '../types';

interface SchedulesAndTariffsProps {
  siteSettings?: any;
}

const DEFAULT_PRICES: Record<TravelClass, number> = {
  'VIP': 27,
  '1ère Classe': 27,
  '2ème Classe': 17,
  '3ème Classe': 10
};

const SchedulesAndTariffs: React.FC<SchedulesAndTariffsProps> = ({ siteSettings }) => {
  const prices: Record<TravelClass, number> = {
    'VIP': Number(siteSettings?.classPrices?.['VIP'] ?? DEFAULT_PRICES['VIP']),
    '1ère Classe': Number(siteSettings?.classPrices?.['1ère Classe'] ?? DEFAULT_PRICES['1ère Classe']),
    '2ème Classe': Number(siteSettings?.classPrices?.['2ème Classe'] ?? DEFAULT_PRICES['2ème Classe']),
    '3ème Classe': Number(siteSettings?.classPrices?.['3ème Classe'] ?? DEFAULT_PRICES['3ème Classe']),
  };

  const routes = [
    {
      departure: "Bukavu (Port de Bukavu)",
      destination: "Goma (Port de Goma)",
      frequency: "Tous les jours",
      schedules: ["07:30 (Mugote 1)", "11:00 (Mugote 2)", "14:30 (Mugote 3)"]
    },
    {
      departure: "Goma (Port de Goma)",
      destination: "Bukavu (Port de Bukavu)",
      frequency: "Tous les jours",
      schedules: ["07:30 (Mugote 2)", "11:00 (Mugote 3)", "14:30 (Mugote 1)"]
    }
  ];

  const classRows: { name: TravelClass; subtitle: string; tag?: string; tagColor?: string }[] = [
    { name: 'VIP', subtitle: 'Salon VIP Privatisé & Climatisé', tag: 'Prestige', tagColor: 'bg-amber-100 text-amber-800' },
    { name: '1ère Classe', subtitle: 'Confort Supérieur & Priorité', tag: 'Standard Plus', tagColor: 'bg-yellow-100 text-yellow-800' },
    { name: '2ème Classe', subtitle: 'Standard Populaire & Aéré', tag: 'Recommandé', tagColor: 'bg-blue-100 text-blue-800' },
    { name: '3ème Classe', subtitle: 'Économique & Abordable' }
  ];

  return (
    <section className="py-16 px-4 max-w-6xl mx-auto w-full" id="schedules-tariffs-section">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-maritime/5 rounded-full text-xs font-bold text-maritime uppercase tracking-widest mb-3">
          <Calendar className="w-3.5 h-3.5 text-gold" />
          <span>Planification & Grille Tarifaire</span>
        </div>
        <h2 className="text-3xl font-extrabold text-maritime tracking-tight uppercase italic">
          Horaires & Tarifs Officiels
        </h2>
        <p className="text-sm text-slate-500 mt-2 max-w-xl mx-auto font-medium">
          Tarification unique et officielle pour chaque classe de voyage sur l'ensemble de nos navettes Lac Kivu.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {routes.map((route, idx) => (
          <div 
            key={idx} 
            className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-sm shadow-slate-100 hover:shadow-md hover:border-slate-200 transition-all duration-300 flex flex-col justify-between"
            id={`route-card-${idx}`}
          >
            <div>
              {/* Header de liaison */}
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-full bg-[#001233]/5 flex items-center justify-center text-[#001233] shrink-0">
                  <Ship className="w-5 h-5 text-gold" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">Liaison maritime</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm md:text-base text-maritime truncate">{route.departure.split(' ')[0]}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-bold text-sm md:text-base text-maritime truncate">{route.destination.split(' ')[0]}</span>
                  </div>
                </div>
              </div>

              {/* Détails rapides */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50/70 p-3 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Fréquence</span>
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-maritime" />
                    {route.frequency}
                  </span>
                </div>
                <div className="bg-slate-50/70 p-3 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Voie de navigation</span>
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-maritime" />
                    Lac Kivu (RDC)
                  </span>
                </div>
              </div>

              {/* Tableau HTML Sémantique pour le référencement et l'accessibilité */}
              <div className="overflow-hidden border border-slate-100 rounded-2xl">
                <table className="w-full text-left border-collapse bg-white text-xs">
                  <thead>
                    <tr className="bg-[#001233] text-white">
                      <th className="py-3 px-4 font-bold uppercase tracking-wider">Classe Officielle</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">Départs</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Tarif Unitaire</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classRows.map((cr, cIdx) => (
                      <tr key={cIdx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{cr.name}</span>
                            {cr.tag && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${cr.tagColor}`}>
                                {cr.tag}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium block">{cr.subtitle}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-[10px] font-bold">
                            <Clock className="w-2.5 h-2.5 text-maritime" /> 07:30 / 11:00 / 14:30
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-maritime text-sm font-mono whitespace-nowrap">
                          {prices[cr.name]} USD
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="mt-4 pt-3 text-[10px] text-slate-400 border-t border-slate-50 italic">
              * Présentation au port d'embarquement au moins 45 minutes avant le départ.
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SchedulesAndTariffs;

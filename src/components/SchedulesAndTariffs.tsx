import React from 'react';
import { Ship, Clock, Calendar, MapPin, ArrowRight } from 'lucide-react';
import { TravelClass } from '../types';

interface SchedulesAndTariffsProps {
  siteSettings?: any;
}

const DEFAULT_PRICES: Record<TravelClass, number> = {
  'VIP': 35,
  '1ère Classe': 11,
  '2ème Classe': 20,
  '3ème Classe': 27
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
      departure: "Bukavu (Beach Muhanzi)",
      destination: "Goma (Port Public)",
      frequency: "Tous les jours",
      schedules: ["07:30 (Matin ➔ 12h30)", "18:00 (Soir ➔ 06h00 +1)"]
    },
    {
      departure: "Goma (Port Public)",
      destination: "Bukavu (Beach Muhanzi)",
      frequency: "Tous les jours",
      schedules: ["07:30 (Matin ➔ 12h30)", "18:00 (Soir ➔ 06h00 +1)"]
    }
  ];

  const classRows: { name: TravelClass; subtitle: string; tag?: string; tagColor?: string }[] = [
    { name: 'VIP', subtitle: 'Salon VIP Privatisé & Climatisé', tag: 'Prestige', tagColor: 'bg-white text-black font-black' },
    { name: '1ère Classe', subtitle: 'Confort Supérieur & Priorité', tag: 'Standard Plus', tagColor: 'bg-white/20 text-white border border-white/30' },
    { name: '2ème Classe', subtitle: 'Standard Populaire & Aéré', tag: 'Recommandé', tagColor: 'bg-[#0b132b] text-white border border-white/20' },
    { name: '3ème Classe', subtitle: 'Économique & Abordable' }
  ];

  return (
    <section className="py-8 px-4 max-w-6xl mx-auto w-full text-left" id="schedules-tariffs-section">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-black text-white uppercase tracking-widest mb-3">
          <Calendar className="w-3.5 h-3.5 text-white" />
          <span>Planification & Grille Tarifaire</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase italic">
          Horaires & Tarifs Officiels
        </h2>
        <p className="text-sm text-slate-300 mt-2 max-w-xl mx-auto font-medium">
          Tarification unique et officielle pour chaque classe de voyage sur l'ensemble de nos navettes Lac Kivu (Bukavu ⇄ Goma).
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {routes.map((route, idx) => (
          <div 
            key={idx} 
            className="bg-[#0b132b] border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col justify-between text-left"
            id={`route-card-${idx}`}
          >
            <div>
              {/* Header de liaison */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
                  <Ship className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase tracking-widest font-black text-slate-300 block">Liaison Lacustre Quotidienne</span>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="font-extrabold text-base md:text-lg text-white truncate">{route.departure.split(' ')[0]}</span>
                    <ArrowRight className="w-4 h-4 text-white shrink-0" />
                    <span className="font-extrabold text-base md:text-lg text-white truncate">{route.destination.split(' ')[0]}</span>
                  </div>
                </div>
              </div>

              {/* Détails rapides */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl">
                  <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Fréquence</span>
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-white" />
                    {route.frequency}
                  </span>
                </div>
                <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl">
                  <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Voie de navigation</span>
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-white" />
                    Lac Kivu (RDC)
                  </span>
                </div>
              </div>

              {/* Tableau Sémantique */}
              <div className="overflow-hidden border border-white/10 rounded-2xl">
                <table className="w-full text-left border-collapse bg-[#070d1e] text-xs">
                  <thead>
                    <tr className="bg-[#0b132b] text-white border-b border-white/10">
                      <th className="py-3.5 px-4 font-black uppercase tracking-wider text-[10px]">Classe Officielle</th>
                      <th className="py-3.5 px-4 font-black uppercase tracking-wider text-center text-[10px]">Départs</th>
                      <th className="py-3.5 px-4 font-black uppercase tracking-wider text-right text-[10px]">Tarif Unitaire</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {classRows.map((cr, cIdx) => (
                      <tr key={cIdx} className="hover:bg-white/5 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-sm">{cr.name}</span>
                            {cr.tag && (
                              <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${cr.tagColor}`}>
                                {cr.tag}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium block mt-0.5">{cr.subtitle}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/10 text-white px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold">
                            <Clock className="w-3 h-3 text-white" /> 07:30 (Matin) / 18:00 (Soir)
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-white text-base font-mono whitespace-nowrap">
                          {prices[cr.name]} $
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="mt-6 pt-3 text-xs text-slate-400 border-t border-white/10 flex items-center justify-between">
              <span>* Embarquement 45 min avant l'horaire</span>
              <span className="font-bold text-white">Gilets de sauvetage certifiés inclus</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SchedulesAndTariffs;

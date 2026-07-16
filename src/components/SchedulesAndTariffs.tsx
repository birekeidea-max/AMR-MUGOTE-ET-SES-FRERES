import React from 'react';
import { Ship, Clock, DollarSign, Calendar, MapPin, ArrowRight } from 'lucide-react';

const SchedulesAndTariffs: React.FC = () => {
  const routes = [
    {
      departure: "Bukavu (Port de Bukavu)",
      destination: "Goma (Port de Goma)",
      frequency: "Tous les jours",
      schedules: ["07:30 (Bateau Rapide)", "11:00 (Bateau Classique)", "14:30 (Bateau Rapide)"],
      prices: { classic: "10 USD", VIP: "25 USD", VVIP: "40 USD" }
    },
    {
      departure: "Goma (Port de Goma)",
      destination: "Bukavu (Port de Bukavu)",
      frequency: "Tous les jours",
      schedules: ["07:30 (Bateau Rapide)", "11:00 (Bateau Classique)", "14:30 (Bateau Rapide)"],
      prices: { classic: "10 USD", VIP: "25 USD", VVIP: "40 USD" }
    }
  ];

  return (
    <section className="py-16 px-4 max-w-5xl mx-auto w-full" id="schedules-tariffs-section">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-maritime/5 rounded-full text-xs font-bold text-maritime uppercase tracking-widest mb-3">
          <Calendar className="w-3.5 h-3.5 text-gold" />
          <span>Planification</span>
        </div>
        <h2 className="text-3xl font-extrabold text-maritime tracking-tight uppercase italic">
          Horaires & Tarifs des Traversées
        </h2>
        <p className="text-sm text-slate-500 mt-2 max-w-xl mx-auto font-medium">
          Retrouvez les horaires officiels et les tarifs de nos navettes maritimes régulières sur le Lac Kivu reliant Bukavu et Goma.
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
                    Lac Kivu (CD)
                  </span>
                </div>
              </div>

              {/* Tableau HTML Sémantique pour le référencement et l'accessibilité */}
              <div className="overflow-hidden border border-slate-100 rounded-2xl">
                <table className="w-full text-left border-collapse bg-white text-xs">
                  <thead>
                    <tr className="bg-[#001233] text-white">
                      <th className="py-3 px-4 font-bold uppercase tracking-wider">Classe / Service</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wider">Départ</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Tarif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        <span className="block font-bold text-slate-900">Standard</span>
                        <span className="text-[10px] text-slate-400 font-medium">Bateau Classique</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold">
                          <Clock className="w-2.5 h-2.5" /> 11:00
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-emerald-600 text-sm">
                        {route.prices.classic}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        <span className="block font-bold text-maritime flex items-center gap-1">
                          VIP <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-bold">Populaire</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">Bateau Rapide</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold w-fit">
                            <Clock className="w-2.5 h-2.5" /> 07:30
                          </span>
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold w-fit">
                            <Clock className="w-2.5 h-2.5" /> 14:30
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-emerald-600 text-sm">
                        {route.prices.VIP}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        <span className="block font-bold text-purple-900">VVIP Exclusive</span>
                        <span className="text-[10px] text-slate-400 font-medium">Bateau Rapide</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold w-fit">
                            <Clock className="w-2.5 h-2.5" /> 07:30
                          </span>
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold w-fit">
                            <Clock className="w-2.5 h-2.5" /> 14:30
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-emerald-600 text-sm">
                        {route.prices.VVIP}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="mt-4 pt-3 text-[10px] text-slate-400 border-t border-slate-50 italic">
              * Veuillez vous présenter au port d'embarquement au moins 45 minutes avant le départ.
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SchedulesAndTariffs;

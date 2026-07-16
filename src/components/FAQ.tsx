import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ: React.FC = () => {
  const faqData: FAQItem[] = [
    {
      question: "Comment réserver un billet sur AMR MUGOTE ?",
      answer: "La réservation s'effectue directement en ligne sur notre plateforme. Choisissez vos villes de départ et d'arrivée (Bukavu ou Goma), sélectionnez votre date, remplissez vos informations passager et payez instantanément par Mobile Money."
    },
    {
      question: "Quels sont les moyens de paiement acceptés ?",
      answer: "Nous acceptons les principaux services de Mobile Money de la région (M-Pesa, Airtel Money, Orange Money) pour garantir des transactions rapides et sécurisées."
    },
    {
      question: "Où se situent les ports d'embarquement ?",
      answer: "Nos bateaux opèrent entre le Port de Bukavu (Sud-Kivu) et le Port de Goma (Nord-Kivu) sur le Lac Kivu."
    },
    {
      question: "Quelle est la durée de la traversée entre Bukavu et Goma ?",
      answer: "La durée varie selon le type de navire choisi : environ 2 à 3 heures pour nos bateaux rapides, et entre 5 et 7 heures pour les grands bateaux classiques."
    }
  ];

  // Génération du schéma JSON-LD pour l'AEO (Answer Engine Optimization)
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqData.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer
      }
    }))
  };

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <section className="py-16 px-4 max-w-4xl mx-auto w-full" id="faq-section">
      {/* Injection du schéma de métadonnées pour Google et les IA */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-maritime/5 rounded-full text-xs font-bold text-maritime uppercase tracking-widest mb-3">
          <HelpCircle className="w-3.5 h-3.5 text-gold" />
          <span>Assistance</span>
        </div>
        <h2 className="text-3xl font-extrabold text-maritime tracking-tight uppercase italic">
          Foire Aux Questions
        </h2>
        <p className="text-sm text-slate-500 mt-2 max-w-lg mx-auto">
          Trouvez des réponses rapides à vos questions les plus fréquentes sur nos traversées du Lac Kivu.
        </p>
      </div>
      
      <div className="space-y-4">
        {faqData.map((item, index) => {
          const isOpen = activeIndex === index;
          return (
            <div 
              key={index} 
              className="bg-white border border-slate-100 rounded-2xl shadow-sm shadow-slate-100 overflow-hidden transition-all duration-300 hover:border-slate-200"
              id={`faq-item-${index}`}
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-5 text-left font-bold text-base text-maritime flex justify-between items-center gap-4 hover:bg-slate-50/50 transition-colors cursor-pointer focus:outline-none"
                aria-expanded={isOpen}
              >
                <span className="font-sans text-sm md:text-base font-bold tracking-tight text-maritime leading-tight">
                  {item.question}
                </span>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-maritime"
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </button>
              
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                  >
                    <div className="px-6 pb-6 pt-1 border-t border-slate-50">
                      <p className="text-xs md:text-sm text-slate-600 font-medium leading-relaxed font-sans">
                        {item.answer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default FAQ;

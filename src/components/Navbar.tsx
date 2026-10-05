import React, { useState } from 'react';

export interface NavItem {
  id: string;
  label: string;
}

export interface NavbarProps {
  items?: NavItem[];
  defaultActiveId?: string;
  activeId?: string;
  onTabChange?: (id: string) => void;
  className?: string;
}

export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Accueil' },
  { id: 'booking', label: 'Réserver un billet' },
  { id: 'tickets', label: 'Mes billets' },
  { id: 'tarifs', label: 'Horaires & Tarifs' },
  { id: 'map', label: 'Ports & Localisation' },
];

/**
 * Composant de navigation (Navbar) ultra-épuré, compact et responsive.
 * - Supprime toute forme lourde, circulaire ou icône superflue.
 * - Liens textuels légers alignés à gauche (justify-start).
 * - Défilement horizontal fluide sans barre apparente sur mobile (anti-embouteillage).
 * - Indicateur actif subtil et transition douce au survol.
 */
export const Navbar: React.FC<NavbarProps> = ({
  items = DEFAULT_NAV_ITEMS,
  defaultActiveId = 'home',
  activeId: controlledActiveId,
  onTabChange,
  className = '',
}) => {
  // Gestion interne de l'onglet actif avec hook useState
  const [internalActiveId, setInternalActiveId] = useState<string>(defaultActiveId);

  // Prise en charge du mode contrôlé (props) ou non-contrôlé (state interne)
  const currentActiveId = controlledActiveId !== undefined ? controlledActiveId : internalActiveId;

  const handleSelectTab = (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    // Recentrage doux de l'élément dans le conteneur défilant sur mobile
    event.currentTarget.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });

    if (controlledActiveId === undefined) {
      setInternalActiveId(id);
    }

    if (onTabChange) {
      onTabChange(id);
    }
  };

  return (
    <nav
      aria-label="Navigation principale"
      className={`w-full border-b border-white/10 bg-[#001c30]/95 backdrop-blur-xs select-none ${className}`}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        {/* Conteneur flex aligné à gauche (justify-start) avec scroll horizontal fluide sans barre visible */}
        <div className="flex items-center justify-start overflow-x-auto scroll-smooth no-scrollbar whitespace-nowrap touch-pan-x gap-1 sm:gap-2 py-0.5">
          {items.map((item) => {
            const isActive = currentActiveId === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={(e) => handleSelectTab(e, item.id)}
                className={`relative px-2.5 sm:px-3 py-2 text-xs sm:text-[13px] font-medium tracking-normal transition-colors duration-150 cursor-pointer shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded-sm ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Texte épuré du lien */}
                <span>{item.label}</span>

                {/* Surlignage subtil de l'onglet actif */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px] bg-amber-400 rounded-full"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

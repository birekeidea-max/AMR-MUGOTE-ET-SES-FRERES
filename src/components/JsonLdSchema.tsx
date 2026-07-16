import React from 'react';

const JsonLdSchema: React.FC = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "TransitBusiness",
    "name": "AMR MUGOTE ET SES FRÈRES",
    "alternateName": "AMR MUGOTE",
    "description": "Plateforme officielle de réservation de billets de transport maritime sur le Lac Kivu reliant les villes de Bukavu et Goma.",
    "url": "https://amr-mugote-et-ses-freres.vercel.app",
    "logo": "https://amr-mugote-et-ses-freres.vercel.app/logo.png",
    "image": "https://amr-mugote-et-ses-freres.vercel.app/cover.jpg",
    "priceRange": "$$",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Bukavu",
      "addressRegion": "Sud-Kivu",
      "addressCountry": "CD"
    },
    "areaServed": [
      {
        "@type": "AdministrativeArea",
        "name": "Bukavu"
      },
      {
        "@type": "AdministrativeArea",
        "name": "Goma"
      },
      {
        "@type": "AdministrativeArea",
        "name": "Lac Kivu"
      }
    ],
    "offers": {
      "@type": "Offer",
      "description": "Réservation de billets de voyage par bateau rapide et grand bateau entre Bukavu et Goma",
      "priceCurrency": "USD",
      "areaServed": "Lac Kivu"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export default JsonLdSchema;

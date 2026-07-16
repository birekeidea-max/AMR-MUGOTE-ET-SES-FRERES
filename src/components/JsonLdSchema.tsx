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
    "telephone": ["+243994102673", "+243816680709"],
    
    // Point d'établissement principal (Siège / Point d'embarquement principal)
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Avenue Michombero, Quartier Nkafu, Commune de Kadutu (En diagonale avec le marché Beach Muhazi)",
      "addressLocality": "Bukavu",
      "addressRegion": "Sud-Kivu",
      "addressCountry": "CD"
    },
    
    // Vos points de présence physiques
    "location": [
      {
        "@type": "Place",
        "name": "AMR MUGOTE - Port de Bukavu (Beach Muhazi)",
        "telephone": "+243994102673",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Avenue Michombero, Quartier Nkafu, Commune de Kadutu (En diagonale avec le marché Beach Muhazi)",
          "addressLocality": "Bukavu",
          "addressRegion": "Sud-Kivu",
          "addressCountry": "CD"
        }
      },
      {
        "@type": "Place",
        "name": "AMR MUGOTE - Port de Goma",
        "telephone": "+243816680709",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Port de Goma",
          "addressLocality": "Goma",
          "addressRegion": "Nord-Kivu",
          "addressCountry": "CD"
        }
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export default JsonLdSchema;

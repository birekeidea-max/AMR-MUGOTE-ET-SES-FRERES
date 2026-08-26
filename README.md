# 🚢 AMR MUGOTE ET SES FRÈRES

> **Plateforme numérique de réservation maritime, suivi de flotte en temps réel et contrôle d'embarquement sur le Lac Kivu (Bukavu ⇄ Goma, République Démocratique du Congo).**

<p align="center">
  <a href="https://amr-mugote-et-ses-freres.vercel.app">
    <img src="https://img.shields.io/badge/Production%20Live-amr--mugote--et--ses--freres.vercel.app-0052cc?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel Deployment" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4.1-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Firebase-Firestore%20%7C%20Auth%20%7C%20Storage-FFCA28?style=flat-square&logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/Node.js-Express%20Backend-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node Express" />
  <img src="https://img.shields.io/badge/Google_Gemini-AI_Assistant-8E75B2?style=flat-square&logo=google&logoColor=white" alt="Gemini AI" />
  <img src="https://img.shields.io/badge/Google_Maps-Flotte_GPS-4285F4?style=flat-square&logo=google-maps&logoColor=white" alt="Google Maps" />
  <img src="https://img.shields.io/badge/PWA-Installable-5A0FC8?style=flat-square&logo=pwa&logoColor=white" alt="PWA" />
  <img src="https://img.shields.io/badge/License-Academic%20%2F%20Innovation-success?style=flat-square" alt="License" />
</p>

---

## 📑 Sommaire

1. [📖 Contexte & Présentation](#-contexte--présentation)
2. [🎯 Problématique & Objectifs](#-problématique--objectifs)
3. [✨ Fonctionnalités Principales](#-fonctionnalités-principales)
   - [👤 Espace Passager / Voyageur](#-espace-passager--voyageur)
   - [👨‍💼 Espace Administration & Gestion de Flotte](#-espace-administration--gestion-de-flotte)
   - [🛂 Espace Contrôleur / Scanner d'Embarquement (QR Code)](#-espace-contrôleur--scanner-dembarquement-qr-code)
   - [🤖 Assistant Virtuel IA (Gemini)](#-assistant-virtuel-ia-gemini)
   - [📰 Journal de Bord & Communauté](#-journal-de-bord--communauté)
   - [📱 Application Web Progressive (PWA)](#-application-web-progressive-pwa)
4. [🏗 Architecture Système & Flux de Données](#-architecture-système--flux-de-données)
5. [🛠 Technologies Utilisées](#-technologies-utilisées)
6. [📂 Structure du Projet](#-structure-du-projet)
7. [🗄 Modèle de Données Firestore](#-modèle-de-données-firestore)
8. [💳 Passerelle de Paiement Mobile Money](#-passerelle-de-paiement-mobile-money)
9. [🔐 Sécurité & Lutte Anti-Fraude](#-sécurité--lutte-anti-fraude)
10. [🔌 Endpoints d'API Backend](#-endpoints-dapi-backend)
11. [⚙️ Installation & Démarrage Local](#️-installation--démarrage-local)
12. [🔧 Variables d'Environnement](#-variables-denvironnement)
13. [🚀 Déploiement en Production](#-déploiement-en-production)
14. [🔮 Feuille de Route & Évolutions](#-feuille-de-route--évolutions)
15. [👨‍💻 Auteur & Crédits Académiques](#-auteur--crédits-académiques)
16. [📄 Licence](#-licence)

---

## 📖 Contexte & Présentation

Le **Lac Kivu**, reliant les deux grands pôles économiques de l'Est de la République Démocratique du Congo (**Bukavu** au Sud-Kivu et **Goma** au Nord-Kivu), constitue l'axe de transport le plus stratégique et sécurisé de la région.

**ETS AMR MUGOTE ET SES FRÈRES** est une compagnie maritime historique de premier plan exploitant des navires de ligne réguliers (notamment *Mugote 1*, *Mugote 2*, *Mugote 3*).

Cette plateforme web full-stack a été conçue pour **digitaliser l'intégralité de l'expérience de voyage lacustre**, de la réservation en ligne au contrôle physique des passagers à l'embarquement via QR Code scanné par caméra.

> 🎓 *Ce projet s'inscrit dans le cadre du **Programme d'Incubation et d'Innovation Technologique de GDG On Campus UCB** (Université Catholique de Bukavu).*

---

## 🎯 Problématique & Objectifs

| Défi traditionnel | Solution apportée par la plateforme |
|---|---|
| **Files d'attente au port** | Réservation 24h/24 et émission instantanée de e-billet PDF |
| **Fraude et duplication de billets** | Billets signés avec ID unique et QR Code scannable à usage unique |
| **Paiement en espèces complexe** | Intégration Mobile Money (Airtel Money, M-Pesa, Orange Money via FlexPay) |
| **Manque de visibilité sur les bateaux** | Carte interactive GPS Google Maps affichant la flotte en temps réel |
| **Assistance voyageur saturée** | Assistant IA expert (Google Gemini) répondant instantanément |
| **Contrôle d'embarquement manuel** | Scanner QR intégré avec horodatage et changement de statut *BOARDED* |

---

## ✨ Fonctionnalités Principales

### 👤 Espace Passager / Voyageur
- **Authentification Sécurisée** : Connexion par e-mail/mot de passe ou identifiant local persistant.
- **Réservation de Traversée** :
  - Choix du trajet : **Bukavu ➔ Goma** ou **Goma ➔ Bukavu**.
  - Sélection de la date, du navire et de la classe (*VIP*, *1ère Classe*, *2ème Classe*, *3ème Classe*).
  - Gestion multi-passagers avec calcul dynamique des montants.
- **Paiement Mobile Money & Manuel** :
  - Déclenchement automatique par push USSD (*FlexPay DRC*).
  - Mode direct Airtel Money avec saisie de référence de transaction.
- **E-Billet Sécurisé & Téléchargeable** :
  - Fiche détaillée du billet avec QR Code haute densité.
  - Exportation directe au format **PDF** via *jsPDF*.
- **Localisation & Itinéraires** :
  - Localisation du port de départ (ex: Port Mugote de Bukavu à Beach Muhanzi / Kadutu).
  - Calcul d'itinéraire et estimation de la distance restante par géolocalisation GPS.

### 👨‍💼 Espace Administration & Gestion de Flotte
- **Dashboard Analytique** : Chiffre d'affaires en temps réel, nombre total de réservations, taux de fréquentation.
- **Gestion Dynamique des Tarifs & Classes** :
  - Configuration en temps réel du tarif officiel en dollars ($ USD) pour chaque classe (*VIP*, *1ère Classe*, *2ème Classe*, *3ème Classe*).
  - Unicité stricte des tarifs synchronisés sur l'accueil, les réservations, les QR codes et les reçus.
- **Validation & Gestion des Réservations** :
  - Validation manuelle ou automatisée des paiements.
  - Annulation ou modification de billets.
- **Gestion de la Flotte** :
  - Ajout/édition de bateaux (*Mugote 1, 2, 3*).
  - Mise à jour des coordonnées GPS et des statuts opérationnels (*À quai*, *En navigation*, *En maintenance*).
- **Gestion des Horaires & Trajets** : Planification des départs quotidiens et des affectations de navires.
- **Gestion des Utilisateurs** : Annuaire complet des comptes avec rôles et coordonnées.
- **Centre de Médias & Actualités** : Publication d'annonces officielles, photos et vidéos.

### 🛂 Espace Contrôleur / Scanner d'Embarquement (QR Code)
- **Scanner Intégré par Caméra** : Utilisation de la caméra de l'appareil (*html5-qrcode*) sans matériel supplémentaire.
- **Recherche par Identifiant Manuel** : Possibilité de taper manuellement le code unique du billet (ex: `AMR-A8F2K9`).
- **Validation Idempotente** :
  - ✅ **Billet Valide & Payé** ➔ Validation avec passage immédiat au statut **EMBARQUÉ** (*BOARDED*).
  - ⚠️ **Billet Déjà Utilisé** ➔ Alerte immédiate avec date et heure du premier embarquement pour bloquer la fraude.
  - ❌ **Billet Invalide ou Impayé** ➔ Refus catégorique de l'embarquement.

### 🤖 Assistant Virtuel IA (Gemini 3.7 Flash & Fallback Intelligent)
- **Support 24/7 Hautement Robuste** : Intégré en bas de page pour accompagner les voyageurs en temps réel.
- **Synchronisation Dynamique des Tarifs & Horaires** : L'IA extrait automatiquement les prix officiels et les coordonnées depuis la base Firestore.
- **Base de Connaissances Exhaustive** : Renseignements précis sur les classes de voyage (VIP, 1ère, 2ème, 3ème), les départs réguliers (07h30, 11h00, 14h30), la géolocalisation des ports (Bukavu Beach Muhanzi / Goma), les règles de bagages et les paiements Mobile Money.
- **Routage & Suggestions Interactives** : Boutons d'accès direct vers les sections "Réserver", "Localisation GPS" et "Mes Billets" intégrés dans les réponses.
- **Architecture Résiliente** : Moteur Google GenAI (`gemini-3.7-flash` et cascades) combiné à un système de secours déterministe pour garantir une disponibilité continue sans interruption.

### 📰 Journal de Bord & Communauté
- Flux d'actualités et communiqués de la compagnie maritime.
- Support des images et vidéos interactives.
- Système de mentions "J'aime" et espace de commentaires pour les voyageurs.

### 📱 Application Web Progressive (PWA)
- **Installable** en un clic sur Android, iOS (Safari) et Desktop.
- Service Worker pour la mise en cache des assets statiques.
- Fonctionnement fluide même en connexion réseau instable.

---

## 🏗 Architecture Système & Flux de Données

```
                                  UTILISATEURS
              ┌─────────────────────────┼─────────────────────────┐
              ▼                         ▼                         ▼
         Passagers                Administrateurs             Contrôleurs
     (Mobile / Desktop)         (Gestion & Flotte)        (Scan QR Embarquement)
              │                         │                         │
              └─────────────────────────┼─────────────────────────┘
                                        │
                                        ▼
                           ┌──────────────────────────┐
                           │   React 19 + Vite + PWA  │
                           │     (Tailwind CSS v4)    │
                           └────────────┬─────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 │ HTTPS (API Routes)                          │ WebSocket / Client SDK
                 ▼                                             ▼
  ┌─────────────────────────────┐               ┌─────────────────────────────┐
  │      Node.js + Express      │               │   Firebase Cloud Services   │
  │     (Backend server.ts)     │               ├─────────────────────────────┤
  ├─────────────────────────────┤               │ • Cloud Firestore (DB)      │
  │ • Proxy IA /api/chat        │               │ • Firebase Authentication   │
  │ • Gateway FlexPay Mobile    │               │ • Firebase Storage (Médias) │
  │ • Webhooks & Signatures     │               │ • Firestore Security Rules  │
  │ • Générateur Ticket Unique  │               └─────────────────────────────┘
  └──────────────┬──────────────┘                              ▲
                 │                                             │
      ┌──────────┴──────────┐                                  │
      ▼                     ▼                                  │
┌───────────┐         ┌───────────┐                            │
│  Gemini   │         │  FlexPay  │────────────────────────────┘
│  AI SDK   │         │ Mobile CD │ (Mise à jour statut paiement)
└───────────┘         └───────────┘
```

---

## 🛠 Technologies Utilisées

### Frontend
- **React 19** & **Vite 6** — Interface utilisateur moderne, ultra-rapide et modulaire.
- **TypeScript 5.8** — Typage statique strict pour une robustesse applicative totale.
- **Tailwind CSS v4** — Framework utilitaire haute performance pour un design moderne et adaptatif.
- **Framer Motion** — Animations et transitions visuelles fluides.
- **Lucide React** — Bibliothèque d'icônes vectorielles cohérentes.
- **Google Maps API** (`@vis.gl/react-google-maps`) — Cartographie interactive et géolocalisation de la flotte.
- **html5-qrcode** — Décodage temps réel de codes QR via la caméra web/mobile.
- **jsPDF** & **qrcode.react** — Génération dynamique de billets au format PDF et rendu QR Code.

### Backend & API
- **Node.js** & **Express 4** — Serveur d'application et passerelle d'API REST.
- **@google/genai** — SDK officiel Google Gemini pour l'assistant conversationnel.
- **Firebase Admin SDK** — Opérations privilégiées côté serveur (mise à jour sécurisée des tickets).
- **esbuild** — Compilation et bundling optimisé du backend en un fichier standalone `dist/server.cjs`.

### Base de Données & Cloud
- **Cloud Firestore** — Base de données NoSQL temps réel pour les réservations, la flotte et les actualités.
- **Firebase Authentication** — Gestion sécurisée des identités et des sessions.
- **Firebase Storage** — Stockage des photos de bateaux, médias et pièces jointes.

---

## 📂 Structure du Projet

```
amr-mugote-et-ses-freres/
├── public/                       # Assets publics statiques
│   ├── favicon.ico               # Icône du site
│   ├── icon-192.png / 512.png    # Icônes de l'application PWA
│   ├── manifest.json             # Manifeste PWA
│   ├── robots.txt                # Directives d'indexation SEO
│   ├── sitemap.xml               # Plan du site pour moteurs de recherche
│   └── sw.js                     # Service Worker PWA
├── scripts/                      # Scripts d'automatisation de build
│   ├── generate-icons.js         # Génération dynamique des icônes PWA
│   └── generate-sitemap.js       # Génération automatique du sitemap SEO
├── src/                          # Code source Frontend React
│   ├── components/               # Composants React modulaires
│   │   ├── DocumentScannerWidget.tsx # Module de scan QR pour le contrôle d'embarquement
│   │   ├── LocalisationView.tsx      # Carte GPS Google Maps et suivi de la flotte
│   │   └── UsersListView.tsx         # Console d'administration des utilisateurs
│   ├── lib/                      # Services et utilitaires
│   │   ├── firebase.ts           # Configuration et initialisation Firebase Client
│   │   └── utils.ts              # Utilitaires (fusion de classes Tailwind cn)
│   ├── App.tsx                   # Composant racine, routage et logique centrale
│   ├── index.css                 # Import global de Tailwind CSS v4
│   ├── main.tsx                  # Montage de l'application React
│   └── types.ts                  # Interfaces TypeScript globales (Reservation, Ship, etc.)
├── .env.example                  # Modèle des variables d'environnement
├── firestore.rules               # Règles de sécurité Firestore
├── firebase-applet-config.json   # Configuration du projet Firebase
├── firebase-blueprint.json       # Schéma blueprint de la base de données
├── metadata.json                 # Métadonnées de l'application
├── package.json                  # Scripts NPM et dépendances
├── SDD.md                        # Software Design Document (Spécifications logicielles)
├── server.ts                     # Serveur Express (API routes + middleware Vite)
├── tsconfig.json                 # Configuration TypeScript
├── vercel.json                   # Configuration de routage et déploiement Vercel
└── vite.config.ts                # Configuration du bundler Vite
```

---

## 🗄 Modèle de Données Firestore

| Collection | Description | Champs Principaux |
|---|---|---|
| `reservations` | Billets et réservations des passagers | `id`, `ticketId`, `userId`, `passengerName`, `phone`, `route`, `departureDate`, `departureTime`, `shipName`, `seatClass`, `amount`, `status` (*PENDING*, *VALIDATED*, *CANCELLED*), `boardingStatus` (*PENDING*, *BOARDED*), `boardedAt`, `transactionId` |
| `fleet` | Bateaux de la compagnie | `id`, `name`, `capacity`, `speed`, `status` (*At Port*, *Sailing*, *Maintenance*), `latitude`, `longitude`, `imageUrl`, `description` |
| `schedules` | Horaires et plannings des traversées | `id`, `route`, `departureTime`, `shipId`, `shipName`, `priceVIP`, `priceFirst`, `priceSecond`, `priceThird` |
| `news` | Communiqués, avis et médias | `id`, `title`, `content`, `processedUrl`, `processedType` (*image*, *video*, *text*), `likes`, `createdAt`, `authorEmail` |
| `news/{id}/comments` | Commentaires sur une actualité | `id`, `userId`, `userName`, `content`, `createdAt` |
| `conversations` | Fils de discussion de support | `id`, `userId`, `userName`, `lastMessage`, `updatedAt` |
| `conversations/{id}/messages` | Messages individuels de support | `id`, `text`, `senderId`, `senderRole` (*USER*, *ADMIN*, *AI*), `createdAt` |
| `siteSettings` | Configuration globale du site | `adminCode`, `primaryColor`, `heroImageUrl` |

---

## 💳 Passerelle de Paiement Mobile Money

La plateforme prend en charge les opérateurs majeurs de RDC :
- 🟢 **M-Pesa** (Vodacom RDC)
- 🔴 **Airtel Money** (Airtel RDC)
- 🟠 **Orange Money** (Orange RDC)

### Flux de paiement automatisé (FlexPay API) :
1. Le client saisit son numéro de téléphone congolais (`+243...`).
2. Le serveur envoie une requête d'initialisation USSD Push à l'API FlexPay.
3. Le client reçoit une invite sur son téléphone pour saisir son code PIN secret.
4. FlexPay notifie le serveur via webhook (`/api/flexpay/callback`).
5. Le billet passe instantanément à l'état `VALIDATED` et génère un `ticketId` unique (`AMR-XXXXXX`).

---

## 🔐 Sécurité & Lutte Anti-Fraude

1. **Génération d'Identifiant de Billet Unique** : Algorithme avec vérification d'unicité dans Firestore pour éviter toute collision.
2. **QR Code Sécurisé** : Le QR code embarque les métadonnées cryptées et l'identifiant unique du passager.
3. **Contrôle d'Embarquement à Usage Unique (Idempotence)** : Dès la première validation par le contrôleur au port, le statut devient `BOARDED` avec horodatage (`boardedAt`). Toute tentative de réutilisation affiche une alerte rouge immédiate.
4. **Protection des Clés d'API** : Les clés sensibles (Gemini API, FlexPay API, Firebase Admin) sont confinées côté serveur et ne sont jamais exposées au client.

---

## 🔌 Endpoints d'API Backend

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/chat` | Proxy pour les échanges avec l'assistant IA Gemini |
| `POST` | `/api/flexpay/initialize` | Déclenchement d'un paiement Mobile Money USSD Push |
| `POST` | `/api/flexpay/callback` | Webhook de réception des confirmations de paiement FlexPay |
| `GET` | `/api/flexpay/check-status/:ref` | Vérification de l'état d'une transaction par référence |
| `POST` | `/api/flexpay/simulate` | Endpoint de test pour la validation en environnement bac à sable |
| `GET` | `/api/config` | Configuration publique de contact et de paiement |
| `GET` | `/api/sdd` | Visualisation du Software Design Document (SDD) |
| `GET` | `/sitemap.xml` | Fichier Sitemap XML pour le référencement |
| `GET` | `/robots.txt` | Directives d'indexation pour les robots |

---

## ⚙️ Installation & Démarrage Local

### Prérequis
- [Node.js](https://nodejs.org/) (version 18 ou supérieure recommandée)
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)
- Un compte Firebase avec un projet Firestore configuré

### 1. Cloner le dépôt

```bash
git clone https://github.com/birekeidea-max/amr-mugote-et-ses-freres.git
cd amr-mugote-et-ses-freres
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer l'environnement

Copiez `.env.example` vers un nouveau fichier `.env` :

```bash
cp .env.example .env
```

Renseignez les variables nécessaires (voir section suivante).

### 4. Lancer le serveur de développement

```bash
npm run dev
```

L'application démarre automatiquement sur **`http://localhost:3000`**.

### 5. Compiler pour la production

```bash
npm run build
```

### 6. Lancer le serveur compilé

```bash
npm run start
```

---

## 🔧 Variables d'Environnement

Exemple de configuration dans le fichier `.env` :

```env
# Clé d'API Google Gemini (utilisée pour l'assistant IA)
GEMINI_API_KEY="votre_cle_api_gemini"

# URL publique de l'application (requise pour les webhooks FlexPay)
APP_URL="https://amr-mugote-et-ses-freres.vercel.app"

# Identifiants de l'API FlexPay DRC (Mobile Money)
FLEXPAY_API_TOKEN="votre_token_bearer_flexpay"
FLEXPAY_MERCHANT_KEY="votre_merchant_key_flexpay"

# Numéro Airtel officiel pour la réception des fonds
RECIPIENT_AIRTEL_NUMBER="+243994102673"
```

---

## 🚀 Déploiement en Production

### Déploiement sur Vercel
Le projet inclut un fichier `vercel.json` préconfiguré :
1. Connectez votre dépôt GitHub à [Vercel](https://vercel.com).
2. Définissez les variables d'environnement dans le tableau de bord Vercel.
3. Déployez la branche `main`.

### Déploiement sur Cloud Run / Docker
Le projet peut être exécuté dans un conteneur Docker standard avec Node.js :
```bash
npm run build
npm run start
```
Le serveur écoute sur le port `3000` (`0.0.0.0:3000`).

---

## 🔮 Feuille de Route & Évolutions

- [ ] **Balises GPS IoT Matérielles** : Intégration de traceurs GPS physiques autonomes sur chaque navire pour une synchronisation automatique des coordonnées.
- [ ] **Notifications SMS & WhatsApp** : Envoi automatique de rappels de départ et d'alertes météo par SMS.
- [ ] **Passerelle de Paiement par Carte Bancaire** : Support des cartes Visa et Mastercard locales.
- [ ] **Gestion du Fret et des Marchandises** : Module d'enregistrement et de pesage des bagages et marchandises lourdes.

---

## 👨‍💻 Auteur & Crédits Académiques

**BIREKE IDEA**
*Développeur Full-Stack & Concepteur de Solutions Numériques*
*Étudiant en Sciences Informatiques à l'**Université Catholique de Bukavu (UCB)***

- 🐙 **GitHub** : [@birekeidea-max](https://github.com/birekeidea-max)
- 📧 **Email** : [birekeidea@gmail.com](mailto:birekeidea@gmail.com)

### Remerciements
- **Université Catholique de Bukavu (UCB)**
- **GDG On Campus UCB**
- **Programme d'Incubation et d'Innovation Technologique**
- L'équipe de direction de l'**ETS AMR MUGOTE ET SES FRÈRES**

---

## 📄 Licence

Ce projet est développé à des fins académiques, de recherche et d'innovation technologique pour le développement socio-économique de la région du Kivu.

© 2026 **BIREKE IDEA** — Tous droits réservés.


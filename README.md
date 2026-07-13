# 🚢 AMR MUGOTE ET SES FRÈRES

> Plateforme numérique de réservation maritime sur le Lac Kivu entre **Bukavu** et **Goma**.

![Version](https://img.shields.io/badge/version-1.0-blue)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)
![Firebase](https://img.shields.io/badge/Firebase-Backend-FFCA28)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933)
![License](https://img.shields.io/badge/License-Academic-green)

---

# 📖 À propos

**AMR MUGOTE ET SES FRÈRES** est une plateforme web moderne conçue pour digitaliser la réservation des billets de transport maritime sur le Lac Kivu.

Elle permet aux voyageurs de réserver leurs billets en ligne, d'effectuer des paiements Mobile Money (M-Pesa, Airtel Money, Orange Money via l'API FlexPay), de recevoir un billet électronique sécurisé avec un identifiant unique / QR Code et de valider l'embarquement en temps réel.

Le projet a été développé dans le cadre du **Programme d'Incubation et d'Innovation Technologique de GDG On Campus UCB**.

---

# 🌐 Démonstration

## Application

https://amr-mugote-et-ses-freres.vercel.app

---

# 🎯 Objectifs

La plateforme vise à :

- Digitaliser les réservations maritimes sur le Lac Kivu (Bukavu ⇄ Goma)
- Réduire les longues files d'attente aux ports d'embarquement
- Lutter contre la fraude de billets via des signatures uniques et un outil de scan QR Code
- Sécuriser les transactions financières via des passerelles de paiement Mobile Money
- Générer automatiquement des e-billets complets
- Améliorer le suivi logistique de la flotte et des passagers
- Simplifier l'embarquement grâce à un module de contrôle d'embarquement

---

# ✨ Fonctionnalités

## 👤 Voyageur

- **Création de compte & Connexion** : Authentification sécurisée (Firebase Auth)
- **Réservations en Ligne** : Sélection du trajet (Bukavu ⇄ Goma), de la date, du navire et de la classe (VIP, 1ère, 2ème, 3ème)
- **Paiement Mobile Money** : Intégration transparente avec FlexPay pour valider les paiements (M-Pesa, Airtel Money, Orange Money)
- **E-Billet Sécurisé** : Génération instantanée d'un reçu avec numéro de billet unique, QR Code et informations détaillées de voyage
- **Localisation & Suivi** : Visualisation en temps réel de la flotte de navires sur la carte du Lac Kivu et calcul d'itinéraires/distances
- **Messagerie & IA** : Assistant IA intégré (Gemini Pro) pour répondre instantanément aux interrogations des passagers

---

## 👨‍💼 Administrateur

- **Tableau de Bord Holistique** : Vue d'ensemble sur les flux financiers, statistiques de fréquentation et taux de remplissage
- **Gestion de la Flotte** : Ajout, modification, localisation GPS en temps réel et statut de navigation (À quai, En navigation, En maintenance) de chaque navire
- **Gestion des Horaires & Trajets** : Planification des départs réguliers
- **Gestion des Utilisateurs & Rôles** : Liste unifiée des utilisateurs avec gestion des statuts de sécurité
- **Gestion des Médias & Actualités** : Publication de communiqués et photos de la flotte pour les voyageurs

---

## 🛂 Contrôleur / Scanner d'Embarquement

- **Vérification QR Code** : Scanner embarqué (caméra ou ID manuel) pour identifier instantanément les billets
- **Contrôle d'Accréditation** : Validation de l'état de paiement et de l'authenticité du ticket
- **Confirmation d'Embarquement** : Enregistrement en direct du passager (passage au statut *EMBARQUÉ*) avec heure précise d'embarquement pour éviter la réutilisation frauduleuse du même billet

---

# 🏗 Architecture

Le projet suit une architecture robuste et hautement réactive.

```
                    React 19 Frontend (Vite)
                                │
                      ┌─────────┴─────────┐
                      │ HTTPS API         │ Temps Réel
                      ▼                   ▼
          Node.js + Express Server    Cloud Firestore (Firebase Client SDK)
                      │                   │
         ┌────────────┼────────────┐      ├─────────────────────────┐
         │            │            │      ▼                         ▼
         ▼            ▼            ▼   Firebase Authentication  Firebase Storage
     FlexPay API  Gemini AI   Admin SDK
```

---

# 🛠 Technologies utilisées

## Frontend

- **React 19** & **Vite 6** (Framework UI ultra-rapide)
- **TypeScript** (Typage statique strict pour la fiabilité)
- **Tailwind CSS v4** (Design moderne, réactif et fluide)
- **Framer Motion** (Micro-animations fluides de transitions)
- **Lucide React** (Ensemble d'icônes vectorielles cohérentes)
- **Google Maps API (@vis.gl/react-google-maps)** (Localisation interactive de la flotte)
- **jsPDF** & **QRCode.react** (Génération et rendu des e-billets)

## Backend (Serveur Hybride)

- **Node.js** & **Express**
- **Firebase Admin SDK** (Opérations privilégiées d'écriture et de validation de billets)
- **Google Gen AI SDK (@google/genai)** (Intégration de l'assistant IA Gemini)
- **esbuild** (Compilation et bundling optimisés en un fichier standalone `dist/server.cjs`)

## Base de Données & Cloud Services

- **Cloud Firestore** (Stockage et synchronisation en temps réel des documents)
- **Firebase Storage** (Hébergement des documents et médias)
- **Firebase Authentication** (Gestion sécurisée des profils utilisateurs)
- **Google Analytics** (Suivi d'utilisation et diagnostic de pannes)

---

# 📂 Structure du projet

L'arborescence réelle du projet s'organise ainsi :

```
amr-mugote-et-ses-freres/
├── public/                     # Fichiers statiques et médias
├── src/                        # Code source Frontend (React)
│   ├── components/             # Composants modulaires réutilisables
│   │   ├── DocumentScannerWidget.tsx  # Module scanner de contrôle de billets (QR)
│   │   ├── LocalisationView.tsx       # Carte interactive GPS et suivi de flotte (Google Maps)
│   │   └── UsersListView.tsx          # Vue unifiée d'administration des utilisateurs
│   ├── lib/                    # Initialisations de services tiers
│   │   ├── firebase.ts                # Configuration client Firebase (Firestore, Auth, Storage)
│   │   └── utils.ts                   # Utilitaires CSS (fusion de classes Tailwind cn)
│   ├── App.tsx                 # Composant racine, routage de vues et interfaces globales
│   ├── index.css               # Imports globaux de Tailwind CSS et polices
│   ├── main.tsx                # Point d'entrée de montage React 19
│   └── types.ts                # Déclarations globales d'interfaces TypeScript (Reservation, Ship, etc.)
├── server.ts                   # Serveur Express principal (API routes + middleware Vite)
├── .env.example                # Exemple de configuration des variables d'environnement
├── firestore.rules             # Règles de sécurité Firestore appliquées en production
├── firebase-blueprint.json     # Configuration de la structure de base Firestore
├── firebase-applet-config.json # Fichier de métadonnées Firebase
├── metadata.json               # Métadonnées et permissions de l'application
├── package.json                # scripts de build et dependances NPM
├── SDD.md                      # Document de conception logicielle détaillé (Software Design Document)
└── tsconfig.json               # Configuration du compilateur TypeScript
```

---

# 🔐 Sécurité

- **Règles de sécurité Firestore** : Restriction granulaire des accès (seul l'administrateur ou le contrôleur peut modifier le statut d'embarquement d'un billet, lecture restreinte aux réservations propres de chaque utilisateur).
- **Vérification d'Embarquement Idempotente** : Dès qu'un billet est scanné pour l'embarquement, il est marqué comme *BOARDED*. Tout scan ultérieur affiche une alerte rouge signalant que le billet a déjà été utilisé.
- **Double-Canal** : Toutes les opérations de modification de statuts sensibles transitent par des scripts d'administration sécurisés.

---

# 🗄 Collections Firestore

- `users` : Profils d'authentification et informations de base.
- `users_list` : Cache public synchronisé pour la recherche et l'administration des comptes.
- `reservations` : Enregistrements détaillés des réservations et des passagers (nom, navire, itinéraire, classe, statut de paiement, boardingStatus).
- `fleet` : Données sur les bateaux (nom, capacité, description, photo, coordonnées GPS de localisation en temps réel, statut de navigation).
- `schedules` : Horaires officiels et navires assignés pour chaque trajet.
- `news` : Publications d'avis de voyage et communiqués de presse.
- `messages` : Historique des conversations avec l'agent d'assistance pour chaque utilisateur.
- `media` : Galerie multimédia de la flotte.
- `settings` : Collection de configuration globale de la plateforme (collection `settings/site` contenant l'arrière-plan de l'application, les photos par défaut et le code d'administration).

---

# 🔄 Processus de réservation et paiement

1. **Recherche & Sélection** : Le client choisit le trajet, le navire, l'horaire et le nombre de passagers.
2. **Facturation** : Calcul automatique du montant total.
3. **Paiement Mobile Money via l'API FlexPay** :
   - Requête USSD PUSH envoyée sur la carte SIM du client.
   - Attente de la saisie sécurisée du code PIN par le client sur son téléphone.
   - Callback serveur automatique mettant à jour instantanément la réservation au statut *VALIDATED*.
4. **Billet Électronique** : Génération automatique du QR Code unique et possibilité d'exporter le billet de transport sous format PDF.
5. **Embarquement** : Contrôle et scan du code par le contrôleur au port de départ.

---

# 💳 Paiements supportés

- **M-Pesa** (Vodacom)
- **Airtel Money** (Airtel)
- **Orange Money** (Orange)

---

# ⚙️ Installation et exécution

## Cloner le projet

```bash
git clone https://github.com/birekeidea-max/amr-mugote-et-ses-freres.git
```

## Entrer dans le projet

```bash
cd amr-mugote-et-ses-freres
```

## Installer les dépendances

```bash
npm install
```

## Lancer le serveur de développement (Express + Vite)

```bash
npm run dev
```
Le serveur démarrera sur le port **3000** (URL : http://localhost:3000).

## Compiler pour la production

```bash
npm run build
```
Cette commande compile le frontend React avec Vite dans le dossier `dist/` et package le backend TypeScript `server.ts` sous forme de bundle CJS standalone `dist/server.cjs` via `esbuild`.

## Lancer l'application compilée en production

```bash
npm run start
```

---

# 🔧 Variables d'environnement

Créez un fichier `.env` à la racine en vous inspirant de `.env.example` :

```env
# Clé d'API Google Gemini
GEMINI_API_KEY="votre_cle_gemini"

# URL publique de l'application (pour les callbacks de paiement)
APP_URL="https://votre-app.com"

# Clés d'API FlexPay DRC pour les paiements réels
FLEXPAY_API_TOKEN="votre_bearer_token_flexpay"
FLEXPAY_MERCHANT_KEY="votre_cle_marchand_flexpay"

# Numéro de réception Airtel par défaut pour collecter les fonds
RECIPIENT_AIRTEL_NUMBER="+243994102673"
```

*Remarque : Les clés d'API Firebase et de Google Maps sont configurées de manière sécurisée et centralisée.*

---

# 📊 Statistiques prévisionnelles de flux

- Capacité cible d'accueil : **Plus de 50 000 utilisateurs actifs**
- Volume opérationnel : **Environ 1 500 voyageurs sécurisés par semaine**
- Synchronisation : Temps réel complet (inférieur à **1 seconde** pour la mise à jour des états d'embarquement)
- Fiabilité réseau : Gestion fluide des états déconnectés avec synchronisation au retour au réseau

---

# 🔮 Améliorations futures

- Applications mobiles natives Android / iOS
- Notifications Push SMS pour informer des retards éventuels de départs
- Paiement par carte bancaire locale
- Géolocalisation par balises physiques autonomes (IoT) sur les navires (en remplacement du positionnement manuel par la console d'administration)

---

# 👨‍💻 Auteur

**BIREKE IDEA**
*Étudiant en Sciences Informatiques à l'Université Catholique de Bukavu (UCB)*
*Développeur & Concepteur de Solutions*

- **GitHub** : [github.com/birekeidea-max](https://github.com/birekeidea-max)
- **Email** : [birekeidea@gmail.com](mailto:birekeidea@gmail.com)

---

# 🙏 Remerciements

Nos remerciements les plus sincères s'adressent à :
- **L'Université Catholique de Bukavu (UCB)**
- **GDG On Campus UCB**
- **Le Programme d'Incubation et d'Innovation Technologique**
- Les mentors et relecteurs pour leurs conseils tout au long de la conception.

---

# 📄 Licence

Ce projet est développé sous licence académique et d'innovation dans un cadre de recherche.
© 2026 BIREKE IDEA — Tous droits réservés.

---

## ⭐ Soutenir le projet

Si ce projet vous a été utile, n'hésitez pas à lui attribuer une **⭐ sur GitHub** et à partager vos suggestions d'amélioration.

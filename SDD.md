# 📝 DOCUMENT DE CONCEPTION SYSTÈME (SDD)
## Plateforme de Billetterie & Transport Lacustre — ETS AMR MUGOTE & FRÈRES

Ce document constitue la spécification technique officielle de référence pour l'application **AMR MUGOTE & FRÈRES**, assurant le transport fluvial/lacustre sécurisé entre Goma et Bukavu sur le lac Kivu (République Démocratique du Congo).

---

## 1. CARTOGRAPHIE ARCHITECTURALE DU SYSTÈME

Le système repose sur un modèle d'architecture **3-Tier découplé** avec une distribution d'actifs gérée via un serveur d'enclave Express / Node.js. Ce choix garantit que toutes les clés d'API (Gemini 3.5 et FlexPay CD) restent strictement cloisonnées du côté serveur privé.

```
+========================================================================================+
|                                    COUCHES SYSTÈME                                     |
+========================================================================================+

     [ COUCHE FRONTE-END : NAVIGATEUR CLIENT ]
     +-----------------------------------------------------------------------------+
     |   Vite + React 19 (Interface SPA Moderne hautement réactive)                |
     |   - Framer Motion (Transitions de pages fluides)                            |
     |   - Tailwind CSS v4.0 (Design system sombre "Cosmic Slate" ultra épuré)     |
     |   - Html5-QRCode (Scanner d'embarquement via caméra mobile de l'équipage)   |
     +-----------------------------------------------------------------------------+
                                           |
                                           | Requêtes HTTPS (JSON / REST Secure)
                                           v
     [ COUCHE BACK-END : ENCLAVE EXPRESS (SERVEUR NOMADE) ]
     +-----------------------------------------------------------------------------+
     |   Express.js (Node Engine, Compilé par esbuild en CommonJS dist/server.cjs)  |
     |   - Gestionnaire d'authentification et de routage admin                     |
     |   - Relais sécurisé de passerelle de paiement (FlexPay CD API)              |
     |   - Proxy IA d'assistance orientée passager (Gemini 3.5 API Server SDK)     |
     +-----------------------------------------------------------------------------+
              |                                    |                           |
              | Connexion API                      | SDK Firebase Privé        | Requêtes HTTPS
              v                                    v                           v
     +--------------------+              +--------------------+      +--------------------+
     |    GEMINI 3.5      |              |  CLOUD FIRESTORE   |      |   FLEXPAY CD CD    |
     |  (Assistant IA)   |              | (Base NoSQL Temps) |      | (Mobile MoMo RDC)  |
     | gemini-3.5-flash   |              | ai-studio-database |      | Port : HTTPS 443   |
     +--------------------+              +--------------------+      +--------------------+
```

---

## 2. DIAGRAMME DE SÉQUENCE : CYCLE DE PAIEMENT MOBILE MONEY (FLEXPAY PUSH USSD)

Ce diagramme décrit logiquement la cinématique d'un achat de billet par Mobile Money (Orange Money, Airtel Money, M-Pesa, Afrimoney) depuis la demande initiale jusqu'au contrôle à la rampe d'embarquement.

```
[ PAYSANT ]           [ CLIENT REACT APP ]       [ SERVEUR EXPRESS ]       [ FLEXPAY API ]        [ FIRESTORE DB ]
     |                         |                          |                       |                      |
     |-- 1. Choisit Voyage --->|                          |                       |                      |
     |   & Saisit Téléphone    |-- 2. Initialise Pay ---->|                       |                      |
     |                         |   POST /api/flexpay/init |                       |                      |
     |                         |                          |-- 3. Crée doc --------|--------------------->|
     |                         |                          |      (Statut PENDING) |                      |
     |                         |                          |                       |                      |
     |                         |                          |-- 4. Re-route PUSH -->|                      |
     |                         |                          |   HTTP POST a FlexPay |                      |
     |                         |                          |<--5. Token Transac. --|                      |
     |                         |<-- 6. Affiche Spinner ---|                       |                      |
     |                         |    & Démarre Polling     |                       |                      |
     |                         |                          |                       |                      |
     |<- 7. Reçoit Boîte ______|<=========================|=======================|                      |
     |   Dialogue PUSH USSD --|                                                  |                      |
     |   "Entrer PIN MoMo"     |                                                  |                      |
     |                         |                                                  |                      |
     |-- 8. Valide avec PIN -->|                                                  |                      |
     |                         |                                                  |                      |
     |                         |                          | [Attente Webhook]     |                      |
     |                         |                          |<-- 9. Callback (0) ---|                      |
     |                         |                          |   POST /api/.../cb    |                      |
     |                         |                          |                       |                      |
     |                         |                          |-- 10. MàJ Billet ---->|                      |
     |                         |                          |   (St: VALIDATED)     |                      |
     |                         |                          |   (Génère Ticket ID)  |                      |
     |                         |<-- 11. Résultat Polling--|                                              |
     |                         |    (Success!)            |                                              |
     |<- 12. Voit son Billet --|                          |                                              |
     |   avec Code QR          |                          |                                              |
```

---

## 3. DIAGRAMME DE FLUX D'ÉTATS D'UN BILLET (STATE MACHINE)

```
       +-----------------+
       |  INITIALISATION  |  (Création de la réservation par le voyageur)
       +-----------------+
                |
                v
       +-----------------+
  +--->|     PENDING     |  (Billet créé, en attente de déblocage des fonds Mobile Money)
  |    +-----------------+
  |             |
  |             |---> [ Échec Paiement / Expi ou Annulation ] -------->  +-----------------+
  |             |                                                       |    REJECTED     | (Remboursé / Rejeté)
  |             |                                                       +-----------------+
  |             |
  |             v  (Callback d'approbation FlexPay reçu avec Code 0)
  |    +-----------------+
  |    |    VALIDATED    |  (Paiement réussi : Attribution du Code QR unique & PDF actif)
  |    +-----------------+
  |             |
  |             v  (Scan au port d'embarquement de Bukavu ou Goma par l'équipage)
  |    +-----------------+
  |    |     BOARDED     |  (Embarqué à bord du Mugote 1, 2 ou 3)
  |    +-----------------+
  |             |
  |             v  (Navette arrivée à bon port sur le Kivu)
  +-------------+
```

---

## 4. SCHÉMA DES DONNÉES ET COLLECTIONS (TABLE STRUCTURES)

### Collection : `reservations` (Documents d'embarquement)

| Attribut | Type | Contraintes | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | Clé Primaire (Auto) | Identifiant technique unique généré par Firestore. |
| `userId` | String | Indexé | Référence vers l'utilisateur Firebase Auth propriétaire. |
| `fullName` | String | Requis | Prénom indiqué sur la carte d'identité du voyageur. |
| `lastName` | String | Requis | Nom de famille enregistré pour le manifeste de bord. |
| `phone` | String | Format RDC | Numéro de transaction standardisé sous la forme `243XXXXXXXXX`. |
| `email` | String | Optionnel | Adresse email facultative de notification. |
| `itinerary` | Enum | 'Bukavu-Goma' \| 'Goma-Bukavu' | Sens du trajet lacustre à travers le lac Kivu. |
| `ship` | Enum | 'Mugote 1' \| 'Mugote 2' \| 'Mugote 3' | Navire affecté au voyage choisi. |
| `travelDate` | String | Format ISO | Date du voyage planifiée. |
| `departureTime` | String | Format (HH:MM) | Heure effective du départ (ex: `07:30`, `14:00`). |
| `travelClass` | Enum | VIP \| 1ère \| 2ème \| 3ème | Classe réservée (les tarifs varient dynamiquement). |
| `passengersCount`| Number | `>= 1` | Nombre total de passagers rattachés à ce billet unique. |
| `status` | Enum | PENDING \| VALIDATED \| REJECTED | État d'avancement de la transaction financière. |
| `paymentMethod` | String | Fixed: 'Mobile Money' | Méthode d'acquisition du titre de transport. |
| `momoOperator` | String | Orange \| Airtel \| Vodacom \| Afrimoney | Opérateur mobile ayant intermédié le prélèvement. |
| `transactionId` | String | Unique | Clé marchande de réconciliation FlexPay (`AMR-FLX-XXXXXX`). |
| `ticketId` | String | Unique, Alphanumérique | Identifiant court d'embarquement (ex: `AMR-A5B2C9`). |
| `amount` | Number | Flottant positif | Montant global facturé en USD. |
| `createdAt` | Timestamp | Requis | Date/Heure exacte de la soumission de la réservation. |
| `validatedAt` | Timestamp | Optionnel | Date/Heure d'approbation instantanée par le webhook. |
| `boardingStatus`| Enum | PENDING \| BOARDED | Statut du contrôle d'accès sur le quai d'embarquement. |
| `boardedAt` | Timestamp | Optionnel | Log horaire du code QR validé par l'administrateur. |

---

## 5. RECONCILIATION API & INTERFAÇAGES TIERS

### 1. Spécification FlexPay RDC (Service de Paiement)
*   **En-tête Requête** : `Authorization: Bearer <FLEXPAY_API_TOKEN>`
*   **Payload de création de dépôt** :
    ```json
    {
      "merchant": "<FLEXPAY_MERCHANT_KEY>",
      "phone": "243XXXXXXXXX",
      "amount": 15,
      "currency": "USD",
      "reference": "AMR-FLX-831920",
      "callback": "https://amrmugote.run.app/api/flexpay/callback",
      "description": "Billet Lacustre AMR MUGOTE"
    }
    ```
*   **Mécanisme de Webhook Callback** :
    Le serveur tiers de FlexPay envoie une requête IPN (Instant Payment Notification) désynchronisée sur notre serveur. Dès lecture de la propriété `code` ou `status` à `0`, la fonction de callback met à jour atomiquement la collection Firestore locale pour débloquer le billet sous format PDF avec son code QR généré.

### 2. Spécification IA Gemini (Moteur d'Assistance)
*   **SDK Mobilisé** : `@google/genai`
*   **Modèle Préconisé** : `gemini-3.5-flash`
*   **Enclave Système** : Le prompt système force le modèle à respecter la charte commerciale des Établissements AMR Mugote (horaires stricts, tarifs fixes détaillés par classe, localisation géographique, consignes de sécurité obligatoires comme le port du gilet de sauvetage).

---

## 6. MODE OPÉRATOIRE POUR CONFIGURER VOS CLÉS DANS LES SECRETS

Pour assurer la confidentialité absolue des paiements et des interactions IA, veuillez configurer les clés de production dans l'onglet **Settings** de votre interface d'administration ou dans vos variables d'environnement Système (`.env`).

### Variables Requises :

1.  **`FLEXPAY_API_TOKEN`** : Jeton secret d'API fourni par la passerelle FlexPay.
2.  **`FLEXPAY_MERCHANT_KEY`** : Identifiant d'affiliation marchand de votre entreprise AMR Mugote.
3.  **`GEMINI_API_KEY`** : Clé d'API émise depuis Google AI Studio pour animer le capitaine de bord virtuel.
4.  **`RECIPIENT_AIRTEL_NUMBER`** : Numéro marchand principal recevant les fonds en République Démocratique du Congo (Par défaut : `243994102673`).

---
*Ce document de conception logicielle (SDD) a été modélisé par l’assistant IA d'antigravité pour l'exploitation et la maintenance de la flotte lacustre AMR MUGOTE & FRÈRES.*

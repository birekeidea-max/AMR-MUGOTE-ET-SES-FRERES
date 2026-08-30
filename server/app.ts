import express from "express";
import cors from "cors";
import "dotenv/config";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { connectMongoDB } from "./db";
import apiRoutes from "./routes/api";
import { Reservation as MongoReservation, SiteSettings as MongoSiteSettings } from "./models";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const firebaseConfig = {
  projectId: "mugote2",
  databaseId: "ai-studio-020b031e-1447-4f1b-8ef0-ab4a23c0b6ab"
};

const adminApp = admin.apps.length ? admin.apps[0] : admin.initializeApp({
  projectId: firebaseConfig.projectId
});

export const dbAdmin = getFirestore(adminApp, firebaseConfig.databaseId);

export async function generateUniqueTicketId(): Promise<string> {
  let uniqueTicketId = "";
  let isUnique = false;
  let attempts = 0;
  const reservationsCol = dbAdmin.collection("reservations");

  while (!isUnique && attempts < 15) {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    uniqueTicketId = `AMR-${randomHex}`;
    
    // Check MongoDB first if available
    try {
      const mongoExists = await MongoReservation.findOne({ ticketId: uniqueTicketId });
      if (mongoExists) {
        attempts++;
        continue;
      }
    } catch (mErr) {
      // MongoDB check optional
    }

    try {
      const qSnap = await reservationsCol.where("ticketId", "==", uniqueTicketId).get();
      if (qSnap.empty) {
        isUnique = true;
      }
    } catch (fErr) {
      isUnique = true;
    }
    attempts++;
  }
  if (!uniqueTicketId) {
    uniqueTicketId = `AMR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
  return uniqueTicketId;
}

export function createExpressApp() {
  const app = express();

  // CORS Configuration
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Auto-connect MongoDB in serverless / container contexts
  app.use(async (req, res, next) => {
    try {
      await connectMongoDB();
    } catch (err) {
      // Non-blocking database check
    }
    next();
  });

  // Mount Comprehensive MongoDB REST API Routes (with /api and root fallback for Vercel rewrites)
  app.use('/api', apiRoutes);
  app.use(apiRoutes);

  // Gemini AI Chat Proxy
  app.post(["/api/chat", "/chat"], async (req, res) => {
    try {
      const { message, history } = req.body;
      if (!message || !String(message).trim()) {
        return res.status(400).json({ error: "Le message est requis." });
      }

      // Retrieve dynamic site settings from Firestore for real-time accurate prices and contacts
      let sitePrices = { 'VIP': 27, '1ère Classe': 27, '2ème Classe': 17, '3ème Classe': 10 };
      let sitePhone = "+243 994 286 469";
      try {
        const settingsSnap = await dbAdmin.collection("settings").doc("site").get();
        if (settingsSnap.exists) {
          const sData = settingsSnap.data();
          if (sData?.classPrices) {
            sitePrices = {
              'VIP': Number(sData.classPrices['VIP'] ?? 27),
              '1ère Classe': Number(sData.classPrices['1ère Classe'] ?? 27),
              '2ème Classe': Number(sData.classPrices['2ème Classe'] ?? 17),
              '3ème Classe': Number(sData.classPrices['3ème Classe'] ?? 10)
            };
          }
          if (sData?.contactPhone) {
            sitePhone = sData.contactPhone;
          }
        }
      } catch (dbErr) {
        console.warn("Could not load Firestore settings for chat, trying MongoDB:", dbErr);
        try {
          const mongoSet = await MongoSiteSettings.findOne({ key: 'site' });
          if (mongoSet && mongoSet.classPrices) {
            sitePrices = {
              'VIP': Number(mongoSet.classPrices.VIP ?? 27),
              '1ère Classe': Number(mongoSet.classPrices['1ère Classe'] ?? 27),
              '2ème Classe': Number(mongoSet.classPrices['2ème Classe'] ?? 17),
              '3ème Classe': Number(mongoSet.classPrices['3ème Classe'] ?? 10)
            };
          }
          if (mongoSet?.contactPhone) {
            sitePhone = mongoSet.contactPhone;
          }
        } catch (mErr) {}
      }

      const systemInstruction = `Tu es l'assistant IA officiel, expert et dévoué de "ETS AMR MUGOTE ET SES FRERES", la plateforme leader et référence du transport lacustre moderne sur le Lac Kivu en République Démocratique du Congo (RDC).
Ta mission est d'orienter, renseigner et accompagner chaleureusement les voyageurs à chaque étape de leur parcours.

=== CONNAISSANCES OFFICIELLES & EXHAUSTIVES DE LA PLATEFORME ===

1. IDENTITÉ & MISSION DE L'ENTREPRISE :
- Raison sociale : ETS AMR MUGOTE ET SES FRERES (abrégé "AMR MUGOTE" ou "MUGOTE").
- Slogan : "Voyager en toute sécurité".
- Rayonnement : Liaisons régulières et rapides entre les villes de Bukavu (Sud-Kivu) et Goma (Nord-Kivu) via le Lac Kivu.
- Valeurs fondamentales : Sécurité maritime certifiée, ponctualité, confort moderne, innovations technologiques et service client attentionné.

2. FLOTTE DE BATEAUX & SÉCURITÉ :
- Nos navires rapides : MUGOTE 1, MUGOTE 2 et MUGOTE 3.
- Caractéristiques : Moteurs marins inspectés quotidiennement, gilets de sauvetage certifiés pour 100% des passagers, canots de sauvetage, radars GPS de navigation, extincteurs, sièges ergonomiques, écrans de divertissement et pont panoramique offrant une vue splendide sur le Lac Kivu et l'île d'Idjwi.
- Durée de traversée : Environ 3 heures de voyage agréable et sécurisé.

3. HORAIRES DE DÉPART QUOTIDIENS (7j/7) :
- Liaisons dans les 2 sens (Bukavu -> Goma ET Goma -> Bukavu) :
  • Matin : 07h30 (Mugote 1 / Mugote 2)
  • Midi : 11h00 (Mugote 2 / Mugote 3)
  • Après-midi : 14h30 (Mugote 3 / Mugote 1)
- Recommandation d'embarquement : Se présenter au port d'embarquement 45 minutes avant le départ pour l'enregistrement et le contrôle des billets.

4. GRILLE TARIFAIRE OFFICIELLE PAR CLASSE (ACTUALISÉE EN DIRECT) :
- Classe VIP : ${sitePrices['VIP']}$ USD (Salon climatisé privatisé, sièges grand luxe, service personnalisé, boisson offerte, embarquement prioritaire).
- 1ère Classe : ${sitePrices['1ère Classe']}$ USD (Fauteuils spacieux de première qualité, espace calme, vue panoramique, priorité).
- 2ème Classe : ${sitePrices['2ème Classe']}$ USD (Standard très populaire, grand espace aéré et ventilé, très apprécié des voyageurs).
- 3ème Classe : ${sitePrices['3ème Classe']}$ USD (Option économique et abordable, accès direct au pont avec vue sur le lac).

5. LOCALISATION EXACTE DES PORTS & GÉOLOCALISATION GPS :
- PORT DE BUKAVU (Port d'attache AMR Mugote) :
  • Adresse : République Démocratique du Congo, Province du Sud-Kivu, Ville de Bukavu, Commune de Kadutu, Avenue Michombero, Quartier Nkafu.
  • Repères : Situé en diagonale avec le célèbre marché Beach Muhanzi de Bukavu.
  • Limites physiques : Borné à l'EST par le marché Beach Muhanzi, et à l'OUEST par le port de l'ETS SILIMU.
- PORT DE GOMA :
  • Port public lacustre de Goma, au bord du Lac Kivu, proche du centre-ville.
- MODULE GPS DU SITE (Onglet "LOCALISATION") :
  • Les passagers peuvent cliquer sur "LOCALISATION" dans le menu pour afficher leur position GPS en temps réel, calculer la distance exacte restante jusqu'au port d'embarquement et lancer l'itinéraire routier.

6. PROCESSUS DE RÉSERVATION & BILLETTERIE PAS-À-PAS :
- Étape 1 : Se rendre sur l'onglet "RÉSERVER" dans le menu du site.
- Étape 2 : Sélectionner l'itinéraire (Bukavu->Goma ou Goma->Bukavu), la date de voyage souhaitée, le bateau et la classe de voyage (VIP, 1ère, 2ème ou 3ème).
- Étape 3 : Renseigner les coordonnées du passager (Nom complet, Téléphone valide).
- Étape 4 : Paiement du billet :
  • Mobile Money Automatique (FlexPay) : M-Pesa (Vodacom), Airtel Money, Orange Money.
  • Transfert Mobile Money direct : Envoi au numéro officiel ${sitePhone} (Titulaire du compte : AMR MUGOTE), puis saisie de la référence/ID de transaction.
  • Carte bancaire (Visa/Mastercard) ou paiement direct au guichet du port.
- Étape 5 : Accès au Billet :
  • Une fois la réservation validée, le billet électronique avec son QR Code infalsifiable est disponible dans l'onglet "MES BILLETS".
  • L'utilisateur peut le télécharger en PDF ou l'imprimer. Le QR Code est scanné au port lors de l'embarquement.

7. AUTRES SECTIONS & FONCTIONNALITÉS DU SITE :
- "GALERIE" : Photos et vidéos de haute qualité des bateaux, des cabines VIP et des traversées sur le Lac Kivu.
- "ACTUALITÉS" (Journal de bord) : Publications officielles de la compagnie, informations météo, annonces de trafic.
- "FAQ" : Foire aux questions détaillées.
- "MES BILLETS" : Visualisation, téléchargement PDF et vérification des réservations de l'utilisateur.
- "CONTACT" : Support et assistance client par téléphone / WhatsApp au ${sitePhone}.

8. RÈGLES DE BAGAGES & POLITIQUE DE VOYAGE :
- Bagages inclus : Valise standard + bagage à main inclus par passager.
- Colis et fret lourd : Pris en charge aux comptoirs de fret de nos ports à des tarifs avantageux.
- Enfants : Les enfants en bas âge voyagent accompagnés avec gilets de sauvetage adaptés.
- Animaux : Transport autorisé sous conditions strictes dans des cages adaptées et sur le pont.

=== CONSIGNES DE RÉPONSE ET DE COMPORTEMENT ===
- TON : Très courtois, professionnel, accueillant et chaleureux. Utilise toujours le vouvoiement ("Vous").
- LANGUE : Réponds en FRANÇAIS (ou en Swahili / Lingala / Anglais si l'utilisateur s'exprime expressément dans ces langues).
- CLARTÉ : Structure tes réponses avec des puces claires, des sauts de ligne et du texte en gras pour une excellente lisibilité.
- ORIENTATION : Guide précisément l'utilisateur vers le bon onglet du site (ex: "Cliquez sur l'onglet 'RÉSERVER' en haut de la page", "Rendez-vous dans la section 'LOCALISATION'", "Consultez vos billets dans 'MES BILLETS'").
- IDENTITÉ IA : Tu es "Mugote AI Assistant", l'assistant virtuel intelligent de la compagnie maritime ETS AMR MUGOTE. Ne mentionne jamais que tu es un modèle générique de Google.`;

      const apiKey = process.env.GEMINI_API_KEY;
      const messageStr = String(message || "").trim();
      const rawContents: any[] = [];
      const historyItems = history || [];
      
      for (const h of historyItems) {
        const text = String(h.text || h.message || "").trim();
        if (!text) continue;
        const rName = (h.role || h.senderRole || "").toString().toUpperCase();
        const role = (rName === 'AI' || rName === 'ADMIN' || rName === 'MODEL') ? 'model' : 'user';
        rawContents.push({ role, parts: [{ text }] });
      }

      const lastHistoryMessage = rawContents.length > 0 ? rawContents[rawContents.length - 1].parts[0].text : "";
      if (lastHistoryMessage !== messageStr) {
        rawContents.push({ role: 'user', parts: [{ text: messageStr }] });
      }

      // Strict role alternation merge
      const contents: any[] = [];
      for (const item of rawContents) {
        if (contents.length > 0 && contents[contents.length - 1].role === item.role) {
          contents[contents.length - 1].parts[0].text += "\n" + item.parts[0].text;
        } else {
          contents.push(item);
        }
      }

      while (contents.length > 0 && contents[0].role !== 'user') {
        contents.shift();
      }

      if (contents.length === 0) {
        contents.push({ role: 'user', parts: [{ text: messageStr }] });
      }

      // If API Key is configured, use Google GenAI SDK with gemini-3.7-flash and fallback
      if (apiKey) {
        const client = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const candidateModels = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
        let responseText = "";

        for (const mName of candidateModels) {
          try {
            console.log(`Calling Gemini with model ${mName}...`);
            const result = await client.models.generateContent({
              model: mName,
              contents: contents,
              config: {
                systemInstruction: systemInstruction,
                temperature: 0.7,
              }
            });

            if (result && result.text) {
              responseText = result.text;
              break;
            } else if (result && result.candidates?.[0]?.content?.parts?.[0]?.text) {
              responseText = result.candidates[0].content.parts[0].text;
              break;
            }
          } catch (modelCallErr: any) {
            console.warn(`Attempt with ${mName} failed:`, modelCallErr?.message || modelCallErr);
          }
        }

        if (responseText && responseText.trim()) {
          return res.json({ text: responseText });
        }
      }

      // Intelligent Fallback System
      const q = messageStr.toLowerCase();
      let fallbackText = "";

      if (q.includes("tarif") || q.includes("prix") || q.includes("combien") || q.includes("coût") || q.includes("cout") || q.includes("classe")) {
        fallbackText = `🚢 **Grille Tarifaire Officielle — AMR MUGOTE :**\n\n` +
          `• 👑 **Classe VIP :** **${sitePrices['VIP']}$ USD** (Salon climatisé, grand confort, service personnalisé, boisson offerte).\n` +
          `• ⭐ **1ère Classe :** **${sitePrices['1ère Classe']}$ USD** (Sièges grand confort, espace calme et vue panoramique).\n` +
          `• 🚢 **2ème Classe :** **${sitePrices['2ème Classe']}$ USD** (Standard recommandé, aéré et très spacieux).\n` +
          `• ⚓ **3ème Classe :** **${sitePrices['3ème Classe']}$ USD** (Tarif économique et abordable, accès pont).\n\n` +
          `💡 *Pour réserver, rendez-vous dans l'onglet **"RÉSERVER"** en haut de la plateforme.*`;
      } else if (q.includes("horaire") || q.includes("heure") || q.includes("départ") || q.includes("depart") || q.includes("quand")) {
        fallbackText = `🕒 **Horaires de Départs Quotidiens (Bukavu <-> Goma) :**\n\n` +
          `Nos navires rapides assurent les liaisons tous les jours aux horaires suivants :\n` +
          `• **Matin :** **07h30** (Mugote 1 / Mugote 2)\n` +
          `• **Midi :** **11h00** (Mugote 2 / Mugote 3)\n` +
          `• **Après-midi :** **14h30** (Mugote 3 / Mugote 1)\n\n` +
          `⏱️ *Durée de la traversée : environ 3 heures sur le Lac Kivu.*\n` +
          `📍 *Présentation au port recommandée : 45 minutes avant le départ.*`;
      } else if (q.includes("port") || q.includes("adresse") || q.includes("localisation") || q.includes("où") || q.includes("ou se trouve") || q.includes("kadutu") || q.includes("nkafu") || q.includes("beach")) {
        fallbackText = `📍 **Localisation de nos Ports d'Embarquement :**\n\n` +
          `• **Port de Bukavu :** Commune de Kadutu, Avenue Michombero, Quartier Nkafu (situé en diagonale avec le célèbre marché Beach Muhanzi, borné à l'Ouest par le port ETS SILIMU).\n` +
          `• **Port de Goma :** Port public lacustre du Lac Kivu à Goma.\n\n` +
          `🗺️ *Astuce : Vous pouvez vous rendre sur l'onglet **"LOCALISATION"** de notre site pour visualiser votre position GPS en temps réel et obtenir l'itinéraire exact.*`;
      } else if (q.includes("réserv") || q.includes("reserv") || q.includes("billet") || q.includes("ticket") || q.includes("comment")) {
        fallbackText = `🎫 **Comment réserver votre billet sur AMR MUGOTE :**\n\n` +
          `1. Cliquez sur l'onglet **"RÉSERVER"** dans le menu.\n` +
          `2. Sélectionnez votre trajet (*Bukavu -> Goma* ou *Goma -> Bukavu*), la date, le navire et votre classe.\n` +
          `3. Saisissez vos coordonnées passager (Nom & Téléphone).\n` +
          `4. Effectuez le paiement soit par **Mobile Money automatique (FlexPay)**, soit par transfert manuel au **${sitePhone}** (Titulaire : AMR MUGOTE).\n` +
          `5. Retrouvez votre billet sécurisé avec QR Code dans l'onglet **"MES BILLETS"** pour l'embarquement.`;
      } else if (q.includes("paiement") || q.includes("payer") || q.includes("flexpay") || q.includes("airtel") || q.includes("mpesa") || q.includes("m-pesa") || q.includes("orange")) {
        fallbackText = `💳 **Modes de Paiement Acceptés :**\n\n` +
          `• **Mobile Money Automatique :** Airtel Money, M-Pesa (Vodacom), Orange Money via FlexPay.\n` +
          `• **Paiement Mobile Money Direct :** Envoi au numéro officiel **${sitePhone}** (*Titulaire : AMR MUGOTE*).\n` +
          `• **Carte Bancaire :** Cartes Visa & Mastercard acceptées.\n` +
          `• **Au Guichet :** Règlement en espèces directement à nos agences aux ports de Bukavu et Goma.`;
      } else if (q.includes("contact") || q.includes("numéro") || q.includes("numero") || q.includes("téléphone") || q.includes("telephone") || q.includes("whatsapp")) {
        fallbackText = `📞 **Contacts & Assistance Client AMR MUGOTE :**\n\n` +
          `• **Téléphone / WhatsApp :** **${sitePhone}**\n` +
          `• **Service Client :** Disponible 7j/7 pour vos réservations et renseignements.\n` +
          `• **Guichets :** Présence physique aux ports de Bukavu (Beach Muhanzi) et Goma.`;
      } else {
        fallbackText = `👋 **Bonjour et bienvenue à bord d'ETS AMR MUGOTE ET SES FRERES !**\n\n` +
          `Je suis votre assistant virtuel officiel. Je peux vous renseigner instantanément sur :\n\n` +
          `• 💳 **Les tarifs par classe** (VIP : ${sitePrices['VIP']}$, 1ère : ${sitePrices['1ère Classe']}$, 2ème : ${sitePrices['2ème Classe']}$, 3ème : ${sitePrices['3ème Classe']}$)\n` +
          `• 🕒 **Les horaires de départ quotidiens** (07h30, 11h00, 14h30)\n` +
          `• 📍 **L'adresse et l'accès au Port Mugote** (Bukavu / Goma & Guidage GPS)\n` +
          `• 🎫 **La réservation et le paiement de vos billets en ligne**\n` +
          `• 🧳 **Les conditions de voyage et la sécurité à bord**\n\n` +
          `N'hésitez pas à me poser votre question précise ou cliquez sur l'une des suggestions ci-dessous !`;
      }

      res.json({ text: fallbackText });
    } catch (error: any) {
      console.error("Gemini /api/chat error:", error);
      res.json({
        text: `Bienvenue chez ETS AMR MUGOTE ET SES FRERES ! Nous assurons les liaisons quotidiennes Bukavu-Goma à 07h30, 11h00 et 14h30. Pour réserver votre billet, cliquez sur l'onglet **"RÉSERVER"** ou contactez notre support au **+243 994 286 469**.`
      });
    }
  });

  // API Route for Payment Verification (Simulated Legacy)
  app.post(["/api/verify-payment", "/verify-payment"], async (req, res) => {
    const { transactionId, phone, amount } = req.body;
    console.log(`Verifying payment for transaction ${transactionId} from ${phone} for ${amount} FC`);
    res.json({ status: "initiated", message: "Paiement en attente de validation administrative." });
  });

  // FlexPay CD Mobile Money PUSH Integration
  app.post(["/api/flexpay/initialize", "/flexpay/initialize"], async (req, res) => {
    try {
      const { phone, amount, operator, reservationId } = req.body;
      if (!phone || !amount || !reservationId) {
        return res.status(400).json({ error: "Champs obligatoires manquants." });
      }

      const formattedPhone = phone.replace(/[\s\-\+]/g, "");
      const finalClientPhone = formattedPhone.startsWith("0") 
        ? "243" + formattedPhone.substring(1) 
        : formattedPhone.startsWith("243") 
          ? formattedPhone 
          : "243" + formattedPhone;
      
      const trackingRef = `AMR-FLX-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

      try {
        const docRef = dbAdmin.collection("reservations").doc(reservationId);
        await docRef.update({
          transactionId: trackingRef,
          momoOperator: operator || "Airtel Money",
        });
      } catch (dbErr: any) {
        console.warn("Could not write initial tracking ref to Firestore:", dbErr);
      }

      const apiToken = process.env.FLEXPAY_API_TOKEN;
      const merchantKey = process.env.FLEXPAY_MERCHANT_KEY;
      const recipientNumber = process.env.RECIPIENT_AIRTEL_NUMBER || "243994102673";

      if (!apiToken || !merchantKey) {
        return res.json({
          success: true,
          trackingRef,
          simulated: true,
          message: "Mode test d'évaluation activé. USSD Push simulé."
        });
      }

      const flexpayUrl = "https://gateway.flexpay.cd/api/1.0/pay";
      const payload = {
        merchant: merchantKey,
        phone: finalClientPhone,
        amount: String(amount),
        currency: "USD",
        reference: trackingRef,
        callback: `${process.env.APP_URL || "https://amr-mugote-et-ses-freres.vercel.app"}/api/flexpay/callback`,
        description: `Billet AMR MUGOTE - Crédite: ${recipientNumber}`
      };

      const response = await fetch(flexpayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiToken}`
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json() as any;
      if (response.ok && (responseData.code === "0" || responseData.code === 0 || responseData.status === "0" || responseData.success)) {
        res.json({
          success: true,
          trackingRef,
          simulated: false,
          flexpayData: responseData,
          message: "Votre transaction a été initiée. Veuillez saisir votre code secret sur le push USSD de votre téléphone."
        });
      } else {
        res.json({
          success: false,
          trackingRef,
          simulated: true,
          error: responseData.message || "Échec de l'intégration avec le serveur FlexPay.",
          message: "Impossible d'initier un paiement réel. Passage automatique au mode Simulation d'évaluation."
        });
      }
    } catch (error: any) {
      console.error("Critical error inside FlexPay initializer:", error);
      res.json({
        success: false,
        trackingRef: `SIM-ERR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        simulated: true,
        message: "Une erreur technique s'est produite lors de la connexion. Mode simulation activé pour évaluation."
      });
    }
  });

  // Webhook Receiver Callback for FlexPay Payment Confirmation
  app.post(["/api/flexpay/callback", "/flexpay/callback"], async (req, res) => {
    try {
      console.log("FlexPay webhook callback triggered with body:", JSON.stringify(req.body));
      const { reference, status, code } = req.body;
      
      const referenceToUse = reference || req.body.ref || req.body.order_ref;
      const statusToUse = status !== undefined ? status : code;

      if (!referenceToUse) {
        return res.status(400).json({ error: "Le paramètre reference est obligatoire dans le callback." });
      }

      const isSuccess = String(statusToUse).trim() === "0" || 
                        String(statusToUse).toUpperCase() === "SUCCESSFUL" || 
                        String(statusToUse).toUpperCase() === "SUCCESS" ||
                        String(statusToUse).toUpperCase() === "COMPLETED";

      if (isSuccess) {
        console.log(`FlexPay Callback confirms successful transaction reference: ${referenceToUse}`);

        let uniqueTicketId = "";
        try {
          const mongoRes = await MongoReservation.findOne({
            $or: [{ transactionId: referenceToUse }, { trackingRef: referenceToUse }]
          });
          if (mongoRes && mongoRes.status !== 'VALIDATED') {
            uniqueTicketId = await generateUniqueTicketId();
            mongoRes.status = 'VALIDATED';
            mongoRes.ticketId = uniqueTicketId;
            mongoRes.validatedAt = new Date();
            await mongoRes.save();
            console.log(`[MongoDB] FlexPay validated ticket ${uniqueTicketId} for Mongo reservation ${mongoRes._id}`);
          } else if (mongoRes) {
            uniqueTicketId = mongoRes.ticketId || "";
          }
        } catch (mErr) {
          console.warn("MongoDB FlexPay update error:", mErr);
        }

        const reservationsCol = dbAdmin.collection("reservations");
        const querySnapshot = await reservationsCol.where("transactionId", "==", referenceToUse).get();

        if (!querySnapshot.empty) {
          for (const doc of querySnapshot.docs) {
            const reservationData = doc.data();
            if (reservationData.status !== "VALIDATED") {
              if (!uniqueTicketId) uniqueTicketId = await generateUniqueTicketId();
              await doc.ref.update({
                status: "VALIDATED",
                ticketId: uniqueTicketId,
                validatedAt: Date.now()
              });
              console.log(`[Firestore] Successfully completed reservation callback for ${doc.id} giving active Ticket ${uniqueTicketId}`);
            }
          }
        }
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("Critical failure during callback webhook processing:", error);
      res.status(500).send("Callback error");
    }
  });

  // Polling check endpoint for live client response updates
  app.get(["/api/flexpay/check-status/:ref", "/flexpay/check-status/:ref"], async (req, res) => {
    try {
      const { ref } = req.params;

      // Check MongoDB first
      try {
        const mongoRes = await MongoReservation.findOne({
          $or: [{ transactionId: ref }, { trackingRef: ref }]
        });
        if (mongoRes) {
          return res.json({
            found: true,
            validated: mongoRes.status === 'VALIDATED',
            ticketId: mongoRes.ticketId || null,
            transactionId: mongoRes.transactionId || null,
            status: mongoRes.status
          });
        }
      } catch (mErr) {}

      const reservationsCol = dbAdmin.collection("reservations");
      const querySnapshot = await reservationsCol.where("transactionId", "==", ref).get();

      if (querySnapshot.empty) {
        return res.json({ found: false, validated: false });
      }

      const docVal = querySnapshot.docs[0];
      const data = docVal.data();

      res.json({
        found: true,
        validated: data.status === "VALIDATED",
        ticketId: data.ticketId || null,
        transactionId: data.transactionId || null,
        status: data.status
      });
    } catch (error) {
      console.error("Error checking transaction reference state:", error);
      res.status(500).json({ error: "Internal check failed" });
    }
  });

  // Client Simulation Bypass endpoint for sandbox evaluation
  app.post(["/api/flexpay/simulate", "/flexpay/simulate"], async (req, res) => {
    try {
      const { trackingRef } = req.body;
      if (!trackingRef) {
        return res.status(400).json({ error: "trackingRef is required for sandbox simulation." });
      }

      // MongoDB update
      try {
        const mongoRes = await MongoReservation.findOne({
          $or: [{ transactionId: trackingRef }, { trackingRef: trackingRef }]
        });
        if (mongoRes) {
          if (mongoRes.status !== 'VALIDATED') {
            const uniqueTicketId = await generateUniqueTicketId();
            mongoRes.status = 'VALIDATED';
            mongoRes.ticketId = uniqueTicketId;
            mongoRes.validatedAt = new Date();
            await mongoRes.save();
            return res.json({ success: true, ticketId: uniqueTicketId });
          }
          return res.json({ success: true, ticketId: mongoRes.ticketId, alreadyValidated: true });
        }
      } catch (mErr) {}

      const reservationsCol = dbAdmin.collection("reservations");
      const querySnapshot = await reservationsCol.where("transactionId", "==", trackingRef).get();

      if (!querySnapshot.empty) {
        const docVal = querySnapshot.docs[0];
        const reservationData = docVal.data();
        
        if (reservationData.status !== "VALIDATED") {
          const uniqueTicketId = await generateUniqueTicketId();
          await docVal.ref.update({
            status: "VALIDATED",
            ticketId: uniqueTicketId,
            validatedAt: Date.now()
          });
          return res.json({ success: true, ticketId: uniqueTicketId });
        }
        return res.json({ success: true, ticketId: reservationData.ticketId, alreadyValidated: true });
      }

      res.status(404).json({ success: false, error: "Référence introuvable." });
    } catch (error) {
      console.error("Bypass callback simulation failed:", error);
      res.status(500).json({ error: "Simulation trigger failed" });
    }
  });

  // API for fetching some server-side config
  app.get(["/api/config", "/config"], (req, res) => {
    res.json({
      merchantPhone: "+243994286469",
      merchantName: "AMR MUGOTE & FRÈRES"
    });
  });

  // Diagnostic route for environment verification
  app.get(["/api/debug-env", "/debug-env"], (req, res) => {
    const key = process.env.GEMINI_API_KEY;
    res.json({
      hasKey: !!key,
      keyLength: key ? key.length : 0,
      keyStart: key ? key.substring(0, 4) : "none",
      nodeEnv: process.env.NODE_ENV || "development"
    });
  });

  // Endpoint to read/download SDD.md directly in the browser
  app.get(["/api/sdd", "/sdd"], (req, res) => {
    try {
      const sddPath = path.join(process.cwd(), "SDD.md");
      if (fs.existsSync(sddPath)) {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.sendFile(sddPath);
      }
      res.status(404).send("Document de Conception Système (SDD) introuvable.");
    } catch (err: any) {
      res.status(500).send("Erreur lors de la lecture du SDD: " + err.message);
    }
  });

  // Route de vérification Google Search Console
  app.get("/googlec0e88496e42691d5.html", (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send("google-site-verification: googlec0e88496e42691d5.html");
  });

  // Route pour sitemap.xml
  app.get("/sitemap.xml", (req, res) => {
    try {
      const publicPath = path.join(process.cwd(), "public", "sitemap.xml");
      const distPath = path.join(process.cwd(), "dist", "sitemap.xml");
      let xmlContent = "";
      if (fs.existsSync(publicPath)) {
        xmlContent = fs.readFileSync(publicPath, "utf-8");
      } else if (fs.existsSync(distPath)) {
        xmlContent = fs.readFileSync(distPath, "utf-8");
      } else {
        const baseUrl = "https://amr-mugote-et-ses-freres.vercel.app";
        const today = new Date().toISOString().split('T')[0];
        xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${baseUrl}/</loc>
        <lastmod>${today}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${baseUrl}/?page=booking</loc>
        <lastmod>${today}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.9</priority>
    </url>
    <url>
        <loc>${baseUrl}/?page=news</loc>
        <lastmod>${today}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${baseUrl}/?page=gallery</loc>
        <lastmod>${today}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>${baseUrl}/?page=map</loc>
        <lastmod>${today}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>
</urlset>`;
      }
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.send(xmlContent);
    } catch (err: any) {
      res.status(500).send("Erreur lors de la génération du sitemap: " + err.message);
    }
  });

  // Route pour robots.txt
  app.get("/robots.txt", (req, res) => {
    try {
      const publicPath = path.join(process.cwd(), "public", "robots.txt");
      const distPath = path.join(process.cwd(), "dist", "robots.txt");
      let textContent = "";
      if (fs.existsSync(publicPath)) {
        textContent = fs.readFileSync(publicPath, "utf-8");
      } else if (fs.existsSync(distPath)) {
        textContent = fs.readFileSync(distPath, "utf-8");
      } else {
        textContent = "User-agent: *\nAllow: /\n\nSitemap: https://amr-mugote-et-ses-freres.vercel.app/sitemap.xml";
      }
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(textContent);
    } catch (err: any) {
      res.status(500).send("Erreur lors de la lecture de robots.txt: " + err.message);
    }
  });

  return app;
}

export const app = createExpressApp();
export async function readyApp() {
  await connectMongoDB();
}

export default app;

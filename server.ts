import express from "express";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import admin from "firebase-admin";

const firebaseConfig = {
  projectId: "mugote2",
  databaseId: "ai-studio-020b031e-1447-4f1b-8ef0-ab4a23c0b6ab"
};

const adminApp = admin.apps.length ? admin.apps[0] : admin.initializeApp({
  projectId: firebaseConfig.projectId
});

const dbAdmin = adminApp.firestore();

async function generateUniqueTicketId(): Promise<string> {
  let uniqueTicketId = "";
  let isUnique = false;
  let attempts = 0;
  const reservationsCol = dbAdmin.collection("reservations");

  while (!isUnique && attempts < 15) {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    uniqueTicketId = `AMR-${randomHex}`;
    const qSnap = await reservationsCol.where("ticketId", "==", uniqueTicketId).get();
    if (qSnap.empty) {
      isUnique = true;
    }
    attempts++;
  }
  if (!uniqueTicketId) {
    uniqueTicketId = `AMR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
  return uniqueTicketId;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini AI Chat Proxy
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY is missing from environment variables");
        return res.status(500).json({ error: "Configuration de l'IA manquante." });
      }

      const client = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      console.log("Chat Request Message:", message);
      
      const messageStr = String(message || "").trim();
      const rawContents = [];
      const historyItems = history || [];
      
      for (const h of historyItems) {
        const text = String(h.text || h.message || "").trim();
        if (!text) continue; // Skip empty messages that crash Gemini
        
        // Match standard senderRole or role tags
        const rName = (h.role || h.senderRole || "").toString().toUpperCase();
        const role = (rName === 'AI' || rName === 'ADMIN' || rName === 'MODEL') ? 'model' : 'user';
        rawContents.push({ role, parts: [{ text }] });
      }

      // Add the current message if it's not already the last turn
      const lastHistoryMessage = rawContents.length > 0 ? rawContents[rawContents.length - 1].parts[0].text : "";
      if (lastHistoryMessage !== messageStr) {
        rawContents.push({ role: 'user', parts: [{ text: messageStr }] });
      }

      // Merge consecutive entries of the same role (e.g., user -> user or model -> model)
      // to comply with Gemini's strict alternation constraint.
      const contents = [];
      for (const item of rawContents) {
        if (contents.length > 0 && contents[contents.length - 1].role === item.role) {
          contents[contents.length - 1].parts[0].text += "\n" + item.parts[0].text;
        } else {
          contents.push(item);
        }
      }

      // Ensure the dialogue starts with a user turn
      while (contents.length > 0 && contents[0].role !== 'user') {
        contents.shift();
      }

      if (contents.length === 0) {
        contents.push({ role: 'user', parts: [{ text: messageStr }] });
      }

      const modelName = "gemini-3.5-flash";

      console.log("Using model:", modelName);
      
      const result = await client.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction: `Tu es l'assistant IA expert et officiel de "ETS AMR MUGOTE ET SES FRERES", la plateforme leader du transport lacustre sur le Lac Kivu en République Démocratique du Congo.
 Ta mission est d'accompagner les voyageurs dans chaque étape de leur expérience, du simple renseignement à la gestion de leurs billets.

CONTEXTE DE L'ENTREPRISE :
- Identité : ETS AMR MUGOTE ET SES FRERES (souvent appelé simplement "Mugote").
- Mission : Révolutionner le transport entre Bukavu et Goma par la sécurité, la technologie et le confort.
- Slogan : "Voyager en toute sécurité".
- Flotte : Nos navires emblématiques MUGOTE 1, MUGOTE 2 et MUGOTE 3. Ils sont inspectés quotidiennement et offrent des espaces VIP climatisés.

LOCALISATION PHARE (PORT AMR MUGOTE BUKAVU) :
- Pays/Province/Ville : RDC, Province du Sud-Kivu, Ville de Bukavu.
- Commune, Avenue, Quartier : Commune de Kadutu, Avenue Michombero, Quartier Nkafu.
- Points de repère : Situé en diagonale avec le célèbre marché Beach Muhanzi de Bukavu.
- Limites physiques du Port Mugote : Borné à l'EST par le marché Beach Muhanzi, et à l'OUEST par le port de l'ETS SILIMU.
- Onglet de Géolocalisation : Les voyageurs peuvent se rendre sur l'onglet "LOCALISATION" de la barre de navigation. Cela leur permet de voir leur position GPS en temps réel sur la carte interactive, d'évaluer le nombre de kilomètres restants jusqu'au port d'embarquement, et d'obtenir l'itinéraire.

FONCTIONNEMENT DE LA PLATEFORME (À EXPLIQUER AUX UTILISATEURS) :
1. RÉSERVATION : Les utilisateurs doivent aller dans l'onglet "RÉSERVER", choisir le sens (Bukavu->Goma ou Goma->Bukavu), la date, le bateau et leur classe.
2. PAIEMENT : Une fois les informations saisies, ils doivent effectuer le paiement via Mobile Money (Airtel, Orange, M-Pesa) au numéro officiel : +243 994 286 469 (Titulaire : AMR MUGOTE).
3. VALIDATION : Après paiement, ils saisissent l'ID de transaction. Un administrateur valide manuellement la transaction. Le billet n'est "ACTIF" qu'après cette validation.
4. BILLETS : Une fois validé, le billet apparaît avec un QR Code unique dans l'onglet "MES BILLETS". Ce QR Code est scanné à l'embarquement.

TARIFS ET HORAIRES (FIXES ET QUOTIDIENS) :
- VIP & 1ère CLASSE : 30$ environ.
- 2ème CLASSE : 17$.
- 3ème CLASSE : 10$.
- DÉPARTS : 07h30 et 11h00 (bukavu) / 09h00 et 14h00 (goma) - à vérifier selon le planning.

TON ET STYLE :
- Sois extrêmement COURTOIS et PROFESSIONNEL. Utilise le "Vous".
- Commence souvent par "Bienvenue à bord" ou "C'est un plaisir de vous aider".
- Réponds uniquement en FRANÇAIS.
- Ne mentionne jamais que tu es un modèle d'IA développé par Google. Tu es "Mugote AI Assistant".`
        }
      });
      
      console.log("Gemini API call successful");
      
      let responseText = "";
      try {
        if (result && result.text) {
          responseText = result.text;
        } else if (result && result.candidates?.[0]?.content?.parts?.[0]?.text) {
          responseText = result.candidates[0].content.parts[0].text;
        }
        
        if (!responseText) {
          console.warn("Empty response from Gemini API", JSON.stringify(result));
          responseText = "Désolé, je n'ai pas pu générer de réponse intelligible. Veuillez réessayer.";
        }
      } catch (extractError) {
        console.error("Text extraction failed:", extractError);
        responseText = "Désolé, une erreur interne est survenue lors du traitement de l'IA.";
      }

      console.log("Chat Response Text (first 50 chars):", responseText.substring(0, 50));
      res.json({ text: responseText });
    } catch (error: any) {
      console.error("Gemini Critical Error in /api/chat:", error);
      res.status(500).json({ error: error.message || "Désolé, l'assistant rencontre une erreur technique." });
    }
  });

  // API Route for Payment Verification (Simulated Legacy)
  app.post("/api/verify-payment", async (req, res) => {
    const { transactionId, phone, amount } = req.body;
    console.log(`Verifying payment for transaction ${transactionId} from ${phone} for ${amount} FC`);
    res.json({ status: "initiated", message: "Paiement en attente de validation administrative." });
  });

  // FlexPay CD Mobile Money PUSH Integration
  app.post("/api/flexpay/initialize", async (req, res) => {
    try {
      const { phone, amount, operator, reservationId } = req.body;
      if (!phone || !amount || !reservationId) {
        return res.status(400).json({ error: "Champs obligatoires manquants." });
      }

      // Format customer phone number for DRC standard (243XXXXXXXXX)
      const formattedPhone = phone.replace(/[\s\-\+]/g, "");
      const finalClientPhone = formattedPhone.startsWith("0") 
        ? "243" + formattedPhone.substring(1) 
        : formattedPhone.startsWith("243") 
          ? formattedPhone 
          : "243" + formattedPhone;
      
      const trackingRef = `AMR-FLX-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

      // Save tracking reference as the reservation's unique transactionId immediately
      try {
        const docRef = dbAdmin.collection("reservations").doc(reservationId);
        await docRef.update({
          transactionId: trackingRef,
          momoOperator: operator || "Airtel Money",
        });
        console.log(`Associated reservation ${reservationId} with tracking reference ${trackingRef}`);
      } catch (dbErr: any) {
        console.warn("Could not write initial tracking ref to Firestore reservation (non-blocking model design):", dbErr);
      }

      const apiToken = process.env.FLEXPAY_API_TOKEN;
      const merchantKey = process.env.FLEXPAY_MERCHANT_KEY;
      const recipientNumber = process.env.RECIPIENT_AIRTEL_NUMBER || "243994102673";

      if (!apiToken || !merchantKey) {
        console.log("FlexPay API keys missing or incomplete. Gracefully entering sandbox trial simulation.");
        return res.json({
          success: true,
          trackingRef,
          simulated: true,
          message: "Mode test d'évaluation activé. USSD Push simulé."
        });
      }

      // Prepare official FlexPay mobile gateway payload
      const flexpayUrl = "https://gateway.flexpay.cd/api/1.0/pay";
      const payload = {
        merchant: merchantKey,
        phone: finalClientPhone,
        amount: String(amount),
        currency: "USD",
        reference: trackingRef,
        callback: `${process.env.APP_URL || "https://mugote.com"}/api/flexpay/callback`,
        description: `Billet AMR MUGOTE - Crédite: ${recipientNumber}`
      };

      console.log("Posting payload to FlexPay gateway:", JSON.stringify(payload));

      const response = await fetch(flexpayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiToken}`
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json() as any;
      console.log("FlexPay gateway response status:", response.status, responseData);

      // FlexPay usually returns a status code of "0" inside for successfully queued USSD pushes
      if (response.ok && (responseData.code === "0" || responseData.code === 0 || responseData.status === "0" || responseData.success)) {
        res.json({
          success: true,
          trackingRef,
          simulated: false,
          flexpayData: responseData,
          message: "Votre transaction a été initiée. Veuillez saisir votre code secret sur le push USSD de votre téléphone."
        });
      } else {
        console.error("FlexPay API rejected transaction registration:", responseData);
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
  app.post("/api/flexpay/callback", async (req, res) => {
    try {
      console.log("FlexPay webhook callback triggered with body:", JSON.stringify(req.body));
      const { reference, status, code } = req.body;
      
      const referenceToUse = reference || req.body.ref || req.body.order_ref;
      const statusToUse = status !== undefined ? status : code;

      if (!referenceToUse) {
        return res.status(400).json({ error: "Le paramètre reference est obligatoire dans le callback." });
      }

      // Check if status represents a successful charge ("0", "SUCCESSFUL", "SUCCESS")
      const isSuccess = String(statusToUse).trim() === "0" || 
                        String(statusToUse).toUpperCase() === "SUCCESSFUL" || 
                        String(statusToUse).toUpperCase() === "SUCCESS" ||
                        String(statusToUse).toUpperCase() === "COMPLETED";

      if (isSuccess) {
        console.log(`FlexPay Callback confirms successful transaction reference: ${referenceToUse}`);

        // Update the reservation document to VALIDATED with a unique, cryptographically friendly ticket ID
        const reservationsCol = dbAdmin.collection("reservations");
        const querySnapshot = await reservationsCol.where("transactionId", "==", referenceToUse).get();

        if (!querySnapshot.empty) {
          for (const doc of querySnapshot.docs) {
            const reservationData = doc.data();
            if (reservationData.status !== "VALIDATED") {
              const uniqueTicketId = await generateUniqueTicketId();
              await doc.ref.update({
                status: "VALIDATED",
                ticketId: uniqueTicketId,
                validatedAt: Date.now()
              });
              console.log(`Successfully completed reservation callback for ${doc.id} giving active Ticket ${uniqueTicketId}`);
            }
          }
        } else {
          console.warn(`Callback reference mismatch. Unable to find reservation holding transactionId: ${referenceToUse}`);
        }
      } else {
        console.log(`FlexPay Callback reports a non-successful transaction state for reference: ${referenceToUse}`);
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("Critical failure during callback webhook processing:", error);
      res.status(500).send("Callback error");
    }
  });

  // Polling check endpoint for live client response updates
  app.get("/api/flexpay/check-status/:ref", async (req, res) => {
    try {
      const { ref } = req.params;
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
  app.post("/api/flexpay/simulate", async (req, res) => {
    try {
      const { trackingRef } = req.body;
      if (!trackingRef) {
        return res.status(400).json({ error: "trackingRef is required for sandbox simulation." });
      }

      console.log(`Simulating immediate payment confirmation for reference: ${trackingRef}`);

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
          console.log(`[BYPASS] Activated reservation ${docVal.id} with Ticket ${uniqueTicketId}`);
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

  // API for fetching some server-side config if needed
  app.get("/api/config", (req, res) => {
    res.json({
      merchantPhone: "+243994286469",
      merchantName: "AMR MUGOTE & FRÈRES"
    });
  });

  // Diagnostic route for environment verification (securely obfuscated)
  app.get("/api/debug-env", (req, res) => {
    const key = process.env.GEMINI_API_KEY;
    res.json({
      hasKey: !!key,
      keyLength: key ? key.length : 0,
      keyStart: key ? key.substring(0, 4) : "none",
      nodeEnv: process.env.NODE_ENV || "development"
    });
  });

  // Endpoint to read/download SDD.md directly in the browser
  app.get("/api/sdd", (req, res) => {
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

  app.get("/sdd", (req, res) => {
    res.redirect("/api/sdd");
  });

  // Route de vérification de site Google Search Console
  app.get("/googlec0e88496e42691d5.html", (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send("google-site-verification: googlec0e88496e42691d5.html");
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

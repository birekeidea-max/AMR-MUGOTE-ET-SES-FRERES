import express from "express";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      
      const contents = [];
      const historyItems = history || [];
      
      for (const h of historyItems) {
        const role = h.role === 'AI' ? 'model' : 'user';
        contents.push({ role, parts: [{ text: h.text || "" }] });
      }

      // Add the latest message if not already present in history
      const lastHistoryMessage = contents.length > 0 ? contents[contents.length - 1].parts[0].text : "";
      if (lastHistoryMessage !== message) {
        contents.push({ role: 'user', parts: [{ text: message }] });
      }

      // Ensure the first message is from 'user'
      while (contents.length > 0 && contents[0].role !== 'user') {
        contents.shift();
      }

      if (contents.length === 0) {
        contents.push({ role: 'user', parts: [{ text: message }] });
      }

      const modelName = "gemini-3-flash-preview";

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
      
      console.log("Gemini API raw result received");
      
      // Better extraction for the unified SDK
      let responseText = "Désolé, je n'ai pas pu générer de réponse pour le moment.";
      if (result.text) {
        responseText = result.text;
      } else if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        responseText = result.candidates[0].content.parts[0].text;
      }

      console.log("Chat Response Text (first 50 chars):", responseText.substring(0, 50));
      res.json({ text: responseText });
    } catch (error: any) {
      console.error("Gemini Critical Error:", error);
      res.status(500).json({ error: error.message || "Désolé, l'assistant rencontre une erreur technique." });
    }
  });

  // API Route for Payment Verification (Simulated)
  app.post("/api/verify-payment", async (req, res) => {
    const { transactionId, phone, amount } = req.body;
    // In a real app, we would call the Mobile Money API here.
    // For now, we simulate a successful initiation.
    console.log(`Verifying payment for transaction ${transactionId} from ${phone} for ${amount} FC`);
    res.json({ status: "initiated", message: "Paiement en attente de validation administrative." });
  });

  // API for fetching some server-side config if needed
  app.get("/api/config", (req, res) => {
    res.json({
      merchantPhone: "+243994286469",
      merchantName: "AMR MUGOTE & FRÈRES"
    });
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

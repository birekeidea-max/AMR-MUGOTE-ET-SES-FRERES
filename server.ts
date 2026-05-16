import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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

      if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is missing from environment variables");
        return res.status(500).json({ error: "AI configuration missing. Please check Settings > Secrets." });
      }

      console.log("Chat Request Message:", message);
      
      const contents = [
        ...(history || []).map((h: any) => ({
          role: h.role === 'AI' ? 'model' : 'user',
          parts: [{ text: h.text }]
        })),
        { role: 'user', parts: [{ text: message }] }
      ];

      const response = await ai.models.generateContent({ 
        model: "gemini-1.5-flash",
        contents,
        config: {
          systemInstruction: `Tu es l'assistant IA expert de ETS AMR MUGOTE ET SES FRERES, le leader du transport lacustre sur le Lac Kivu en RDC.
Ta mission est de fournir une assistance de classe mondiale aux voyageurs, avec courtoisie, précision et fierté.

CONTEXTE DE L'ENTREPRISE :
- Mission : Assurer un transport sécurisé, rapide et confortable entre Bukavu et Goma.
- Slogan : "Voyager en toute sécurité".
- Flotte d'élite : MUGOTE 1, MUGOTE 2, MUGOTE 3 (nos navires sont modernes, stables et équipés pour votre confort).

SERVICES DE LA PLATEFORME MUGOTE :
- Réservations en ligne : Les clients peuvent réserver leurs billets via cette plateforme web (onglet RÉSERVER).
- Billetterie Électronique : Après paiement, un administrateur valide le billet. Le client peut ensuite le voir dans l'onglet "BILLETS".
- Paiements Mobiles : Intégration avec Airtel Money, M-Pesa et Orange Money au +243 994 286 469. Le processus est semi-automatique (STK Push ou confirmation manuelle de l'ID de transaction).
- Journal de Bord : Un espace "JOURNAL" où nous publions des actualités, photos et vidéos.
- Flotte : Un onglet "FLOTTE" pour voir les images de nos bateaux.

TARIFICATION ET ITINÉRAIRES :
- Itinéraire : Bukavu <-> Goma.
- Classes : VIP (27$), 1ère Classe (27$), 2ème Classe (17$), 3ème Classe (10$).
- Horaires fixes (Quotidien) : 
  * Matin : Départ à 07h30.
  * Soir : Départ à 18h00 (Nocturne).
- Durée du voyage : Environ 2h30 à 3h selon les conditions.

CONSIGNES DE RÉPONSE :
1. Sois chaleureux et professionnel (utilise "Cher Passager", "Bienvenue chez Mugote").
2. Réponds exclusivement en FRANÇAIS.
3. Sois précis sur les horaires (7h30 et 18h00).
4. Support Client : En cas de litige ou besoin urgent, contacte le support : 0991717549 ou 0853129170.
5. Politique de remboursement : Possible jusqu'à 24h avant le départ, avec une retenue de 25%.
6. Tu es l'IA de Mugote, pas un modèle de Google.
7. Ne parle QUE de Mugote et du transport lacustre. Si on te demande autre chose, ramène poliment la conversation sur nos services.`,
        }
      });

      const responseText = response.text || "Je n'ai pas pu générer une réponse. Veuillez réessayer.";
      console.log("Chat Response Text:", responseText);
      res.json({ text: responseText });
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Désolé, l'assistant rencontre une erreur technique." });
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

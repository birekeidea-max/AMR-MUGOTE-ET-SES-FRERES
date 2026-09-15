import type { IncomingMessage, ServerResponse } from "http";
import app from "../server/app";
import { connectMongoDB } from "../server/db";

// Désactive le bodyParser par défaut de Vercel pour laisser Express gérer le stream des requêtes (JSON jusqu'à 50MB)
export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    // Garantit la réutilisation ou l'établissement de la connexion MongoDB Serverless Vercel
    await connectMongoDB();
  } catch (err: any) {
    console.error("[Vercel Serverless] Erreur de connexion MongoDB dans handler /api/index.ts:", err?.message || err);
  }

  // Enveloppe l'appel Express dans une Promise pour s'assurer que Vercel Serverless
  // n'interrompt pas prématurément le cycle de vie de la fonction avant que la réponse soit envoyée
  return new Promise<void>((resolve, reject) => {
    res.on("finish", () => resolve());
    res.on("close", () => resolve());
    res.on("error", (err) => {
      console.error("[Vercel Serverless] Erreur du stream de réponse:", err);
      reject(err);
    });

    app(req as any, res as any);
  });
}


import type { IncomingMessage, ServerResponse } from "http";
import app from "../server/app";
import { connectMongoDB } from "../server/db";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    // Garantit la réutilisation ou l'établissement de la connexion MongoDB Serverless Vercel
    await connectMongoDB();
  } catch (err: any) {
    console.error("[Vercel Serverless] Erreur de connexion MongoDB dans handler /api/index.ts:", err?.message || err);
  }
  return app(req as any, res as any);
}

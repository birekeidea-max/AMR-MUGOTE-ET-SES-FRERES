import type { IncomingMessage, ServerResponse } from "http";
import app, { readyApp } from "../server/app";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await readyApp();
  } catch (err) {
    console.warn("[Vercel Serverless] MongoDB pre-connection warning:", err);
  }
  return app(req, res);
}

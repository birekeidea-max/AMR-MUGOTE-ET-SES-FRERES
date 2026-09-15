import type { IncomingMessage, ServerResponse } from "http";
import app from "./app";
import { connectMongoDB } from "./db";

// Connect to MongoDB in background or reuse cached connection
connectMongoDB().catch((err) => {
  console.warn("[Vercel Handler] Initial MongoDB connection notice:", err?.message || err);
});

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req as any, res as any);
}

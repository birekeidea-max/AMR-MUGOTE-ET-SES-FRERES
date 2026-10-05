import express from "express";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import path from "path";
import { app, readyApp } from "./server/app";

// Prevent server crash from unhandled rejections or transient database network drops
process.on("unhandledRejection", (reason) => {
  console.warn("[Server] Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[Server] Uncaught exception:", err);
});

async function startServer() {
  // Parse command line port flags (--port 3000) or fallback to 3000
  let portArg = 3000;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--port" || args[i] === "-p") && args[i + 1]) {
      const parsed = parseInt(args[i + 1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        portArg = parsed;
      }
    }
  }

  const PORT = Number(process.env.PORT) || portArg || 3000;

  // Initialize DB connection in the background so HTTP server is immediately available
  readyApp().catch((err) => {
    console.warn("[Server] MongoDB initial connection notice:", err?.message || err);
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

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Express & Vite listening on http://0.0.0.0:${PORT}`);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[Server] Port ${PORT} currently in use. Retrying in 1.5 seconds...`);
      setTimeout(() => {
        server.close();
        server.listen(PORT, "0.0.0.0");
      }, 1500);
    } else {
      console.error("[Server] Server listener error:", err);
    }
  });

  // Graceful shutdown
  const shutdown = () => {
    server.close(() => {
      console.log("[Server] HTTP server stopped.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer().catch((err) => {
  console.error("[Server] Fatal error starting server:", err);
});


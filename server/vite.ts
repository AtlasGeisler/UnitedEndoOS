import type { Express } from "express";
import express from "express";
import path from "node:path";
import fs from "node:fs";

// In development the Express server runs Vite in middleware mode so the client
// and API share one port and one process. In production it serves the built
// assets from dist/public. The client is never exposed as a public static dir
// for protected data, only the Vite app shell and bundles.
export async function attachClient(app: Express, isProd: boolean) {
  if (isProd) {
    const dist = path.resolve(import.meta.dirname, "..", "dist", "public");
    app.use(express.static(dist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(dist, "index.html"));
    });
    return;
  }

  const { createServer } = await import("vite");
  const vite = await createServer({
    configFile: path.resolve(import.meta.dirname, "..", "vite.config.ts"),
    server: { middlewareMode: true },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.get("*", async (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    try {
      const templatePath = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );
      let template = fs.readFileSync(templatePath, "utf-8");
      template = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

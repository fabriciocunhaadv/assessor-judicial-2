import cors from "cors";
import express from "express";
import path from "node:path";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { adminRouter } from "./routes/admin.js";
import { agendaRouter } from "./routes/agenda.js";
import { audienciaRouter } from "./routes/audiencia.js";
import { chatRouter } from "./routes/chat.js";
import { gabineteRouter } from "./routes/gabinete.js";
import { lupaRouter } from "./routes/lupa.js";
import { minutasRouter } from "./routes/minutas.js";
import { miscRouter } from "./routes/misc.js";
import { pdfRouter } from "./routes/pdf.js";
import { pesquisaRouter } from "./routes/pesquisa.js";
import { precedentesRouter } from "./routes/precedentes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (!env.isProd) app.use(cors());
  app.use(express.json({ limit: "60mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // Tudo abaixo exige usuário autenticado (ID Token do Firebase) — inclusive o uso das chaves de IA.
  // Limite geral folgado (navegação carrega várias listas) e um limite próprio para chamadas que usam IA.
  app.use("/api", requireAuth, rateLimit({ windowMs: 60_000, max: 300 }));
  const limiteIA = rateLimit({ windowMs: 60_000, max: 20 });
  app.use("/api", miscRouter);
  app.use("/api/minutas", (req, res, next) => (req.method === "POST" ? limiteIA(req, res, next) : next()), minutasRouter);
  app.use("/api/lupa", limiteIA, lupaRouter);
  app.use("/api/audiencia", limiteIA, audienciaRouter);
  app.use("/api/chat", limiteIA, chatRouter);
  app.use("/api/pesquisa", limiteIA, pesquisaRouter);
  app.use("/api/pdf", pdfRouter);
  app.use("/api/precedentes", (req, res, next) => (req.path.startsWith("/importar") ? limiteIA(req, res, next) : next()), precedentesRouter);
  app.use("/api/gabinete", gabineteRouter);
  app.use("/api/agenda", agendaRouter);
  app.use("/api/admin", adminRouter);

  if (env.isProd) {
    const web = path.resolve(process.cwd(), "dist/web");
    app.use(express.static(web));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(web, "index.html")));
  }
  app.use(errorHandler);
  return app;
}

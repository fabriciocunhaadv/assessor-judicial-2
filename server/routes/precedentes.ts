import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../lib/httpError.js";
import { requirePermission } from "../middleware/requireRole.js";
import { importarPrecedentes } from "../pipelines/precedentsImport.js";
import { repo } from "../repositories/index.js";
import { extrairPdf } from "../services/pdfService.js";
import { rankPrecedentes } from "../services/precedentMatcher.js";
import { upload } from "./pdf.js";

export const precedentesRouter = Router();

precedentesRouter.get("/", requirePermission("precedentes:ler"), async (req, res) => {
  const tribunal = typeof req.query.tribunal === "string" ? req.query.tribunal : undefined;
  const todos = await repo().precedentes.listar(req.user!.tenantId);
  res.json(tribunal ? todos.filter((p) => p.tribunal === tribunal) : todos);
});

precedentesRouter.post("/buscar", requirePermission("precedentes:ler"), async (req, res) => {
  const { contexto } = z.object({ contexto: z.string().min(3) }).parse(req.body);
  res.json(rankPrecedentes(contexto, await repo().precedentes.listar(req.user!.tenantId), 30));
});

/** Importa PDF de informativo/caderno. Inclusão por merge: nada existente é apagado. */
precedentesRouter.post("/importar", requirePermission("precedentes:importar"), upload.single("arquivo"), async (req, res) => {
  if (!req.file) throw new HttpError(400, "Envie o PDF no campo 'arquivo'.");
  const { texto, paginas } = await extrairPdf(req.file.buffer);
  const r = await importarPrecedentes(req.user!, texto, req.file.originalname);
  const gravados = await repo().precedentes.incluir(req.user!.tenantId, r.itens);
  res.json({ paginas, blocos: r.blocos, blocosComFalha: r.blocosComFalha, indexados: gravados });
});

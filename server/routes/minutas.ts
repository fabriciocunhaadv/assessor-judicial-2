import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../middleware/requireRole.js";
import { gerarMinuta } from "../pipelines/minutePipeline.js";
import { repo } from "../repositories/index.js";

export const minutasRouter = Router();

const Body = z.object({
  autos: z.string().min(200, "Autos vazios ou ilegíveis."),
  paradigmaId: z.string().nullish(),
  instrucao: z.string().max(10_000).optional(),
  usarTeses: z.boolean().optional(),
});

minutasRouter.post("/", requirePermission("minuta:gerar"), async (req, res) => {
  const input = Body.parse(req.body);
  res.json(await gerarMinuta(req.user!, input));
});

minutasRouter.get("/", requirePermission("minuta:gerar"), async (req, res) => {
  res.json(await repo().minutas.listar(req.user!.tenantId, 50));
});

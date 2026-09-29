import { Router } from "express";
import { z } from "zod";
import { TIPOS_ATO } from "../../shared/gabinete.js";
import { HttpError } from "../lib/httpError.js";
import { requirePermission } from "../middleware/requireRole.js";
import { gerarMinuta } from "../pipelines/minutePipeline.js";
import { repo } from "../repositories/index.js";

export const minutasRouter = Router();

const Body = z.object({
  autos: z.string().min(200, "Autos vazios ou ilegíveis."),
  tipoAto: z.enum(TIPOS_ATO).default("auto"),
  unidadeId: z.string().nullish(),
  promptId: z.string().nullish(),
  paradigmaId: z.string().nullish(),
  instrucao: z.string().max(10_000).optional(),
  usarTeses: z.boolean().optional(),
});

minutasRouter.post("/", requirePermission("minuta:gerar"), async (req, res) => {
  const input = Body.parse(req.body);
  const lib = req.user!.unidadesLiberadas;
  if (input.unidadeId && lib.length && !lib.includes(input.unidadeId)) throw new HttpError(403, "Você não tem acesso a esta unidade judiciária.");
  res.json(await gerarMinuta(req.user!, input));
});

minutasRouter.get("/", requirePermission("minuta:gerar"), async (req, res) => {
  res.json(await repo().minutas.listar(req.user!.tenantId, 50));
});

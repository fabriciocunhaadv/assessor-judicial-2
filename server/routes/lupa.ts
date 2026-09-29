import { Router } from "express";
import { z } from "zod";
import { verificarFidelidade } from "../../shared/fidelity.js";
import { DiagnosticoAuditoria } from "../../shared/schemas.js";
import { AUDITOR_SYSTEM, auditorUser } from "../ai/prompts/auditor.js";
import { requirePermission } from "../middleware/requireRole.js";
import { generateValidated, schemaText } from "../services/llmJson.js";

export const lupaRouter = Router();

const Body = z.object({
  minuta: z.string().min(100),
  /** Autos integrais OU resumo executivo (mais econômico). */
  autos: z.string().min(100),
  /** Texto integral dos autos, quando disponível, para a checagem determinística de fidelidade. */
  autosIntegrais: z.string().optional(),
});

lupaRouter.post("/auditar", requirePermission("lupa:auditar"), async (req, res) => {
  const b = Body.parse(req.body);
  const divergencias = verificarFidelidade(b.minuta, b.autosIntegrais ?? b.autos);
  const alertas = divergencias.map((d) => `- ${d.tipo}: ${d.valor}`).join("\n");
  const { data, result } = await generateValidated(req.user!, "lupa", DiagnosticoAuditoria, {
    system: AUDITOR_SYSTEM,
    messages: [{ role: "user", content: auditorUser(b.minuta, b.autos, schemaText(DiagnosticoAuditoria), alertas) }],
    temperature: 0,
  });
  res.json({ diagnostico: data, divergenciasAutomaticas: divergencias, modelo: result.model });
});

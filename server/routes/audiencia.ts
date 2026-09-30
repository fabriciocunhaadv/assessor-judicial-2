import { Router } from "express";
import { z } from "zod";
import { PainelAudiencia } from "../../shared/schemas.js";
import { orchestrator } from "../ai/index.js";
import { HEARING_SYSTEM, TERMO_SYSTEM } from "../ai/prompts/hearing.js";
import { requirePermission } from "../middleware/requireRole.js";
import { generateValidated, schemaText } from "../services/llmJson.js";
import { registrarUso } from "../services/usage.js";

export const audienciaRouter = Router();

audienciaRouter.post("/painel", requirePermission("audiencia:usar"), async (req, res) => {
  const b = z.object({ autos: z.string().min(100), participantes: z.array(z.string()).default([]) }).parse(req.body);
  const { data } = await generateValidated(req.user!, "audiencia", PainelAudiencia, {
    system: HEARING_SYSTEM,
    documento: { rotulo: "autos", texto: b.autos },
    messages: [{ role: "user", content: `SCHEMA:\n${schemaText(PainelAudiencia)}\n\nParticipantes previstos: ${b.participantes.join("; ") || "não informados"}` }],
    esforco: "high",
  });
  res.json(data);
});

audienciaRouter.post("/termo", requirePermission("audiencia:usar"), async (req, res) => {
  const b = z.object({ anotacoes: z.string().min(20), cabecalho: z.string().default(""), tipo: z.enum(["instrucao", "conciliacao", "acordo"]) }).parse(req.body);
  const r = await orchestrator.generate({
    system: TERMO_SYSTEM,
    messages: [{ role: "user", content: `Tipo: ${b.tipo}\nCabeçalho do processo: ${b.cabecalho}\n\nAnotações do(a) magistrado(a):\n${b.anotacoes}` }],
    esforco: "medium",
    maxOutputTokens: 8_000,
  });
  await registrarUso(req.user!, "audiencia", r);
  res.json({ termo: r.text, modelo: r.model });
});

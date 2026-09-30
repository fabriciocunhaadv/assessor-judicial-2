import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { verificarFidelidade } from "../../shared/fidelity.js";
import { DiagnosticoAuditoria } from "../../shared/schemas.js";
import { AUDITOR_SYSTEM, auditorUser } from "../ai/prompts/auditor.js";
import { requirePermission } from "../middleware/requireRole.js";
import { repo } from "../repositories/index.js";
import { generateValidated, schemaText } from "../services/llmJson.js";

export const lupaRouter = Router();

const Body = z.object({
  minuta: z.string().min(100),
  /** Autos integrais OU resumo executivo (mais econômico). */
  autos: z.string().min(100),
  /** Texto integral dos autos, quando disponível, para a checagem determinística de fidelidade. */
  autosIntegrais: z.string().optional(),
  promptId: z.string().nullish(),
  numeroProcesso: z.string().max(40).optional(),
  assessorNome: z.string().max(120).optional(),
  pontoAtencao: z.string().max(5_000).optional(),
});

/** Número CNJ no texto, se houver (para identificar a auditoria sem digitação). */
const CNJ = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/;

lupaRouter.post("/auditar", requirePermission("lupa:auditar"), async (req, res) => {
  const b = Body.parse(req.body);
  const divergencias = verificarFidelidade(b.minuta, b.autosIntegrais ?? b.autos);
  const alertas = divergencias.map((d) => `- ${d.tipo}: ${d.valor}`).join("\n");
  const t = req.user!.tenantId;
  const [diretriz, caderno] = await Promise.all([b.promptId ? repo().prompts.get(t, b.promptId) : Promise.resolve(null), repo().caderno.get(t)]);
  const { data, result } = await generateValidated(req.user!, "lupa", DiagnosticoAuditoria, {
    system: AUDITOR_SYSTEM,
    documento: { rotulo: "autos", texto: b.autos },
    messages: [{ role: "user", content: auditorUser(b.minuta, schemaText(DiagnosticoAuditoria), alertas, { diretriz, caderno: caderno?.texto, pontoAtencao: b.pontoAtencao }) }],
    esforco: "high",
  });

  const numeroProcesso = b.numeroProcesso?.trim() || (b.autosIntegrais ?? b.autos).match(CNJ)?.[0] || b.minuta.match(CNJ)?.[0] || "n/i";
  const pendencias = data.adstricao.citraPetita.length + data.adstricao.extraPetita.length + data.adstricao.ultraPetita.length + data.alucinacoes.length + divergencias.length;
  const id = randomUUID();
  await repo().auditorias.registrar(t, { id, numeroProcesso, assessorNome: b.assessorNome?.trim() ?? "", nota: data.nota, pendencias, criadoPor: req.user!.uid, criadoEm: Date.now(), diagnostico: { ...data, divergenciasAutomaticas: divergencias } });
  res.json({ id, numeroProcesso, diagnostico: data, divergenciasAutomaticas: divergencias, modelo: result.model });
});

lupaRouter.get("/auditorias", requirePermission("lupa:auditar"), async (req, res) => {
  res.json(await repo().auditorias.listar(req.user!.tenantId, 100));
});

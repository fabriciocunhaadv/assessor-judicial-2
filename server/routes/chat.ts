import { Router } from "express";
import { z } from "zod";
import { orchestrator } from "../ai/index.js";
import { chatSystem } from "../ai/prompts/chat.js";
import { requirePermission } from "../middleware/requireRole.js";
import { registrarUso } from "../services/usage.js";

export const chatRouter = Router();

const Body = z.object({
  resumoExecutivo: z.string().min(50),
  minutaAtual: z.string().min(50),
  historico: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(40).default([]),
  mensagem: z.string().min(2).max(5_000),
});

chatRouter.post("/", requirePermission("minuta:refinar"), async (req, res) => {
  const b = Body.parse(req.body);
  const r = await orchestrator.generate({
    system: chatSystem(b.resumoExecutivo, b.minutaAtual),
    // Só as últimas trocas: a minuta atual já carrega o estado acumulado.
    messages: [...b.historico.slice(-8), { role: "user", content: b.mensagem }],
    temperature: 0.2,
  });
  await registrarUso(req.user!, "chat", r);
  res.json({ resposta: r.text, modelo: r.model, tokens: { entrada: r.inputTokens, saida: r.outputTokens } });
});

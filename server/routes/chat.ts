import { Router } from "express";
import { z } from "zod";
import { orchestrator } from "../ai/index.js";
import { CHAT_SYSTEM, chatUser } from "../ai/prompts/chat.js";
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
  // Só as últimas trocas: a minuta atual já carrega o estado acumulado. A conversa precisa começar pelo usuário.
  const historico = b.historico.slice(-8);
  if (historico[0]?.role === "assistant") historico.shift();
  const r = await orchestrator.generate({
    system: CHAT_SYSTEM,
    documento: { rotulo: "resumo_executivo_dos_autos", texto: b.resumoExecutivo, ttl: "1h" },
    messages: [...historico, { role: "user", content: chatUser(b.minutaAtual, b.mensagem) }],
    esforco: "medium",
  });
  await registrarUso(req.user!, "chat", r);
  res.json({ resposta: r.text, modelo: r.model, tokens: { entrada: r.inputTokens, saida: r.outputTokens, cacheLeitura: r.cacheLeitura } });
});

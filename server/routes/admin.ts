import { Router } from "express";
import { z } from "zod";
import { orchestrator } from "../ai/index.js";
import { env } from "../config/env.js";
import { requirePermission } from "../middleware/requireRole.js";
import { repo } from "../repositories/index.js";

export const adminRouter = Router();

/** Consumo de tokens e custo (USD e R$) rateado por funcionalidade, modelo e gabinete. */
adminRouter.get("/consumo", requirePermission("admin:custos"), async (req, res) => {
  const q = z.object({ dias: z.coerce.number().min(1).max(365).default(30), tenantId: z.string().optional() }).parse(req.query);
  const logs = await repo().uso.listar(Date.now() - q.dias * 86_400_000, q.tenantId);
  const agrupar = (chave: (l: (typeof logs)[number]) => string) => {
    const m = new Map<string, { chamadas: number; entrada: number; saida: number; usd: number; brl: number }>();
    for (const l of logs) {
      const k = chave(l);
      const a = m.get(k) ?? { chamadas: 0, entrada: 0, saida: 0, usd: 0, brl: 0 };
      a.chamadas++; a.entrada += l.inputTokens; a.saida += l.outputTokens; a.usd += l.usd; a.brl = a.usd * env.usdBrl;
      m.set(k, a);
    }
    return Object.fromEntries(m);
  };
  const usd = logs.reduce((s, l) => s + l.usd, 0);
  res.json({
    periodoDias: q.dias,
    cotacaoUsdBrl: env.usdBrl,
    total: { chamadas: logs.length, usd, brl: usd * env.usdBrl },
    porFuncionalidade: agrupar((l) => l.funcionalidade),
    porModelo: agrupar((l) => `${l.provider}/${l.model}`),
    porGabinete: agrupar((l) => l.tenantId),
    modelosSemPreco: Array.from(new Set(logs.filter((l) => !l.tabelado).map((l) => l.model))),
  });
});

adminRouter.get("/motor", requirePermission("admin:custos"), (_req, res) => {
  res.json({ cascata: orchestrator.configured() });
});

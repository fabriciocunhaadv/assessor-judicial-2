import { Router } from "express";
import { z } from "zod";
import { normalizeRole } from "../../shared/roles.js";
import { orchestrator } from "../ai/index.js";
import { env } from "../config/env.js";
import { HttpError } from "../lib/httpError.js";
import { requirePermission } from "../middleware/requireRole.js";
import { repo } from "../repositories/index.js";

export const adminRouter = Router();

/** Indicadores do painel Super Admin. */
adminRouter.get("/resumo", requirePermission("admin:tenants"), async (_req, res) => {
  const [gabinetes, usuarios, minutas, comunicado] = await Promise.all([repo().gabinetes.listar(), repo().usuarios.listarTodos(), repo().minutas.contar(), repo().comunicados.get(null)]);
  res.json({
    gabinetes: { total: gabinetes.length, ativos: gabinetes.filter((g) => g.status !== "suspenso").length },
    usuarios: { total: usuarios.length, ativos: usuarios.filter((u) => u.ativo !== false).length },
    minutas,
    comunicadoAtivo: !!comunicado?.ativo,
  });
});

adminRouter.get("/gabinetes", requirePermission("admin:tenants"), async (_req, res) => {
  const [gabinetes, usuarios] = await Promise.all([repo().gabinetes.listar(), repo().usuarios.listarTodos()]);
  res.json(gabinetes.map((g) => ({ ...g, membros: usuarios.filter((u) => u.tenantId === g.id).length })));
});

adminRouter.put("/gabinetes/:id", requirePermission("admin:tenants"), async (req, res) => {
  const idGab = String(req.params.id);
  if (!/^[a-z0-9_-]{3,60}$/.test(idGab)) throw new HttpError(400, "Identificador do gabinete: 3 a 60 letras minúsculas, números, _ ou -.");
  const b = z.object({ nome: z.string().min(3), juizTitular: z.string().default(""), status: z.enum(["ativo", "suspenso"]).default("ativo") }).parse(req.body);
  const atual = await repo().gabinetes.get(idGab);
  const g = { id: idGab, ...b, criadoEm: atual?.criadoEm ?? Date.now() };
  await repo().gabinetes.salvar(g);
  res.json(g);
});

adminRouter.get("/usuarios", requirePermission("admin:tenants"), async (_req, res) => {
  res.json(await repo().usuarios.listarTodos());
});

/** Super Admin: muda papel, gabinete ou status de qualquer usuário (merge; nada é apagado). */
adminRouter.patch("/usuarios/:uid", requirePermission("admin:tenants"), async (req, res) => {
  const b = z.object({ role: z.string().optional(), tenantId: z.string().optional(), ativo: z.boolean().optional() }).parse(req.body);
  const uid = String(req.params.uid);
  if (uid === req.user!.uid) throw new HttpError(400, "Não é possível alterar o próprio acesso.");
  const u = await repo().usuarios.get(uid);
  if (!u) throw new HttpError(404, "Usuário não encontrado.");
  if (b.tenantId && !(await repo().gabinetes.get(b.tenantId))) throw new HttpError(400, "Gabinete inexistente.");
  await repo().usuarios.salvar({ ...u, ...(b.role ? { role: normalizeRole(b.role) } : {}), ...(b.tenantId ? { tenantId: b.tenantId, unidadesLiberadas: [] } : {}), ...(b.ativo !== undefined ? { ativo: b.ativo } : {}) });
  res.json({ ok: true });
});

/** Comunicado global exibido a todos os usuários. */
adminRouter.put("/comunicado", requirePermission("admin:tenants"), async (req, res) => {
  const b = z.object({ texto: z.string().max(1000), nivel: z.enum(["info", "alerta"]).default("info"), ativo: z.boolean() }).parse(req.body);
  const c = { ...b, atualizadoPor: req.user!.uid, atualizadoEm: Date.now() };
  await repo().comunicados.salvar(null, c);
  res.json(c);
});

/** Consumo de tokens e custo (USD e R$) rateado por funcionalidade, modelo e gabinete. */
adminRouter.get("/consumo", requirePermission("admin:custos"), async (req, res) => {
  const q = z.object({ dias: z.coerce.number().min(1).max(365).default(30), tenantId: z.string().optional() }).parse(req.query);
  const logs = await repo().uso.listar(Date.now() - q.dias * 86_400_000, q.tenantId);
  const agrupar = (chave: (l: (typeof logs)[number]) => string) => {
    const m = new Map<string, { chamadas: number; entrada: number; saida: number; cacheLeitura: number; usd: number; brl: number }>();
    for (const l of logs) {
      const k = chave(l);
      const a = m.get(k) ?? { chamadas: 0, entrada: 0, saida: 0, cacheLeitura: 0, usd: 0, brl: 0 };
      a.chamadas++; a.entrada += l.inputTokens; a.saida += l.outputTokens; a.cacheLeitura += l.cacheLeitura ?? 0; a.usd += l.usd; a.brl = a.usd * env.usdBrl;
      m.set(k, a);
    }
    return Object.fromEntries(m);
  };
  const usd = logs.reduce((s, l) => s + l.usd, 0);
  const economiaUsd = logs.reduce((s, l) => s + (l.economiaUsd ?? 0), 0);
  const buscasWeb = logs.reduce((s, l) => s + (l.buscasWeb ?? 0), 0);
  res.json({
    periodoDias: q.dias,
    cotacaoUsdBrl: env.usdBrl,
    total: { chamadas: logs.length, usd, brl: usd * env.usdBrl, economiaCacheUsd: economiaUsd, economiaCacheBrl: economiaUsd * env.usdBrl, buscasWeb },
    porFuncionalidade: agrupar((l) => l.funcionalidade),
    porModelo: agrupar((l) => `${l.provider}/${l.model}`),
    porGabinete: agrupar((l) => l.tenantId),
    modelosSemPreco: Array.from(new Set(logs.filter((l) => !l.tabelado).map((l) => l.model))),
  });
});

adminRouter.get("/motor", requirePermission("admin:custos"), (_req, res) => {
  res.json({ cascata: orchestrator.configured() });
});

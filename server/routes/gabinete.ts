import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { normalizeRole, roleRank } from "../../shared/roles.js";
import { HttpError } from "../lib/httpError.js";
import { requirePermission } from "../middleware/requireRole.js";
import { repo } from "../repositories/index.js";

/**
 * Teses, paradigmas e equipe do gabinete.
 * Não há endpoints de reset/seed. Edição = merge + versão anterior preservada em histórico.
 * Exclusão lógica: `ativa: false`.
 */
export const gabineteRouter = Router();

gabineteRouter.get("/teses", requirePermission("minuta:gerar"), async (req, res) => {
  res.json(await repo().teses.listar(req.user!.tenantId));
});

gabineteRouter.put("/teses{/:id}", requirePermission("gabinete:teses_editar"), async (req, res) => {
  const b = z.object({ titulo: z.string().min(3), texto: z.string().min(10), ativa: z.boolean().default(true) }).parse(req.body);
  const tese = { id: (req.params.id as string | undefined) ?? randomUUID(), ...b, atualizadoPor: req.user!.uid, atualizadoEm: Date.now() };
  await repo().teses.salvar(req.user!.tenantId, tese);
  res.json(tese);
});

gabineteRouter.get("/paradigmas", requirePermission("minuta:gerar"), async (req, res) => {
  res.json(await repo().paradigmas.listar(req.user!.tenantId));
});

gabineteRouter.put("/paradigmas{/:id}", requirePermission("gabinete:paradigmas_editar"), async (req, res) => {
  const b = z.object({ titulo: z.string().min(3), tipoAto: z.string().min(3), texto: z.string().min(200) }).parse(req.body);
  const p = { id: (req.params.id as string | undefined) ?? randomUUID(), ...b, atualizadoPor: req.user!.uid, atualizadoEm: Date.now() };
  await repo().paradigmas.salvar(req.user!.tenantId, p);
  res.json(p);
});

gabineteRouter.get("/equipe", requirePermission("gabinete:equipe_gerenciar"), async (req, res) => {
  res.json(await repo().usuarios.listarDoGabinete(req.user!.tenantId));
});

/** O Juiz Titular gerencia a própria equipe; ninguém concede papel igual ou superior ao seu (exceto super admin). */
gabineteRouter.put("/equipe/:uid", requirePermission("gabinete:equipe_gerenciar"), async (req, res) => {
  const b = z.object({ email: z.string().email(), nome: z.string().min(2), role: z.string(), ativo: z.boolean().default(true) }).parse(req.body);
  const uid = String(req.params.uid);
  const alvo = normalizeRole(b.role);
  const eu = req.user!;
  if (eu.role !== "super_admin" && roleRank(alvo) >= roleRank(eu.role)) throw new HttpError(403, "Não é possível conceder papel igual ou superior ao seu.");
  if (uid === eu.uid) throw new HttpError(400, "Não é possível alterar o próprio papel.");
  const existente = await repo().usuarios.get(uid);
  if (existente && existente.tenantId !== eu.tenantId && eu.role !== "super_admin") throw new HttpError(403, "Usuário pertence a outro gabinete.");
  await repo().usuarios.salvar({ uid, email: b.email.toLowerCase(), nome: b.nome, role: alvo, tenantId: existente?.tenantId ?? eu.tenantId, ativo: b.ativo });
  res.json({ ok: true });
});

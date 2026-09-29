import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { AREAS } from "../../shared/gabinete.js";
import { normalizeRole, roleRank, type Role } from "../../shared/roles.js";
import { HttpError } from "../lib/httpError.js";
import { requirePermission } from "../middleware/requireRole.js";
import { repo } from "../repositories/index.js";

/**
 * Teses, paradigmas, prompts por área, lotações, equipe, convites e avisos do gabinete.
 * Não há endpoints de reset/seed. Edição = merge (+ versão anterior em histórico no Firestore).
 * Exclusão lógica (`ativa`/`ativo: false`), exceto convites pendentes, que podem ser revogados.
 */
export const gabineteRouter = Router();
const id = (req: { params: Record<string, unknown> }) => (req.params.id as string | undefined) ?? randomUUID();

// ───────── Teses ─────────
gabineteRouter.get("/teses", requirePermission("minuta:gerar"), async (req, res) => {
  res.json(await repo().teses.listar(req.user!.tenantId));
});
gabineteRouter.put("/teses{/:id}", requirePermission("gabinete:teses_editar"), async (req, res) => {
  const b = z.object({ titulo: z.string().min(3), texto: z.string().min(10), ativa: z.boolean().default(true) }).parse(req.body);
  const tese = { id: id(req), ...b, atualizadoPor: req.user!.uid, atualizadoEm: Date.now() };
  await repo().teses.salvar(req.user!.tenantId, tese);
  res.json(tese);
});

// ───────── Paradigmas ─────────
gabineteRouter.get("/paradigmas", requirePermission("minuta:gerar"), async (req, res) => {
  res.json(await repo().paradigmas.listar(req.user!.tenantId));
});
gabineteRouter.put("/paradigmas{/:id}", requirePermission("gabinete:paradigmas_editar"), async (req, res) => {
  const b = z.object({ titulo: z.string().min(3), tipoAto: z.string().min(3), texto: z.string().min(200) }).parse(req.body);
  const p = { id: id(req), ...b, atualizadoPor: req.user!.uid, atualizadoEm: Date.now() };
  await repo().paradigmas.salvar(req.user!.tenantId, p);
  res.json(p);
});

// ───────── Prompts por área ─────────
gabineteRouter.get("/prompts", requirePermission("minuta:gerar"), async (req, res) => {
  res.json(await repo().prompts.listar(req.user!.tenantId));
});
gabineteRouter.put("/prompts{/:id}", requirePermission("gabinete:teses_editar"), async (req, res) => {
  const b = z.object({ titulo: z.string().min(3), area: z.enum(AREAS), texto: z.string().min(20).max(30_000), ativo: z.boolean().default(true) }).parse(req.body);
  const p = { id: id(req), ...b, atualizadoPor: req.user!.uid, atualizadoEm: Date.now() };
  await repo().prompts.salvar(req.user!.tenantId, p);
  res.json(p);
});

// ───────── Lotações / unidades judiciárias ─────────
gabineteRouter.get("/unidades", async (req, res) => {
  const todas = (await repo().unidades.listar(req.user!.tenantId)).filter((u) => u.ativa !== false);
  const lib = req.user!.unidadesLiberadas;
  res.json(lib.length ? todas.filter((u) => lib.includes(u.id)) : todas);
});
gabineteRouter.get("/unidades/todas", requirePermission("gabinete:equipe_gerenciar"), async (req, res) => {
  res.json(await repo().unidades.listar(req.user!.tenantId));
});
gabineteRouter.put("/unidades{/:id}", requirePermission("gabinete:equipe_gerenciar"), async (req, res) => {
  const b = z.object({ nome: z.string().min(3), comarca: z.string().min(2), competencia: z.enum(AREAS), ativa: z.boolean().default(true) }).parse(req.body);
  const u = { id: id(req), ...b };
  await repo().unidades.salvar(req.user!.tenantId, u);
  res.json(u);
});

// ───────── Equipe e convites ─────────
/** Ninguém concede papel igual ou superior ao próprio (exceto super admin). */
function checarPapel(eu: Role, alvo: Role) {
  if (eu !== "super_admin" && roleRank(alvo) >= roleRank(eu)) throw new HttpError(403, "Não é possível conceder papel igual ou superior ao seu.");
}

gabineteRouter.get("/equipe", requirePermission("gabinete:equipe_gerenciar"), async (req, res) => {
  const [membros, convites] = await Promise.all([repo().usuarios.listarDoGabinete(req.user!.tenantId), repo().convites.listarDoGabinete(req.user!.tenantId)]);
  res.json({ membros, convites });
});

gabineteRouter.post("/convites", requirePermission("gabinete:equipe_gerenciar"), async (req, res) => {
  const b = z.object({ email: z.string().email(), nome: z.string().default(""), role: z.string(), unidadesLiberadas: z.array(z.string()).default([]) }).parse(req.body);
  const alvo = normalizeRole(b.role);
  checarPapel(req.user!.role, alvo);
  const email = b.email.trim().toLowerCase();
  const jaMembro = (await repo().usuarios.listarTodos()).find((u) => u.email.toLowerCase() === email);
  if (jaMembro) throw new HttpError(409, jaMembro.tenantId === req.user!.tenantId ? "Este e-mail já é membro do gabinete." : "Este e-mail já pertence a outro gabinete. Peça ao Super Admin para transferi-lo.");
  const convite = { email, nome: b.nome, role: alvo, tenantId: req.user!.tenantId, unidadesLiberadas: b.unidadesLiberadas, convidadoPor: req.user!.uid, criadoEm: Date.now() };
  await repo().convites.salvar(convite);
  res.json(convite);
});

gabineteRouter.delete("/convites/:email", requirePermission("gabinete:equipe_gerenciar"), async (req, res) => {
  const c = await repo().convites.get(String(req.params.email));
  if (!c || (c.tenantId !== req.user!.tenantId && req.user!.role !== "super_admin")) throw new HttpError(404, "Convite não encontrado.");
  await repo().convites.remover(c.email);
  res.json({ ok: true });
});

gabineteRouter.patch("/equipe/:uid", requirePermission("gabinete:equipe_gerenciar"), async (req, res) => {
  const b = z.object({ role: z.string().optional(), ativo: z.boolean().optional(), unidadesLiberadas: z.array(z.string()).optional() }).parse(req.body);
  const uid = String(req.params.uid);
  const eu = req.user!;
  if (uid === eu.uid) throw new HttpError(400, "Não é possível alterar o próprio acesso.");
  const u = await repo().usuarios.get(uid);
  if (!u || (u.tenantId !== eu.tenantId && eu.role !== "super_admin")) throw new HttpError(404, "Membro não encontrado.");
  checarPapel(eu.role, normalizeRole(u.role)); // não mexe em quem está acima ou no mesmo nível
  const role = b.role ? normalizeRole(b.role) : undefined;
  if (role) checarPapel(eu.role, role);
  await repo().usuarios.salvar({ ...u, ...(role ? { role } : {}), ...(b.ativo !== undefined ? { ativo: b.ativo } : {}), ...(b.unidadesLiberadas ? { unidadesLiberadas: b.unidadesLiberadas } : {}) });
  res.json({ ok: true });
});

// ───────── Aviso do gabinete ─────────
gabineteRouter.put("/aviso", requirePermission("gabinete:equipe_gerenciar"), async (req, res) => {
  const b = z.object({ texto: z.string().max(1000), nivel: z.enum(["info", "alerta"]).default("info"), ativo: z.boolean() }).parse(req.body);
  const c = { ...b, atualizadoPor: req.user!.uid, atualizadoEm: Date.now() };
  await repo().comunicados.salvar(req.user!.tenantId, c);
  res.json(c);
});

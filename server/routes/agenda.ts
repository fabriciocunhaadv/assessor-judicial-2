import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../lib/httpError.js";
import { requirePermission } from "../middleware/requireRole.js";
import { repo } from "../repositories/index.js";

/** Agenda de prazos, audiências e diligências do gabinete. */
export const agendaRouter = Router();
const DATA = /^\d{4}-\d{2}-\d{2}$/;

agendaRouter.get("/", requirePermission("minuta:gerar"), async (req, res) => {
  const q = z.object({ de: z.string().regex(DATA), ate: z.string().regex(DATA) }).parse(req.query);
  const itens = await repo().agenda.listar(req.user!.tenantId, q.de, q.ate);
  res.json(itens.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)));
});

const Evento = z.object({
  titulo: z.string().min(3).max(200),
  tipo: z.enum(["prazo", "audiencia", "diligencia", "outro"]),
  data: z.string().regex(DATA),
  hora: z.string().regex(/^(\d{2}:\d{2})?$/).default(""),
  processo: z.string().max(40).default(""),
  responsavel: z.string().max(120).default(""),
  unidadeId: z.string().max(80).default(""),
  observacao: z.string().max(2000).default(""),
  concluido: z.boolean().default(false),
});

agendaRouter.put("{/:id}", requirePermission("minuta:gerar"), async (req, res) => {
  const b = Evento.parse(req.body);
  const id = (req.params.id as string | undefined) ?? randomUUID();
  const atual = req.params.id ? await repo().agenda.get(req.user!.tenantId, id) : null;
  if (req.params.id && !atual) throw new HttpError(404, "Compromisso não encontrado.");
  const e = { ...b, id, criadoPor: atual?.criadoPor ?? req.user!.uid, criadoEm: atual?.criadoEm ?? Date.now() };
  await repo().agenda.salvar(req.user!.tenantId, e);
  res.json(e);
});

/** Exclusão só por ação explícita do usuário na tela (com confirmação). */
agendaRouter.delete("/:id", requirePermission("minuta:gerar"), async (req, res) => {
  const id = String(req.params.id);
  if (!(await repo().agenda.get(req.user!.tenantId, id))) throw new HttpError(404, "Compromisso não encontrado.");
  await repo().agenda.remover(req.user!.tenantId, id);
  res.json({ ok: true });
});

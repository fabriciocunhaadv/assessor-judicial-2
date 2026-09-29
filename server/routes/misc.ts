import { Router } from "express";
import { z } from "zod";
import { calcularConsectarios } from "../../shared/consectarios.js";
import { permissionsOf } from "../../shared/roles.js";
import { repo } from "../repositories/index.js";

export const miscRouter = Router();

miscRouter.get("/me", async (req, res) => {
  const gabinete = await repo().gabinetes.get(req.user!.tenantId);
  res.json({ ...req.user, gabineteNome: gabinete?.nome ?? req.user!.tenantId, permissoes: [...permissionsOf(req.user!.role)] });
});

/** Comunicado global (Super Admin) e aviso do gabinete, quando ativos. */
miscRouter.get("/comunicados", async (req, res) => {
  const [global, gabinete] = await Promise.all([repo().comunicados.get(null), repo().comunicados.get(req.user!.tenantId)]);
  res.json({ global: global?.ativo ? global : null, gabinete: gabinete?.ativo ? gabinete : null });
});

const Serie = z.array(z.object({ competencia: z.string().regex(/^\d{4}-\d{2}$/), percentual: z.number() }));
miscRouter.post("/consectarios/calcular", (req, res) => {
  const b = z
    .object({ principal: z.number().nonnegative(), inicioCorrecao: z.string(), inicioJuros: z.string(), fim: z.string(), ipca: Serie, selic: Serie })
    .parse(req.body);
  res.json(calcularConsectarios(b));
});

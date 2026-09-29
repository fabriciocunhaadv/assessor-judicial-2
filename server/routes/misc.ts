import { Router } from "express";
import { z } from "zod";
import { calcularConsectarios } from "../../shared/consectarios.js";
import { permissionsOf } from "../../shared/roles.js";

export const miscRouter = Router();

miscRouter.get("/me", (req, res) => {
  res.json({ ...req.user, permissoes: [...permissionsOf(req.user!.role)] });
});

const Serie = z.array(z.object({ competencia: z.string().regex(/^\d{4}-\d{2}$/), percentual: z.number() }));
miscRouter.post("/consectarios/calcular", (req, res) => {
  const b = z
    .object({ principal: z.number().nonnegative(), inicioCorrecao: z.string(), inicioJuros: z.string(), fim: z.string(), ipca: Serie, selic: Serie })
    .parse(req.body);
  res.json(calcularConsectarios(b));
});

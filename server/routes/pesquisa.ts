import { Router } from "express";
import { z } from "zod";
import { orchestrator } from "../ai/index.js";
import { DOMINIOS_JURISPRUDENCIA, DOMINIOS_LEGISLACAO, PESQUISA_SYSTEM } from "../ai/prompts/pesquisa.js";
import { requirePermission } from "../middleware/requireRole.js";
import { registrarUso } from "../services/usage.js";

export const pesquisaRouter = Router();

const Body = z.object({
  consulta: z.string().trim().min(3).max(2_000),
  tipo: z.enum(["jurisprudencia", "legislacao"]).default("jurisprudencia"),
});

/** Pesquisa ao vivo com a busca na web do Claude, restrita a sites oficiais (STF, STJ, CJF, TJGO, Planalto…). */
pesquisaRouter.post("/", requirePermission("precedentes:ler"), async (req, res) => {
  const b = Body.parse(req.body);
  const r = await orchestrator.generate({
    system: PESQUISA_SYSTEM,
    messages: [{ role: "user", content: `${b.tipo === "legislacao" ? "Pesquise a legislação" : "Pesquise a jurisprudência"} sobre: ${b.consulta}` }],
    buscaWeb: { dominios: b.tipo === "legislacao" ? DOMINIOS_LEGISLACAO : DOMINIOS_JURISPRUDENCIA, maxUsos: 5 },
    esforco: "medium",
    maxOutputTokens: 8_000,
  });
  await registrarUso(req.user!, "pesquisa", r);
  res.json({ resposta: r.text, fontes: r.fontes ?? [], buscas: r.buscasWeb, modelo: r.model });
});

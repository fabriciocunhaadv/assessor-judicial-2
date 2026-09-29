import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AllProvidersFailedError } from "../ai/orchestrator.js";
import { HttpError } from "../lib/httpError.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ erro: err.message, detalhes: err.details });
  if (err instanceof ZodError) return res.status(400).json({ erro: "Requisição inválida.", detalhes: err.issues });
  if (err instanceof AllProvidersFailedError) {
    console.error("[motor de IA]", err.attempts);
    return res.status(503).json({ erro: "Motor de IA indisponível no momento (todos os modelos/chaves falharam). Tente novamente em instantes.", detalhes: err.attempts.slice(-5) });
  }
  console.error("[erro não tratado]", err);
  res.status(500).json({ erro: "Erro interno. A equipe técnica foi notificada." });
}

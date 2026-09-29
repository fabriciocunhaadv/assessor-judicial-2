import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/httpError.js";

/** Limite simples por usuário em janela deslizante (memória do processo). Para múltiplas instâncias, trocar por Redis. */
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.user?.uid ?? req.ip ?? "anon";
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return next(new HttpError(429, "Muitas requisições. Aguarde alguns instantes."));
    arr.push(now);
    hits.set(key, arr);
    next();
  };
}

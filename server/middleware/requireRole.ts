import type { NextFunction, Request, Response } from "express";
import { can, type Permission } from "../../shared/roles.js";
import { HttpError } from "../lib/httpError.js";

export const requirePermission = (permission: Permission) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(new HttpError(401, "Autenticação obrigatória."));
  if (!can(req.user.role, permission)) return next(new HttpError(403, `Permissão insuficiente (${permission}).`));
  next();
};

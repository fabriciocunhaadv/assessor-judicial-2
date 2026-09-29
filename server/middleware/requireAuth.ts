import type { NextFunction, Request, Response } from "express";
import { normalizeRole, type Role } from "../../shared/roles.js";
import { env } from "../config/env.js";
import { adminAuth } from "../lib/firebaseAdmin.js";
import { HttpError } from "../lib/httpError.js";
import { repo } from "../repositories/index.js";

export interface AuthUser {
  uid: string;
  email: string;
  nome: string;
  role: Role;
  tenantId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Valida o ID Token do Firebase Auth e carrega papel/gabinete do cadastro do usuário.
 * O papel NUNCA vem do cliente: é lido do Firestore (users/{uid}) pelo servidor.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    if (env.authDisabled && !env.isProd) {
      req.user = { uid: "dev", email: "dev@local", nome: "Desenvolvedor", role: "super_admin", tenantId: "gabinete_dev" };
      return next();
    }
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new HttpError(401, "Autenticação obrigatória.");

    const decoded = await adminAuth().verifyIdToken(token, true);
    const email = (decoded.email ?? "").toLowerCase();
    const perfil = await repo().usuarios.get(decoded.uid);

    if (!perfil && !env.superAdminEmails.includes(email)) {
      throw new HttpError(403, "Usuário sem cadastro em nenhum gabinete. Solicite convite ao Juiz Titular.");
    }
    if (perfil?.ativo === false) throw new HttpError(403, "Acesso suspenso.");

    req.user = {
      uid: decoded.uid,
      email,
      nome: perfil?.nome ?? decoded.name ?? email,
      role: env.superAdminEmails.includes(email) ? "super_admin" : normalizeRole(perfil?.role),
      tenantId: perfil?.tenantId ?? "sem_gabinete",
    };
    next();
  } catch (err) {
    if (err instanceof HttpError) return next(err);
    next(new HttpError(401, "Token inválido ou expirado."));
  }
}

import type { NextFunction, Request, Response } from "express";
import type { Role } from "../../shared/roles.js";
import { env } from "../config/env.js";
import { adminAuth } from "../lib/firebaseAdmin.js";
import { HttpError } from "../lib/httpError.js";
import { repo } from "../repositories/index.js";
import { resolverPerfil } from "../services/perfil.js";

export interface AuthUser {
  uid: string;
  email: string;
  nome: string;
  role: Role;
  tenantId: string;
  unidadesLiberadas: string[];
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
      req.user = { uid: "dev", email: "dev@local", nome: "Desenvolvedor", role: "super_admin", tenantId: "gabinete_dev", unidadesLiberadas: [] };
      return next();
    }
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new HttpError(401, "Autenticação obrigatória.");

    const decoded = await adminAuth().verifyIdToken(token, true);
    const email = (decoded.email ?? "").toLowerCase();
    const r = await resolverPerfil(repo(), decoded.uid, email, decoded.name ?? "", env.superAdminEmails);
    if (!r) throw new HttpError(403, "Seu e-mail ainda não foi convidado para nenhum gabinete. Peça o convite ao Juiz Titular.");
    const perfil = r.usuario;
    if (perfil?.ativo === false) throw new HttpError(403, "Acesso suspenso. Fale com o Juiz Titular do gabinete.");
    if (perfil && r.role !== "super_admin") {
      const g = await repo().gabinetes.get(perfil.tenantId);
      if (g?.status === "suspenso") throw new HttpError(403, "Este gabinete está suspenso. Fale com o administrador do sistema.");
    }

    req.user = {
      uid: decoded.uid,
      email,
      nome: perfil?.nome ?? decoded.name ?? email,
      role: r.role,
      tenantId: r.tenantId,
      unidadesLiberadas: perfil?.unidadesLiberadas ?? [],
    };
    next();
  } catch (err) {
    if (err instanceof HttpError) return next(err);
    next(new HttpError(401, "Token inválido ou expirado."));
  }
}

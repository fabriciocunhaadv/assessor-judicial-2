import { normalizeRole, type Role } from "../../shared/roles.js";
import type { Repositorio, Usuario } from "../repositories/types.js";

export interface PerfilResolvido {
  usuario: Usuario | null;
  role: Role;
  tenantId: string;
  ativado: boolean;
}

/**
 * Descobre o perfil de quem entrou. Se ainda não há cadastro mas existe convite para o e-mail,
 * o convite vira perfil (sem sobrescrever cadastro existente) e é consumido.
 */
export async function resolverPerfil(repo: Repositorio, uid: string, email: string, nome: string, superAdmins: string[]): Promise<PerfilResolvido | null> {
  const eSuper = superAdmins.includes(email);
  let usuario = await repo.usuarios.get(uid);
  let ativado = false;

  if (!usuario) {
    const convite = email ? await repo.convites.get(email) : null;
    if (convite) {
      usuario = { uid, email, nome: convite.nome || nome || email, role: normalizeRole(convite.role), tenantId: convite.tenantId, ativo: true, unidadesLiberadas: convite.unidadesLiberadas ?? [] };
      await repo.usuarios.salvar(usuario);
      await repo.convites.remover(email);
      ativado = true;
    }
  }
  if (!usuario && !eSuper) return null;
  return { usuario, role: eSuper ? "super_admin" : normalizeRole(usuario?.role), tenantId: usuario?.tenantId ?? "sem_gabinete", ativado };
}

/**
 * RBAC do gabinete. A hierarquia é cumulativa: cada papel herda as permissões dos inferiores.
 */
export const ROLES = ["estagiario", "assessor", "juiz_titular", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  estagiario: "Estagiário(a)",
  assessor: "Assessor(a)",
  juiz_titular: "Juiz(a) Titular",
  super_admin: "Super Admin",
};

export type Permission =
  | "minuta:gerar"
  | "minuta:refinar"
  | "minuta:exportar_final"
  | "lupa:auditar"
  | "audiencia:usar"
  | "precedentes:ler"
  | "precedentes:importar"
  | "gabinete:teses_editar"
  | "gabinete:paradigmas_editar"
  | "gabinete:equipe_gerenciar"
  | "admin:custos"
  | "admin:tenants";

const GRANTS: Record<Role, Permission[]> = {
  estagiario: ["minuta:gerar", "minuta:refinar", "precedentes:ler", "audiencia:usar"],
  assessor: ["minuta:exportar_final", "lupa:auditar", "precedentes:importar"],
  juiz_titular: ["gabinete:teses_editar", "gabinete:paradigmas_editar", "gabinete:equipe_gerenciar"],
  super_admin: ["admin:custos", "admin:tenants"],
};

export function roleRank(role: Role): number {
  return ROLES.indexOf(role);
}

export function permissionsOf(role: Role): Set<Permission> {
  const out = new Set<Permission>();
  for (const r of ROLES.slice(0, roleRank(role) + 1)) GRANTS[r].forEach((p) => out.add(p));
  return out;
}

export function can(role: Role, permission: Permission): boolean {
  return permissionsOf(role).has(permission);
}

/**
 * Normaliza papéis legados SEM reescrever o documento salvo (leitura retrocompatível).
 * Desconhecido → menor privilégio.
 */
export function normalizeRole(raw: unknown): Role {
  const v = String(raw ?? "").trim().toLowerCase();
  if ((ROLES as readonly string[]).includes(v)) return v as Role;
  if (["admin", "judge", "magistrado", "juiz"].includes(v)) return "juiz_titular";
  if (["user", "assessor(a)", "servidor"].includes(v)) return "assessor";
  if (["superadmin", "super-admin", "root"].includes(v)) return "super_admin";
  return "estagiario";
}

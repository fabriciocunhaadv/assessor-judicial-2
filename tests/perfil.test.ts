import { describe, expect, it } from "vitest";
import { createMemoryRepo } from "../server/repositories/memory";
import { resolverPerfil } from "../server/services/perfil";

describe("convite por e-mail", () => {
  it("vira perfil no primeiro login e é consumido", async () => {
    const r = createMemoryRepo();
    await r.convites.salvar({ email: "Assessora@Exemplo.com", nome: "Assessora", role: "assessor", tenantId: "gab_a", unidadesLiberadas: ["u1"], convidadoPor: "juiz", criadoEm: 1 });
    const p = await resolverPerfil(r, "uid1", "assessora@exemplo.com", "Nome Google", []);
    expect(p).toMatchObject({ role: "assessor", tenantId: "gab_a", ativado: true });
    expect((await r.usuarios.get("uid1"))?.unidadesLiberadas).toEqual(["u1"]);
    expect(await r.convites.get("assessora@exemplo.com")).toBeNull();
  });

  it("não sobrescreve cadastro existente com o convite", async () => {
    const r = createMemoryRepo();
    await r.usuarios.salvar({ uid: "uid1", email: "a@x.com", nome: "A", role: "juiz_titular", tenantId: "gab_a", ativo: true });
    await r.convites.salvar({ email: "a@x.com", nome: "", role: "estagiario", tenantId: "gab_b", unidadesLiberadas: [], convidadoPor: "x", criadoEm: 1 });
    const p = await resolverPerfil(r, "uid1", "a@x.com", "", []);
    expect(p).toMatchObject({ role: "juiz_titular", tenantId: "gab_a", ativado: false });
  });

  it("sem cadastro e sem convite: acesso negado; super admin por e-mail passa", async () => {
    const r = createMemoryRepo();
    expect(await resolverPerfil(r, "u", "x@y.com", "", [])).toBeNull();
    expect(await resolverPerfil(r, "u", "root@y.com", "", ["root@y.com"])).toMatchObject({ role: "super_admin" });
  });
});

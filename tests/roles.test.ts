import { describe, expect, it } from "vitest";
import { can, normalizeRole } from "../shared/roles";

describe("RBAC", () => {
  it("hierarquia cumulativa", () => {
    expect(can("estagiario", "minuta:gerar")).toBe(true);
    expect(can("estagiario", "minuta:exportar_final")).toBe(false);
    expect(can("assessor", "lupa:auditar")).toBe(true);
    expect(can("assessor", "gabinete:teses_editar")).toBe(false);
    expect(can("juiz_titular", "gabinete:teses_editar")).toBe(true);
    expect(can("juiz_titular", "admin:custos")).toBe(false);
    expect(can("super_admin", "admin:custos")).toBe(true);
  });

  it("normaliza papéis legados sem conceder privilégio a desconhecidos", () => {
    expect(normalizeRole("admin")).toBe("juiz_titular");
    expect(normalizeRole("user")).toBe("assessor");
    expect(normalizeRole("qualquer")).toBe("estagiario");
    expect(normalizeRole(undefined)).toBe("estagiario");
  });
});

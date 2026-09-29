import { describe, expect, it } from "vitest";
import { exigePisoDeParagrafos, REGRA_POR_ATO, TIPOS_ATO } from "../shared/gabinete";

describe("tipos de ato", () => {
  it("todo ato explícito tem regra de estrutura", () => {
    for (const t of TIPOS_ATO.filter((t) => t !== "auto")) expect(REGRA_POR_ATO[t as keyof typeof REGRA_POR_ATO]).toBeTruthy();
  });
  it("piso de 14 parágrafos só vale para sentença", () => {
    expect(exigePisoDeParagrafos("sentenca")).toBe(true);
    expect(exigePisoDeParagrafos("despacho")).toBe(false);
    expect(exigePisoDeParagrafos("decisao_interlocutoria")).toBe(false);
  });
});

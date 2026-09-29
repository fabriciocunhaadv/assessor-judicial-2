import { describe, expect, it } from "vitest";
import { calcularConsectarios, taxaLegalMensal } from "../shared/consectarios";

describe("consectários — Lei 14.905/2024", () => {
  it("taxa legal = Selic − IPCA, com piso zero (art. 406, § 3º)", () => {
    expect(taxaLegalMensal(1.0, 0.4)).toBeCloseTo(0.6);
    expect(taxaLegalMensal(0.3, 0.5)).toBe(0);
  });

  it("corrige pelo IPCA e aplica juros simples pela taxa legal a partir do termo inicial", () => {
    const r = calcularConsectarios({
      principal: 1000,
      inicioCorrecao: "2025-01",
      inicioJuros: "2025-02",
      fim: "2025-03",
      ipca: [{ competencia: "2025-01", percentual: 1 }, { competencia: "2025-02", percentual: 1 }, { competencia: "2025-03", percentual: 1 }],
      selic: [{ competencia: "2025-01", percentual: 1 }, { competencia: "2025-02", percentual: 1.5 }, { competencia: "2025-03", percentual: 0.5 }],
    });
    expect(r.valorCorrigido).toBeCloseTo(1030.3, 2); // 1000 × 1,01³
    // juros: fev 0,5% + mar 0% (Selic < IPCA) = 0,5% sobre o corrigido
    expect(r.juros).toBeCloseTo(5.15, 2);
    expect(r.total).toBeCloseTo(1035.45, 2);
  });

  it("interrompe (não estima) quando falta índice de alguma competência", () => {
    expect(() =>
      calcularConsectarios({ principal: 100, inicioCorrecao: "2025-01", inicioJuros: "2025-01", fim: "2025-02", ipca: [{ competencia: "2025-01", percentual: 1 }], selic: [{ competencia: "2025-01", percentual: 1 }] }),
    ).toThrow(/Índice ausente/);
  });
});

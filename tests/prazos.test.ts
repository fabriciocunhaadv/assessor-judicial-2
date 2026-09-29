import { describe, expect, it } from "vitest";
import { calcularPrazo } from "../shared/prazos";

describe("prazos processuais em dias úteis (CPC)", () => {
  it("exclui o dia do começo e pula o fim de semana", () => {
    // intimação sexta 05/09/2025; 5 dias úteis: 08, 09, 10, 11, 12 → vence 12/09
    const r = calcularPrazo("2025-09-05", 5);
    expect(r.inicioContagem).toBe("2025-09-08");
    expect(r.vencimento).toBe("2025-09-12");
  });

  it("não conta feriado nacional no curso do prazo", () => {
    // intimação 04/09/2025 (qui); 3 dias úteis: 05 (sex), 08 (seg), 09 (ter) — nenhum feriado; e com 07/09 no domingo nada muda
    expect(calcularPrazo("2025-09-04", 3).vencimento).toBe("2025-09-09");
    // intimação 10/10/2025 (sex); 12/10 é domingo e feriado; 1 dia útil → 13/10
    expect(calcularPrazo("2025-10-10", 1).vencimento).toBe("2025-10-13");
    // intimação 19/11/2025 (qua); 20/11 feriado; 1 dia útil → 21/11
    const r = calcularPrazo("2025-11-19", 1);
    expect(r.vencimento).toBe("2025-11-21");
    expect(r.ignorados.map((i) => i.data)).toContain("2025-11-20");
  });

  it("suspende no recesso de 20/12 a 20/01 (art. 220)", () => {
    // intimação 18/12/2025 (qui); 15 dias úteis: 19/12, depois 21/01 em diante
    const r = calcularPrazo("2025-12-18", 15);
    expect(r.inicioContagem).toBe("2025-12-19");
    // 19/12 = 1; 21/01 (qua)=2, 22=3, 23=4, 26=5, 27=6, 28=7, 29=8, 30=9, 02/02=10, 03=11, 04=12, 05=13, 06=14, 09=15
    expect(r.vencimento).toBe("2026-02-09");
  });

  it("respeita datas sem expediente informadas pelo usuário", () => {
    expect(calcularPrazo("2025-09-05", 5, ["2025-09-10"]).vencimento).toBe("2025-09-15");
  });

  it("dias corridos: conta todos os dias, mas vencimento em dia sem expediente prorroga", () => {
    // intimação 01/09/2025 (seg) + 5 corridos = 06/09 (sáb) → prorroga para 08/09
    expect(calcularPrazo("2025-09-01", 5, [], false).vencimento).toBe("2025-09-08");
  });

  it("rejeita datas inválidas", () => {
    expect(() => calcularPrazo("2025-02-30", 5)).toThrow(/inexistente/);
  });
});

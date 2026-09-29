import { describe, expect, it } from "vitest";
import { contarParagrafosDensos, verificarFidelidade } from "../shared/fidelity";

const autos = "Processo 5272040-93.2021.8.09.0115. Citação em 12/03/2022. Pedido de R$ 15.000,00. Telefone (62) 99999-1234.";

describe("fidelidade alfanumérica", () => {
  it("aceita dados que constam literalmente dos autos", () => {
    expect(verificarFidelidade("Nos autos 5272040-93.2021.8.09.0115, citado em 12/03/2022, condeno em R$ 15.000,00.", autos)).toEqual([]);
  });

  it("aponta número de processo, valor e data inventados", () => {
    const d = verificarFidelidade("Autos 5272040-93.2021.8.09.0116, citação em 13/03/2022, condeno em R$ 15.500,00.", autos);
    expect(d.map((x) => x.tipo).sort()).toEqual(["cnj", "data", "valor"]);
  });

  it("conta apenas parágrafos densos", () => {
    const denso = "x".repeat(300);
    expect(contarParagrafosDensos(`${denso}\n\ncurto\n\n${denso}`)).toBe(2);
  });
});

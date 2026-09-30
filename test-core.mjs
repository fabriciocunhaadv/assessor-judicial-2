import "./core.js";
const AJ = globalThis.AJ; let ok = 0, fail = 0;
const t = (n, c) => { if (c) ok++; else { fail++; console.log("FALHOU:", n); } };
const hdr = "PODER JUDICIÁRIO DO ESTADO DE GOIÁS";
const corpos = ["Trata-se de ação indenizatória em que o autor alega que o contrato foi", "celebrado mediante fraude.", "A ré contestou.", "Houve réplica."];
const out = AJ.cleanPages(corpos.map((c, i) => [hdr, c, "Documento assinado eletronicamente por FULANO", `Pág. ${i + 1} de 4`].join("\n")));
t("limpeza", !out.includes(hdr) && !out.includes("assinado") && out.includes("contrato foi ⟦Pág. 2⟧ celebrado"));
const autos = "Processo 5272040-93.2021.8.09.0115. Citação em 12/03/2022. R$ 15.000,00.";
t("fidelidade ok", AJ.verificarFidelidade("5272040-93.2021.8.09.0115 em 12/03/2022 R$ 15.000,00", autos).length === 0);
t("fidelidade erro", AJ.verificarFidelidade("5272040-93.2021.8.09.0116 R$ 15.500,00", autos).length === 2);
const m = AJ.mergeDossies([{ numeroProcesso: "123", pedidos: [{ litisconsorte: "Ana", descricao: "Dano moral" }] }, { pedidos: [{ litisconsorte: "Bruno", descricao: "Dano moral" }] }]);
t("merge litisconsortes", m.pedidos.map((p) => p.id + p.litisconsorte).join() === "P1Ana,P2Bruno" && m.numeroProcesso === "123");
t("nao apreciados", AJ.pedidosNaoApreciados(m, "Julgo [P1] procedente").map((p) => p.id).join() === "P2");
t("resumo", AJ.resumoExecutivo(m).includes("[P2] Bruno"));
const s = AJ.parseSeries("2025-01;1;1\n2025-02;1;1,5\n2025-03;1;0,5");
const r = AJ.calcularConsectarios({ principal: 1000, inicioCorrecao: "2025-01", inicioJuros: "2025-02", fim: "2025-03", ...s });
t("consectarios", Math.abs(r.corrigido - 1030.3) < 0.01 && Math.abs(r.juros - 5.15) < 0.01);
const txt = Array.from({ length: 400 }, (_, i) => `Parágrafo ${i}. Texto.`).join("\n\n");
const ch = AJ.chunkText(txt, 1500); t("chunk", ch.at(-1).endsWith("Parágrafo 399. Texto.") && ch.length > 4);
t("rank", AJ.rankPrecedentes("desconto indevido benefício previdenciário dano moral", [{ enunciado: "Desconto indevido em benefício previdenciário gera dano moral", palavrasChave: ["desconto indevido"] }]).length === 1);
t("paragrafos", AJ.paragrafosDensos("x".repeat(300) + "\n\n## T\n\n" + "y".repeat(300)) === 2);
t("secao", AJ.secao("## RELATÓRIO\na\n## FUNDAMENTAÇÃO\nb\n## DISPOSITIVO\nc", "FUNDAMENTA", "DISPOSITIVO").includes("b") && !AJ.secao("## RELATÓRIO\na\n## FUNDAMENTAÇÃO\nb\n## DISPOSITIVO\nc", "FUNDAMENTA", "DISPOSITIVO").includes("c"));
const pz = AJ.calcularPrazo("2025-12-18", 15);
t("prazo CPC com recesso", pz.vencimento === "2026-02-09");
t("prazo corrido", AJ.calcularPrazo("2026-03-02", 5, [], false).vencimento === "2026-03-09");
const pgs = ["PROJUDI - Processo: 5001234-56.2025.8.09.0000 - Movimentação 1 - Arquivo 1 - Página 1 de 2\nPetição inicial.", "PROJUDI - Processo: 5001234-56.2025.8.09.0000 - Movimentação 1 - Arquivo 1 - Página 2 de 2\nPedidos.", "sem carimbo", "Processo 5001234 Mov. 18 Arq. 2\nContestação"];
const dl = AJ.detectarLocais(pgs);
t("carimbo PROJUDI", dl.locais[1].mov === "1" && dl.locais[1].pag === "2" && dl.locais[3].mov === "18" && dl.locais[3].arq === "2" && dl.locais[3].pag === "1");
t("sem carimbo segue o arquivo", dl.locais[2].mov === "1" && dl.locais[2].pag === "3" && dl.locais[2].lido === false);
const txtLoc = AJ.cleanPages(pgs, true, dl.locais);
t("marcador triplo", txtLoc.includes("⟦Mov. 18 · Arq. 2 · Pág. 1 | PDF 4⟧"));
const rod = AJ.detectarLocais(["Mov. 1 - Arq. 1\na\nPág. 1 de 3", "b\nPág. 2 de 3", "Mov. 18 - Arq. 1\nc\nPág. 3 de 3"]);
t("rodapé do PDF não vira página do arquivo", rod.locais[2].pag === "1" && rod.locais[1].pag === "2");
t("chave de tese", AJ.chaveTese("Súmula", "297") === "s297" && AJ.chaveTese("Tema repetitivo", "1.061") === "t1061" && AJ.chaveTese("Súmula vinculante", "13") === "sv13" && AJ.chaveTese("Artigo de lei", "art. 14") === null);
const cit = AJ.citacoesDeTeses("Aplica-se a Súmula 297 do STJ e o Tema 1.061. Ver Súmula Vinculante n. 13 e a súmula nº 297.");
t("citações de súmulas e temas", cit.map((c) => c.chave).join() === "s297,t1061,sv13");
const banco = [
  { tipo: "Súmula", numero: "297", fonte: "STJ", texto: "O Código de Defesa do Consumidor é aplicável às instituições financeiras.", assuntos: "banco, consumidor", area: "Todas" },
  { tipo: "Súmula", numero: "385", fonte: "STJ", texto: "Da anotação irregular em cadastro de proteção ao crédito não cabe indenização por dano moral quando preexistente legítima inscrição.", assuntos: "negativação", area: "Cível" },
  { tipo: "Tese do gabinete", numero: "Fixação", texto: "Dano moral em desconto indevido: R$ 5.000,00.", sempre: true, area: "Juizado Especial Cível" },
];
t("teses: tudo que cabe, filtrado pela área", AJ.selecionarTeses(banco, "", { area: "Juizado Especial Cível" }).map((x) => x.numero).join() === "Fixação,297");
t("teses: sem caber, ranqueia pelo caso", AJ.selecionarTeses(banco, "contrato com banco e consumidor", { maxBytes: 450 }).map((x) => x.numero).join() === "Fixação,297");
t("mesma tese", AJ.mesmaTese({ tipo: "Súmula", numero: "297", fonte: "STJ" }, { tipo: "Súmula", numero: "297", fonte: "stj" }) && !AJ.mesmaTese({ tipo: "Súmula", numero: "297", fonte: "STJ" }, { tipo: "Súmula", numero: "297", fonte: "STF" })
  && AJ.mesmaTese({ tipo: "Informativo", numero: "726", texto: "Na autolavagem não ocorre a consunção entre a corrupção passiva e a lavagem." }, { tipo: "Informativo", numero: "726", texto: "Na autolavagem, não ocorre a consunção entre a corrupção passiva e a lavagem!" }));
t("itens de JSON cortado", AJ.itensParciais('{"itens":[{"tipo":"Súmula","texto":"a } \\" b"},{"tipo":"Tema","texto":"x"},{"tipo":"Súm').map((x) => x.tipo).join() === "Súmula,Tema");
console.log(`${ok} ok, ${fail} falhas`);
if (fail) process.exit(1);

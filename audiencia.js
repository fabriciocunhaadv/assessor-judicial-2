/* Assessor TJGO — Mesa de Audiência (portada do sistema antigo): briefing probatório, ata preliminar no layout do Termo,
   inquirição, deliberações e sentença em mesa, e o Termo de Audiência final. As audiências ficam no espaço privado de cada
   usuário (data/users/<uid>); os autos nunca são gravados. */
(function () {
  "use strict";
  const AJ = window.AJ, P = window.PROMPTS, T = window.TJ;
  if (!T) return;
  const { $, h, clear, L, novoId, S, ask, errMsg, showErr, toast, carregarScript, salvar, lerPdf } = T;
  const BRASAO = window.BRASAO_GO || "";
  const LIMITE_AUTOS = 190000;

  const TIPOS = { instrucao_julgamento: "Instrução e julgamento", conciliacao: "Conciliação", una: "Una (conciliação, instrução e julgamento)", saneamento: "Saneamento", justificacao: "Justificação" };
  const STATUS = { preparada: "Preparada", em_andamento: "Em andamento", concluida: "Concluída", suspensa: "Suspensa" };
  const PAPEIS = { testemunha_autor: "Testemunha do autor", testemunha_reu: "Testemunha do réu", informante: "Informante", perito: "Perito", parte_autora: "Depoimento pessoal — autor", parte_re: "Depoimento pessoal — réu" };
  const SIT_TEST = { aguardando: "Aguardando", inquirido: "Inquirida", dispensado: "Dispensada", contraditado: "Contraditada" };
  const ONUS = { autor: "Autor", reu: "Réu", inversao_cdc: "Inversão (CDC)", dinamica_juiz: "Dinâmica (art. 373, § 1º)" };
  const SITPT = { pendente: "Pendente", provado_autor: "Provado pelo autor", provado_reu: "Provado pelo réu", nao_provado: "Não provado" };
  const DELIBS = { acordo_total: "Acordo total", acordo_parcial: "Acordo parcial", revelia: "Revelia", contradita: "Contradita", indeferimento_perguntas: "Indeferir pergunta", diligencia: "Diligência / ofício" };
  const ABAS = { briefing: "Briefing", ata: "Ata preliminar", inquiricao: "Inquirição", deliberacoes: "Deliberações", sentenca: "Sentença em mesa", termo: "Termo de audiência" };

  const A = { lista: [], atual: null, aba: "briefing", autos: "", autosNome: "", autosInfo: "", injecao: null, ctl: null, busy: "", editandoAta: false, ouvindo: false };
  const vazia = () => ({ id: novoId(), processo: "", autor: "", reu: "", classe: "", tipo: "instrucao_julgamento", data: "", hora: "", modalidade: "", area: "civel",
    comarca: "", vara: "", juiz: "", assessor: "", status: "preparada", notas: "", briefing: null, pontos: [], testemunhas: [], ata: null, ataHtml: "",
    delibTipo: "acordo_total", delibParams: {}, deliberacao: "", sentParams: { verdict: "auto", damagesAwarded: "", groundsHighlights: "" }, sentenca: "",
    presAutor: "", advAutor: "", presReu: "", preposto: "", advReu: "", presMP: "", promotor: "", vitimas: "", prazoAlegacoes: "", ocorrencias: "", termo: "", criadoEm: Date.now() });

  // ───────── Banco (privado por usuário) ─────────
  const col = () => (S.cap.db && S.cap.uid ? S.cap.db.collection(`data/users/${S.cap.uid}`) : null);
  let salvarT = null;
  function salvarAud(imediato) {
    const a = A.atual; if (!a) return;
    a.atualizadoEm = Date.now();
    if (!A.lista.some((x) => x.id === a.id)) A.lista.unshift(a);
    renderLista();
    const c = col(); if (!c) return;
    clearTimeout(salvarT);
    const ir = async () => { try { const { id, ...d } = a; await c.doc("aud-" + id).set(JSON.parse(JSON.stringify(d))); } catch (e) { toast("Não foi possível salvar a audiência."); } };
    if (imediato) ir(); else salvarT = setTimeout(ir, 700);
  }
  function ouvir() {
    const c = col(); if (!c || A.ouvindo) return;
    A.ouvindo = true;
    c.onSnapshot((s) => {
      const vindos = s.docs.filter((d) => d.id.startsWith("aud-")).map((d) => ({ ...vazia(), ...d.data(), id: d.id.slice(4) }));
      // a audiência aberta mantém o que está sendo digitado
      A.lista = vindos.map((x) => (A.atual && x.id === A.atual.id ? A.atual : x)).sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0));
      if (A.atual && !A.lista.some((x) => x.id === A.atual.id) && A.atual.atualizadoEm) A.lista.unshift(A.atual);
      renderLista();
    }, () => {});
  }
  document.addEventListener("tj:pronto", () => { ouvir(); render(); });
  // a página pode ter terminado de conectar antes deste arquivo carregar
  const jaPronto = () => { if (S.cap.db && S.cap.uid && !A.ouvindo) { ouvir(); render(); } };

  // ───────── Chamada ao Claude ─────────
  async function claude(rotulo, prompt, opts = {}) {
    if (A.busy) return null;
    showErr($("#aud-err"), null);
    if (!S.cap.sample) { showErr($("#aud-err"), { code: "capability_disabled" }); return null; }
    A.busy = rotulo; A.ctl = new AbortController(); renderBusy();
    try { return await ask(prompt, { tier: "complex", signal: A.ctl.signal, ...opts }); }
    catch (e) { if (!(e && e.code === "cancelled")) showErr($("#aud-err"), e); return null; }
    finally { A.busy = ""; A.ctl = null; renderBusy(); }
  }
  function renderBusy() {
    const b = $("#aud-busy");
    b.hidden = !A.busy;
    clear(b, A.busy ? [h("span", { class: "claude-chip", text: "Claude" }), h("span", { text: " " + A.busy + "…" }), h("button", { class: "btn danger sm", type: "button", onclick: () => A.ctl && A.ctl.abort(), text: "Parar" })] : []);
    document.querySelectorAll("#audiencia [data-ia]").forEach((x) => { x.disabled = !!A.busy || !S.cap.sample; });
  }
  const defesa = () => AJ.defesaInjecao(A.injecao);
  const precisaAutos = () => { if (A.autos) return true; showErr($("#aud-err"), "Anexe os autos (ou use os autos abertos no Processo) para esta etapa."); return false; };
  function contextoCaso(a) {
    const b = a.briefing || {};
    return [
      `Processo: ${a.processo || "não informado"} · Autor: ${a.autor || "não informado"} · Réu: ${a.reu || "não informado"} · Classe: ${a.classe || "não informada"}`,
      b.caseFactsSummary && `Resumo: ${b.caseFactsSummary}`, b.plaintiffClaims && `Autor (fatos e provas): ${b.plaintiffClaims}`, b.defendantClaims && `Réu (defesa e contraprovas): ${b.defendantClaims}`,
      b.counterClaim && `Pedido contraposto: ${b.counterClaim}`, b.whatRemainsToProve && `O que resta provar: ${b.whatRemainsToProve}`,
      a.pontos.length && "Pontos controvertidos:\n" + a.pontos.map((p, i) => `${i + 1}. ${p.topic} — ônus: ${ONUS[p.burdenOfProof] || p.burdenOfProof || "?"}; situação: ${SITPT[p.status] || "pendente"}${p.localizacao ? ` (${p.localizacao})` : ""}`).join("\n"),
    ].filter(Boolean).join("\n");
  }
  function notasComTestemunhas(a) {
    const t = a.testemunhas.filter((w) => w.name).map((w) => `- ${w.name} (${PAPEIS[w.role] || w.role}): ${SIT_TEST[w.status] || "aguardando"}${w.notes ? ` — ${w.notes}` : ""}`).join("\n");
    return [a.notas, t && "Testemunhas e depoimentos:\n" + t].filter(Boolean).join("\n\n");
  }

  // ───────── Autos ─────────
  function usarAutos(texto, nome, injecao) {
    const r = AJ.autosParaAudiencia(texto, LIMITE_AUTOS);
    A.autos = r.texto; A.autosNome = nome; A.injecao = injecao || AJ.detectarInjecao(texto);
    A.autosInfo = r.omitidas ? `${r.omitidas} de ${r.total} páginas sem relação com a audiência ficaram de fora (autos grandes)` : "autos inteiros";
    render();
  }
  async function anexarPdf(file) {
    if (!file) return;
    showErr($("#aud-err"), null);
    $("#aud-autos-s").textContent = `Lendo ${file.name}…`;
    try {
      const r = await lerPdf(file, (n, t, fase) => { $("#aud-autos-s").textContent = fase === "oculto" ? `Procurando texto escondido: página ${n} de ${t}` : `Lendo página ${n} de ${t}`; });
      usarAutos(r.texto, `${file.name} · ${r.paginas} página(s)`);
    } catch (e) { showErr($("#aud-err"), "Não foi possível ler o PDF: " + (e.message || e)); render(); }
  }

  // ───────── Etapas com o Claude ─────────
  async function gerarBriefing() {
    const a = A.atual; if (!precisaAutos()) return;
    const r = await claude("Montando o briefing probatório", P.mesaBriefing(A.autos, a.notasBriefing) + defesa(), { json: true });
    if (!r) return;
    const d = r;
    const b = typeof d === "object" ? d : {};
    a.briefing = { caseFactsSummary: b.caseFactsSummary || "", plaintiffClaims: b.plaintiffClaims || "", defendantClaims: b.defendantClaims || "", counterClaim: b.counterClaim || "", whatRemainsToProve: b.whatRemainsToProve || "", controversySummary: b.controversySummary || "", keyQuestions: L(b.keyQuestions), alertsAndTraps: L(b.alertsAndTraps) };
    for (const [k, v] of [["processo", b.processNumber], ["autor", b.author], ["reu", b.defendant], ["classe", b.actionClass || b.subject]]) if (!a[k] && v) a[k] = String(v);
    a.pontos = L(b.pointsOfControversy).map((p) => ({ id: novoId(), topic: p.topic || p.fact || "", plaintiffPosition: p.plaintiffPosition || "", defendantPosition: p.defendantPosition || "", burdenOfProof: p.burdenOfProof || "autor", whatNeedsProof: p.whatNeedsProof || "", needsOralProof: p.needsOralProof !== false, localizacao: p.localizacao || "", status: "pendente" }));
    // testemunhas do briefing entram na inquirição sem apagar as já cadastradas
    for (const w of L(b.witnesses)) if (w && w.name && !a.testemunhas.some((x) => String(x.name || "").trim().toLowerCase() === String(w.name).trim().toLowerCase())) a.testemunhas.push({ id: novoId(), name: w.name, role: w.role || "testemunha_autor", controversyTopic: w.controversyTopic || "", localizacao: w.localizacao || "", status: "aguardando", questions: "", notes: "" });
    salvarAud(true); render();
  }
  async function gerarAta() {
    const a = A.atual; if (!precisaAutos()) return;
    const conhecidos = `processo ${a.processo || "?"}; autor ${a.autor || "?"}; réu ${a.reu || "?"}${a.data ? `; audiência em ${a.data} ${a.hora || ""}` : ""}`;
    const r = await claude("Preparando a ata preliminar", P.mesaAta(A.autos, conhecidos, a.notasBriefing) + defesa(), { json: true });
    if (!r) return;
    const d = r;
    a.ata = AJ.conferirAta(typeof d === "object" ? d : {}, A.autos);
    if (A.injecao && A.injecao.total) a.ata.alertaInjecao = JSON.parse(JSON.stringify(A.injecao));
    a.ata.geradaEm = Date.now(); a.ataHtml = ""; A.editandoAta = false;
    const c = a.ata.cabecalho || {};
    for (const [k, v] of [["processo", c.numeroProcesso], ["classe", c.assunto || c.classe], ["comarca", c.comarca], ["vara", c.vara], ["juiz", c.juizDesignouAudiencia]]) if (!a[k] && v && !/não consta/i.test(v)) a[k] = String(v);
    salvarAud(true); render();
  }
  async function gerarPerguntas(w) {
    const a = A.atual;
    const r = await claude(`Formulando perguntas para ${w.name || "a testemunha"}`, P.mesaPerguntas(w, contextoCaso(a), a.notas));
    if (!r) return;
    w.questions = String(r.text || "").trim(); salvarAud(); render();
  }
  async function gerarDeliberacao() {
    const a = A.atual;
    const r = await claude("Redigindo a deliberação", P.mesaDeliberacao(a.delibTipo, a.delibParams, contextoCaso(a), a.juiz));
    if (!r) return;
    a.deliberacao = String(r.text || "").trim(); salvarAud(); render();
  }
  async function gerarSentenca() {
    const a = A.atual;
    const r = await claude("Redigindo a sentença em mesa", P.mesaSentenca({ ...a.sentParams, processo: a.processo, autor: a.autor, reu: a.reu }, contextoCaso(a), notasComTestemunhas(a)) + defesa());
    if (!r) return;
    a.sentenca = String(r.text || "").trim(); salvarAud(); render();
  }
  const dadosTermo = (a) => ({ comarca: a.comarca, vara: a.vara, tipoAudiencia: TIPOS[a.tipo], area: a.area, data: a.data, hora: a.hora, modalidade: a.modalidade || "[presencial/telepresencial]",
    juiz: a.juiz, assessor: a.assessor, processo: a.processo, natureza: a.classe, autor: a.autor, reu: a.reu, presencaAutor: a.presAutor, advogadoAutor: a.advAutor,
    presencaReu: a.presReu, preposto: a.preposto, advogadoReu: a.advReu, presencaMP: a.presMP, promotor: a.promotor, vitimas: a.vitimas,
    testemunhas: a.testemunhas.map((w) => ({ nome: w.name, papel: PAPEIS[w.role], situacao: SIT_TEST[w.status], depoimento: w.notes })),
    ocorrencias: a.ocorrencias, anotacoes: a.notas, deliberacao: a.deliberacao, sentenca: a.sentenca, prazoAlegacoes: a.prazoAlegacoes });
  async function gerarTermo() {
    const a = A.atual;
    const r = await claude("Redigindo o termo de audiência", P.mesaTermo(dadosTermo(a)));
    if (!r) return;
    a.termo = String(r.text || "").replace(/\*\*/g, "").trim(); salvarAud(); render();
  }
  const ctxDoc = (a) => ({ juiz: a.juiz, assessor: a.assessor, data: a.data, hora: a.hora, modalidade: a.modalidade, vara: a.vara, comarca: a.comarca });

  // ───────── Documento (ata/termo): HTML editável, copiloto e exportação ─────────
  const TAGS_OK = new Set(["DIV", "P", "SPAN", "B", "STRONG", "I", "EM", "U", "BR", "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "IMG"]);
  const CLASSES_OK = new Set(["cab", "titulo", "aviso", "conferir", "vazio", "conf", "alto", "meta", "rot", "secao", "corpo", "preencher", "assin", "quadro", "qt"]);
  function sanitizar(html) {
    const doc = new DOMParser().parseFromString(`<div id="raiz">${html || ""}</div>`, "text/html"), raiz = doc.getElementById("raiz");
    const limpar = (no) => {
      for (const f of Array.from(no.children)) {
        if (!TAGS_OK.has(f.tagName)) { if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|LINK|META|FORM|INPUT|BUTTON|SVG)$/i.test(f.tagName)) { f.remove(); continue; } f.replaceWith(...f.childNodes); continue; }
        if (f.tagName === "IMG" && !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(f.getAttribute("src") || "")) { f.remove(); continue; }
        for (const at of Array.from(f.attributes)) {
          if (at.name === "class") { const ok = at.value.split(/\s+/).filter((c) => CLASSES_OK.has(c)); if (ok.length) f.setAttribute("class", ok.join(" ")); else f.removeAttribute("class"); }
          else if (!(f.tagName === "IMG" && (at.name === "src" || at.name === "alt")) && !["colspan", "rowspan"].includes(at.name)) f.removeAttribute(at.name);
        }
        limpar(f);
      }
    };
    for (let i = 0; i < 3; i++) limpar(raiz);
    return raiz.innerHTML;
  }
  function htmlParaBlocos(html) {
    const doc = new DOMParser().parseFromString(`<div id="raiz">${html || ""}</div>`, "text/html");
    const txt = (e) => (e.textContent || "").replace(/\s+/g, " ").trim(), bl = [];
    for (const f of Array.from(doc.getElementById("raiz").children)) {
      const cl = f.className || "";
      if (f.tagName === "TABLE") { const cab = Array.from(f.querySelectorAll("thead th")).map(txt); const linhas = Array.from(f.querySelectorAll("tbody tr")).map((tr) => ({ celulas: Array.from(tr.children).map(txt), conferir: /conf/.test(tr.className) })); bl.push({ tipo: "tabela", colunas: cab.length ? cab : (linhas[0] ? linhas[0].celulas.map(() => "") : []), linhas }); }
      else if (f.tagName === "UL" || f.tagName === "OL") bl.push({ tipo: "lista", itens: Array.from(f.querySelectorAll("li")).map((li) => ({ texto: txt(li), conferir: /conf/.test(li.className), nivel: /alto/.test(li.className) ? "alto" : "" })) });
      else if (/\bquadro\b/.test(cl)) bl.push({ tipo: "quadro", titulo: txt(f.querySelector(".qt") || f), itens: Array.from(f.querySelectorAll("li")).map((li) => ({ texto: txt(li), alerta: /alto/.test(li.className) })) });
      else if (/\bcab\b/.test(cl)) bl.push({ tipo: "cabecalho", linhas: Array.from(f.querySelectorAll("p")).map(txt).filter(Boolean) });
      else if (/\bassin\b/.test(cl)) bl.push({ tipo: "assinatura", linhas: Array.from(f.querySelectorAll("p")).map(txt).filter(Boolean) });
      else if (/\btitulo\b/.test(cl)) bl.push({ tipo: "titulo", texto: txt(f) });
      else if (/\bsecao\b/.test(cl)) bl.push({ tipo: "secao", texto: txt(f) });
      else if (/\bmeta\b/.test(cl)) { const r = f.querySelector(".rot"), rot = r ? txt(r) : "", todo = txt(f); bl.push({ tipo: "meta", rotulo: rot, valor: rot ? todo.slice(todo.indexOf(rot) + rot.length).trim() : todo }); }
      else if (txt(f)) bl.push({ tipo: "paragrafo", texto: txt(f), destaque: /conferir/.test(cl) ? "conferir" : /aviso/.test(cl) ? "aviso" : /vazio/.test(cl) ? "vazio" : "corpo" });
    }
    return bl;
  }
  // Copiloto: os blocos vão numerados e o Claude devolve só as operações (resposta curta e rápida)
  const SEL = "p, li, tr";
  function numerarBlocos(html) {
    const doc = new DOMParser().parseFromString(`<div id="raiz">${html || ""}</div>`, "text/html");
    const t = (e) => (e.textContent || "").replace(/\s+/g, " ").trim();
    return Array.from(doc.getElementById("raiz").querySelectorAll(SEL)).map((e, i) => ({ id: i + 1, tipo: e.tagName.toLowerCase(), classe: e.getAttribute("class") || "", texto: e.tagName === "TR" ? "" : t(e), celulas: e.tagName === "TR" ? Array.from(e.children).map(t) : null }));
  }
  function aplicarOperacoes(html, ops) {
    const doc = new DOMParser().parseFromString(`<div id="raiz">${html || ""}</div>`, "text/html"), raiz = doc.getElementById("raiz");
    const alvos = Array.from(raiz.querySelectorAll(SEL)), limpo = (x) => String(x == null ? "" : x).replace(/<[^>]*>/g, "").trim();
    let aplicadas = 0;
    for (const o of L(ops)) {
      const alvo = alvos[Number(o && o.id) - 1]; if (!alvo) continue;
      if (o.op === "delete") { alvo.remove(); aplicadas++; }
      else if (o.op === "replace") {
        if (alvo.tagName === "TR" && Array.isArray(o.celulas)) { Array.from(alvo.children).forEach((c, i) => { if (o.celulas[i] != null) c.textContent = limpo(o.celulas[i]); }); aplicadas++; }
        else if (o.texto != null && alvo.tagName !== "TR") {
          const t = limpo(o.texto);
          if (alvo.classList.contains("meta") && /^[^:]{1,40}:\s*\S/.test(t)) { const k = t.indexOf(":"); alvo.replaceChildren(Object.assign(doc.createElement("span"), { className: "rot", textContent: t.slice(0, k + 1) }), " ", Object.assign(doc.createElement("b"), { textContent: t.slice(k + 1).trim() })); }
          else alvo.textContent = t;
          aplicadas++;
        }
      } else if (o.op === "insert_after") {
        const tipo = o.tipo || alvo.tagName.toLowerCase(); let novo;
        if (tipo === "tr") { novo = doc.createElement("tr"); const n = alvo.tagName === "TR" ? alvo.children.length : L(o.celulas).length; for (let i = 0; i < n; i++) novo.append(Object.assign(doc.createElement("td"), { textContent: limpo(L(o.celulas)[i]) })); }
        else novo = Object.assign(doc.createElement(tipo === "li" ? "li" : "p"), { textContent: limpo(o.texto) });
        const cl = String(o.classe || "").split(/\s+/).filter((c) => CLASSES_OK.has(c)).join(" "); if (cl) novo.className = cl;
        alvo.after(novo); aplicadas++;
      }
    }
    return { html: sanitizar(raiz.innerHTML), aplicadas };
  }
  const htmlAta = (a) => a.ataHtml || (a.ata ? AJ.blocosParaHtml(AJ.blocosAtaPreliminar(a.ata, ctxDoc(a)), BRASAO) : "");
  const htmlTermo = (a) => AJ.blocosParaHtml(AJ.termoParaBlocos(a.termo || AJ.termoEsqueleto({ ...a, testemunhas: a.testemunhas }, ctxDoc(a)), ctxDoc(a)), BRASAO);
  async function copilotoAta(pedido) {
    const a = A.atual, html = htmlAta(a); if (!html || !pedido.trim()) return;
    const doc = numerarBlocos(html).map((b) => `[${b.id}] <${b.tipo}${b.classe ? " class=" + b.classe : ""}> ${b.tipo === "tr" ? b.celulas.join(" | ") : b.texto}`).join("\n");
    const busca = /\b(autos|consta|verific|confir|localiz|busc|procur|encontr|mov\.?|movimenta|p[aá]g)/i.test(pedido) && A.autos ? AJ.trechosParaPedido(A.autos, pedido) : "";
    const r = await claude("Ajustando a ata", P.mesaAtaEditar(pedido, doc, busca), { json: true });
    if (!r) return;
    const d = r || {}, out = aplicarOperacoes(html, d.operacoes);
    a.ataHtml = out.html; salvarAud(true); render();
    toast(`${out.aplicadas} alteração(ões) aplicada(s).${d.resumo ? " " + String(d.resumo).slice(0, 160) : ""}`);
  }
  const nomeDoc = (pref, ext) => `${pref}-${(A.atual.processo || "audiencia").replace(/[^\w.-]+/g, "_")}.${ext}`;
  async function copiarDoc(html) {
    try { await navigator.clipboard.writeText(AJ.blocosParaTexto(htmlParaBlocos(html))); toast("Texto copiado."); } catch (e) { toast("Não foi possível copiar."); }
  }
  async function wordDoc(html, pref) {
    let D; try { D = await carregarScript("docx.min.js", "docx"); } catch (e) { return toast("Não foi possível carregar o gerador de Word."); }
    const cm = (n) => Math.round(n * 567), bl = htmlParaBlocos(html);
    const run = (t, o = {}) => new D.TextRun({ text: t, font: o.font || "Calibri", size: o.size || 23, bold: o.bold, italics: o.italics, color: o.color });
    const corpo = [];
    for (const x of bl) {
      if (x.tipo === "cabecalho") {
        if (BRASAO) { try { const bin = atob(BRASAO.split(",")[1]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); corpo.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.ImageRun({ data: u8, type: "jpg", transformation: { width: 60, height: 78 } })] })); } catch (e) { /* sem brasão */ } }
        x.linhas.forEach((l) => corpo.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: 0 }, children: [run(l, { font: "Courier New", size: 19, bold: true })] })));
      } else if (x.tipo === "titulo") corpo.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 480, after: 360 }, children: [run(x.texto, { bold: true, size: 34 })] }));
      else if (x.tipo === "meta") corpo.push(new D.Paragraph({ spacing: { after: 20 }, children: [run(x.rotulo + " "), run(x.valor, { bold: true })] }));
      else if (x.tipo === "secao") corpo.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 360, after: 160 }, children: [run(x.texto, { bold: true, size: 24 })] }));
      else if (x.tipo === "paragrafo") corpo.push(new D.Paragraph({ alignment: D.AlignmentType.JUSTIFIED, indent: x.destaque === "corpo" ? { firstLine: cm(1) } : undefined, spacing: { after: 100, line: 300 }, children: [run(x.texto, x.destaque === "conferir" ? { bold: true, color: "8A1C1C" } : x.destaque === "aviso" ? { size: 18, color: "444444" } : x.destaque === "vazio" ? { italics: true, color: "555555" } : {})] }));
      else if (x.tipo === "lista" || x.tipo === "quadro") {
        if (x.tipo === "quadro") corpo.push(new D.Paragraph({ spacing: { before: 200 }, children: [run(x.titulo, { bold: true, color: "92400E" })] }));
        x.itens.forEach((i) => corpo.push(new D.Paragraph({ indent: { left: cm(0.8), hanging: cm(0.4) }, spacing: { after: 60 }, children: [run("• " + i.texto, { bold: i.nivel === "alto" || i.alerta, color: i.nivel === "alto" || i.alerta ? "8A1C1C" : undefined })] })));
      } else if (x.tipo === "tabela") {
        const cel = (t, cab) => new D.TableCell({ children: [new D.Paragraph({ children: [run(t, { size: 19, bold: cab })] })], shading: cab ? { fill: "ECECEC" } : undefined });
        corpo.push(new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, rows: [new D.TableRow({ tableHeader: true, children: x.colunas.map((c) => cel(c, true)) }), ...x.linhas.map((l) => new D.TableRow({ children: l.celulas.map((c) => cel(c)) }))] }));
      } else if (x.tipo === "assinatura") x.linhas.forEach((l, i) => corpo.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: i ? 0 : 600 }, children: [run(l, { bold: i === 0 })] })));
    }
    const juiz = (A.atual.juiz || "").replace(/^dr\.?a?\s+/i, "");
    const doc = new D.Document({ creator: "Assessor TJGO", title: pref, sections: [{ properties: { page: { size: { width: cm(21), height: cm(29.7) }, margin: { top: cm(1.6), left: cm(2), right: cm(2), bottom: cm(2) } } },
      footers: { default: new D.Footer({ children: [new D.Paragraph({ tabStops: [{ type: D.TabStopType.RIGHT, position: cm(17) }], children: [new D.TextRun({ children: [D.PageNumber.CURRENT], size: 16 }), new D.TextRun({ text: `\t${juiz || "[nome do Juiz]"} — Juiz de Direito`, size: 16 })] })] }) },
      children: corpo }] });
    await salvar(nomeDoc(pref, "docx"), await D.Packer.toBlob(doc));
  }
  async function pdfDoc(html, pref) {
    let J; try { J = await carregarScript("jspdf.min.js", "jspdf"); } catch (e) { return toast("Não foi possível carregar o gerador de PDF."); }
    const pdf = new J.jsPDF({ unit: "pt", format: "a4" }), W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight();
    const M = { l: 57, r: 57, t: 46, b: 60 }, larg = W - M.l - M.r;
    const limpa = (t) => String(t).replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/…/g, "...").replace(/•/g, "-").replace(/[^\x00-\xFF§ºª°]/g, "");
    let y = M.t;
    const quebra = (alt) => { if (y + alt > H - M.b) { pdf.addPage(); y = M.t; } };
    const texto = (t, { font = "helvetica", st = "normal", size = 11, alin = "justify", esq = 0, cor = [17, 17, 17], antes = 0, depois = 5, recuo = 0 } = {}) => {
      pdf.setFont(font, st); pdf.setFontSize(size); pdf.setTextColor(...cor); y += antes;
      const linhas = pdf.splitTextToSize(limpa(t), larg - esq - recuo), lh = size * 1.35;
      linhas.forEach((ln, i) => { quebra(lh); const x = M.l + esq + (i === 0 ? recuo : 0); if (alin === "center") pdf.text(ln, W / 2, y + size, { align: "center" }); else pdf.text(ln, x, y + size, alin === "justify" && i < linhas.length - 1 ? { maxWidth: larg - esq - (i === 0 ? recuo : 0), align: "justify" } : undefined); y += lh; });
      y += depois;
    };
    for (const x of htmlParaBlocos(html)) {
      if (x.tipo === "cabecalho") { if (BRASAO) { try { pdf.addImage(BRASAO, "JPEG", W / 2 - 22, y, 44, 57); y += 62; } catch (e) { /* sem brasão */ } } x.linhas.forEach((l) => texto(l, { font: "courier", st: "bold", size: 9.5, alin: "center", depois: 0 })); }
      else if (x.tipo === "titulo") texto(x.texto, { st: "bold", size: 16, alin: "center", antes: 18, depois: 12 });
      else if (x.tipo === "meta") { pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); const w = pdf.getTextWidth(limpa(x.rotulo + " ")); quebra(15); pdf.setTextColor(17, 17, 17); pdf.text(limpa(x.rotulo), M.l, y + 11); pdf.setFont("helvetica", "bold"); const ls = pdf.splitTextToSize(limpa(x.valor), larg - w); ls.forEach((ln, i) => { if (i) { y += 15; quebra(15); } pdf.text(ln, M.l + w, y + 11); }); y += 16; }
      else if (x.tipo === "secao") texto(x.texto, { st: "bold", size: 12, alin: "center", antes: 12, depois: 6 });
      else if (x.tipo === "paragrafo") texto(x.texto, x.destaque === "conferir" ? { st: "bold", cor: [138, 28, 28] } : x.destaque === "aviso" ? { size: 9, cor: [68, 68, 68] } : x.destaque === "vazio" ? { st: "italic", cor: [85, 85, 85] } : { recuo: 28 });
      else if (x.tipo === "lista" || x.tipo === "quadro") { if (x.tipo === "quadro") texto(x.titulo, { st: "bold", cor: [146, 64, 14], antes: 6 }); x.itens.forEach((i) => texto("• " + i.texto, { esq: 14, size: 10.5, st: i.nivel === "alto" || i.alerta ? "bold" : "normal", cor: i.nivel === "alto" || i.alerta ? [138, 28, 28] : [17, 17, 17], depois: 2 })); y += 4; }
      else if (x.tipo === "tabela") {
        const n = x.colunas.length || 1, cw = larg / n, fs = 8.5, lh = fs * 1.3;
        const linha = (cels, cab) => {
          pdf.setFont("helvetica", cab ? "bold" : "normal"); pdf.setFontSize(fs);
          const partes = cels.map((c) => pdf.splitTextToSize(limpa(c || ""), cw - 6)), alt = Math.max(...partes.map((p) => p.length)) * lh + 6;
          quebra(alt);
          partes.forEach((p, i) => { if (cab) { pdf.setFillColor(236, 236, 236); pdf.rect(M.l + i * cw, y, cw, alt, "F"); } pdf.setDrawColor(136, 136, 136); pdf.rect(M.l + i * cw, y, cw, alt); pdf.setTextColor(17, 17, 17); p.forEach((ln, k) => pdf.text(ln, M.l + i * cw + 3, y + 3 + fs + k * lh)); });
          y += alt;
        };
        linha(x.colunas, true); x.linhas.forEach((l) => linha(l.celulas)); y += 8;
      } else if (x.tipo === "assinatura") { y += 24; x.linhas.forEach((l, i) => texto(l, { st: i === 0 ? "bold" : "normal", alin: "center", depois: 0 })); }
    }
    const nPag = pdf.getNumberOfPages(), juiz = (A.atual.juiz || "").replace(/^dr\.?a?\s+/i, "") || "[nome do Juiz]";
    for (let i = 1; i <= nPag; i++) { pdf.setPage(i); pdf.setDrawColor(119, 119, 119); pdf.line(M.l, H - 40, W - M.r, H - 40); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(34, 34, 34); pdf.text(String(i), M.l, H - 28); pdf.text(limpa(juiz), W - M.r, H - 30, { align: "right" }); pdf.text("Juiz de Direito", W - M.r, H - 20, { align: "right" }); }
    await salvar(nomeDoc(pref, "pdf"), pdf.output("blob"));
  }

  // ───────── Tela ─────────
  const campo = (rot, chave, props = {}) => h("label", { class: "f" }, rot, h("input", { type: props.type || "text", value: A.atual[chave] || "", placeholder: props.placeholder || "", oninput: (e) => { A.atual[chave] = e.target.value; salvarAud(); if (props.vivo) renderCab(); } }));
  const escolha = (rot, chave, opcoes, onchange) => h("label", { class: "f" }, rot, h("select", { onchange: (e) => { A.atual[chave] = e.target.value; salvarAud(); if (onchange) onchange(); } },
    Object.entries(opcoes).map(([v, t]) => { const o = h("option", { value: v, text: t }); if ((A.atual[chave] || "") === v) o.selected = true; return o; })));
  const area = (rot, valor, onv, rows = 4, ph = "") => h("label", { class: "f" }, rot, h("textarea", { rows, placeholder: ph, oninput: (e) => onv(e.target.value) }, valor || ""));
  const botaoIA = (txt, fn, extra = "") => h("button", { class: "btn " + extra, type: "button", "data-ia": "1", disabled: !!A.busy || !S.cap.sample, onclick: fn, text: txt });

  function renderLista() {
    const box = $("#aud-lista"); if (!box) return;
    const q = ($("#aud-q").value || "").toLowerCase();
    const lista = A.lista.filter((x) => !q || `${x.processo} ${x.autor} ${x.reu}`.toLowerCase().includes(q));
    clear(box, lista.length ? lista.map((x) => h("button", { type: "button", class: "aud-item" + (A.atual && A.atual.id === x.id ? " on" : ""), onclick: () => abrirAud(x) },
      h("strong", { text: x.processo || "Processo não informado" }),
      h("span", { class: "small", text: [x.autor, x.reu].filter(Boolean).join(" × ") || "Partes não informadas" }),
      h("span", { class: "small muted", text: [x.data ? x.data.split("-").reverse().join("/") : "", x.hora, STATUS[x.status]].filter(Boolean).join(" · ") })))
      : [h("p", { class: "muted small", text: A.lista.length ? "Nada encontrado." : "Nenhuma audiência ainda. Clique em Nova audiência." })]);
  }
  function abrirAud(x) { A.atual = x; A.editandoAta = false; render(); }
  function renderCab() {
    const a = A.atual; if (!a) return;
    $("#aud-h").textContent = a.processo ? `Audiência · ${a.processo}` : "Audiência";
  }

  function abaBriefing(a) {
    const b = a.briefing;
    const out = [h("div", { class: "row" }, botaoIA(b ? "Gerar de novo" : "Gerar briefing probatório", gerarBriefing), h("span", { class: "small muted", text: "Matriz da instrução: fatos e provas de cada parte, o que falta provar, pontos controvertidos com o ônus, testemunhas e perguntas-chave." }))];
    out.push(area("Observações do assessor para o Claude (opcional)", a.notasBriefing, (v) => { a.notasBriefing = v; salvarAud(); }, 2, "Ex.: a audiência foi redesignada a pedido do réu; conferir rol de testemunhas."));
    if (!b) return out;
    const bloco = (t, v) => v ? h("div", { class: "aud-card" }, h("h3", { text: t }), h("p", { text: v })) : null;
    out.push(h("div", { class: "aud-cards" }, bloco("Resumo", b.caseFactsSummary), bloco("Autor — fatos e provas", b.plaintiffClaims), bloco("Réu — defesa e contraprovas", b.defendantClaims), bloco("Pedido contraposto", b.counterClaim), bloco("O que resta provar", b.whatRemainsToProve)));
    out.push(h("h3", { class: "aud-sub", text: `Pontos controvertidos (${a.pontos.length})` }));
    out.push(a.pontos.length ? h("div", { class: "aud-tab" }, h("table", null, h("thead", null, h("tr", null, ["Ponto", "Autor", "Réu", "Ônus", "Situação"].map((c) => h("th", { text: c })))),
      h("tbody", null, a.pontos.map((p) => h("tr", null, h("td", null, h("strong", { text: p.topic }), p.whatNeedsProof ? h("div", { class: "small muted", text: "Falta provar: " + p.whatNeedsProof }) : null, p.localizacao ? h("div", { class: "small", style: "color:var(--ref)", text: p.localizacao }) : null),
        h("td", { class: "small", text: p.plaintiffPosition }), h("td", { class: "small", text: p.defendantPosition }),
        h("td", null, h("select", { onchange: (e) => { p.burdenOfProof = e.target.value; salvarAud(); } }, Object.entries(ONUS).map(([v, t]) => { const o = h("option", { value: v, text: t }); if (p.burdenOfProof === v) o.selected = true; return o; }))),
        h("td", null, h("select", { onchange: (e) => { p.status = e.target.value; salvarAud(); } }, Object.entries(SITPT).map(([v, t]) => { const o = h("option", { value: v, text: t }); if (p.status === v) o.selected = true; return o; })))))))) : h("p", { class: "muted small", text: "Nenhum ponto controvertido identificado." }));
    if (L(b.keyQuestions).length) out.push(h("h3", { class: "aud-sub", text: "Perguntas-chave" }), h("ol", { class: "aud-ol" }, b.keyQuestions.map((q) => h("li", { text: q }))));
    if (L(b.alertsAndTraps).length) out.push(h("h3", { class: "aud-sub", text: "Alertas e armadilhas" }), h("ul", { class: "aud-ol aud-alerta" }, b.alertsAndTraps.map((q) => h("li", { text: q }))));
    return out;
  }
  function docView(html, editavel, onSalvar) {
    const folha = h("div", { class: "ata" + (editavel ? " editando" : "") });
    folha.innerHTML = sanitizar(html);
    if (editavel) { folha.contentEditable = "true"; folha.spellcheck = true; }
    return { folha, salvarEdicao: () => onSalvar(sanitizar(folha.innerHTML)) };
  }
  function abaAta(a) {
    const out = [h("div", { class: "row" }, botaoIA(a.ata ? "Gerar de novo" : "Gerar ata preliminar", () => { if (!a.ata || confirm("Gerar de novo substitui a ata atual (inclusive as edições). Continuar?")) gerarAta(); }),
      h("span", { class: "small muted", text: "Só o que consta nos autos, com Mov./Arq./Pág.: partes, testemunhas, citações e intimações, pedidos ligados à audiência, pontos de atenção e as questões a verificar antes do ato. Itens em amarelo: conferir nos autos." }))];
    if (!a.ata && !a.ataHtml) return out;
    const html = htmlAta(a), v = docView(html, A.editandoAta, (novo) => { a.ataHtml = novo; A.editandoAta = false; salvarAud(true); render(); toast("Edição salva."); });
    out.push(h("div", { class: "row aud-acts" },
      A.editandoAta ? h("button", { class: "btn sm", type: "button", onclick: v.salvarEdicao, text: "Salvar edição" }) : h("button", { class: "btn quiet sm", type: "button", onclick: () => { A.editandoAta = true; render(); }, text: "Editar" }),
      A.editandoAta ? h("button", { class: "btn quiet sm", type: "button", onclick: () => { A.editandoAta = false; render(); }, text: "Cancelar" }) : null,
      a.ataHtml && !A.editandoAta ? h("button", { class: "btn quiet sm", type: "button", onclick: () => { if (confirm("Descartar as edições e voltar à ata gerada?")) { a.ataHtml = ""; salvarAud(true); render(); } }, text: "Descartar edições" }) : null,
      h("button", { class: "btn quiet sm", type: "button", onclick: () => copiarDoc(html), text: "Copiar" }),
      h("button", { class: "btn quiet sm", type: "button", onclick: () => wordDoc(html, "ata-preliminar"), text: "Word" }),
      h("button", { class: "btn quiet sm", type: "button", onclick: () => pdfDoc(html, "ata-preliminar"), text: "PDF" })));
    const ped = h("input", { type: "text", placeholder: "Peça um ajuste na ata (ex.: \"confira nos autos se a testemunha Ana foi intimada\", \"exclua o quadro de perícia\")" });
    out.push(h("div", { class: "row aud-cop" }, ped, botaoIA("Ajustar com o Claude", () => copilotoAta(ped.value), "sm")));
    out.push(h("div", { class: "aud-papel" }, v.folha));
    return out;
  }
  function abaInquiricao(a) {
    const out = [area("Anotações da audiência (depoimentos, requerimentos, ocorrências) — salvas automaticamente", a.notas, (v) => { a.notas = v; salvarAud(); }, 6, "Ex.: 14h05 — testemunha Ana Souza (autor): confirmou que acompanhou a autora à agência…")];
    out.push(h("h3", { class: "aud-sub", text: `Testemunhas e depoimentos (${a.testemunhas.length})` }));
    out.push(...a.testemunhas.map((w) => h("div", { class: "item" },
      h("div", { class: "row" }, h("input", { type: "text", value: w.name || "", placeholder: "Nome", style: "flex:1;min-width:160px", oninput: (e) => { w.name = e.target.value; salvarAud(); } }),
        h("select", { onchange: (e) => { w.role = e.target.value; salvarAud(); } }, Object.entries(PAPEIS).map(([v, t]) => { const o = h("option", { value: v, text: t }); if (w.role === v) o.selected = true; return o; })),
        h("select", { onchange: (e) => { w.status = e.target.value; salvarAud(); } }, Object.entries(SIT_TEST).map(([v, t]) => { const o = h("option", { value: v, text: t }); if (w.status === v) o.selected = true; return o; })),
        h("button", { class: "btn quiet sm", type: "button", onclick: () => { if (confirm(`Remover ${w.name || "esta pessoa"}?`)) { a.testemunhas = a.testemunhas.filter((x) => x !== w); salvarAud(); render(); } }, text: "Remover" })),
      h("input", { type: "text", value: w.controversyTopic || "", placeholder: "Ponto controvertido a esclarecer", oninput: (e) => { w.controversyTopic = e.target.value; salvarAud(); } }),
      w.localizacao ? h("p", { class: "small", style: "color:var(--ref)", text: "Indicada em: " + w.localizacao }) : null,
      h("div", { class: "row" }, botaoIA(w.questions ? "Novas perguntas" : "Sugerir perguntas", () => gerarPerguntas(w), "quiet sm")),
      w.questions ? h("div", { class: "aud-perg" }, h("pre", { text: w.questions })) : null,
      area("Depoimento (resumo fiel)", w.notes, (v) => { w.notes = v; salvarAud(); }, 3))));
    out.push(h("button", { class: "btn quiet sm", type: "button", onclick: () => { a.testemunhas.push({ id: novoId(), name: "", role: "testemunha_autor", controversyTopic: "", status: "aguardando", questions: "", notes: "" }); salvarAud(); render(); }, text: "+ Adicionar testemunha, informante ou depoimento pessoal" }));
    return out;
  }
  function abaDeliberacoes(a) {
    const p = a.delibParams || (a.delibParams = {});
    const par = (rot, k, ph) => h("label", { class: "f" }, rot, h("input", { type: "text", value: p[k] || "", placeholder: ph || "", oninput: (e) => { p[k] = e.target.value; salvarAud(); } }));
    const out = [h("div", { class: "seg", role: "radiogroup", "aria-label": "Tipo de deliberação" }, Object.entries(DELIBS).map(([v, t]) => h("button", { type: "button", role: "radio", "aria-checked": String(a.delibTipo === v), onclick: () => { a.delibTipo = v; salvarAud(); render(); }, text: t })))];
    if (a.delibTipo === "acordo_total" || a.delibTipo === "acordo_parcial") out.push(h("div", { class: "params" }, par("Valor do acordo (R$)", "agreedValue", "Ex.: 3.500,00"), par("Forma e vencimentos", "paymentTerms", "Ex.: 5 parcelas de R$ 700,00, todo dia 10, via PIX"), par("Multa por inadimplemento (%)", "penaltyPercent", "Ex.: 50"), a.delibTipo === "acordo_parcial" ? par("Pontos que seguem controvertidos", "partialPendingItems", "Ex.: danos morais") : null));
    out.push(area("Detalhes para a deliberação", p.detalhes, (v) => { p.detalhes = v; salvarAud(); }, 3, a.delibTipo === "contradita" ? "Testemunha, motivo da contradita, resposta e se acolhe ou rejeita" : a.delibTipo === "indeferimento_perguntas" ? "Pergunta feita, por quem, e o motivo do indeferimento" : a.delibTipo === "diligencia" ? "Destinatário, objeto, prazo" : "Informações adicionais"));
    out.push(h("div", { class: "row" }, botaoIA("Redigir deliberação", gerarDeliberacao)));
    out.push(area("Deliberação (editável; vai para o termo)", a.deliberacao, (v) => { a.deliberacao = v; salvarAud(); }, 10));
    return out;
  }
  function abaSentenca(a) {
    const sp = a.sentParams || (a.sentParams = {});
    return [h("div", { class: "params" },
      h("label", { class: "f" }, "Dispositivo pretendido", h("select", { onchange: (e) => { sp.verdict = e.target.value; salvarAud(); } }, Object.entries({ auto: "Conforme a prova (o Claude propõe)", procedencia: "Procedência", parcial_procedencia: "Parcial procedência", improcedencia: "Improcedência", sem_resolucao: "Extinção sem resolução do mérito (art. 485)" }).map(([v, t]) => { const o = h("option", { value: v, text: t }); if (sp.verdict === v) o.selected = true; return o; }))),
      h("label", { class: "f" }, "Valores / condenações", h("input", { type: "text", value: sp.damagesAwarded || "", placeholder: "Ex.: danos materiais de R$ 4.200,00 e morais de R$ 3.000,00", oninput: (e) => { sp.damagesAwarded = e.target.value; salvarAud(); } }))),
      area("Destaques da fundamentação", sp.groundsHighlights, (v) => { sp.groundsHighlights = v; salvarAud(); }, 3, "Ex.: a testemunha confirmou que a autora não abriu a conta; o banco não juntou o contrato assinado."),
      h("p", { class: "small muted", text: "A sentença usa o briefing, os pontos controvertidos, as anotações e os depoimentos da aba Inquirição." }),
      h("div", { class: "row" }, botaoIA("Redigir sentença em mesa", gerarSentenca)),
      a.sentenca ? h("div", { class: "folha claude-out aud-prev" }, T.md(a.sentenca)) : null,
      area("Sentença (editável; vai para o termo)", a.sentenca, (v) => { a.sentenca = v; salvarAud(); }, 12)];
  }
  function abaTermo(a) {
    const crim = a.area === "criminal";
    const pres = (rot, k) => escolha(rot, k, { "": "[Presente/Ausente]", presente: "Presente", ausente: "Ausente" });
    const out = [h("details", { class: "aud-det", open: !a.termo ? "" : null }, h("summary", { text: "Presenças e dados do termo" }),
      h("div", { class: "params3" }, pres(crim ? "Acusado" : "Requerente", crim ? "presReu" : "presAutor"), crim ? pres("Ministério Público", "presMP") : pres("Requerido", "presReu"),
        crim ? campo("Promotor(a)", "promotor") : campo("Preposto do requerido", "preposto"),
        campo(crim ? "Advogado(a) do acusado (nome e OAB)" : "Advogado(a) do requerente (nome e OAB)", crim ? "advReu" : "advAutor"), crim ? campo("Vítima(s)", "vitimas") : campo("Advogado(a) do requerido (nome e OAB)", "advReu"),
        campo("Prazo de alegações finais", "prazoAlegacoes", { placeholder: crim ? "05 (cinco) dias" : "10 (dez) dias" })),
      area("Ocorrências (abertura, conciliação, oitivas, requerimentos)", a.ocorrencias, (v) => { a.ocorrencias = v; salvarAud(); }, 4, "Ex.: Proposta a conciliação, restou infrutífera. Foram ouvidas…"))];
    out.push(h("div", { class: "row" }, h("button", { class: "btn quiet", type: "button", onclick: () => { if (!a.termo || confirm("Substituir o texto atual do termo pelo esqueleto padrão?")) { a.termo = AJ.termoEsqueleto({ ...a }, ctxDoc(a)); salvarAud(true); render(); } }, text: "Esqueleto padrão (sem IA)" }),
      botaoIA("Redigir termo com o Claude", () => { if (!a.termo || confirm("Substituir o texto atual do termo?")) gerarTermo(); }),
      h("span", { class: "small muted", text: "Usa as presenças, as anotações, os depoimentos, a deliberação e a sentença em mesa. O que faltar fica entre [colchetes]." })));
    const html = htmlTermo(a);
    out.push(h("div", { class: "row aud-acts" },
      h("button", { class: "btn quiet sm", type: "button", onclick: () => copiarDoc(html), text: "Copiar" }),
      h("button", { class: "btn quiet sm", type: "button", onclick: () => wordDoc(html, "termo-audiencia"), text: "Word" }),
      h("button", { class: "btn quiet sm", type: "button", onclick: () => pdfDoc(html, "termo-audiencia"), text: "PDF" })));
    out.push(h("div", { class: "aud-termo" }, area("Texto do termo (editável — uma informação por linha)", a.termo || "", (v) => { a.termo = v; salvarAud(); clearTimeout(A.prevT); A.prevT = setTimeout(() => { const box = $("#aud-termo-prev"); if (box) box.innerHTML = sanitizar(htmlTermo(a)); }, 400); }, 24, "Clique em Esqueleto padrão ou em Redigir termo com o Claude."),
      h("div", { class: "aud-papel" }, (() => { const f = h("div", { class: "ata", id: "aud-termo-prev" }); f.innerHTML = sanitizar(html); return f; })())));
    return out;
  }

  function render() {
    renderLista();
    const a = A.atual, box = $("#aud-mesa");
    if (!a) { clear(box, h("div", { class: "body" }, h("p", { class: "muted", text: "Abra uma audiência na lista ou clique em Nova audiência." }))); renderBusy(); return; }
    renderCab();
    const dados = h("details", { class: "aud-det", open: !a.processo ? "" : null }, h("summary", { text: "Dados da audiência" }),
      h("div", { class: "params3" }, campo("Número do processo", "processo", { vivo: true }), campo("Autor / requerente", "autor"), campo("Réu / requerido", "reu"), campo("Classe / natureza", "classe"),
        escolha("Tipo de audiência", "tipo", TIPOS), escolha("Área", "area", { civel: "Cível", criminal: "Criminal" }, render), campo("Data", "data", { type: "date" }), campo("Hora", "hora", { type: "time" }),
        escolha("Modalidade", "modalidade", { "": "[a definir]", presencial: "Presencial", telepresencial: "Telepresencial (Zoom)", hibrida: "Híbrida" }), campo("Comarca", "comarca", { placeholder: "Ex.: Iporá" }), campo("Vara / juízo", "vara", { placeholder: "Ex.: Juizado Especial Cível" }),
        campo("Juiz(a) que preside", "juiz"), campo("Assessor(a) que digita o termo", "assessor"), escolha("Situação", "status", STATUS, renderLista)));
    const autos = h("div", { class: "aud-autos" },
      h("div", { style: "min-width:0;flex:1" }, h("strong", { text: A.autos ? A.autosNome : "Autos não anexados" }), h("div", { class: "small muted", id: "aud-autos-s", text: A.autos ? A.autosInfo : "Necessários para o briefing e a ata preliminar. Não são gravados: ao reabrir a audiência, anexe de novo." })),
      S.caso && S.caso.autos ? h("button", { class: "btn quiet sm", type: "button", onclick: () => usarAutos(S.caso.autos, `${S.caso.nome} (aberto no Processo)`, S.caso.injecao), text: "Usar os autos abertos no Processo" }) : null,
      h("label", { class: "btn quiet sm", for: "aud-pdf" }, "Anexar PDF", h("input", { type: "file", id: "aud-pdf", accept: "application/pdf", hidden: true, onchange: (e) => { anexarPdf(e.target.files[0]); e.target.value = ""; } })));
    const inj = A.injecao && A.injecao.verificado && A.autos ? h("div", { class: "inj " + (A.injecao.total ? "bad" : "ok") }, h("strong", { text: A.injecao.total ? `⚠ Possível prompt injection nos autos: ${A.injecao.total} trecho(s). O Claude foi instruído a não obedecer.` : "✓ Autos verificados: nenhuma tentativa de dar ordens à IA" }),
      A.injecao.total ? h("ul", null, A.injecao.achados.slice(0, 5).map((x) => h("li", null, h("b", { text: (AJ.localInjecao(x) || "local não identificado") + ": " }), x.categoria))) : null) : null;
    const abas = h("div", { class: "subtabs", role: "tablist" }, Object.entries(ABAS).map(([v, t]) => h("button", { type: "button", "aria-selected": String(A.aba === v), onclick: () => { A.aba = v; A.editandoAta = false; render(); }, text: t })));
    const corpo = { briefing: abaBriefing, ata: abaAta, inquiricao: abaInquiricao, deliberacoes: abaDeliberacoes, sentenca: abaSentenca, termo: abaTermo }[A.aba](a);
    clear(box, h("div", { class: "body" }, dados, autos, inj), abas, h("div", { class: "body" }, corpo));
    renderBusy();
  }

  $("#aud-nova").addEventListener("click", () => { A.atual = vazia(); A.aba = "briefing"; if (S.caso && S.caso.numero && S.caso.numero !== "n/i") A.atual.processo = S.caso.numero; render(); });
  $("#aud-q").addEventListener("input", renderLista);
  $("#aud-excluir").addEventListener("click", async () => {
    const a = A.atual; if (!a) return;
    if (!confirm(`Excluir a audiência ${a.processo || ""}? Esta ação não pode ser desfeita.`)) return;
    try { const c = col(); if (c && a.atualizadoEm) await c.doc("aud-" + a.id).delete(); } catch (e) { return toast("Não foi possível excluir."); }
    A.lista = A.lista.filter((x) => x.id !== a.id); A.atual = null; render();
  });
  render(); jaPronto(); setTimeout(jaPronto, 1500);
})();

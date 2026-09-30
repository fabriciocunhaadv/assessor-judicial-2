/* Assessor Judicial IA — interface e integração com o Claude (sample), dados do gabinete (db) e downloads. */
(function () {
  "use strict";
  const AJ = window.AJ, P = window.PROMPTS;
  const $ = (s) => document.querySelector(s);
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
    return e;
  }
  const clear = (el, ...kids) => { el.replaceChildren(...kids.flat().filter(Boolean)); return el; };
  const MAX_BYTES = 250000; // limite de uma chamada ao Claude (256 KiB) com folga
  const STAGE1_CHARS = 170000;

  // ───────── Estado ─────────
  const S = {
    caso: { nome: "", autos: "", paginas: 0, pdf: null, exemplo: false, dossie: null, resumo: "", minuta: "", numero: "" },
    teses: [], paradigmas: [], precedentes: [], historico: [],
    prompts: [], unidades: [], cfg: {}, auditorias: [], eventos: [], conhecimento: [], chamados: [],
    paradigmaId: "", promptId: "", unidadeId: "", tipoAto: "auto",
    diag: null, chat: [], ctl: null, pagina: 1, filtro: "TODOS",
    cap: { sample: null, db: null, user: null, downloads: null, uid: null, canEdit: false, canWrite: null },
  };
  try {
    S.paradigmaId = sessionStorage.getItem("aj.paradigma") || "";
    S.promptId = localStorage.getItem("aj.prompt") || "";
    S.unidadeId = localStorage.getItem("aj.unidade") || "";
  } catch (e) { /* sem armazenamento */ }
  const lembrar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } };

  // ───────── Abas ─────────
  const TABS = ["esteira", "lupa", "audiencia", "mutirao", "peticao", "chat", "historico", "agenda", "gabinete", "precedentes", "conhecimento", "prompts", "legislacao", "projudi", "equipe", "chamados", "conheca", "ajuda"];
  function abrirAba(id) {
    for (const t of TABS) {
      $("#t-" + t).setAttribute("aria-selected", String(t === id));
      $("#" + t).hidden = t !== id;
    }
    if (id === "lupa") renderLupa();
    if (id === "agenda") renderAgenda();
    if (id === "chat") renderChat();
    window.scrollTo(0, 0);
  }
  TABS.forEach((t) => $("#t-" + t).addEventListener("click", () => abrirAba(t)));
  const hash = (location.hash || "").slice(1);
  if (TABS.includes(hash)) abrirAba(hash);

  // ───────── Mensagens de erro ─────────
  const ERR = {
    not_granted: "Esta página não recebeu permissão para usar o Claude. Recarregue a página e permita o uso quando for perguntado.",
    sampling_disabled: "O Claude não está disponível para esta conta ou organização.",
    capability_disabled: "O Claude não pode ser usado nesta visualização. Abra a página no claude.ai.",
    rate_limited: "Limite de uso do seu plano atingido ou muitas chamadas seguidas. Aguarde alguns minutos e tente de novo.",
    session_expired: "Sua sessão expirou. Entre de novo no claude.ai e recarregue a página.",
    refused: "O Claude recusou este conteúdo. Revise o texto enviado.",
    prompt_too_large: "Texto grande demais para uma chamada. Divida o documento.",
    invalid_json: "A resposta veio fora do formato esperado. Tente de novo.",
    empty_completion: "O Claude não devolveu texto. Tente de novo.",
    upstream_error: "Falha temporária de conexão com o Claude. Tente de novo.",
    cancelled: "Interrompido.",
  };
  const errMsg = (e) => ERR[e && e.code] || (e && e.message ? String(e.message) : "Erro inesperado.");
  const showErr = (el, e) => clear(el, e ? h("div", { class: "err", role: "alert", text: typeof e === "string" ? e : errMsg(e) }) : null);

  // ───────── Claude ─────────
  async function ask(input, { tier = "default", json = false, onText, signal, cache } = {}) {
    if (!S.cap.sample) throw { code: "capability_disabled", message: "Claude indisponível nesta visualização." };
    if (typeof input === "string" && AJ.bytes(input) > MAX_BYTES) throw { code: "prompt_too_large" };
    const opts = { modelTier: tier };
    if (signal) opts.signal = signal;
    if (onText) opts.onText = onText;
    if (cache !== undefined) opts.cache = cache;
    return json ? S.cap.sample.json(input, opts) : S.cap.sample(input, opts);
  }

  // ───────── Markdown seguro (sem HTML bruto) ─────────
  const REF = /(⟦Pág\. \d+⟧|\b(?:Mov|Arq|Pág|Evento|fls?)\.?\s?\d+(?:[.-]\d+)?|\[P\d+\])/g;
  function inlineRefs(text) {
    const out = [];
    for (const part of text.split(REF)) {
      if (!part) continue;
      if (/^\[P\d+\]$/.test(part)) out.push(h("span", { class: "pid", text: part }));
      else if (REF.test(part)) {
        REF.lastIndex = 0;
        const pag = /Pág\.?\s?(\d+)/.exec(part);
        out.push(pag && S.caso.paginas
          ? h("button", { class: "ref", type: "button", title: "Abrir na Lupa", onclick: () => { S.pagina = Number(pag[1]); abrirAba("lupa"); }, text: part.replace(/[⟦⟧]/g, "") })
          : h("span", { class: "ref", text: part.replace(/[⟦⟧]/g, "") }));
      } else out.push(part);
      REF.lastIndex = 0;
    }
    return out;
  }
  function inline(text) {
    return text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*)/g).flatMap((p) => {
      if (/^\*\*.+\*\*$/.test(p)) return [h("strong", null, inlineRefs(p.slice(2, -2)))];
      if (/^__.+__$/.test(p)) return [h("u", null, inlineRefs(p.slice(2, -2)))];
      if (/^\*.+\*$/.test(p)) return [h("em", null, inlineRefs(p.slice(1, -1)))];
      return inlineRefs(p);
    });
  }
  function md(text) {
    const frag = document.createDocumentFragment();
    for (const block of String(text || "").split(/\n\s*\n/)) {
      const t = block.trim(); if (!t) continue;
      const lines = t.split("\n");
      const hm = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
      if (hm) {
        frag.append(h("h" + hm[1].length, null, inline(hm[2])));
        if (lines.length > 1) frag.append(md(lines.slice(1).join("\n")));
        continue;
      }
      if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) { frag.append(h("ul", null, lines.map((l) => h("li", null, inline(l.replace(/^\s*[-*•]\s+/, "")))))); continue; }
      if (lines.every((l) => /^\s*>/.test(l))) { frag.append(h("p", { class: "cit" }, inline(lines.map((l) => l.replace(/^\s*>\s?/, "")).join(" ")))); continue; }
      const p = h("p");
      lines.forEach((l, i) => { if (i) p.append(h("br")); p.append(...inline(l)); });
      frag.append(p);
    }
    return frag;
  }

  // ───────── Leitura dos autos ─────────
  let pdfjs = window.pdfjsLib || null;
  if (pdfjs) pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  async function lerPdf(file, onProgress) {
    if (!pdfjs) throw new Error("O leitor de PDF não carregou. Recarregue a página.");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    const paginas = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let linha = ""; const linhas = [];
      for (const it of content.items) { if (!("str" in it)) continue; linha += it.str; if (it.hasEOL) { linhas.push(linha); linha = ""; } }
      if (linha) linhas.push(linha);
      paginas.push(linhas.join("\n"));
      page.cleanup();
      onProgress(n, doc.numPages);
      if (n % 4 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    return { doc, texto: AJ.cleanPages(paginas), paginas: doc.numPages };
  }

  function novoCaso(dados) {
    S.caso = { nome: "", autos: "", paginas: 0, pdf: null, exemplo: false, dossie: null, resumo: "", minuta: "", numero: "", ...dados };
    S.diag = null; S.chat = []; S.pagina = 1; S.minutaAnterior = null; resAba = "minuta"; cmp = { a: null, b: null };
    renderCaso();
  }

  const drop = $("#drop"), fAutos = $("#f-autos");
  fAutos.addEventListener("change", () => carregarArquivo(fAutos.files[0]));
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); carregarArquivo(e.dataTransfer.files[0]); });

  async function carregarArquivo(file) {
    if (!file) return;
    showErr($("#leitura-err"), null);
    if (file.type && file.type !== "application/pdf") return showErr($("#leitura-err"), "Selecione um arquivo PDF.");
    const bar = $("#leitura-bar"); bar.hidden = false;
    $("#drop-t").textContent = `Lendo ${file.name}…`;
    try {
      const r = await lerPdf(file, (n, t) => { bar.firstElementChild.style.width = (100 * n / t) + "%"; $("#drop-s").textContent = `Página ${n} de ${t}`; });
      novoCaso({ nome: file.name, autos: r.texto, paginas: r.paginas, pdf: r.doc });
      if (r.texto.replace(/⟦Pág\. \d+⟧/g, "").trim().length < 300) showErr($("#leitura-err"), "Este PDF parece ser digitalizado sem camada de texto (imagem). Aplique OCR antes de enviar.");
    } catch (e) {
      showErr($("#leitura-err"), "Não foi possível ler o PDF: " + (e.message || e));
      renderCaso();
    } finally { bar.hidden = true; }
  }

  $("#b-exemplo").addEventListener("click", () => {
    const hdr = "PODER JUDICIÁRIO DO ESTADO DE GOIÁS\nComarca de Exemplo — Juizado Especial Cível";
    const pags = EXEMPLO.map((c, i) => `${hdr}\n${c}\nDocumento assinado eletronicamente por SERVIDOR FICTÍCIO\nPág. ${i + 1} de ${EXEMPLO.length}`);
    novoCaso({ nome: "Autos de exemplo (fictícios)", autos: AJ.cleanPages(pags), paginas: pags.length, exemplo: true });
  });

  // ───────── Esteira: duas etapas ─────────
  const steps = $("#steps");
  const setStep = (n, st, extra) => {
    const li = steps.querySelector(`[data-s="${n}"]`); li.className = st;
    const base = li.dataset.base || (li.dataset.base = li.textContent);
    li.textContent = extra ? `${base} · ${extra}` : base;
  };

  $("#b-parar").addEventListener("click", () => S.ctl && S.ctl.abort());
  $("#b-gerar").addEventListener("click", gerar);

  async function etapa1(autos, signal) {
    const blocos = AJ.chunkText(autos, STAGE1_CHARS);
    const parciais = [];
    for (let i = 0; i < blocos.length; i++) {
      setStep(1, "run", blocos.length > 1 ? `bloco ${i + 1} de ${blocos.length}` : "lendo os autos");
      parciais.push(...await etapa1Bloco(blocos[i], i + 1, blocos.length, signal, 0));
    }
    return AJ.mergeDossies(parciais);
  }
  // Se a resposta de um bloco grande vier cortada, divide o bloco ao meio (no máximo duas vezes).
  async function etapa1Bloco(bloco, i, n, signal, nivel) {
    try {
      return [await ask(P.stage1(bloco, i, n), { tier: "default", json: true, signal })];
    } catch (e) {
      if (e && e.code === "invalid_json" && nivel < 2 && bloco.length > 40000) {
        const [a, b] = AJ.chunkText(bloco, Math.ceil(bloco.length / 2) + 2000);
        return [...await etapa1Bloco(a, i, n, signal, nivel + 1), ...(b ? await etapa1Bloco(b, i, n, signal, nivel + 1) : [])];
      }
      throw e;
    }
  }

  async function gerar() {
    const c = S.caso;
    showErr($("#gerar-err"), null);
    S.ctl = new AbortController();
    const signal = S.ctl.signal;
    $("#b-gerar").disabled = true; $("#b-parar").hidden = false; steps.hidden = false;
    [1, 2, 3].forEach((n) => setStep(n, ""));
    let etapa = 1;
    try {
      c.dossie = await etapa1(c.autos, signal);
      c.resumo = AJ.resumoExecutivo(c.dossie);
      c.numero = c.dossie.numeroProcesso;
      setStep(1, "done", `${c.dossie.pedidos.length} pedido(s), ${c.dossie.cronologia.length} evento(s)`);

      etapa = 2; setStep(2, "run", "pensando…");
      const paradigma = S.paradigmas.find((p) => p.id === S.paradigmaId) || null;
      const usarCaderno = $("#c-teses").checked;
      const teses = usarCaderno ? S.teses.filter((t) => t.ativa !== false) : [];
      const sugerido = { despacho: "despacho", decisao_interlocutoria: "decisao", saneamento: "decisao", sentenca: "sentenca", embargos_declaracao: "embargos" };
      c.tipoAto = S.tipoAto !== "auto" ? S.tipoAto : (sugerido[c.dossie.atoSugerido] || "sentenca");
      const promptArea = S.prompts.find((x) => x.id === S.promptId && x.ativo !== false) || null;
      const unidade = S.unidades.find((u) => u.id === S.unidadeId) || null;
      const tema = [...c.dossie.pedidos.map((p) => p.descricao), ...c.dossie.pontosControvertidos, c.dossie.classe].join(" ");
      const precedentes = AJ.rankPrecedentes(tema, S.precedentes);
      const bc = trechosConhecimento(tema);
      const prompt = P.stage2({ dossie: c.dossie, paradigma, teses, precedentes, instrucao: $("#t-instrucao").value.trim(), tipoAto: c.tipoAto, promptArea, unidade, caderno: usarCaderno ? (S.cfg.caderno && S.cfg.caderno.texto) || "" : "", conhecimento: bc.texto });
      const out = $("#minuta");
      const r = await ask(prompt, { tier: "complex", signal, onText: ({ text }) => { setStep(2, "run", "redigindo"); clear(out, md(text)); } });
      c.minuta = r.text.trim();
      c.fato = null; c.conf = c.conf || null;
      c.meta = { tipoAto: { sentenca: "Sentença", decisao: "Decisão", despacho: "Despacho", embargos: "Embargos" }[c.tipoAto] + (S.tipoAto === "auto" ? " (auto-detectado)" : ""),
        prompt: promptArea ? `${promptArea.titulo} · ${promptArea.area}` : "", unidade: unidade ? `${unidade.nome} — ${unidade.comarca}` : "",
        paradigma: paradigma ? paradigma.titulo : "", caderno: !!(usarCaderno && S.cfg.caderno && S.cfg.caderno.texto), teses: teses.length,
        conhecimento: bc.n, precedentes: precedentes.map((p) => `${p.tribunal} ${p.identificador}`), blocos: AJ.chunkText(c.autos, STAGE1_CHARS).length, instrucao: $("#t-instrucao").value.trim() };
      pushVersao("Minuta gerada");
      setStep(2, "done", r.truncated ? "resposta cortada pelo limite" : "");

      etapa = 3; setStep(3, "run");
      renderCaso();
      setStep(3, "done");
      salvarHistorico();
    } catch (e) {
      setStep(etapa, "fail", e && e.code === "cancelled" ? "interrompido" : "falhou");
      if (!(e && e.code === "cancelled")) showErr($("#gerar-err"), e);
      if (etapa === 2 && e && e.text) { c.minuta = e.text; renderCaso(); }
    } finally {
      $("#b-parar").hidden = true; S.ctl = null; renderBotoes();
    }
  }

  async function aprofundar() {
    const c = S.caso;
    S.ctl = new AbortController();
    const btn = $("#b-aprof"); if (btn) { btn.disabled = true; btn.textContent = "Aprofundando…"; }
    try {
      const r = await ask(P.aprofundar(c.minuta, c.resumo), { tier: "complex", signal: S.ctl.signal, onText: ({ text }) => clear($("#minuta"), md(text)) });
      c.minuta = r.text.trim(); pushVersao("Fundamentação aprofundada"); renderCaso(); salvarHistorico();
    } catch (e) { showErr($("#gerar-err"), e); renderCaso(); }
    finally { S.ctl = null; }
  }

  function conferencia() {
    const c = S.caso;
    const fund = AJ.secao(c.minuta, "FUNDAMENTA", "DISPOSITIVO");
    const densos = AJ.paragrafosDensos(fund || c.minuta);
    const nao = c.dossie ? AJ.pedidosNaoApreciados(c.dossie, c.minuta) : [];
    const sem = c.autos ? AJ.verificarFidelidade(c.minuta, c.autos) : [];
    return { densos, nao, sem };
  }

  // ───────── Renderização do caso ─────────
  function renderCaso() {
    const c = S.caso;
    $("#drop-t").textContent = c.nome || "Selecione os autos em PDF";
    $("#drop-s").textContent = c.nome
      ? `${c.paginas} página(s) · ${c.autos.length.toLocaleString("pt-BR")} caracteres após a limpeza${c.exemplo ? " · conteúdo fictício" : ""}. Clique para trocar.`
      : "Projudi, PJe ou eproc. O texto é lido e limpo aqui no navegador.";
    $("#minuta-h").textContent = c.numero && c.numero !== "n/i" ? `Minuta · ${c.numero}` : "Minuta";
    const out = $("#minuta");
    if (c.minuta) clear(out, md(c.minuta));
    else clear(out, h("div", { class: "placeholder" },
      h("p", { text: c.autos ? "Autos prontos. Escolha o paradigma e clique em Gerar minuta em 2 etapas." : "Carregue os autos em PDF ou use os autos de exemplo." },),
      h("p", { class: "small", text: "Etapa 1: o Assessor Fático extrai a cronologia, os pedidos de cada litisconsorte e as provas com Mov./Arq./Pág. Etapa 2: o Juiz Revisor redige relatório, fundamentação em 7 blocos e dispositivo com os consectários da Lei nº 14.905/2024." })));
    $("#editor").value = c.minuta;

    const acts = $("#minuta-actions"); clear(acts);
    if (c.minuta) {
      clear(acts,
        h("button", { class: "btn quiet sm", type: "button", onclick: copiarMinuta, text: "Copiar" }),
        S.cap.downloads ? h("button", { class: "btn quiet sm", type: "button", onclick: () => baixar("html"), text: "Baixar para Word" }) : null,
        S.cap.downloads ? h("button", { class: "btn quiet sm", type: "button", onclick: () => baixar("md"), text: ".md" }) : null,
        h("button", { class: "btn ghost sm", type: "button", onclick: () => abrirAba("chat"), text: "Conversar sobre a minuta" }),
        h("button", { class: "btn ghost sm", type: "button", onclick: () => abrirAba("lupa"), text: "Conferir na Lupa" }));
    }

    const pc = $("#p-checks");
    if (c.minuta) {
      const { densos, nao, sem } = conferencia();
      pc.hidden = false;
      const linha = (rot, n, bom) => h("div", { class: "check" }, h("span", { text: rot }), h("span", { class: "pill " + (bom ? "ok" : "bad"), text: String(n) }));
      const piso = !c.tipoAto || c.tipoAto === "sentenca" ? 14 : 0;
      clear($("#checks"),
        c.tipoAto && c.tipoAto !== "sentenca" ? h("div", { class: "check" }, h("span", { text: "Tipo de ato" }), h("span", { class: "tag", text: { decisao: "Decisão", despacho: "Despacho", embargos: "Embargos" }[c.tipoAto] || c.tipoAto })) : null,
        linha(piso ? "Parágrafos densos na fundamentação (mínimo 14)" : "Parágrafos densos na fundamentação", densos, densos >= piso),
        c.dossie ? linha("Pedidos não apreciados", nao.length, !nao.length) : null,
        c.autos ? linha("Dados sem lastro nos autos", sem.length, !sem.length) : null);
      clear($("#check-notes"),
        nao.map((p) => h("div", { class: "bad", text: `${p.id} — ${p.litisconsorte}: ${p.descricao}` })),
        sem.map((d) => h("div", { class: "bad", text: `${d.tipo}: ${d.valor} não aparece nos autos` })),
        c.dossie && c.dossie.alertas.length ? h("div", { class: "warn", text: "Alertas da Etapa 1: " + c.dossie.alertas.join(" · ") }) : null);
      clear($("#check-actions"), piso && densos < piso && c.resumo ? h("button", { class: "btn quiet sm", id: "b-aprof", type: "button", onclick: aprofundar, text: "Aprofundar fundamentação" }) : null);
    } else pc.hidden = true;

    if (c.minuta && S.cap.canEdit) acts.append(h("button", { class: "btn quiet sm", type: "button", title: "Selecione um trecho da minuta e clique", onclick: selecaoParaCaderno, text: "⚡ Seleção → Caderno" }));
    renderRes(); renderPassos();
    renderBotoes();
    if (!$("#lupa").hidden) renderLupa();
    if (!$("#chat").hidden) renderMinutaChat();
  }

  function renderBotoes() {
    const c = S.caso, ok = !!S.cap.sample, ocupado = !!S.ctl;
    $("#b-gerar").disabled = !ok || !c.autos || ocupado;
    $("#b-auditar").disabled = !ok || !$("#editor").value.trim() || !(c.autos || c.resumo) || ocupado;
    $("#b-painel").disabled = !ok || !(c.resumo || c.autos);
    $("#b-termo").disabled = !ok;
    $("#b-enviar").disabled = !ok || !(c.minuta || c.autos) || ocupado;
  }

  const semMarcadores = (t) => t.replace(/\s?\[P\d+\]/g, "");
  async function copiarMinuta() {
    try { await navigator.clipboard.writeText(semMarcadores(S.caso.minuta)); toast("Minuta copiada."); }
    catch (e) { $("#editor").select(); abrirAba("lupa"); toast("Selecione e copie a minuta no editor da Lupa."); }
  }
  function mdParaHtml(t) {
    const div = h("div"); div.append(md(semMarcadores(t)));
    div.querySelectorAll(".ref,.pid").forEach((r) => r.replaceWith(document.createTextNode(r.textContent)));
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${(S.caso.numero || "minuta").replace(/[<>&]/g, "")}</title><style>body{font:12pt/1.6 "Times New Roman",serif;max-width:17cm;margin:2cm auto}h2{text-align:center;text-transform:uppercase;font-size:12pt}h3{font-size:12pt}p{text-align:justify;text-indent:2cm}p.cit{text-indent:0;margin-left:4cm;font-size:11pt}</style></head><body>${div.innerHTML}</body></html>`;
  }
  async function baixar(fmt) {
    const nome = `minuta-${(S.caso.numero && S.caso.numero !== "n/i" ? S.caso.numero : "processo").replace(/[^\w.-]+/g, "_")}.${fmt}`;
    try { await S.cap.downloads.save({ filename: nome, data: fmt === "html" ? mdParaHtml(S.caso.minuta) : semMarcadores(S.caso.minuta) }); }
    catch (e) { if (e && e.code !== "declined") toast("Não foi possível salvar o arquivo."); }
  }
  let toastT;
  function toast(msg) {
    let t = $("#toast");
    if (!t) { t = h("div", { id: "toast", role: "status", style: "position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:8px 14px;border-radius:6px;font-size:13px;z-index:9" }); document.body.append(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
  }

  // ───────── Lupa ─────────
  $("#editor").addEventListener("input", () => { S.caso.minuta = $("#editor").value; renderBotoes(); });
  $("#editor").addEventListener("change", () => { pushVersao("Edição manual"); renderCaso(); });
  $("#pg-prev").addEventListener("click", () => { S.pagina = Math.max(1, S.pagina - 1); renderPagina(); });
  $("#pg-next").addEventListener("click", () => { S.pagina = Math.min(S.caso.paginas || 1, S.pagina + 1); renderPagina(); });
  let buscaT;
  $("#busca").addEventListener("input", () => { clearTimeout(buscaT); buscaT = setTimeout(renderBusca, 200); });

  function renderLupa() { renderPagina(); renderBusca(); renderBotoes(); }
  let renderTask = null;
  async function renderPagina() {
    const c = S.caso, box = $("#pdfbox");
    $("#pg-info").textContent = c.paginas ? `Pág. ${S.pagina} de ${c.paginas}` : "—";
    if (!c.autos) return clear(box, h("span", { class: "muted small", text: "Carregue os autos na Esteira de Minutas." }));
    if (!c.pdf) {
      const partes = c.autos.split(/(⟦Pág\. \d+⟧)/);
      let atual = 1, txt = "";
      for (const p of partes) { const m = /⟦Pág\. (\d+)⟧/.exec(p); if (m) atual = Number(m[1]); else if (atual === S.pagina) txt += p; }
      return clear(box, h("pre", { text: txt.trim() || "(página sem texto)" }));
    }
    try {
      const page = await c.pdf.getPage(S.pagina);
      const vp0 = page.getViewport({ scale: 1 });
      const scale = Math.min(2, Math.max(0.6, (box.clientWidth - 16) / vp0.width)) * (window.devicePixelRatio || 1);
      const vp = page.getViewport({ scale });
      const canvas = h("canvas", { width: Math.floor(vp.width), height: Math.floor(vp.height), "aria-label": `Página ${S.pagina} dos autos` });
      if (renderTask) renderTask.cancel();
      renderTask = page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
      await renderTask.promise; renderTask = null;
      clear(box, canvas);
    } catch (e) { if (!(e && e.name === "RenderingCancelledException")) clear(box, h("span", { class: "muted small", text: "Não foi possível exibir esta página." })); }
  }
  function renderBusca() {
    const q = $("#busca").value.trim(), c = S.caso, box = $("#hits");
    if (q.length < 3 || !c.autos) return clear(box);
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const hits = []; let m;
    while ((m = re.exec(c.autos)) && hits.length < 60) {
      const antes = c.autos.lastIndexOf("⟦Pág.", m.index);
      const pag = antes >= 0 ? Number(c.autos.slice(antes + 6, c.autos.indexOf("⟧", antes))) : 1;
      const ini = Math.max(0, m.index - 70);
      const trecho = c.autos.slice(ini, m.index + m[0].length + 90).replace(/⟦Pág\. \d+⟧/g, " ");
      const k = trecho.toLowerCase().indexOf(q.toLowerCase());
      hits.push(h("button", { type: "button", onclick: () => { S.pagina = pag; renderPagina(); } },
        h("span", { class: "tag", text: "Pág. " + pag }), " …", trecho.slice(0, k), h("mark", { text: trecho.slice(k, k + q.length) }), trecho.slice(k + q.length), "…"));
    }
    clear(box, hits.length ? hits : [h("span", { class: "muted small", text: "Nada encontrado." })]);
  }

  // Autos integrais quando cabem na chamada junto com o resto; senão, o Resumo Executivo.
  const autosParaIA = (...outros) => {
    const c = S.caso, extra = outros.reduce((n, t) => n + AJ.bytes(typeof t === "string" ? t : JSON.stringify(t || "")), 0);
    if (c.autos && AJ.bytes(c.autos) + extra < 215000) return c.autos;
    if (c.resumo) return c.resumo;
    return c.autos.slice(0, Math.max(20000, 200000 - extra));
  };

  $("#b-auditar").addEventListener("click", async () => {
    const c = S.caso, minuta = $("#editor").value.trim();
    c.minuta = minuta;
    showErr($("#lupa-err"), null);
    const sem = c.autos ? AJ.verificarFidelidade(minuta, c.autos) : [];
    const alertas = sem.map((d) => `- ${d.tipo}: ${d.valor}`).join("\n");
    const diag = $("#diag"); clear(diag, h("p", { class: "muted", text: "Auditando… o Claude está lendo a minuta e os autos (pode levar até 2 minutos)." }));
    S.ctl = new AbortController(); renderBotoes();
    try {
      const diretriz = S.prompts.find((x) => x.id === $("#lupa-prompt").value) || null;
      const extras = { diretriz, caderno: (S.cfg.caderno && S.cfg.caderno.texto) || "", pontoAtencao: $("#lupa-ponto").value.trim() };
      const d = await ask(P.auditoria(minuta, autosParaIA(minuta, alertas, extras), alertas, extras), { tier: "complex", json: true, signal: S.ctl.signal });
      S.diag = { ...d, automaticas: sem };
      renderDiag();
      registrarAuditoria(d, sem, minuta);
    } catch (e) { clear(diag); showErr($("#lupa-err"), e); }
    finally { S.ctl = null; renderBotoes(); }
  });

  function renderDiag() {
    const d = S.diag, diag = $("#diag");
    const nota = Number(d.nota);
    clear($("#nota"), Number.isFinite(nota) ? h("span", { class: "pill " + (nota >= 8 ? "ok" : nota >= 6 ? "warn" : "bad"), text: `Nota ${nota.toFixed(1)}` }) : null);
    const L = (v) => (Array.isArray(v) ? v.filter((x) => x && (typeof x !== "string" || x.trim())) : []);
    const sec = (titulo, itens, grave = true) => h("div", { class: "sec" },
      h("h3", null, titulo, h("span", { class: "pill " + (itens.length ? (grave ? "bad" : "warn") : "ok"), text: String(itens.length) })),
      itens.length ? h("ul", { class: "list-ol" }, itens.map((i) => h("li", null, inline(String(i))))) : null);
    const aluc = [...(d.automaticas || []).map((x) => `${x.tipo}: ${x.valor} — não aparece nos autos`),
      ...L(d.alucinacoes).map((a) => `"${a.trecho}" — ${a.motivo}${a.fonteCorreta ? ` (correto: ${a.fonteCorreta})` : ""}`)];
    clear(diag,
      sec("Citra petita — risco de Embargos de Declaração", L(d.citraPetita)),
      sec("Ultra petita", L(d.ultraPetita)),
      sec("Extra petita", L(d.extraPetita)),
      sec("Possíveis alucinações", aluc),
      sec("Precedentes", L(d.precedentes).map((p) => `${p.precedente}: ${String(p.situacao || "").replace(/_/g, " ")}`), false),
      d.consectarios ? h("div", { class: "sec" }, h("h3", { text: "Consectários (Lei nº 14.905/2024)" }), h("p", { class: "small", text: d.consectarios })) : null,
      sec("Recomendações", L(d.recomendacoes), false),
      h("div", { class: "row" }, h("button", { class: "btn", type: "button", id: "b-gab", onclick: gerarGabarito, text: "Gerar minuta gabarito" })),
      h("div", { id: "gab" }));
  }

  async function gerarGabarito() {
    const box = $("#gab"), btn = $("#b-gab"); btn.disabled = true;
    clear(box, h("p", { class: "muted small", text: "Reescrevendo com as correções…" }));
    S.ctl = new AbortController();
    try {
      const r = await ask(P.gabarito(S.caso.minuta, autosParaIA(S.caso.minuta, S.diag), S.diag), { tier: "complex", signal: S.ctl.signal, onText: ({ text }) => clear(box, h("div", { class: "folha" }, md(text))) });
      const txt = r.text.trim();
      clear(box, h("div", { class: "row" }, h("button", { class: "btn ghost sm", type: "button", onclick: () => { S.caso.minuta = txt; pushVersao("Gabarito da Lupa"); renderCaso(); toast("Minuta substituída pelo gabarito."); }, text: "Usar o gabarito como minuta" })), h("div", { class: "folha" }, md(txt)));
    } catch (e) { showErr(box, e); btn.disabled = false; }
    finally { S.ctl = null; }
  }

  // ───────── Audiência ─────────
  $("#b-painel").addEventListener("click", async () => {
    const box = $("#painel"), btn = $("#b-painel"); btn.disabled = true;
    clear(box, h("p", { class: "muted small", text: "Preparando os 5 pilares…" }));
    try {
      const d = await ask(P.audiencia(S.caso.resumo || autosParaIA(), $("#i-part").value.trim()), { tier: "default", json: true });
      const L = (v) => (Array.isArray(v) ? v : []);
      const bloco = (t, v) => h("div", { class: "sec" }, h("h3", { text: t }), h("ul", { class: "list-ol" }, L(v).map((x) => h("li", null, inline(String(x))))));
      clear(box,
        bloco("Fatos incontroversos", d.fatosIncontroversos), bloco("Controvérsias", d.controversias), bloco("Provas produzidas", d.provasProduzidas),
        bloco("Ônus da prova", d.onusDaProva), bloco("Pontos a sanear", d.pontosASanear),
        h("div", { class: "sec" }, h("h3", { text: "Perguntas sugeridas" }), h("ol", { class: "list-ol" },
          L(d.perguntas).map((p) => h("li", null, h("strong", { text: (p.destinatario || "") + ": " }), String(p.pergunta || ""), p.finalidade ? h("span", { class: "muted small", text: ` (${p.finalidade})` }) : null)))));
    } catch (e) { showErr(box, e); }
    finally { btn.disabled = false; renderBotoes(); }
  });
  $("#b-termo").addEventListener("click", async () => {
    const box = $("#termo"), anot = $("#t-anot").value.trim();
    if (anot.length < 20) return showErr(box, "Escreva as anotações da audiência (pelo menos uma frase).");
    $("#b-termo").disabled = true;
    clear(box, h("p", { class: "muted small", text: "Redigindo…" }));
    try {
      const r = await ask(P.termo($("#s-tipo").value, S.caso.numero, anot), { tier: "default", cache: false, onText: ({ text }) => clear(box, h("div", { class: "folha" }, md(text))) });
      clear(box, h("div", { class: "folha" }, md(r.text)));
    } catch (e) { showErr(box, e); }
    finally { renderBotoes(); }
  });

  // ───────── Chat com a minuta ─────────
  // O Claude pode buscar e ler páginas dos autos (ferramentas da página) para reanalisar documentos.
  const tMsg = $("#t-msg");
  const INI = "===MINUTA ATUALIZADA===", FIM = "===FIM DA MINUTA===";
  tMsg.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviarChat(); });
  $("#b-enviar").addEventListener("click", enviarChat);
  $("#b-chat-parar").addEventListener("click", () => S.ctl && S.ctl.abort());
  $("#b-chat-nova").addEventListener("click", () => { S.chat = []; renderChat(); tMsg.focus(); });
  $("#chips").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-p]"); if (!b) return;
    tMsg.value = b.dataset.p; tMsg.focus();
    if (b.dataset.edit) tMsg.setSelectionRange(tMsg.value.length, tMsg.value.length);
    else enviarChat();
  });

  function separar(texto) {
    const i = texto.indexOf(INI);
    if (i < 0) return { conversa: texto, minuta: "" };
    const resto = texto.slice(i + INI.length), f = resto.indexOf(FIM);
    return { conversa: texto.slice(0, i).trim(), minuta: (f >= 0 ? resto.slice(0, f) : resto).trim(), completa: f >= 0 };
  }
  function aplicarMinuta(txt) {
    S.minutaAnterior = S.caso.minuta; S.caso.minuta = txt; pushVersao("Ajuste pelo chat");
    renderCaso(); salvarHistorico(); renderChat(); toast("Minuta atualizada. Use “Desfazer” para voltar.");
  }
  function renderMinutaChat() {
    const c = S.caso;
    $("#chat-ctx").textContent = c.autos ? `Autos: ${c.paginas} pág.` : c.minuta ? "Sem os autos (só a minuta)" : "";
    $("#chat-min-h").textContent = c.numero && c.numero !== "n/i" ? `Minuta atual · ${c.numero}` : "Minuta atual";
    clear($("#chat-min-acts"),
      S.minutaAnterior != null ? h("button", { class: "btn quiet sm", type: "button", onclick: () => { const x = S.caso.minuta; S.caso.minuta = S.minutaAnterior; S.minutaAnterior = null; renderCaso(); salvarHistorico(); renderChat(); toast("Alteração desfeita."); void x; }, text: "Desfazer" }) : null,
      c.minuta ? h("button", { class: "btn quiet sm", type: "button", onclick: copiarMinuta, text: "Copiar" }) : null);
    clear($("#chat-minuta"), c.minuta ? md(c.minuta) : h("div", { class: "placeholder" }, h("p", { text: "Nenhuma minuta ainda. Gere uma na Nova Análise ou abra uma do Histórico. Com os autos carregados, você já pode conversar sobre eles." })));
  }
  function renderChat(streaming) {
    const box = $("#msgs");
    renderMinutaChat();
    if (!S.chat.length && !streaming) return clear(box, h("p", { class: "muted small", text: "Pergunte qualquer coisa sobre a minuta ou os autos, ou use os atalhos abaixo. Quando o Claude propuser uma minuta alterada, você decide se aplica." }));
    clear(box, S.chat.map((m, idx) => {
      if (m.role === "user") return h("div", { class: "msg user", text: m.content });
      const { conversa, minuta, completa } = separar(m.content);
      return h("div", { class: "msg bot" },
        h("span", { class: "claude-chip", text: "Claude" }),
        h("div", { class: "folha" }, md(conversa || (minuta ? "Minuta atualizada abaixo." : ""))),
        m.fontes && m.fontes.length ? h("p", { class: "tool-note", text: "Consultou nos autos: " + m.fontes.join("; ") }) : null,
        minuta ? h("details", null, h("summary", { text: completa === false ? "Minuta proposta (resposta cortada — confira antes de aplicar)" : "Ver a minuta proposta" }), h("div", { class: "folha" }, md(minuta))) : null,
        minuta ? h("div", { class: "acts" },
          m.aplicada ? h("span", { class: "pill ok", text: "Aplicada" }) : h("button", { class: "btn sm", type: "button", onclick: () => { m.aplicada = true; aplicarMinuta(minuta); }, text: "Aplicar como minuta atual" })) : null);
    }), streaming || null);
    box.scrollTop = box.scrollHeight;
  }

  // Ferramentas que o Claude usa para ler os autos (dados pequenos por chamada).
  function paginasDoTexto(autos) {
    const pags = new Map(); let atual = 1;
    for (const p of autos.split(/(⟦Pág\. \d+⟧)/)) { const m = /⟦Pág\. (\d+)⟧/.exec(p); if (m) atual = Number(m[1]); else pags.set(atual, (pags.get(atual) || "") + p); }
    return pags;
  }
  function ferramentasAutos(fontes, nota) {
    const c = S.caso, pags = paginasDoTexto(c.autos);
    return [
      { name: "buscar_nos_autos", description: "Procura um termo nos autos (nome de peça, pessoa, valor, 'Mov. 18', 'laudo'...). Retorna até 12 ocorrências com a página e um trecho. Use antes de ler páginas.",
        inputSchema: { type: "object", properties: { termo: { type: "string", description: "Texto a procurar (mín. 3 letras)" } }, required: ["termo"] },
        execute: ({ termo }) => {
          const q = String(termo || "").trim(); if (q.length < 3) throw new Error("Informe ao menos 3 letras.");
          nota(`buscando “${q}”…`);
          const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), out = [];
          for (const [n, t] of pags) { let m; re.lastIndex = 0; while ((m = re.exec(t)) && out.length < 12) out.push({ pagina: n, trecho: t.slice(Math.max(0, m.index - 160), m.index + q.length + 200).replace(/\s+/g, " ").trim() }); if (out.length >= 12) break; }
          fontes.push(`busca “${q}”`);
          return out.length ? out : "Nada encontrado. Tente outro termo.";
        } },
      { name: "ler_paginas", description: "Lê o texto integral de páginas dos autos (até 6 páginas por vez). Retorna a lista {pagina, texto}. Use para reanalisar um documento.",
        inputSchema: { type: "object", properties: { inicio: { type: "integer", minimum: 1 }, fim: { type: "integer", minimum: 1 } }, required: ["inicio"] },
        execute: ({ inicio, fim }) => {
          const a = Math.max(1, Math.floor(Number(inicio) || 1)), b = Math.min(c.paginas || a, Math.max(a, Math.floor(Number(fim) || a)), a + 5);
          nota(`lendo pág. ${a}${b > a ? "–" + b : ""}…`);
          const out = []; let total = 0;
          for (let n = a; n <= b; n++) { const t = (pags.get(n) || "").trim().slice(0, 30000 - total); total += t.length; out.push({ pagina: n, texto: t || "(página sem texto)" }); if (total >= 30000) break; }
          fontes.push(`pág. ${a}${b > a ? "–" + b : ""}`);
          return out;
        } },
    ];
  }

  async function enviarChat() {
    const msg = tMsg.value.trim(), c = S.caso;
    if (!msg || $("#b-enviar").disabled) return;
    showErr($("#chat-err"), null);
    S.chat.push({ role: "user", content: msg }); tMsg.value = "";
    const bolha = h("div", { class: "msg bot" }, h("span", { class: "claude-chip", text: "Claude" }), h("p", { class: "muted small", text: "Pensando…" }));
    renderChat(bolha);
    S.ctl = new AbortController(); renderBotoes(); $("#b-chat-parar").hidden = false;
    const fontes = [], nota = (t) => { const n = bolha.querySelector(".tool-note") || bolha.appendChild(h("p", { class: "tool-note" })); n.textContent = "Consultando os autos: " + t; };
    const usarFerramentas = !!(c.autos && S.cap.tools);
    // Sem ferramentas, os autos vão no texto quando cabem; senão, o resumo.
    const autosTexto = !usarFerramentas && c.autos ? autosParaIA(c.minuta, c.resumo) : "";
    const contexto = P.chat({ resumo: (c.resumo || "").slice(0, 60000), minuta: c.minuta, paginas: c.paginas, nomeAutos: c.nome, ferramentas: usarFerramentas, autosTexto: autosTexto === c.resumo ? "" : autosTexto });
    // Histórico curto; respostas antigas com minuta vão abreviadas (a minuta atual já está no contexto).
    let hist = S.chat.slice(-8).map((m) => ({ role: m.role, content: m.role === "assistant" ? (separar(m.content).conversa || "Propus uma minuta atualizada.").slice(0, 3000) : m.content }));
    while (hist.length && hist[0].role !== "user") hist.shift();
    hist[0] = { role: "user", content: contexto + "\n\n---\nMENSAGEM:\n" + hist[0].content };
    const opts = { tier: "default", cache: false, signal: S.ctl.signal, onText: ({ text }) => { const { conversa, minuta } = separar(text); clear(bolha, h("span", { class: "claude-chip", text: "Claude" }), h("div", { class: "folha" }, md(conversa)), minuta ? h("p", { class: "muted small", text: "Redigindo a minuta atualizada…" }) : null); } };
    try {
      let r;
      if (usarFerramentas) {
        const { cache, ...semCache } = opts;
        r = await S.cap.sample(hist, { modelTier: "default", signal: semCache.signal, onText: semCache.onText, tools: ferramentasAutos(fontes, nota) });
      } else r = await ask(hist, opts);
      S.chat.push({ role: "assistant", content: r.text, fontes });
      renderChat();
    } catch (e) {
      if (e && e.code === "cancelled") { S.chat.push({ role: "assistant", content: (e.text || "") + "\n\n*(interrompido)*", fontes }); renderChat(); }
      else { S.chat.pop(); tMsg.value = msg; renderChat(); showErr($("#chat-err"), e); }
    } finally { S.ctl = null; $("#b-chat-parar").hidden = true; renderBotoes(); }
  }

  // ───────── Precedentes ─────────
  const FILTROS = ["TODOS", "STF", "STJ", "TNU", "TJGO", "GABINETE"];
  function renderFiltros() {
    clear($("#filtros"), FILTROS.map((f) => h("button", { class: "btn sm " + (S.filtro === f ? "" : "quiet"), type: "button", "aria-pressed": String(S.filtro === f), onclick: () => { S.filtro = f; renderFiltros(); renderPrecedentes(); }, text: f })));
  }
  $("#prec-q").addEventListener("input", () => renderPrecedentes());
  function renderPrecedentes() {
    const q = $("#prec-q").value.trim().toLowerCase();
    const lista = S.precedentes.filter((p) => (S.filtro === "TODOS" || p.tribunal === S.filtro) && (!q || `${p.identificador} ${p.enunciado} ${(p.palavrasChave || []).join(" ")}`.toLowerCase().includes(q)));
    $("#prec-h").textContent = `Repositório vinculante · ${S.precedentes.length}`;
    clear($("#prec-list"), lista.length ? lista.slice(0, 300).map((p) => h("div", { class: "item" },
      h("div", { class: "row" }, h("span", null, h("span", { class: "tag", text: p.tribunal }), " ", h("strong", { text: p.identificador }), " ", h("span", { class: "muted small", text: String(p.tipo || "").replace(/_/g, " ") }))),
      h("p", { text: p.enunciado }),
      p.fonte ? h("span", { class: "muted small", text: "Fonte: " + p.fonte }) : null))
      : [h("p", { class: "muted", text: S.precedentes.length ? "Nenhum precedente com esse filtro." : "Nenhum precedente ainda. Importe informativos e cadernos em PDF do STF, STJ, TNU ou TJGO: o Claude lê cada bloco e indexa os julgados aqui para todo o gabinete." })]);
    if (lista.length > 300) $("#prec-list").append(h("p", { class: "muted small", text: `Mostrando 300 de ${lista.length}. Refine a busca.` }));
  }

  let falhasImport = null;
  $("#f-prec").addEventListener("change", async () => {
    const file = $("#f-prec").files[0]; $("#f-prec").value = "";
    if (!file) return;
    const st = $("#prec-status");
    try {
      clear(st, h("div", { class: "info", text: `Lendo ${file.name}…` }));
      const r = await lerPdf(file, (n, t) => clear(st, h("div", { class: "info", text: `Lendo ${file.name}: página ${n} de ${t}` })));
      r.doc.destroy && r.doc.destroy();
      const texto = r.texto.replace(/⟦Pág\. \d+⟧/g, " ");
      await importarBlocos(file.name, AJ.chunkText(texto, 30000), r.paginas);
    } catch (e) { showErr(st, e.code ? e : "Não foi possível ler o PDF: " + (e.message || e)); }
  });

  async function importarBlocos(fonte, blocos, paginas, apenas) {
    const st = $("#prec-status"), total = blocos.length, alvo = apenas || blocos.map((_, i) => i);
    const falhas = []; let feitos = 0, gravados = 0, parar = false;
    const info = () => clear(st, h("div", { class: "info" }, `${fonte}: ${feitos} de ${alvo.length} bloco(s) lidos · ${gravados} julgado(s) indexados`,
      h("div", { class: "bar", style: "margin-top:6px" }, h("i", { style: `width:${(100 * feitos) / alvo.length}%` }))));
    info();
    let proximo = 0;
    const worker = async () => {
      while (!parar && proximo < alvo.length) {
        const idx = alvo[proximo++];
        try {
          const d = await ask(P.precedentes(blocos[idx], fonte, idx + 1, total), { tier: "default", json: true });
          const itens = (Array.isArray(d && d.itens) ? d.itens : []).map((p) => AJ.normalizarPrecedente(p, fonte)).filter(Boolean);
          for (const it of itens) { await gravarPrecedente(it); gravados++; }
        } catch (e) {
          if (e && ["not_granted", "sampling_disabled", "rate_limited", "session_expired", "capability_disabled"].includes(e.code)) { parar = true; showErr(st, e); }
          falhas.push(idx);
        }
        feitos++; if (!parar) info();
      }
    };
    await Promise.all([worker(), worker()]);
    if (parar) return;
    falhasImport = falhas.length ? { fonte, blocos, paginas, falhas } : null;
    clear(st, h("div", { class: falhas.length ? "warnbox" : "info" },
      `${fonte}: ${paginas} página(s) em ${total} bloco(s) → ${gravados} julgado(s) indexados.`,
      falhas.length ? [` Blocos com falha: ${falhas.map((i) => i + 1).sort((a, b) => a - b).join(", ")}. `, h("button", { class: "btn sm quiet", type: "button", onclick: () => importarBlocos(fonte, blocos, paginas, falhasImport.falhas), text: "Reprocessar blocos com falha" })] : null));
  }
  async function gravarPrecedente(p) {
    const doc = { ...p, importadoEm: Date.now() };
    if (S.cap.db) await S.cap.db.collection("precedentes").doc(p.id).set(doc);
    else if (!S.precedentes.some((x) => x.id === p.id)) { S.precedentes.push(doc); renderPrecedentes(); }
  }

  // ───────── Gabinete: paradigmas e teses ─────────
  function renderParadigmas() {
    const sel = $("#s-paradigma");
    clear(sel, h("option", { value: "", text: "Sem paradigma" }), S.paradigmas.map((p) => h("option", { value: p.id, text: `${p.titulo} (${p.tipoAto})` })));
    if (S.paradigmaId && !S.paradigmas.some((p) => p.id === S.paradigmaId)) S.paradigmaId = "";
    sel.value = S.paradigmaId;
    clear($("#par-list"), S.paradigmas.length ? S.paradigmas.map((p) => h("div", { class: "item" },
      h("div", { class: "row" }, h("span", null, h("strong", { text: p.titulo }), " ", h("span", { class: "tag", text: p.tipoAto })),
        h("div", { class: "row" },
          h("button", { class: "btn sm " + (S.paradigmaId === p.id ? "" : "ghost"), type: "button", onclick: () => injetar(p.id), text: S.paradigmaId === p.id ? "⚡ Injetado" : "⚡ Injetar no Prompt" }),
          S.cap.canEdit ? h("button", { class: "btn sm quiet", type: "button", onclick: () => removerDoc("paradigmas", p.id, p.titulo), text: "Remover" }) : null)),
      h("p", { class: "muted small", text: p.texto.slice(0, 220) + (p.texto.length > 220 ? "…" : "") })))
      : [h("p", { class: "muted small", text: "Nenhum paradigma cadastrado. Cole uma decisão anterior do magistrado para que as minutas sigam o mesmo estilo, a mesma ordem de tópicos e o mesmo formato de dispositivo." })]);
  }
  function injetar(id) {
    S.paradigmaId = id;
    try { sessionStorage.setItem("aj.paradigma", id); } catch (e) { /* sem armazenamento */ }
    renderParadigmas(); abrirAba("esteira"); toast("Paradigma injetado na próxima minuta.");
  }
  $("#s-paradigma").addEventListener("change", (e) => { S.paradigmaId = e.target.value; try { sessionStorage.setItem("aj.paradigma", S.paradigmaId); } catch (x) { /* */ } renderParadigmas(); });

  function renderTeses() {
    clear($("#tes-list"), S.teses.length ? S.teses.map((t) => h("div", { class: "item" },
      h("div", { class: "row" }, h("strong", { text: t.titulo }),
        S.cap.canEdit ? h("button", { class: "btn sm quiet", type: "button", onclick: () => salvarDoc("teses", t.id, { ...t, ativa: t.ativa === false }), text: t.ativa === false ? "Reativar" : "Desativar" })
          : h("span", { class: "pill " + (t.ativa === false ? "" : "ok"), text: t.ativa === false ? "inativa" : "ativa" })),
      h("p", { text: t.texto })))
      : [h("p", { class: "muted small", text: "Nenhuma tese cadastrada. As teses ativas entram em toda minuta gerada, como entendimento do juízo." })]);
  }

  // Remoção com confirmação dentro da página (o visualizador não exibe confirm()).
  function removerDoc(col, id, titulo) {
    const box = $(col === "paradigmas" ? "#par-list" : "#tes-list");
    const aviso = h("div", { class: "warnbox row" }, `Remover “${titulo}”? Esta ação não pode ser desfeita.`,
      h("button", { class: "btn danger sm", type: "button", onclick: async () => { try { if (S.cap.db) await S.cap.db.collection(col).doc(id).delete(); else { S[col] = S[col].filter((x) => x.id !== id); col === "paradigmas" ? renderParadigmas() : renderTeses(); } } catch (e) { toast("Não foi possível remover."); } aviso.remove(); }, text: "Remover" }),
      h("button", { class: "btn quiet sm", type: "button", onclick: () => aviso.remove(), text: "Cancelar" }));
    box.prepend(aviso);
  }
  async function salvarDoc(col, id, dados) {
    const doc = { ...dados, id, atualizadoEm: Date.now() };
    try {
      if (S.cap.db) await S.cap.db.collection(col).doc(id).set(doc);
      else { const i = S[col].findIndex((x) => x.id === id); if (i >= 0) S[col][i] = doc; else S[col].push(doc); col === "teses" ? renderTeses() : renderParadigmas(); }
      return true;
    } catch (e) { toast(e && e.code === "invalid_argument" ? "Você não tem permissão para alterar isto." : "Não foi possível salvar."); return false; }
  }
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  $("#par-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const titulo = $("#par-titulo").value.trim(), texto = $("#par-texto").value.trim();
    if (titulo.length < 3 || texto.length < 200) return toast("Informe um título e a íntegra da decisão (mínimo de 200 caracteres).");
    if (await salvarDoc("paradigmas", novoId(), { titulo, tipoAto: $("#par-tipo").value.trim() || "Sentença", texto: texto.slice(0, 120000) })) { $("#par-titulo").value = ""; $("#par-texto").value = ""; toast("Paradigma adicionado."); }
  });
  $("#tes-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const titulo = $("#tes-titulo").value.trim(), texto = $("#tes-texto").value.trim();
    if (titulo.length < 3 || texto.length < 10) return toast("Informe o título e o entendimento.");
    if (await salvarDoc("teses", novoId(), { titulo, texto, ativa: true })) { $("#tes-titulo").value = ""; $("#tes-texto").value = ""; toast("Tese adicionada."); }
  });

  // Consectários
  $("#b-calc").addEventListener("click", () => {
    const out = $("#cx-out");
    try {
      const ym = (v) => { if (!/^\d{4}-\d{2}$/.test(v)) throw new Error("Use competências no formato AAAA-MM."); return v; };
      const { ipca, selic } = AJ.parseSeries($("#cx-s").value);
      const r = AJ.calcularConsectarios({ principal: Number($("#cx-p").value), inicioCorrecao: ym($("#cx-c").value.trim()), inicioJuros: ym($("#cx-j").value.trim()), fim: ym($("#cx-fim").value.trim()), ipca, selic });
      const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const pct = (n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) + "%";
      clear(out, h("div", { class: "tbl" }, h("table", null,
        h("thead", null, h("tr", null, ["Competência", "IPCA", "Selic", "Taxa legal", "Fator"].map((t) => h("th", { text: t })))),
        h("tbody", null, r.memoria.map((m) => h("tr", null, h("td", { text: m.c }), h("td", { text: pct(m.i) }), h("td", { text: pct(m.s) }), h("td", { text: pct(m.tl) }), h("td", { text: m.fator.toFixed(6) })))),
        h("tfoot", null,
          h("tr", null, h("td", { text: "Valor corrigido" }), h("td", { colspan: "4", text: brl(r.corrigido) })),
          h("tr", null, h("td", { text: `Juros (${pct(r.jurosPct)})` }), h("td", { colspan: "4", text: brl(r.juros) })),
          h("tr", null, h("th", { text: "Total" }), h("th", { colspan: "4", text: brl(r.total) }))))));
    } catch (e) { showErr(out, e.message || String(e)); }
  });

  // ───────── Histórico (privado por pessoa) ─────────
  async function salvarHistorico() {
    const c = S.caso;
    if (!S.cap.db || !S.cap.uid || !c.minuta || c.exemplo) return;
    const id = c.histId || (c.histId = novoId());
    try {
      await S.cap.db.collection("data/users/" + S.cap.uid).doc("m-" + id).set({
        numero: c.numero || "n/i", arquivo: c.nome, criadoEm: Date.now(),
        minuta: c.minuta.slice(0, 90000), resumo: c.resumo.slice(0, 90000),
        pedidos: c.dossie ? c.dossie.pedidos.map((p) => ({ id: p.id, litisconsorte: p.litisconsorte, descricao: p.descricao })) : [],
      });
    } catch (e) { /* histórico é conveniência: falha não interrompe o trabalho */ }
  }
  function renderHistorico() {
    const box = $("#hist-list");
    if (!S.cap.db || !S.cap.uid) return clear(box, h("p", { class: "muted small", text: "O histórico fica disponível quando a página é aberta no claude.ai com sua conta." }));
    clear(box, S.historico.length ? S.historico.map((m) => h("div", { class: "item" },
      h("div", { class: "row" }, h("span", null, h("span", { class: "tag", text: m.peca ? "Peça" : "Minuta" }), " ", h("strong", { text: m.numero }), " ", h("span", { class: "muted small", text: new Date(m.criadoEm).toLocaleString("pt-BR") })),
        h("div", { class: "row" },
          h("button", { class: "btn sm ghost", type: "button", onclick: () => abrirHistorico(m), text: "Abrir" }),
          h("button", { class: "btn sm quiet", type: "button", onclick: async () => { try { await S.cap.db.collection("data/users/" + S.cap.uid).doc(m._id).delete(); } catch (e) { toast("Não foi possível excluir."); } }, text: "Excluir" }))),
      h("p", { class: "muted small", text: m.arquivo || "" })))
      : [h("p", { class: "muted small", text: "Nenhuma minuta salva ainda. Cada minuta gerada a partir de autos reais é guardada aqui, visível só para você (os autos em si não são guardados)." })]);
  }
  function abrirHistorico(m) {
    if (m.peca) { PT.peca = m.peca; PT.titulo = m.numero; PT.tipo = m.tipo || "inicial"; PT.analise = null; PT.aba = "peca"; PT.histId = m._id.replace(/^p-/, ""); renderPt(); return abrirAba("peticao"); }
    novoCaso({ nome: `${m.arquivo || "Minuta salva"} (sem os autos)`, minuta: m.minuta, resumo: m.resumo, numero: m.numero,
      dossie: m.pedidos && m.pedidos.length ? AJ.normalizarDossie({ numeroProcesso: m.numero, pedidos: m.pedidos }) : null, histId: m._id.replace(/^m-/, "") });
    abrirAba("esteira");
  }

  // ───────── Modo Simplificado / Avançado e guia rápido ─────────
  function aplicarModo(m) {
    document.body.classList.toggle("simples", m === "simples");
    $("#seg-modo").querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === m)));
    lembrar("aj.modo", m);
  }
  $("#seg-modo").addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (b) aplicarModo(b.dataset.v); });
  try { aplicarModo(localStorage.getItem("aj.modo") || "simples"); } catch (e) { aplicarModo("simples"); }
  function guiaRecolhida(v) {
    $("#passos").hidden = v; $("#b-guia-fechar").textContent = v ? "Mostrar" : "Recolher";
    lembrar("aj.guia", v ? "1" : "");
  }
  $("#b-guia-fechar").addEventListener("click", () => guiaRecolhida(!$("#passos").hidden));
  try { guiaRecolhida(localStorage.getItem("aj.guia") === "1"); } catch (e) { /* */ }
  function renderPassos() {
    const c = S.caso, feito = { 1: !!c.autos, 2: !!c.autos && (!!S.promptId || S.tipoAto !== "auto"), 3: !!S.paradigmaId, 4: !!c.minuta };
    $("#passos").querySelectorAll("li").forEach((li) => li.classList.toggle("feito", !!feito[li.dataset.p]));
  }

  // ───────── Versões da minuta ─────────
  function pushVersao(origem) {
    const c = S.caso; if (!c.minuta) return;
    const v = c.versoes || (c.versoes = []);
    if (v.length && v[v.length - 1].texto === c.minuta) return;
    v.push({ em: Date.now(), origem, texto: c.minuta });
    if (v.length > 20) v.shift();
  }

  // ───────── Abas do resultado ─────────
  let resAba = "minuta", cmp = { a: null, b: null };
  $("#res-tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (!b) return; resAba = b.dataset.v; renderRes(); });
  const L = (v) => (Array.isArray(v) ? v : []);
  function renderRes() {
    const c = S.caso, view = $("#res-view");
    $("#res-tabs").querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.v === resAba)));
    $("#n-versoes").textContent = c.versoes && c.versoes.length ? `(${c.versoes.length})` : "";
    $("#minuta").hidden = resAba !== "minuta"; view.hidden = resAba === "minuta";
    if (resAba === "minuta") return;
    const vazio = (t) => clear(view, h("p", { class: "muted small", text: t }));
    if (resAba === "linha") {
      const cr = c.dossie ? L(c.dossie.cronologia) : [];
      if (!cr.length) return vazio("A linha do tempo aparece depois da Etapa 1 (gere a minuta).");
      return clear(view, h("ol", { class: "tl" }, cr.map((e) => h("li", null,
        h("strong", { text: `${e.data || "s/d"} · ${String(e.tipo || "").replace(/_/g, " ")}` }), " ", h("span", { class: "ref", text: AJ.loc ? AJ.loc(e) : [e.mov && "Mov. " + e.mov, e.arq && "Arq. " + e.arq, e.pag && "Pág. " + e.pag].filter(Boolean).join(", ") }),
        h("p", { style: "margin:2px 0 0", text: e.resumo || "" }),
        L(e.transcricoes).filter(Boolean).map((q) => h("p", { class: "q", text: `“${q}”` }))))));
    }
    if (resAba === "fato") {
      if (!c.dossie || !c.minuta) return vazio("Gere a minuta para montar a matriz de confronto Fato × Prova.");
      const btn = h("button", { class: "btn sm", type: "button", disabled: !S.cap.sample || !!S.ctl, text: c.fato ? "Montar de novo" : "Montar matriz Fato × Prova", onclick: async () => {
        btn.disabled = true; btn.textContent = "Montando…";
        try { const d = await ask(P.fatoProva(c.dossie, c.minuta), { tier: "default", json: true }); c.fato = L(d && d.itens); renderRes(); }
        catch (e) { showErr(err, e); btn.disabled = false; btn.textContent = "Tentar de novo"; } } });
      const err = h("div");
      return clear(view, h("div", { class: "row" }, btn, h("span", { class: "muted small", text: "Cada fato relevante com a prova, a análise, o fundamento e o impacto no julgamento." })), err,
        c.fato ? h("div", { class: "items", style: "margin-top:10px" }, c.fato.map((i) => h("div", { class: "item" },
          h("strong", { text: i.fato }),
          h("p", { class: "small" }, h("strong", { text: "Prova: " }), i.prova || "—", i.localizacao ? [" ", h("span", { class: "ref", text: i.localizacao })] : null),
          i.analise ? h("p", { class: "small" }, h("strong", { text: "Análise: " }), i.analise) : null,
          i.fundamento ? h("p", { class: "small" }, h("strong", { text: "Fundamento: " }), i.fundamento) : null,
          i.valoracao ? h("p", { class: "small" }, h("strong", { text: "Valoração: " }), i.valoracao) : null))) : null);
    }
    if (resAba === "conf") {
      if (!c.autos && !c.resumo) return vazio("Carregue os autos para conferir competência, alçada, legitimidade, documentos e consectários.");
      const err = h("div");
      const btn = h("button", { class: "btn sm", type: "button", disabled: !S.cap.sample || !!S.ctl, text: c.conf ? "Conferir de novo" : "Conferir conformidade", onclick: async () => {
        btn.disabled = true; btn.textContent = "Conferindo…";
        try { const d = await ask(P.conformidade(autosParaIA(c.dossie), c.dossie), { tier: "default", json: true }); c.conf = { itens: L(d && d.itens), sintese: (d && d.sintese) || "" }; renderRes(); }
        catch (e) { showErr(err, e); btn.disabled = false; btn.textContent = "Tentar de novo"; } } });
      const ST = { ok: "✓ regular", alerta: "! conferir", falha: "✗ irregular", nao_aplicavel: "— não se aplica" };
      const grupos = c.conf ? [...new Set(c.conf.itens.map((i) => i.grupo || "Geral"))] : [];
      return clear(view, h("div", { class: "row" }, btn, h("span", { class: "muted small", text: "Alertas e pontos críticos do processo antes de decidir." })), err,
        c.conf && c.conf.sintese ? h("div", { class: "info", style: "margin-top:10px", text: c.conf.sintese }) : null,
        grupos.map((g) => h("div", { class: "sec", style: "margin-top:12px" }, h("h3", { text: g }),
          h("div", { class: "checks" }, c.conf.itens.filter((i) => (i.grupo || "Geral") === g).map((i) => h("div", { class: "item" },
            h("div", { class: "row" }, h("strong", { class: "small", text: i.requisito }), h("span", { class: "small st-" + i.status, text: ST[i.status] || i.status })),
            i.observacao ? h("p", { class: "small muted", text: i.observacao + (i.localizacao ? ` (${i.localizacao})` : "") }) : null))))));
    }
    if (resAba === "raiox") {
      const m = c.meta;
      if (!m) return vazio("O Raio-X mostra o que o Claude usou para redigir: aparece depois de gerar a minuta.");
      const { densos, nao, sem } = conferencia();
      const linha = (rot, val) => h("div", { class: "check" }, h("span", { text: rot }), h("strong", { class: "small", text: val }));
      return clear(view, h("div", { class: "checks" },
        linha("Motor", "Claude (sua conta do claude.ai)"),
        linha("Autos", `${c.paginas} página(s), ${c.autos.length.toLocaleString("pt-BR")} caracteres${m.blocos > 1 ? `, lidos em ${m.blocos} blocos` : ""}`),
        linha("Tipo de ato", m.tipoAto), linha("Prompt da área", m.prompt || "Padrão do sistema"),
        linha("Unidade", m.unidade || "—"), linha("Minuta Paradigma (espelho)", m.paradigma || "sem paradigma"),
        linha("Caderno de Teses", m.caderno ? "aplicado" : "não aplicado"), linha("Teses avulsas aplicadas", String(m.teses)),
        linha("Base de Conhecimento", m.conhecimento ? `${m.conhecimento} documento(s)` : "nenhum"),
        linha("Precedentes injetados", m.precedentes.length ? String(m.precedentes.length) : "nenhum"),
        linha("Pedidos no dossiê", String(c.dossie ? c.dossie.pedidos.length : 0)),
        linha("Pedidos não apreciados", String(nao.length)), linha("Dados sem lastro nos autos", String(sem.length)), linha("Parágrafos densos", String(densos))),
        m.precedentes.length ? h("div", { class: "sec", style: "margin-top:10px" }, h("h3", { text: "Precedentes enviados ao Claude" }), h("ul", { class: "list-ol" }, m.precedentes.map((p) => h("li", { class: "small", text: p })))) : null,
        m.instrucao ? h("div", { class: "sec", style: "margin-top:10px" }, h("h3", { text: "Orientação do co-piloto" }), h("p", { class: "small", text: m.instrucao })) : null);
    }
    if (resAba === "versoes") {
      const v = c.versoes || [];
      if (!v.length) return vazio("Cada minuta gerada, aprofundada, ajustada pelo chat ou editada fica guardada aqui nesta sessão.");
      if (cmp.a == null || cmp.a >= v.length) cmp.a = Math.max(0, v.length - 2);
      if (cmp.b == null || cmp.b >= v.length) cmp.b = v.length - 1;
      const rot = (x, i) => `v${i + 1} · ${x.origem} · ${new Date(x.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      const sel = (k) => { const e = h("select", { onchange: (ev) => { cmp[k] = Number(ev.target.value); renderRes(); } }, v.map((x, i) => h("option", { value: String(i), text: rot(x, i) }))); e.value = String(cmp[k]); return e; };
      const pars = (t) => t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      const A = pars(v[cmp.a].texto), B = pars(v[cmp.b].texto), sa = new Set(A), sb = new Set(B);
      const itens = v.map((x, i) => {
        const restaurar = x.texto === c.minuta ? null : h("button", { class: "btn sm ghost", type: "button", text: "Restaurar",
          onclick: () => { c.minuta = x.texto; pushVersao(`Restaurada (v${i + 1})`); renderCaso(); toast("Versão restaurada."); } });
        return h("div", { class: "item" }, h("div", { class: "row" }, h("span", { class: "small", text: rot(x, i) + (x.texto === c.minuta ? " · atual" : "") }), restaurar));
      }).reverse();
      let comparar = null;
      if (v.length > 1) {
        const colA = h("div", { class: "col" }, A.map((p) => h("p", { class: sb.has(p) ? "" : "del", text: p })));
        const colB = h("div", { class: "col" }, B.map((p) => h("p", { class: sa.has(p) ? "" : "add", text: p })));
        comparar = h("div", { class: "sec", style: "margin-top:14px" }, h("h3", { text: "Comparar lado a lado" }),
          h("div", { class: "grid g-2" }, sel("a"), sel("b")),
          h("p", { class: "small muted", text: `${A.filter((p) => !sb.has(p)).length} parágrafo(s) só na esquerda (vermelho) · ${B.filter((p) => !sa.has(p)).length} só na direita (verde)` }),
          h("div", { class: "cmp" }, colA, colB));
      }
      return clear(view, h("div", { class: "items" }, itens), comparar);
    }
  }

  // Trecho selecionado da minuta → Caderno de Teses (só Juiz(a)/Editor).
  async function selecaoParaCaderno() {
    const sel = String(window.getSelection ? window.getSelection() : "").trim();
    if (sel.length < 20) return toast("Selecione na minuta o trecho (ao menos uma frase) e clique de novo.");
    const atual = (S.cfg.caderno && S.cfg.caderno.texto) || "";
    if (await setCfg("caderno", { texto: (atual ? atual.trimEnd() + "\n\n" : "") + sel.slice(0, 8000) })) toast("Trecho injetado no Caderno de Teses.");
  }

  // ───────── Gravação genérica no banco do gabinete ─────────
  // Sem db (fora do claude.ai), guarda só nesta sessão para a página continuar utilizável.
  async function gravar(col, id, dados, local) {
    try {
      if (S.cap.db) await S.cap.db.collection(col).doc(id).set({ ...dados, atualizadoEm: Date.now() });
      else local();
      return true;
    } catch (e) { toast(e && e.code === "invalid_argument" ? "Você não tem permissão para alterar isto." : "Não foi possível salvar."); return false; }
  }
  async function apagar(col, id, local) {
    try { if (S.cap.db) await S.cap.db.collection(col).doc(id).delete(); else local(); return true; }
    catch (e) { toast("Não foi possível remover."); return false; }
  }
  function confirmar(box, texto, acao) {
    const aviso = h("div", { class: "warnbox row" }, texto,
      h("button", { class: "btn danger sm", type: "button", onclick: async () => { await acao(); aviso.remove(); }, text: "Remover" }),
      h("button", { class: "btn quiet sm", type: "button", onclick: () => aviso.remove(), text: "Cancelar" }));
    box.prepend(aviso);
  }
  const setCfg = (id, dados) => gravar("config", id, dados, () => { S.cfg[id] = { ...dados }; renderCfg(); });

  // ───────── Topo: unidade e prompt ativos; aviso do gabinete ─────────
  function renderContexto() {
    const sel = $("#s-unidade");
    if (S.unidadeId && !S.unidades.some((u) => u.id === S.unidadeId)) S.unidadeId = "";
    if (!S.unidadeId && S.unidades.length) S.unidadeId = S.unidades[0].id;
    clear(sel, S.unidades.map((u) => h("option", { value: u.id, text: `${u.nome} — ${u.comarca}` })));
    sel.value = S.unidadeId;
    $("#ctx-unidade").hidden = !S.unidades.length;
    const ativos = S.prompts.filter((x) => x.ativo !== false);
    if (S.promptId && !ativos.some((x) => x.id === S.promptId)) S.promptId = "";
    const pa = ativos.find((x) => x.id === S.promptId);
    $("#prompt-ativo").textContent = pa ? pa.titulo : "Padrão do sistema";
    for (const [id, vazio] of [["#s-prompt", "Padrão do sistema (sem instruções de área)"], ["#lupa-prompt", "Nenhuma"], ["#pt-prompt", "Nenhum"], ["#mu-prompt", "Sentença de instrução e julgamento (padrão)"]]) {
      const el = $(id), atual = id === "#s-prompt" ? S.promptId : el.value;
      clear(el, h("option", { value: "", text: vazio }), ativos.map((x) => h("option", { value: x.id, text: `${x.titulo} · ${x.area}` })));
      el.value = ativos.some((x) => x.id === atual) ? atual : "";
    }
  }
  $("#s-unidade").addEventListener("change", (e) => { S.unidadeId = e.target.value; lembrar("aj.unidade", S.unidadeId); });
  $("#s-prompt").addEventListener("change", (e) => { S.promptId = e.target.value; lembrar("aj.prompt", S.promptId); renderContexto(); });
  $("#b-prompt-ativo").addEventListener("click", () => { abrirAba("esteira"); $("#s-prompt").focus(); });
  $("#seg-ato").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]"); if (!b) return;
    S.tipoAto = b.dataset.v;
    $("#seg-ato").querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    renderPassos();
  });

  function renderCfg() {
    const av = S.cfg.aviso || {};
    $("#aviso").hidden = !(av.ativo && av.texto);
    $("#aviso").className = "aviso" + (av.nivel === "alerta" ? " alerta" : "");
    $("#aviso-t").textContent = av.texto || "";
    if (document.activeElement !== $("#av-texto")) $("#av-texto").value = av.ativo ? av.texto || "" : "";
    const cad = S.cfg.caderno || {};
    if (document.activeElement !== $("#cad-texto")) $("#cad-texto").value = cad.texto || "";
    $("#cad-info").textContent = cad.atualizadoEm ? "Atualizado em " + new Date(cad.atualizadoEm).toLocaleString("pt-BR") : "";
    renderProjudi();
    renderGcal();
  }
  $("#b-cad").addEventListener("click", async () => { if (await setCfg("caderno", { texto: $("#cad-texto").value.slice(0, 60000) })) toast("Caderno de Teses salvo."); });
  $("#av-pub").addEventListener("click", async () => {
    const texto = $("#av-texto").value.trim();
    if (texto.length < 3) return toast("Escreva o aviso.");
    if (await setCfg("aviso", { texto, nivel: "info", ativo: true })) toast("Aviso publicado.");
  });
  $("#av-ret").addEventListener("click", async () => { if (await setCfg("aviso", { texto: "", nivel: "info", ativo: false })) toast("Aviso retirado."); });

  // ───────── Prompts por Área ─────────
  const AREAS = ["Juizado Especial Cível", "Cível", "Fazenda Pública", "Juizado da Fazenda Pública", "Família e Sucessões", "Previdenciário", "Criminal", "Outros"];
  clear($("#pr-area"), AREAS.map((a) => h("option", { value: a, text: a })));
  let prEdit = null;
  function renderPrompts() {
    $("#pr-h").textContent = `Prompts do gabinete · ${S.prompts.length}`;
    clear($("#pr-list"), S.prompts.length ? S.prompts.map((x) => h("div", { class: "item" },
      h("div", { class: "row" }, h("span", null, h("strong", { text: x.titulo }), " ", h("span", { class: "tag", text: x.area }), x.ativo === false ? h("span", { class: "muted small", text: " · inativo" }) : null),
        h("div", { class: "row" },
          x.ativo !== false ? h("button", { class: "btn sm " + (S.promptId === x.id ? "" : "ghost"), type: "button", onclick: () => { S.promptId = x.id; lembrar("aj.prompt", x.id); renderContexto(); renderPrompts(); toast("Prompt ativo na Nova Análise."); }, text: S.promptId === x.id ? "Ativo" : "Usar" }) : null,
          S.cap.canEdit ? h("button", { class: "btn sm quiet", type: "button", onclick: () => editarPrompt(x), text: "Editar" }) : null,
          S.cap.canEdit ? h("button", { class: "btn sm quiet", type: "button", onclick: () => confirmar($("#pr-list"), `Remover “${x.titulo}”?`, () => apagar("prompts", x.id, () => { S.prompts = S.prompts.filter((y) => y.id !== x.id); renderPrompts(); renderContexto(); })), text: "Remover" }) : null)),
      h("p", { class: "muted small", text: x.texto.slice(0, 260) + (x.texto.length > 260 ? "…" : "") })))
      : [h("p", { class: "muted small", text: "Nenhum prompt cadastrado. Crie instruções por matéria (ex.: JEC bancário, Fazenda Pública, Previdenciário) ou importe um JSON exportado do sistema." })]);
  }
  function editarPrompt(x) {
    prEdit = x ? x.id : null;
    $("#pr-form-h").textContent = x ? "Editar prompt" : "Novo prompt";
    $("#pr-titulo").value = x ? x.titulo : ""; $("#pr-area").value = x ? x.area : AREAS[0];
    $("#pr-texto").value = x ? x.texto : ""; $("#pr-ativo").checked = x ? x.ativo !== false : true;
    if (x) $("#pr-titulo").focus();
  }
  $("#pr-limpar").addEventListener("click", () => editarPrompt(null));
  $("#pr-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = { titulo: $("#pr-titulo").value.trim(), area: $("#pr-area").value, texto: $("#pr-texto").value.trim(), ativo: $("#pr-ativo").checked };
    if (d.titulo.length < 3 || d.texto.length < 10) return toast("Informe o título e as instruções.");
    const id = prEdit || novoId();
    if (await gravar("prompts", id, d, () => { S.prompts = [...S.prompts.filter((y) => y.id !== id), { ...d, id }]; renderPrompts(); renderContexto(); })) { editarPrompt(null); toast("Prompt salvo."); }
  });
  $("#pr-exp").addEventListener("click", async () => {
    const dados = JSON.stringify({ tipo: "assessor-judicial/prompts", versao: 1, exportadoEm: new Date().toISOString(), prompts: S.prompts.map(({ titulo, area, texto, ativo }) => ({ titulo, area, texto, ativo: ativo !== false })) }, null, 2);
    if (!S.cap.downloads) return toast("Download indisponível nesta visualização.");
    try { await S.cap.downloads.save({ filename: "prompts-gabinete.json", data: dados }); } catch (e) { if (e && e.code !== "declined") toast("Não foi possível salvar o arquivo."); }
  });
  $("#pr-imp").addEventListener("change", async () => {
    const f = $("#pr-imp").files[0]; $("#pr-imp").value = "";
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const lista = (Array.isArray(j) ? j : j.prompts || []).filter((x) => x && typeof x.titulo === "string" && typeof x.texto === "string");
      if (!lista.length) return toast("Nenhum prompt válido no arquivo.");
      let n = 0;
      // Importação só acrescenta: nunca sobrescreve prompts existentes.
      for (const x of lista) {
        if (S.prompts.some((y) => y.titulo === x.titulo && y.texto === x.texto)) continue;
        const d = { titulo: x.titulo.slice(0, 160), area: AREAS.includes(x.area) ? x.area : "Outros", texto: x.texto.slice(0, 20000), ativo: x.ativo !== false };
        const id = novoId();
        if (await gravar("prompts", id, d, () => { S.prompts.push({ ...d, id }); })) n++;
      }
      renderPrompts(); renderContexto();
      toast(`${n} prompt(s) importado(s).`);
    } catch (e) { toast("Arquivo JSON inválido."); }
  });

  // ───────── Legislação & Juros ─────────
  function renderRegimes() {
    const q = $("#reg-q").value.trim().toLowerCase();
    const lista = (window.REGIMES || []).filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q));
    clear($("#reg-list"), lista.length ? lista.map((r) => h("details", { class: "reg" },
      h("summary", null, r.titulo, " ", h("span", { class: "tag", text: r.area })),
      h("p", { text: r.resumo }),
      h("p", null, h("strong", { text: "Correção: " }), r.correcao),
      h("p", null, h("strong", { text: "Juros: " }), r.juros),
      h("strong", { class: "small", text: "Termos iniciais" }), h("ul", null, r.termos.map((t) => h("li", { text: t }))),
      h("strong", { class: "small", text: "Diplomas" }), h("ul", null, r.diplomas.map((d) => h("li", null, h("strong", { text: d.nome }), ` — ${d.artigos}. ${d.nota}`))),
      r.observacoes.length ? h("ul", null, r.observacoes.map((o) => h("li", { class: "muted", text: o }))) : null))
      : [h("p", { class: "muted small", text: "Nenhum regime com esse filtro." })]);
  }
  $("#reg-q").addEventListener("input", renderRegimes);

  // ───────── Guia do PROJUDI ─────────
  function renderProjudi() {
    const texto = (S.cfg.projudi && S.cfg.projudi.texto) || "";
    if (document.activeElement !== $("#pj-texto")) $("#pj-texto").value = texto;
    const q = $("#pj-q").value.trim().toLowerCase();
    const secoes = texto.split(/^#\s+/m).map((b) => b.trim()).filter(Boolean).map((b) => { const [t, ...r] = b.split("\n"); return { t: t.trim(), c: r.join("\n").trim() }; });
    const vis = q.length < 2 ? secoes : secoes.filter((x) => (x.t + " " + x.c).toLowerCase().includes(q));
    clear($("#pj-view"), !texto
      ? [h("p", { class: "muted small", text: S.cap.canEdit ? "O guia está vazio. Escreva as rotinas do gabinete ao lado (uma por título “# …”)." : "O guia ainda não foi escrito pelo(a) Juiz(a) Titular." })]
      : vis.length ? vis.map((x) => [h("h3", { text: x.t }), x.c ? h("p", { text: x.c }) : null]) : [h("p", { class: "muted small", text: "Nenhuma rotina encontrada." })]);
  }
  $("#pj-q").addEventListener("input", renderProjudi);
  $("#pj-salvar").addEventListener("click", async () => { if (await setCfg("projudi", { texto: $("#pj-texto").value.slice(0, 200000) })) toast("Guia salvo."); });

  // ───────── Equipe & Lotações ─────────
  function renderUnidades() {
    clear($("#un-list"), S.unidades.length ? S.unidades.map((u) => h("div", { class: "item" },
      h("div", { class: "row" }, h("span", null, h("strong", { text: u.nome }), " ", h("span", { class: "muted small", text: `Comarca de ${u.comarca}${u.competencia ? " · " + u.competencia : ""}` })),
        S.cap.canEdit ? h("button", { class: "btn sm quiet", type: "button", onclick: () => confirmar($("#un-list"), `Remover “${u.nome}”?`, () => apagar("unidades", u.id, () => { S.unidades = S.unidades.filter((y) => y.id !== u.id); renderUnidades(); renderContexto(); })), text: "Remover" }) : null)))
      : [h("p", { class: "muted small", text: "Nenhuma unidade cadastrada. As unidades aparecem no topo da página e entram no cabeçalho das minutas." })]);
  }
  $("#un-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = { nome: $("#un-nome").value.trim(), comarca: $("#un-comarca").value.trim(), competencia: $("#un-comp").value.trim() };
    if (d.nome.length < 3 || d.comarca.length < 2) return toast("Informe a unidade e a comarca.");
    const id = novoId();
    if (await gravar("unidades", id, d, () => { S.unidades.push({ ...d, id }); renderUnidades(); renderContexto(); })) { $("#un-nome").value = ""; $("#un-comarca").value = ""; $("#un-comp").value = ""; toast("Unidade adicionada."); }
  });

  // ───────── Lupa: processos auditados ─────────
  const CNJ = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/;
  async function registrarAuditoria(d, sem, minuta) {
    const nota = Number(d.nota), L = (v) => (Array.isArray(v) ? v.filter(Boolean).length : 0);
    const reg = {
      numero: (S.caso.numero && S.caso.numero !== "n/i" ? S.caso.numero : (minuta.match(CNJ) || S.caso.autos.match(CNJ) || ["n/i"])[0]),
      assessor: $("#lupa-assessor").value.trim().slice(0, 120), nota: Number.isFinite(nota) ? nota : null,
      pendencias: L(d.citraPetita) + L(d.ultraPetita) + L(d.extraPetita) + L(d.alucinacoes) + sem.length,
      criadoEm: Date.now(), diagnostico: JSON.stringify({ ...d, automaticas: sem }).slice(0, 60000),
    };
    if (S.caso.exemplo) return;
    const id = novoId();
    await gravar("auditorias", id, reg, () => { S.auditorias.unshift({ ...reg, id }); renderAuditorias(); });
  }
  function renderAuditorias() {
    const box = $("#aud-list");
    if (!S.auditorias.length) return clear(box, h("p", { class: "muted small", text: "Nenhuma auditoria salva ainda. Cada auditoria de autos reais fica registrada aqui para o gabinete." }));
    clear(box, h("table", null,
      h("thead", null, h("tr", null, ["Processo", "Assessor(a)", "Nota", "Pendências", "Data", ""].map((t) => h("th", { text: t })))),
      h("tbody", null, S.auditorias.slice(0, 100).map((a) => h("tr", null,
        h("td", { text: a.numero }), h("td", { text: a.assessor || "—" }),
        h("td", null, a.nota == null ? "—" : h("span", { class: "pill " + (a.nota >= 8 ? "ok" : a.nota >= 6 ? "warn" : "bad"), text: a.nota.toFixed(1) })),
        h("td", { text: String(a.pendencias) }), h("td", { text: new Date(a.criadoEm).toLocaleDateString("pt-BR") }),
        h("td", null, h("button", { class: "btn sm ghost", type: "button", onclick: () => { try { S.diag = JSON.parse(a.diagnostico); renderDiag(); toast("Diagnóstico reaberto."); } catch (e) { toast("Diagnóstico indisponível."); } }, text: "Ver" })))))));
  }

  // ───────── Agenda ─────────
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const TIPO_EV = { prazo: "Prazo", audiencia: "Audiência", diligencia: "Diligência", outro: "Outro" };
  const hojeISO = () => new Date().toLocaleDateString("sv-SE");
  const pad2 = (n) => String(n).padStart(2, "0");
  const brData = (d) => d.split("-").reverse().join("/");
  const AG = { y: new Date().getFullYear(), m: new Date().getMonth(), dia: hojeISO(), edit: null };
  function renderAgenda() {
    $("#ag-mes").textContent = `${MESES[AG.m]} de ${AG.y}`;
    const primeiro = new Date(AG.y, AG.m, 1).getDay(), total = new Date(AG.y, AG.m + 1, 0).getDate(), hoje = hojeISO();
    const cel = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => h("div", { class: "dow", text: d }));
    for (let i = 0; i < primeiro; i++) cel.push(h("div"));
    for (let d = 1; d <= total; d++) {
      const iso = `${AG.y}-${pad2(AG.m + 1)}-${pad2(d)}`, evs = S.eventos.filter((e) => e.data === iso);
      cel.push(h("button", { type: "button", class: iso === hoje ? "hoje" : "", "aria-pressed": String(iso === AG.dia), "aria-label": `${d} de ${MESES[AG.m]}${evs.length ? `, ${evs.length} compromisso(s)` : ""}`, onclick: () => { AG.dia = iso; renderAgenda(); } },
        h("span", { class: "n", text: String(d) }),
        evs.slice(0, 3).map((e) => h("span", { class: "ev" }, h("span", { class: "dot d-" + e.tipo }), e.titulo)),
        evs.length > 3 ? h("span", { class: "ev", text: `+${evs.length - 3}` }) : null));
    }
    clear($("#ag-grid"), cel);
    $("#ag-dia-h").textContent = brData(AG.dia);
    const doDia = S.eventos.filter((e) => e.data === AG.dia).sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
    clear($("#ag-dia"), doDia.length ? doDia.map((e) => h("div", { class: "item" + (e.concluido ? " feito" : "") },
      h("div", { class: "row" }, h("span", null, h("span", { class: "dot d-" + e.tipo }), h("strong", { text: e.titulo }), e.hora ? h("span", { class: "muted small", text: " · " + e.hora }) : null),
        h("div", { class: "row" },
          h("button", { class: "btn sm quiet", type: "button", onclick: () => salvarEvento({ ...e, concluido: !e.concluido }), text: e.concluido ? "Reabrir" : "Concluir" }),
          h("button", { class: "btn sm quiet", type: "button", onclick: () => abrirFormEvento(e), text: "Editar" }),
          h("button", { class: "btn sm quiet", type: "button", onclick: () => confirmar($("#ag-dia"), `Remover “${e.titulo}”?`, () => apagar("agenda", e.id, () => { S.eventos = S.eventos.filter((x) => x.id !== e.id); renderAgenda(); })), text: "Remover" }))),
      h("p", { class: "small muted", text: [TIPO_EV[e.tipo], e.processo, e.responsavel && "Resp.: " + e.responsavel, e.observacao].filter(Boolean).join(" · ") })))
      : [h("p", { class: "muted small", text: "Nenhum compromisso neste dia." })]);
  }
  function abrirFormEvento(e) {
    AG.edit = e && e.id ? e.id : null;
    const v = e || {};
    $("#ag-titulo").value = v.titulo || ""; $("#ag-tipo").value = v.tipo || "prazo"; $("#ag-data").value = v.data || AG.dia;
    $("#ag-hora").value = v.hora || ""; $("#ag-proc").value = v.processo || ""; $("#ag-resp").value = v.responsavel || ""; $("#ag-obs").value = v.observacao || "";
    $("#ag-form").hidden = false; $("#ag-titulo").focus();
  }
  async function salvarEvento(ev) {
    const id = ev.id || novoId(); const { id: _, ...d } = ev;
    const ok = await gravar("agenda", id, d, () => { S.eventos = [...S.eventos.filter((x) => x.id !== id), { ...d, id }]; renderAgenda(); });
    return ok;
  }
  $("#ag-novo").addEventListener("click", () => abrirFormEvento(null));
  $("#ag-cancelar").addEventListener("click", () => { $("#ag-form").hidden = true; });
  $("#ag-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = { titulo: $("#ag-titulo").value.trim(), tipo: $("#ag-tipo").value, data: $("#ag-data").value.trim(), hora: $("#ag-hora").value.trim(), processo: $("#ag-proc").value.trim(), responsavel: $("#ag-resp").value.trim(), observacao: $("#ag-obs").value.trim(), concluido: false };
    if (d.titulo.length < 2) return toast("Informe o título.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data)) return toast("Data no formato AAAA-MM-DD.");
    if (d.hora && !/^\d{2}:\d{2}$/.test(d.hora)) return toast("Hora no formato HH:MM.");
    const antigo = AG.edit && S.eventos.find((x) => x.id === AG.edit);
    if (antigo) d.concluido = !!antigo.concluido;
    if (await salvarEvento({ ...d, id: AG.edit || undefined })) {
      $("#ag-form").hidden = true; AG.dia = d.data; const [y, m] = d.data.split("-").map(Number); AG.y = y; AG.m = m - 1; renderAgenda(); toast("Compromisso salvo.");
    }
  });
  $("#ag-prev").addEventListener("click", () => { AG.m--; if (AG.m < 0) { AG.m = 11; AG.y--; } renderAgenda(); });
  $("#ag-next").addEventListener("click", () => { AG.m++; if (AG.m > 11) { AG.m = 0; AG.y++; } renderAgenda(); });
  $("#ag-hoje").addEventListener("click", () => { const d = new Date(); AG.y = d.getFullYear(); AG.m = d.getMonth(); AG.dia = hojeISO(); renderAgenda(); });

  $("#pz-int").value = hojeISO();
  $("#pz-calc").addEventListener("click", () => {
    const out = $("#pz-out");
    try {
      const extras = $("#pz-extras").value.split(/\n/).map((x) => x.trim()).filter(Boolean);
      const r = AJ.calcularPrazo($("#pz-int").value.trim(), Number($("#pz-dias").value), extras, $("#pz-uteis").checked);
      clear(out, h("div", { class: "info" },
        h("p", { style: "margin:0 0 4px" }, "Início da contagem: ", h("strong", { text: brData(r.inicioContagem) }), " · Vencimento: ", h("strong", { text: brData(r.vencimento) }), ` (${r.diasCorridos} dias corridos)`),
        r.ignorados.length ? h("details", null, h("summary", { class: "small", text: `${r.ignorados.length} dia(s) não contado(s)` }), h("ul", { class: "list-ol small" }, r.ignorados.map((x) => h("li", { text: `${brData(x.data)} — ${x.motivo}` })))) : null,
        h("div", { class: "row", style: "margin-top:8px" }, h("button", { class: "btn sm", type: "button", onclick: () => { AG.dia = r.vencimento; abrirFormEvento({ titulo: `Vencimento — prazo de ${$("#pz-dias").value} dias`, tipo: "prazo", data: r.vencimento, observacao: `Intimação em ${brData($("#pz-int").value.trim())}` }); }, text: "Levar para a agenda" })),
        h("p", { class: "muted small", style: "margin:6px 0 0", text: "Feriados locais e suspensões do tribunal não são presumidos: informe-os acima." })));
    } catch (e) { showErr(out, e.message || String(e)); }
  });
  function renderGcal() {
    const url = (S.cfg.agenda && S.cfg.agenda.url) || "";
    if (document.activeElement !== $("#gcal-url")) $("#gcal-url").value = url;
    clear($("#gcal-open"), url ? h("a", { class: "btn quiet sm", href: url, target: "_blank", rel: "noopener noreferrer", text: "Abrir Google Agenda do gabinete ↗" }) : h("span", { class: "muted small", text: "Nenhum link cadastrado." }));
  }
  $("#gcal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = $("#gcal-url").value.trim();
    if (url && !/^https:\/\/calendar\.google\.com\//.test(url)) return toast("Use um link que comece com https://calendar.google.com/");
    if (await setCfg("agenda", { url })) toast("Link salvo.");
  });

  // ───────── Manual ─────────
  const MODULOS = [
    ["Nova Análise", "Envie os autos em PDF, escolha o prompt da área e o tipo de ato. A Etapa 1 extrai cronologia, pedidos de cada litisconsorte e provas com Mov./Arq./Pág.; a Etapa 2 redige a minuta. A conferência aponta pedidos não julgados e dados que não aparecem nos autos."],
    ["Auditoria Ouro (Lupa)", "Confira a minuta contra os autos antes da assinatura: extra, ultra e citra petita, alucinações, precedentes e consectários, com minuta gabarito. Cada auditoria fica em Processos auditados."],
    ["Mesa de Audiência", "Os 5 pilares da lide, perguntas sugeridas e o redator de termo ou de homologação de acordo."],
    ["Mutirão de Audiências", "Autos em PDF e a ata (ou anotações/transcrição da mídia) da audiência geram o termo e a sentença prontos, com o prompt de sentença escolhido."],
    ["Petição & Defesa 360°", "Redator de peças para a advocacia (inicial, contestação, réplica, manifestação, recurso), com Matriz de impugnação do art. 341 do CPC, auditoria preventiva e conferência da jurisprudência citada."],
    ["Base de Conhecimento", "Documentos de referência do gabinete; os trechos pertinentes ao tema entram na minuta e aparecem no Raio-X."],
    ["Chamados & Recados", "Sugestões, erros, pedidos de tese ou prompt e recados entre a equipe e o(a) Juiz(a). O sino no topo mostra o que está pendente."],
    ["Chat com a minuta", "Converse com o Claude sobre a minuta e os autos: resumo, reanálise de um documento (ele busca e lê as páginas dos autos), melhoria, ajuste, conferência de pedidos e revisão da linguagem. Minutas propostas só mudam quando você clica em Aplicar, e dá para desfazer."],
    ["Agenda", "Prazos, audiências e diligências do gabinete, com a calculadora de prazos em dias úteis do CPC."],
    ["Teses & Modelos", "Minutas Paradigma (⚡ Injetar no Prompt), Caderno de Teses em texto corrido e teses avulsas."],
    ["Súmulas & Precedentes", "Importe PDFs de informativos; os julgados pertinentes entram automaticamente nas minutas."],
    ["Prompts por Área", "Instruções do gabinete por matéria, com exportação e importação em JSON."],
    ["Legislação & Juros", "Regimes de correção e juros por microssistema e calculadora da Lei nº 14.905/2024."],
    ["Guia do PROJUDI", "Rotinas do gabinete, com busca."],
    ["Equipe & Lotações", "Unidades judiciárias, aviso à equipe e permissões. A equipe entra pelo botão Compartilhar do claude.ai."],
  ];
  const NOVIDADES = [
    ["30/09/2026", "Todas as telas do sistema antigo: Mutirão de Audiências, Petição & Defesa 360°, Base de Conhecimento, Chamados & Recados com sino, Conheça o Assessor; na Nova Análise, linha do tempo, Fato × Prova, conformidade, Raio-X, versões com comparação lado a lado, modo simplificado/avançado, guia rápido e trecho selecionado para o Caderno."],
    ["30/09/2026", "Chat com a minuta: conversa livre sobre a minuta e os autos, com atalhos (resumir, reanalisar documento, melhorar, conferir pedidos, revisar linguagem), leitura das páginas dos autos pelo Claude, aplicar e desfazer."],
    ["30/09/2026", "Todos os módulos do sistema nesta página: Agenda com prazos do CPC, Prompts por Área, Legislação & Juros, Guia do PROJUDI, Equipe & Lotações, Caderno de Teses em texto, tipo de ato, processos auditados e este Manual."],
    ["30/09/2026", "Layout igual ao do sistema principal e cores do Claude."],
    ["29/09/2026", "Primeira versão no claude.ai: minutas em 2 etapas, Lupa, audiência, chat, precedentes e histórico."],
  ];
  clear($("#man-mod"), MODULOS.map(([t, d]) => h("div", { class: "item" }, h("strong", { text: t }), h("p", { class: "small", text: d }))));
  clear($("#man-log"), NOVIDADES.map(([d, t]) => h("div", { class: "item" }, h("span", { class: "tag", text: d }), h("p", { class: "small", text: t }))));

  // ───────── Base de Conhecimento ─────────
  const BC_MAX = 200000; // o documento do banco aceita até 256 KiB
  function renderConhecimento() {
    $("#bc-h").textContent = `Documentos · ${S.conhecimento.length} (${S.conhecimento.filter((d) => d.ativo !== false).length} ativos)`;
    $("#bc-add-l").hidden = !S.cap.canEdit;
    clear($("#bc-list"), S.conhecimento.length ? S.conhecimento.map((d) => h("div", { class: "item" },
      h("div", { class: "row" }, h("span", null, h("strong", { text: d.nome }), " ", h("span", { class: "muted small", text: `${d.paginas || "?"} pág. · ${(d.texto || "").length.toLocaleString("pt-BR")} caracteres` }), d.ativo === false ? h("span", { class: "muted small", text: " · inativo" }) : null),
        h("div", { class: "row" },
          h("button", { class: "btn sm quiet", type: "button", onclick: () => clear($("#bc-view"), h("div", { class: "panel", style: "margin-top:12px" }, h("header", null, h("h2", { text: d.nome }), h("button", { class: "btn sm quiet", type: "button", onclick: () => clear($("#bc-view")), text: "Fechar" })), h("div", { class: "body scroll" }, h("pre", { style: "white-space:pre-wrap;font:13px/1.55 var(--f-doc);margin:0", text: d.texto || "" })))), text: "Ver" }),
          S.cap.canEdit ? h("button", { class: "btn sm quiet", type: "button", onclick: () => gravar("conhecimento", d.id, { ...d, ativo: d.ativo === false }, () => { d.ativo = d.ativo === false; renderConhecimento(); }), text: d.ativo === false ? "Ativar" : "Desativar" }) : null,
          S.cap.canEdit ? h("button", { class: "btn sm quiet", type: "button", onclick: () => confirmar($("#bc-list"), `Remover “${d.nome}” da base?`, () => apagar("conhecimento", d.id, () => { S.conhecimento = S.conhecimento.filter((x) => x.id !== d.id); renderConhecimento(); })), text: "Remover" }) : null))))
      : [h("p", { class: "muted small", text: "Nenhum documento. Anexe enunciados, manuais, cadernos de jurisprudência ou votos do juízo: os trechos pertinentes ao tema de cada processo entram na redação da minuta." })]);
  }
  $("#bc-add").addEventListener("change", async () => {
    const files = [...$("#bc-add").files]; $("#bc-add").value = "";
    const st = $("#bc-status");
    for (const f of files) {
      try {
        clear(st, h("div", { class: "info", text: `Lendo ${f.name}…` }));
        const r = await lerPdf(f, (n, t) => clear(st, h("div", { class: "info", text: `Lendo ${f.name}: página ${n} de ${t}` })));
        r.doc.destroy && r.doc.destroy();
        let texto = r.texto;
        while (AJ.bytes(texto) > BC_MAX) texto = texto.slice(0, Math.floor(texto.length * 0.9));
        const d = { nome: f.name, paginas: r.paginas, texto, ativo: true, criadoEm: Date.now(), truncado: texto.length < r.texto.length };
        const id = novoId();
        await gravar("conhecimento", id, d, () => { S.conhecimento.push({ ...d, id }); });
        clear(st, h("div", { class: d.truncado ? "warnbox" : "info", text: `${f.name}: ${r.paginas} página(s) adicionada(s)${d.truncado ? " — texto cortado no limite de 200 mil bytes por documento; divida o PDF para incluir o restante" : ""}.` }));
      } catch (e) { showErr(st, "Não foi possível ler " + f.name + ": " + (e.message || e)); }
    }
    renderConhecimento();
  });
  /** Trechos dos documentos ativos mais próximos do tema (até ~30 mil caracteres). */
  function trechosConhecimento(tema) {
    const ativos = S.conhecimento.filter((d) => d.ativo !== false && d.texto);
    if (!ativos.length) return { texto: "", n: 0 };
    const termos = [...new Set(String(tema).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 4))];
    const cands = [];
    for (const d of ativos) for (const par of d.texto.split(/\n\s*\n/)) {
      if (par.length < 80) continue;
      const norm = par.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const score = termos.reduce((n, t) => n + (norm.includes(t) ? 1 : 0), 0);
      if (score >= 2) cands.push({ score, nome: d.nome, par: par.slice(0, 2500) });
    }
    cands.sort((a, b) => b.score - a.score);
    let total = 0; const out = []; const usados = new Set();
    for (const c of cands) { if (total + c.par.length > 30000) break; out.push(`[${c.nome}] ${c.par}`); total += c.par.length; usados.add(c.nome); }
    return { texto: out.join("\n\n"), n: usados.size };
  }

  // ───────── Petição & Defesa 360° ─────────
  const PT = { tipo: "inicial", docs: [], peca: "", analise: null, aba: "peca", titulo: "" };
  const PRELIM = ["Inépcia da inicial", "Ilegitimidade passiva", "Falta de interesse de agir", "Incompetência", "Conexão / continência", "Prescrição", "Decadência", "Gratuidade indevida"];
  clear($("#pt-area"), AREAS.map((a) => h("option", { value: a, text: a })));
  clear($("#pt-prelim"), PRELIM.map((p) => h("label", { class: "row" }, h("input", { type: "checkbox", value: p }), p)));
  $("#pt-tipo").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]"); if (!b) return;
    PT.tipo = b.dataset.v;
    $("#pt-tipo").querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    $("#pt-defesa").hidden = PT.tipo !== "contestacao";
  });
  $("#pt-docs").addEventListener("change", async () => {
    const files = [...$("#pt-docs").files]; $("#pt-docs").value = "";
    for (const f of files) {
      try {
        $("#pt-docs-t").textContent = `Lendo ${f.name}…`;
        const r = await lerPdf(f, (n, t) => { $("#pt-docs-s").textContent = `Página ${n} de ${t}`; });
        r.doc.destroy && r.doc.destroy();
        PT.docs.push({ nome: f.name, paginas: r.paginas, texto: r.texto });
      } catch (e) { showErr($("#pt-err"), "Não foi possível ler " + f.name); }
    }
    $("#pt-docs-t").textContent = "Anexar PDFs (autos, provas, documentos do cliente)"; $("#pt-docs-s").textContent = "O texto é lido aqui no navegador.";
    renderPtDocs();
  });
  function renderPtDocs() {
    clear($("#pt-docs-l"), PT.docs.map((d, i) => h("div", { class: "item" }, h("div", { class: "row" }, h("span", { class: "small", text: `${d.nome} · ${d.paginas} pág.` }), h("button", { class: "btn sm quiet", type: "button", onclick: () => { PT.docs.splice(i, 1); renderPtDocs(); }, text: "Remover" })))));
    $("#pt-gerar").disabled = !S.cap.sample || !!S.ctl;
  }
  function docsTexto(limite) {
    let out = "", resto = limite;
    for (const d of PT.docs) { const t = `\n=== ${d.nome} ===\n${d.texto}`; out += t.slice(0, Math.max(0, resto)); resto -= t.length; if (resto <= 0) { out += "\n[… documentos cortados pelo limite de tamanho]"; break; } }
    return out;
  }
  $("#pt-parar").addEventListener("click", () => S.ctl && S.ctl.abort());
  $("#pt-gerar").addEventListener("click", async () => {
    showErr($("#pt-err"), null);
    const prompt = S.prompts.find((x) => x.id === $("#pt-prompt").value) || null;
    const fatos = $("#pt-fatos").value.trim();
    if (fatos.length < 30 && !PT.docs.length) return showErr($("#pt-err"), "Descreva os fatos ou anexe os documentos.");
    const d = { tipo: PT.tipo, polo: ["contestacao"].includes(PT.tipo) ? "reu" : "autor", cliente: $("#pt-cliente").value.trim(), contra: $("#pt-contra").value.trim(), processo: $("#pt-proc").value.trim(), vara: $("#pt-vara").value.trim(), area: $("#pt-area").value, valor: $("#pt-valor").value.trim(),
      tutela: $("#pt-tutela").checked, gratuidade: $("#pt-gratuidade").checked, concil: $("#pt-concil").checked, preliminares: [...$("#pt-prelim").querySelectorAll("input:checked")].map((x) => x.value), tempestividade: $("#pt-tempest").value.trim(),
      prompt, extra: $("#pt-extra").value.trim(), fatos, precedentes: AJ.rankPrecedentes(fatos + " " + $("#pt-extra").value, S.precedentes).slice(0, 12) };
    d.docs = docsTexto(Math.max(20000, 200000 - AJ.bytes(fatos) - AJ.bytes((prompt && prompt.texto) || "") - 15000));
    PT.dados = d; PT.analise = null; PT.aba = "peca"; renderPt();
    S.ctl = new AbortController(); $("#pt-gerar").disabled = true; $("#pt-parar").hidden = false;
    try {
      const r = await ask(P.peticao(d), { tier: "complex", signal: S.ctl.signal, onText: ({ text }) => { PT.peca = text; if (PT.aba === "peca") clear($("#pt-out"), md(text)); } });
      PT.peca = r.text.trim(); PT.titulo = (PT.peca.match(/^#+\s*(.+)$/m) || [, "Peça"])[1].slice(0, 120);
      renderPt(); salvarPeca();
      clear($("#pt-err"), h("div", { class: "info", text: "Peça pronta. Conferindo requisitos do CPC, matriz e jurisprudência…" }));
      const a = await ask(P.peticaoAnalise(d, PT.peca), { tier: "default", json: true, signal: S.ctl.signal });
      PT.analise = a; showErr($("#pt-err"), null); renderPt();
    } catch (e) { if (!(e && e.code === "cancelled")) showErr($("#pt-err"), e); if (e && e.text) { PT.peca = e.text; renderPt(); } }
    finally { S.ctl = null; $("#pt-parar").hidden = true; renderPtDocs(); renderBotoes(); }
  });
  $("#pt-tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (b) { PT.aba = b.dataset.v; renderPt(); } });
  function renderPt() {
    $("#pt-tabs").querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.v === PT.aba)));
    $("#pt-h").textContent = PT.titulo || "Peça";
    clear($("#pt-acts"), PT.peca ? [h("button", { class: "btn quiet sm", type: "button", onclick: async () => { try { await navigator.clipboard.writeText(PT.peca); toast("Peça copiada."); } catch (e) { toast("Não foi possível copiar."); } }, text: "Copiar" }),
      S.cap.downloads ? h("button", { class: "btn quiet sm", type: "button", onclick: () => salvarArquivo(`peca-${PT.tipo}.html`, htmlWord(PT.peca, PT.titulo)), text: "Baixar para Word" }) : null] : []);
    const out = $("#pt-out"), a = PT.analise || {};
    if (PT.aba === "peca") return clear(out, PT.peca ? md(PT.peca) : h("div", { class: "placeholder" }, h("p", { text: "Escolha o tipo de peça, descreva os fatos ou anexe os documentos e clique em Redigir peça." }), h("p", { class: "small", text: "Na contestação, a Matriz do art. 341 do CPC confere se cada fato da inicial foi impugnado." })));
    if (!PT.analise) return clear(out, h("p", { class: "muted small", text: PT.peca ? "A análise sai logo depois da peça." : "Gere a peça primeiro." }));
    if (PT.aba === "matriz") {
      const m = L(a.matriz341);
      if (!m.length) return clear(out, h("p", { class: "muted small", text: PT.tipo === "contestacao" ? "Nenhuma alegação identificada. Anexe a petição inicial adversa." : "A matriz do art. 341 é gerada nas contestações." }));
      return clear(out, h("p", { class: "small", text: `${m.length} alegação(ões) da inicial · ${m.filter((x) => x.impugnada === false).length} sem impugnação (risco de presunção de veracidade).` }),
        h("div", { class: "items" }, m.map((x) => h("div", { class: "item" }, h("div", { class: "row" }, h("strong", { class: "small", text: x.alegacao }), h("span", { class: "pill " + (x.impugnada === false ? "bad" : "ok"), text: x.impugnada === false ? "não impugnada" : "impugnada" })),
          x.localizacao ? h("span", { class: "ref", text: x.localizacao }) : null, x.impugnacao ? h("p", { class: "small", text: "Impugnação: " + x.impugnacao }) : null, x.prova ? h("p", { class: "small muted", text: "Prova: " + x.prova }) : null))));
    }
    if (PT.aba === "auditoria") {
      const au = a.auditoria || {}, nota = Number(au.nota);
      return clear(out, h("p", null, "Nota preventiva: ", h("span", { class: "pill " + (nota >= 80 ? "ok" : nota >= 60 ? "warn" : "bad"), text: Number.isFinite(nota) ? `${nota}/100` : "—" })),
        h("div", { class: "checks" }, L(au.requisitos).map((r) => h("div", { class: "item" }, h("div", { class: "row" }, h("strong", { class: "small", text: r.requisito }), h("span", { class: "small st-" + r.status, text: { ok: "✓ ok", alerta: "! conferir", falha: "✗ falha" }[r.status] || r.status })), r.observacao ? h("p", { class: "small muted", text: r.observacao }) : null))));
    }
    if (PT.aba === "juris") {
      const j = L(a.jurisprudencia);
      if (!j.length) return clear(out, h("p", { class: "muted small", text: "Nenhuma jurisprudência citada." }));
      return clear(out, h("div", { class: "items" }, j.map((x) => h("div", { class: "item" }, h("div", { class: "row" }, h("strong", { class: "small", text: x.citacao }), h("span", { class: "pill " + (x.verificado ? "ok" : "warn"), text: x.verificado ? "no repositório" : "sugestão de tese — conferir" })),
        x.tese ? h("p", { class: "small", text: x.tese }) : null, x.uso ? h("p", { class: "small muted", text: x.uso }) : null))));
    }
  }
  async function salvarPeca() {
    if (!S.cap.db || !S.cap.uid || !PT.peca) return;
    const id = PT.histId || (PT.histId = novoId());
    try { await S.cap.db.collection("data/users/" + S.cap.uid).doc("p-" + id).set({ tipoDoc: "peca", tipo: PT.tipo, numero: PT.titulo || "Peça", arquivo: $("#pt-cliente").value.trim(), criadoEm: Date.now(), peca: PT.peca.slice(0, 150000) }); } catch (e) { /* conveniência */ }
  }
  function htmlWord(texto, titulo) {
    const div = h("div"); div.append(md(texto));
    div.querySelectorAll(".ref,.pid").forEach((r) => r.replaceWith(document.createTextNode(r.textContent)));
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${String(titulo || "documento").replace(/[<>&]/g, "")}</title><style>body{font:12pt/1.6 "Times New Roman",serif;max-width:17cm;margin:2cm auto}h1,h2{text-align:center;text-transform:uppercase;font-size:12pt}h3{font-size:12pt}p{text-align:justify;text-indent:2cm}p.cit{text-indent:0;margin-left:4cm;font-size:11pt}</style></head><body>${div.innerHTML}</body></html>`;
  }
  async function salvarArquivo(nome, dados) {
    try { await S.cap.downloads.save({ filename: nome, data: dados }); } catch (e) { if (e && e.code !== "declined") toast("Não foi possível salvar o arquivo."); }
  }

  // ───────── Mutirão de Audiências ─────────
  const MU = { autos: "", nome: "", termo: "", sent: "" };
  $("#mu-pdf").addEventListener("change", async () => {
    const f = $("#mu-pdf").files[0]; $("#mu-pdf").value = ""; if (!f) return;
    try {
      $("#mu-pdf-t").textContent = `Lendo ${f.name}…`;
      const r = await lerPdf(f, (n, t) => { $("#mu-pdf-s").textContent = `Página ${n} de ${t}`; });
      r.doc.destroy && r.doc.destroy();
      MU.autos = r.texto; MU.nome = f.name; renderMu();
    } catch (e) { showErr($("#mu-err"), "Não foi possível ler o PDF."); renderMu(); }
  });
  $("#mu-usar").addEventListener("click", () => { if (!S.caso.autos) return toast("Carregue os autos na Nova Análise primeiro."); MU.autos = S.caso.autos; MU.nome = S.caso.nome; renderMu(); });
  $("#mu-ata-pdf").addEventListener("change", async () => {
    const f = $("#mu-ata-pdf").files[0]; if (!f) return;
    try { const r = await lerPdf(f, () => {}); r.doc.destroy && r.doc.destroy(); $("#mu-ata").value = r.texto.replace(/⟦Pág\. \d+⟧/g, "\n"); renderMu(); }
    catch (e) { showErr($("#mu-err"), "Não foi possível ler a ata."); }
  });
  $("#mu-ata").addEventListener("input", () => renderMu());
  function renderMu() {
    $("#mu-pdf-t").textContent = MU.nome || "Toque ou arraste o PDF dos autos / inicial";
    $("#mu-pdf-s").textContent = MU.autos ? `${MU.autos.length.toLocaleString("pt-BR")} caracteres após a limpeza` : "Lido e limpo aqui no navegador.";
    $("#mu-gerar").disabled = !S.cap.sample || !MU.autos || $("#mu-ata").value.trim().length < 30 || !!S.ctl;
    const acts = (id, txt, nome) => clear($(id), txt ? [h("button", { class: "btn quiet sm", type: "button", onclick: async () => { try { await navigator.clipboard.writeText(txt); toast("Copiado."); } catch (e) { toast("Não foi possível copiar."); } }, text: "Copiar" }),
      S.cap.downloads ? h("button", { class: "btn quiet sm", type: "button", onclick: () => salvarArquivo(nome, htmlWord(txt, nome)), text: "Baixar para Word" }) : null] : []);
    acts("#mu-termo-acts", MU.termo, "termo-audiencia.html"); acts("#mu-sent-acts", MU.sent, "sentenca-mutirao.html");
  }
  $("#mu-gerar").addEventListener("click", async () => {
    showErr($("#mu-err"), null);
    const ata = $("#mu-ata").value.trim().slice(0, 60000);
    const lim = 180000 - AJ.bytes(ata);
    const autos = AJ.bytes(MU.autos) <= lim ? MU.autos : MU.autos.slice(0, Math.floor(lim / 2)) + "\n\n[… trecho intermediário omitido pelo limite de tamanho …]\n\n" + MU.autos.slice(-Math.floor(lim / 2));
    const prompt = S.prompts.find((x) => x.id === $("#mu-prompt").value) || null;
    S.ctl = new AbortController(); renderMu();
    try {
      clear($("#mu-termo"), h("p", { class: "muted small", text: "Redigindo o termo…" }));
      const t = await ask(P.mutiraoTermo(autos, ata), { tier: "default", signal: S.ctl.signal, onText: ({ text }) => clear($("#mu-termo"), md(text)) });
      MU.termo = t.text.trim(); clear($("#mu-termo"), md(MU.termo)); renderMu();
      clear($("#mu-sent"), h("p", { class: "muted small", text: "Redigindo a sentença…" }));
      const s2 = await ask(P.mutiraoSentenca(autos, ata, prompt), { tier: "complex", signal: S.ctl.signal, onText: ({ text }) => clear($("#mu-sent"), md(text)) });
      MU.sent = s2.text.trim(); clear($("#mu-sent"), md(MU.sent));
    } catch (e) { if (!(e && e.code === "cancelled")) showErr($("#mu-err"), e); }
    finally { S.ctl = null; renderMu(); renderBotoes(); }
  });

  // ───────── Chamados & Recados ─────────
  function renderChamados() {
    const f = $("#ch-filtro").value, meu = (c) => c.autor && c.autor === S.cap.uid;
    const lista = S.chamados.filter((c) => f === "todos" || (f === "meus" ? meu(c) : c.status !== "fechado")).sort((a, b) => b.criadoEm - a.criadoEm);
    $("#ch-h").textContent = `Chamados · ${S.chamados.filter((c) => c.status !== "fechado").length} aberto(s)`;
    clear($("#ch-list"), lista.length ? lista.map((c) => {
      const resp = h("textarea", { rows: "2", placeholder: "Responder…", maxlength: "3000" });
      const podeResponder = S.cap.canEdit || meu(c);
      return h("div", { class: "item" },
        h("div", { class: "row" }, h("span", null, h("strong", { text: c.titulo }), " ", h("span", { class: "tag", text: c.categoria }), " ", h("span", { class: "small prio-" + c.prioridade, text: c.prioridade !== "normal" ? c.prioridade : "" })),
          h("span", { class: "pill " + (c.status === "fechado" ? "" : c.status === "respondido" ? "ok" : "warn"), text: c.status })),
        h("p", { class: "small", text: c.descricao }),
        h("p", { class: "muted small", text: `${meu(c) ? "Você" : "Membro da equipe"} · ${new Date(c.criadoEm).toLocaleString("pt-BR")}` }),
        L(c.respostas).map((r) => h("div", { class: "resp" + (r.admin ? " adm" : "") }, h("strong", { class: "small", text: r.autor === S.cap.uid ? "Você" : r.admin ? "Juiz(a) / gabinete" : "Membro da equipe" }), h("p", { style: "margin:2px 0", text: r.texto }))),
        podeResponder && c.status !== "fechado" ? [resp, h("div", { class: "row" },
          h("button", { class: "btn sm", type: "button", onclick: async () => { const t = resp.value.trim(); if (t.length < 2) return; await salvarChamado({ ...c, status: S.cap.canEdit && !meu(c) ? "respondido" : c.status, respostas: [...L(c.respostas), { autor: S.cap.uid, texto: t, em: Date.now(), admin: !!S.cap.canEdit }] }); }, text: "Responder" }),
          S.cap.canEdit || meu(c) ? h("button", { class: "btn sm quiet", type: "button", onclick: () => salvarChamado({ ...c, status: "fechado" }), text: "Encerrar" }) : null)] : null);
    }) : [h("p", { class: "muted small", text: "Nenhum chamado." })]);
    renderSino();
  }
  function renderSino() {
    const n = S.cap.canEdit ? S.chamados.filter((c) => c.status === "aberto").length : S.chamados.filter((c) => c.autor === S.cap.uid && c.status === "respondido").length;
    $("#sino-n").hidden = !n; $("#sino-n").textContent = String(n);
  }
  async function salvarChamado(c) {
    const { id, ...d } = c;
    return gravar("chamados", id, d, () => { S.chamados = [...S.chamados.filter((x) => x.id !== id), c]; renderChamados(); });
  }
  $("#ch-filtro").addEventListener("change", renderChamados);
  $("#b-sino").addEventListener("click", () => abrirAba("chamados"));
  $("#ch-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const c = { id: novoId(), categoria: $("#ch-cat").value, prioridade: $("#ch-prio").value, titulo: $("#ch-tit").value.trim(), descricao: $("#ch-desc").value.trim(), status: "aberto", autor: S.cap.uid || "local", criadoEm: Date.now(), respostas: [] };
    if (c.titulo.length < 3 || c.descricao.length < 5) return toast("Informe o assunto e a descrição.");
    if (await salvarChamado(c)) { $("#ch-tit").value = ""; $("#ch-desc").value = ""; toast("Chamado aberto."); }
  });

  // Conheça o Assessor
  $("#cn-iniciar").addEventListener("click", () => abrirAba("esteira"));
  $("#cn-manual").addEventListener("click", () => abrirAba("ajuda"));

  // ───────── Capacidades do claude.ai ─────────
  function pill(id, txt, tom) { const el = $(id); el.textContent = txt; el.className = "pill " + (tom || ""); el.hidden = false; }
  async function iniciar() {
    renderFiltros(); renderPrecedentes(); renderParadigmas(); renderTeses(); renderHistorico(); renderCaso();
    renderPrompts(); renderRegimes(); renderUnidades(); renderAuditorias(); renderCfg(); renderContexto(); renderAgenda();
    renderConhecimento(); renderPt(); renderPtDocs(); renderMu(); renderChamados();
    if (!window.claude || !window.claude.use) {
      pill("#st-claude", "Claude: abra esta página no claude.ai", "bad");
      pill("#st-db", "Dados do gabinete: indisponíveis fora do claude.ai", "warn");
      S.cap.canEdit = true; // prévia local: nada é gravado fora desta sessão
      return;
    }
    const [sample, db, user, downloads] = await Promise.all(["sample", "db", "user", "downloads"].map((n) => window.claude.use(n).catch(() => null)));
    S.cap.sample = sample; S.cap.db = db; S.cap.user = user; S.cap.downloads = downloads;
    if (sample && sample.limits) { try { S.cap.tools = !!(await sample.limits()).tools; } catch (e) { S.cap.tools = false; } }
    pill("#st-claude", sample ? "Claude: disponível" : "Claude: indisponível nesta visualização", sample ? "ok" : "bad");

    if (user) {
      try { S.cap.uid = await user.id(); } catch (e) { S.cap.uid = null; }
      try { S.cap.canEdit = await user.canEdit(); } catch (e) { S.cap.canEdit = false; }
      try { S.cap.canWrite = await user.can("data.write"); } catch (e) { S.cap.canWrite = null; }
      pill("#st-role", S.cap.canEdit ? "Juiz(a) / Editor" : S.cap.canWrite === false ? "Somente leitura" : "Assessor(a) / Colaborador", S.cap.canEdit ? "ok" : "");
    }
    $("#par-form").hidden = !S.cap.canEdit; $("#par-ro").hidden = S.cap.canEdit;
    $("#tes-form").hidden = !S.cap.canEdit; $("#tes-ro").hidden = S.cap.canEdit;
    $("#pr-form").hidden = !S.cap.canEdit; $("#pr-ro").hidden = S.cap.canEdit; $("#pr-imp-l").hidden = !S.cap.canEdit;
    $("#un-form").hidden = !S.cap.canEdit; $("#pj-edit").hidden = !S.cap.canEdit; $("#gcal-form").hidden = !S.cap.canEdit;
    $("#av-texto").hidden = $("#av-pub").hidden = $("#av-ret").hidden = !S.cap.canEdit; $("#av-ro").hidden = S.cap.canEdit;
    $("#cad-texto").readOnly = !S.cap.canEdit; $("#b-cad").hidden = !S.cap.canEdit;
    renderPrompts(); renderUnidades(); renderProjudi(); renderConhecimento(); renderPtDocs(); renderMu(); renderChamados();
    $("#l-importar").hidden = S.cap.canWrite === false || !sample;

    if (db) {
      pill("#st-db", "Dados do gabinete: sincronizados", "ok");
      const falha = () => pill("#st-db", "Dados do gabinete: conexão perdida — recarregue", "bad");
      db.collection("teses").onSnapshot((s) => { S.teses = s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (a.titulo || "").localeCompare(b.titulo || "")); renderTeses(); }, falha);
      db.collection("paradigmas").onSnapshot((s) => { S.paradigmas = s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (a.titulo || "").localeCompare(b.titulo || "")); renderParadigmas(); }, falha);
      db.collection("precedentes").limit(1000).onSnapshot((s) => { S.precedentes = s.docs.map((d) => ({ ...d.data(), id: d.id })); renderPrecedentes(); }, falha);
      const ordenar = (lista, campo) => lista.sort((a, b) => String(a[campo] || "").localeCompare(String(b[campo] || "")));
      db.collection("prompts").onSnapshot((s) => { S.prompts = ordenar(s.docs.map((d) => ({ ...d.data(), id: d.id })), "titulo"); renderPrompts(); renderContexto(); }, falha);
      db.collection("unidades").onSnapshot((s) => { S.unidades = ordenar(s.docs.map((d) => ({ ...d.data(), id: d.id })), "nome"); renderUnidades(); renderContexto(); }, falha);
      db.collection("config").onSnapshot((s) => { S.cfg = Object.fromEntries(s.docs.map((d) => [d.id, d.data()])); renderCfg(); }, falha);
      db.collection("auditorias").orderBy("criadoEm", "desc").limit(100).onSnapshot((s) => { S.auditorias = s.docs.map((d) => ({ ...d.data(), id: d.id })); renderAuditorias(); }, falha);
      db.collection("agenda").onSnapshot((s) => { S.eventos = s.docs.map((d) => ({ ...d.data(), id: d.id })); renderAgenda(); }, falha);
      db.collection("conhecimento").onSnapshot((s) => { S.conhecimento = ordenar(s.docs.map((d) => ({ ...d.data(), id: d.id })), "nome"); renderConhecimento(); }, falha);
      db.collection("chamados").orderBy("criadoEm", "desc").limit(200).onSnapshot((s) => { S.chamados = s.docs.map((d) => ({ ...d.data(), id: d.id })); renderChamados(); }, falha);
      if (S.cap.uid) db.collection("data/users/" + S.cap.uid).orderBy("criadoEm", "desc").limit(50).onSnapshot((s) => { S.historico = s.docs.map((d) => ({ ...d.data(), _id: d.id })).filter((m) => m.minuta || m.peca); renderHistorico(); }, () => {});
      else renderHistorico();
    } else pill("#st-db", "Dados do gabinete: indisponíveis (só nesta sessão)", "warn");
    renderCaso();
  }

  // ───────── Autos de exemplo (FICTÍCIOS) ─────────
  const EXEMPLO = [
    "PROJUDI - Processo: 5001234-56.2025.8.09.0000 - Mov. 1 - Arq. 1 - Petição Inicial\nEXCELENTÍSSIMO SENHOR JUIZ DE DIREITO DO JUIZADO ESPECIAL CÍVEL\nMARIA DA SILVA EXEMPLO e JOÃO PEREIRA EXEMPLO, qualificados, vêm propor AÇÃO DECLARATÓRIA DE INEXISTÊNCIA DE DÉBITO C/C REPETIÇÃO DE INDÉBITO E INDENIZAÇÃO POR DANOS MORAIS em face de BANCO FICTÍCIO S.A.\nDOS FATOS\nA primeira autora é aposentada e, a partir de 05/02/2025, passou a sofrer descontos mensais de R$ 312,40 em seu benefício previdenciário, referentes a um empréstimo consignado que jamais contratou. O segundo autor, seu filho e curador, teve o nome inscrito em cadastro de inadimplentes em 10/03/2025 por dívida de R$ 1.874,00 vinculada ao mesmo contrato.",
    "DOS PEDIDOS\na) a declaração de inexistência do contrato nº 998877;\nb) a condenação do réu à restituição em dobro dos valores descontados da primeira autora, no total de R$ 1.874,40;\nc) a condenação do réu ao pagamento de R$ 10.000,00 a título de danos morais à primeira autora;\nd) a condenação do réu ao pagamento de R$ 5.000,00 a título de danos morais ao segundo autor, pela negativação indevida;\ne) a exclusão do nome do segundo autor dos cadastros de inadimplentes, em tutela de urgência.\nDá-se à causa o valor de R$ 16.874,40.",
    "PROJUDI - Mov. 18 - Arq. 1 - Contestação\nO BANCO FICTÍCIO S.A. sustenta, preliminarmente, a ilegitimidade ativa do segundo autor, que não seria parte no contrato. No mérito, afirma que o contrato foi celebrado eletronicamente, com biometria facial, e junta comprovante de transferência de R$ 5.000,00 para conta de titularidade da primeira autora em 03/01/2025. Pede a improcedência e, subsidiariamente, a compensação do valor transferido.",
    "PROJUDI - Mov. 24 - Arq. 1 - Réplica\nA primeira autora impugna a autenticidade da biometria e afirma que a conta indicada foi aberta por terceiro, sem sua participação. Requer a inversão do ônus da prova.\nPROJUDI - Mov. 30 - Termo de Audiência de Instrução\nRealizada em 14/08/2025. Ausente proposta de acordo. A testemunha Ana Souza afirmou que acompanhou a autora à agência e que ela desconhecia a conta. As partes dispensaram outras provas. Autos conclusos para sentença.",
  ];

  iniciar();
})();

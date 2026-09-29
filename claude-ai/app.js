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
    paradigmaId: "", diag: null, chat: [], ctl: null, pagina: 1, filtro: "TODOS",
    cap: { sample: null, db: null, user: null, downloads: null, uid: null, canEdit: false, canWrite: null },
  };
  try { S.paradigmaId = sessionStorage.getItem("aj.paradigma") || ""; } catch (e) { /* sem armazenamento */ }

  // ───────── Abas ─────────
  const TABS = ["esteira", "lupa", "audiencia", "chat", "precedentes", "gabinete", "historico"];
  function abrirAba(id) {
    for (const t of TABS) {
      $("#t-" + t).setAttribute("aria-selected", String(t === id));
      $("#" + t).hidden = t !== id;
    }
    if (id === "lupa") renderLupa();
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
    S.diag = null; S.chat = []; S.pagina = 1;
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
      const teses = $("#c-teses").checked ? S.teses.filter((t) => t.ativa !== false) : [];
      const tema = [...c.dossie.pedidos.map((p) => p.descricao), ...c.dossie.pontosControvertidos, c.dossie.classe].join(" ");
      const precedentes = AJ.rankPrecedentes(tema, S.precedentes);
      const prompt = P.stage2({ dossie: c.dossie, paradigma, teses, precedentes, instrucao: $("#t-instrucao").value.trim() });
      const out = $("#minuta");
      const r = await ask(prompt, { tier: "complex", signal, onText: ({ text }) => { setStep(2, "run", "redigindo"); clear(out, md(text)); } });
      c.minuta = r.text.trim();
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
      c.minuta = r.text.trim(); renderCaso(); salvarHistorico();
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
        h("button", { class: "btn ghost sm", type: "button", onclick: () => abrirAba("lupa"), text: "Conferir na Lupa" }));
    }

    const pc = $("#p-checks");
    if (c.minuta) {
      const { densos, nao, sem } = conferencia();
      pc.hidden = false;
      const linha = (rot, n, bom) => h("div", { class: "check" }, h("span", { text: rot }), h("span", { class: "pill " + (bom ? "ok" : "bad"), text: String(n) }));
      clear($("#checks"),
        linha("Parágrafos densos na fundamentação (mínimo 14)", densos, densos >= 14),
        c.dossie ? linha("Pedidos não apreciados", nao.length, !nao.length) : null,
        c.autos ? linha("Dados sem lastro nos autos", sem.length, !sem.length) : null);
      clear($("#check-notes"),
        nao.map((p) => h("div", { class: "bad", text: `${p.id} — ${p.litisconsorte}: ${p.descricao}` })),
        sem.map((d) => h("div", { class: "bad", text: `${d.tipo}: ${d.valor} não aparece nos autos` })),
        c.dossie && c.dossie.alertas.length ? h("div", { class: "warn", text: "Alertas da Etapa 1: " + c.dossie.alertas.join(" · ") }) : null);
      clear($("#check-actions"), densos < 14 && c.resumo ? h("button", { class: "btn quiet sm", id: "b-aprof", type: "button", onclick: aprofundar, text: "Aprofundar fundamentação" }) : null);
    } else pc.hidden = true;

    renderBotoes();
    if (!$("#lupa").hidden) renderLupa();
  }

  function renderBotoes() {
    const c = S.caso, ok = !!S.cap.sample, ocupado = !!S.ctl;
    $("#b-gerar").disabled = !ok || !c.autos || ocupado;
    $("#b-auditar").disabled = !ok || !$("#editor").value.trim() || !(c.autos || c.resumo) || ocupado;
    $("#b-painel").disabled = !ok || !(c.resumo || c.autos);
    $("#b-termo").disabled = !ok;
    $("#b-enviar").disabled = !ok || !c.minuta || !c.resumo;
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
  $("#editor").addEventListener("change", () => renderCaso());
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
      const d = await ask(P.auditoria(minuta, autosParaIA(minuta, alertas), alertas), { tier: "complex", json: true, signal: S.ctl.signal });
      S.diag = { ...d, automaticas: sem };
      renderDiag();
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
      clear(box, h("div", { class: "row" }, h("button", { class: "btn ghost sm", type: "button", onclick: () => { S.caso.minuta = txt; renderCaso(); toast("Minuta substituída pelo gabarito."); }, text: "Usar o gabarito como minuta" })), h("div", { class: "folha" }, md(txt)));
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

  // ───────── Chat ─────────
  const tMsg = $("#t-msg");
  tMsg.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviarChat(); });
  $("#b-enviar").addEventListener("click", enviarChat);
  function renderChat(streaming) {
    const box = $("#msgs");
    if (!S.chat.length && !streaming) return clear(box, h("p", { class: "muted small", text: "Gere uma minuta na Esteira. Depois peça ajustes como “converta para improcedência” ou “aprecie a tutela de urgência”." }));
    clear(box, S.chat.map((m) => m.role === "user" ? h("div", { class: "msg user", text: m.content }) : h("div", { class: "msg bot" },
      h("div", { class: "folha" }, md(m.content)),
      /##\s*Altera/i.test(m.content) ? h("button", { class: "btn ghost sm", type: "button", onclick: () => { S.caso.minuta = m.content.replace(/\n#{1,3}\s*Altera[çc][õo]es realizadas[\s\S]*$/i, "").trim(); renderCaso(); toast("Minuta atualizada."); }, text: "Aplicar como minuta atual" }) : null)),
      streaming || null);
    box.scrollTop = box.scrollHeight;
  }
  async function enviarChat() {
    const msg = tMsg.value.trim();
    if (!msg || $("#b-enviar").disabled) return;
    showErr($("#chat-err"), null);
    S.chat.push({ role: "user", content: msg }); tMsg.value = "";
    const bolha = h("div", { class: "msg bot" }, h("p", { class: "muted small", text: "Pensando…" }));
    renderChat(bolha);
    $("#b-enviar").disabled = true;
    // A minuta atual já carrega o estado; respostas antigas vão resumidas para caber na chamada.
    const hist = S.chat.slice(-6).map((m) => (m.role === "assistant" && m.content.length > 3000 ? { role: "assistant", content: m.content.slice(0, 3000) + "\n[…resposta anterior abreviada; a minuta atual acima já reflete as alterações aceitas]" } : m));
    const turns = [{ role: "user", content: P.chatRegras(S.caso.resumo, S.caso.minuta) }, ...hist];
    try {
      const r = await ask(turns, { tier: "default", cache: false, onText: ({ text }) => clear(bolha, h("div", { class: "folha" }, md(text))) });
      S.chat.push({ role: "assistant", content: r.text });
      renderChat();
    } catch (e) { S.chat.pop(); tMsg.value = msg; renderChat(); showErr($("#chat-err"), e); }
    finally { renderBotoes(); }
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
      h("div", { class: "row" }, h("span", null, h("strong", { text: m.numero }), " ", h("span", { class: "muted small", text: new Date(m.criadoEm).toLocaleString("pt-BR") })),
        h("div", { class: "row" },
          h("button", { class: "btn sm ghost", type: "button", onclick: () => abrirHistorico(m), text: "Abrir" }),
          h("button", { class: "btn sm quiet", type: "button", onclick: async () => { try { await S.cap.db.collection("data/users/" + S.cap.uid).doc(m._id).delete(); } catch (e) { toast("Não foi possível excluir."); } }, text: "Excluir" }))),
      h("p", { class: "muted small", text: m.arquivo || "" })))
      : [h("p", { class: "muted small", text: "Nenhuma minuta salva ainda. Cada minuta gerada a partir de autos reais é guardada aqui, visível só para você (os autos em si não são guardados)." })]);
  }
  function abrirHistorico(m) {
    novoCaso({ nome: `${m.arquivo || "Minuta salva"} (sem os autos)`, minuta: m.minuta, resumo: m.resumo, numero: m.numero,
      dossie: m.pedidos && m.pedidos.length ? AJ.normalizarDossie({ numeroProcesso: m.numero, pedidos: m.pedidos }) : null, histId: m._id.replace(/^m-/, "") });
    abrirAba("esteira");
  }

  // ───────── Capacidades do claude.ai ─────────
  function pill(id, txt, tom) { const el = $(id); el.textContent = txt; el.className = "pill " + (tom || ""); el.hidden = false; }
  async function iniciar() {
    renderFiltros(); renderPrecedentes(); renderParadigmas(); renderTeses(); renderHistorico(); renderCaso();
    if (!window.claude || !window.claude.use) {
      pill("#st-claude", "Claude: abra esta página no claude.ai", "bad");
      pill("#st-db", "Dados do gabinete: indisponíveis fora do claude.ai", "warn");
      return;
    }
    const [sample, db, user, downloads] = await Promise.all(["sample", "db", "user", "downloads"].map((n) => window.claude.use(n).catch(() => null)));
    S.cap.sample = sample; S.cap.db = db; S.cap.user = user; S.cap.downloads = downloads;
    pill("#st-claude", sample ? "Claude: disponível" : "Claude: indisponível nesta visualização", sample ? "ok" : "bad");

    if (user) {
      try { S.cap.uid = await user.id(); } catch (e) { S.cap.uid = null; }
      try { S.cap.canEdit = await user.canEdit(); } catch (e) { S.cap.canEdit = false; }
      try { S.cap.canWrite = await user.can("data.write"); } catch (e) { S.cap.canWrite = null; }
      pill("#st-role", S.cap.canEdit ? "Juiz(a) / Editor" : S.cap.canWrite === false ? "Somente leitura" : "Assessor(a) / Colaborador", S.cap.canEdit ? "ok" : "");
    }
    $("#par-form").hidden = !S.cap.canEdit; $("#par-ro").hidden = S.cap.canEdit;
    $("#tes-form").hidden = !S.cap.canEdit; $("#tes-ro").hidden = S.cap.canEdit;
    $("#l-importar").hidden = S.cap.canWrite === false || !sample;

    if (db) {
      pill("#st-db", "Dados do gabinete: sincronizados", "ok");
      const falha = () => pill("#st-db", "Dados do gabinete: conexão perdida — recarregue", "bad");
      db.collection("teses").onSnapshot((s) => { S.teses = s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (a.titulo || "").localeCompare(b.titulo || "")); renderTeses(); }, falha);
      db.collection("paradigmas").onSnapshot((s) => { S.paradigmas = s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (a.titulo || "").localeCompare(b.titulo || "")); renderParadigmas(); }, falha);
      db.collection("precedentes").limit(1000).onSnapshot((s) => { S.precedentes = s.docs.map((d) => ({ ...d.data(), id: d.id })); renderPrecedentes(); }, falha);
      if (S.cap.uid) db.collection("data/users/" + S.cap.uid).orderBy("criadoEm", "desc").limit(50).onSnapshot((s) => { S.historico = s.docs.map((d) => ({ ...d.data(), _id: d.id })).filter((m) => m.minuta); renderHistorico(); }, () => {});
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

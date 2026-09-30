/* Assessor TJGO — mesa de trabalho do assessor: autos (PDF) | minuta | chat, com prompts e histórico.
   IA: o Claude da conta de quem usa a página (sample). Dados: banco da página (db). Nada é semeado. */
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
  const L = (v) => (Array.isArray(v) ? v : []);
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const lembrar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } };
  const lido = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const MAX_BYTES = 250000, STAGE1_CHARS = 170000;
  const INI = "===MINUTA ATUALIZADA===", FIM = "===FIM DA MINUTA===";

  // ───────── Estado ─────────
  const S = {
    caso: null, prompts: [], historico: [], chat: [], ctl: null, pagina: 1, tipoAto: "auto", promptId: lido("tj.prompt"),
    minAba: "texto", anterior: null,
    cap: { sample: null, db: null, user: null, downloads: null, uid: null, tools: false },
  };
  const casoVazio = () => ({ id: novoId(), nome: "", autos: "", paginas: 0, pdf: null, exemplo: false, dossie: null, resumo: "", minuta: "", numero: "", tipoAto: "" });
  S.caso = casoVazio();

  // ───────── Navegação ─────────
  const TELAS = ["processo", "prompts", "historico"];
  function abrir(id) {
    for (const t of TELAS) { $("#t-" + t).setAttribute("aria-selected", String(t === id)); $("#" + t).hidden = t !== id; }
    window.scrollTo(0, 0);
  }
  TELAS.forEach((t) => $("#t-" + t).addEventListener("click", () => abrir(t)));
  function painel(id) {
    document.querySelectorAll(".mesa > .panel").forEach((p) => p.classList.toggle("on", p.id === id));
    $("#paneswitch").querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.p === id)));
    if (id === "p-autos") renderPagina();
  }
  $("#paneswitch").addEventListener("click", (e) => { const b = e.target.closest("button[data-p]"); if (b) painel(b.dataset.p); });

  // ───────── Mensagens ─────────
  const ERR = {
    not_granted: "A página não recebeu permissão para usar o Claude. Recarregue e permita quando for perguntado.",
    sampling_disabled: "O Claude não está disponível para esta conta.",
    capability_disabled: "Abra esta página no claude.ai para usar o Claude.",
    rate_limited: "Limite de uso do seu plano atingido ou muitas chamadas seguidas. Aguarde alguns minutos.",
    session_expired: "Sua sessão expirou. Entre de novo no claude.ai e recarregue a página.",
    refused: "O Claude recusou este conteúdo. Revise o texto enviado.",
    prompt_too_large: "Texto grande demais para uma chamada.",
    invalid_json: "A resposta veio fora do formato esperado. Tente de novo.",
    upstream_error: "Falha temporária de conexão com o Claude. Tente de novo.",
    tools_unavailable: "Leitura dos autos pelo chat indisponível nesta visualização.",
    cancelled: "Interrompido.",
  };
  const errMsg = (e) => ERR[e && e.code] || (e && e.message ? String(e.message) : "Erro inesperado.");
  const showErr = (el, e) => clear(el, e ? h("div", { class: "err", role: "alert", text: typeof e === "string" ? e : errMsg(e) }) : null);
  let toastT;
  function toast(msg) {
    let t = $("#toast");
    if (!t) { t = h("div", { id: "toast", role: "status" }); document.body.append(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
  }

  // ───────── Claude ─────────
  async function ask(input, { tier = "default", json = false, onText, signal, cache } = {}) {
    if (!S.cap.sample) throw { code: "capability_disabled" };
    if (typeof input === "string" && AJ.bytes(input) > MAX_BYTES) throw { code: "prompt_too_large" };
    const o = { modelTier: tier };
    if (signal) o.signal = signal; if (onText) o.onText = onText; if (cache !== undefined) o.cache = cache;
    return json ? S.cap.sample.json(input, o) : S.cap.sample(input, o);
  }

  // ───────── Markdown seguro, com referências clicáveis ─────────
  const REF = /(⟦Pág\. \d+⟧|\b(?:Mov|Arq|Pág|Evento|fls?)\.?\s?\d+(?:[.-]\d+)?|\[P\d+\])/g;
  function irParaPagina(n) { S.pagina = n; painel("p-autos"); renderPagina(); }
  function inlineRefs(text) {
    const out = [];
    for (const part of text.split(REF)) {
      if (!part) continue;
      REF.lastIndex = 0;
      if (/^\[P\d+\]$/.test(part)) out.push(h("span", { class: "pid", text: part }));
      else if (REF.test(part)) {
        const pag = /Pág\.?\s?(\d+)/.exec(part);
        out.push(pag && S.caso.paginas ? h("button", { class: "ref", type: "button", title: "Abrir esta página dos autos", onclick: () => irParaPagina(Number(pag[1])), text: part.replace(/[⟦⟧]/g, "") }) : h("span", { class: "ref", text: part.replace(/[⟦⟧]/g, "") }));
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
      const lines = t.split("\n"), hm = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
      if (hm) { frag.append(h("h" + hm[1].length, null, inline(hm[2]))); if (lines.length > 1) frag.append(md(lines.slice(1).join("\n"))); continue; }
      if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) { frag.append(h("ul", null, lines.map((l) => h("li", null, inline(l.replace(/^\s*[-*•]\s+/, "")))))); continue; }
      if (lines.every((l) => /^\s*>/.test(l))) { frag.append(h("p", { class: "cit" }, inline(lines.map((l) => l.replace(/^\s*>\s?/, "")).join(" ")))); continue; }
      const p = h("p"); lines.forEach((l, i) => { if (i) p.append(h("br")); p.append(...inline(l)); }); frag.append(p);
    }
    return frag;
  }

  // ───────── Leitura dos autos ─────────
  const pdfjs = window.pdfjsLib || null;
  if (pdfjs) pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  async function lerPdf(file, onProgress) {
    if (!pdfjs) throw new Error("O leitor de PDF não carregou. Recarregue a página.");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    const paginas = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n), content = await page.getTextContent();
      let linha = ""; const linhas = [];
      for (const it of content.items) { if (!("str" in it)) continue; linha += it.str; if (it.hasEOL) { linhas.push(linha); linha = ""; } }
      if (linha) linhas.push(linha);
      paginas.push(linhas.join("\n")); page.cleanup(); onProgress(n, doc.numPages);
      if (n % 4 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    return { doc, texto: AJ.cleanPages(paginas), paginas: doc.numPages };
  }
  const drop = $("#drop"), fAutos = $("#f-autos");
  fAutos.addEventListener("change", () => { carregar(fAutos.files[0]); fAutos.value = ""; });
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); carregar(e.dataTransfer.files[0]); });
  async function carregar(file) {
    if (!file) return;
    showErr($("#gerar-err"), null);
    if (file.type && file.type !== "application/pdf") return showErr($("#gerar-err"), "Selecione um arquivo PDF.");
    const bar = $("#leitura-bar"); bar.hidden = false; $("#drop-t").textContent = `Lendo ${file.name}…`;
    try {
      const r = await lerPdf(file, (n, t) => { bar.firstElementChild.style.width = (100 * n / t) + "%"; $("#drop-s").textContent = `Página ${n} de ${t}`; });
      // Reabrindo do histórico: mantém a minuta e só acrescenta os autos.
      if (S.caso.minuta && !S.caso.autos && S.caso.reaberto) Object.assign(S.caso, { nome: file.name, autos: r.texto, paginas: r.paginas, pdf: r.doc });
      else novoCaso({ nome: file.name, autos: r.texto, paginas: r.paginas, pdf: r.doc });
      if (r.texto.replace(/⟦Pág\. \d+⟧/g, "").trim().length < 300) showErr($("#gerar-err"), "Este PDF parece digitalizado sem texto (imagem). Aplique OCR antes de enviar.");
      S.pagina = 1; render();
    } catch (e) { showErr($("#gerar-err"), "Não foi possível ler o PDF: " + (e.message || e)); render(); }
    finally { bar.hidden = true; }
  }
  function novoCaso(dados) { S.caso = { ...casoVazio(), ...dados }; S.chat = []; S.anterior = null; S.minAba = "texto"; }
  $("#b-exemplo").addEventListener("click", () => {
    const hdr = "PODER JUDICIÁRIO DO ESTADO DE GOIÁS\nComarca de Exemplo — Juizado Especial Cível";
    const pags = EXEMPLO.map((c, i) => `${hdr}\n${c}\nDocumento assinado eletronicamente por SERVIDOR FICTÍCIO\nPág. ${i + 1} de ${EXEMPLO.length}`);
    novoCaso({ nome: "Autos de exemplo (fictícios)", autos: AJ.cleanPages(pags), paginas: pags.length, exemplo: true });
    S.pagina = 1; render();
  });

  // ───────── Visualizador dos autos ─────────
  let renderTask = null;
  $("#pg-prev").addEventListener("click", () => { S.pagina = Math.max(1, S.pagina - 1); renderPagina(); });
  $("#pg-next").addEventListener("click", () => { S.pagina = Math.min(S.caso.paginas || 1, S.pagina + 1); renderPagina(); });
  $("#pg-n").addEventListener("change", (e) => { S.pagina = Math.min(Math.max(1, Number(e.target.value) || 1), S.caso.paginas || 1); renderPagina(); });
  async function renderPagina() {
    const c = S.caso, box = $("#pdfbox");
    $("#pg-n").value = String(S.pagina); $("#pg-n").max = String(c.paginas || 1); $("#pg-total").textContent = `de ${c.paginas || "—"}`;
    if (!c.autos) return clear(box, h("p", { class: "muted small", style: "padding:20px", text: c.minuta ? "Minuta do histórico: anexe o PDF dos autos para vê-los aqui." : "Anexe os autos para vê-los aqui." }));
    if (!c.pdf) {
      let atual = 1, txt = "";
      for (const p of c.autos.split(/(⟦Pág\. \d+⟧)/)) { const m = /⟦Pág\. (\d+)⟧/.exec(p); if (m) atual = Number(m[1]); else if (atual === S.pagina) txt += p; }
      return clear(box, h("pre", { text: txt.trim() || "(página sem texto)" }));
    }
    if ($("#p-autos").offsetParent === null) return; // painel oculto: desenha quando abrir
    try {
      const page = await c.pdf.getPage(S.pagina), vp0 = page.getViewport({ scale: 1 });
      const scale = Math.min(2.2, Math.max(0.5, (box.clientWidth - 20) / vp0.width)) * (window.devicePixelRatio || 1);
      const vp = page.getViewport({ scale });
      const canvas = h("canvas", { width: Math.floor(vp.width), height: Math.floor(vp.height), "aria-label": `Página ${S.pagina} dos autos` });
      if (renderTask) renderTask.cancel();
      renderTask = page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
      await renderTask.promise; renderTask = null;
      clear(box, canvas); box.scrollTop = 0;
    } catch (e) { if (!(e && e.name === "RenderingCancelledException")) clear(box, h("p", { class: "muted small", text: "Não foi possível exibir esta página." })); }
  }
  let buscaT;
  $("#busca").addEventListener("input", () => { clearTimeout(buscaT); buscaT = setTimeout(renderBusca, 200); });
  function renderBusca() {
    const q = $("#busca").value.trim(), c = S.caso, box = $("#hits");
    if (q.length < 3 || !c.autos) return clear(box);
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), hits = []; let m;
    while ((m = re.exec(c.autos)) && hits.length < 60) {
      const antes = c.autos.lastIndexOf("⟦Pág.", m.index);
      const pag = antes >= 0 ? Number(c.autos.slice(antes + 6, c.autos.indexOf("⟧", antes))) : 1;
      const trecho = c.autos.slice(Math.max(0, m.index - 60), m.index + m[0].length + 80).replace(/⟦Pág\. \d+⟧/g, " ");
      const k = trecho.toLowerCase().indexOf(q.toLowerCase());
      hits.push(h("button", { type: "button", onclick: () => { S.pagina = pag; renderPagina(); } }, h("span", { class: "tag", text: "Pág. " + pag }), " …", trecho.slice(0, k), h("mark", { text: trecho.slice(k, k + q.length) }), trecho.slice(k + q.length), "…"));
    }
    clear(box, hits.length ? hits : [h("span", { class: "muted small", text: "Nada encontrado." })]);
  }

  // ───────── Parâmetros ─────────
  $("#seg-ato").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]"); if (!b) return;
    S.tipoAto = b.dataset.v; $("#seg-ato").querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
  });
  $("#s-prompt").addEventListener("change", (e) => { S.promptId = e.target.value; lembrar("tj.prompt", S.promptId); });

  // ───────── Geração em duas etapas, com progresso visível ─────────
  // Autos grandes (milhares de páginas) são lidos em blocos, 3 ao mesmo tempo. Cada bloco lido fica guardado no caso:
  // se a geração parar ou falhar, "Gerar minuta" continua de onde parou.
  const PARALELO = 3;
  const PROG = { ini: 0, timer: null, blocos: [], duracoes: [], etapa: 1, agora: "" };
  const fmtTempo = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s}s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}s`; };
  function renderProg() {
    const n = PROG.blocos.length, feitos = PROG.blocos.filter((x) => x === "done").length, dec = Date.now() - PROG.ini;
    if (PROG.etapa === 1) {
      $("#prog-t").textContent = `Etapa 1 de 2 · Leitura dos autos — ${feitos} de ${n} bloco(s)`;
      const media = PROG.duracoes.length ? PROG.duracoes.reduce((a, b) => a + b, 0) / PROG.duracoes.length : 0;
      const resta = media ? (media * (n - feitos)) / PARALELO : 0;
      $("#prog-tempo").textContent = `${fmtTempo(dec)} decorridos${resta ? ` · cerca de ${fmtTempo(resta)} restantes` : ""}`;
      $("#prog-bar").style.width = `${n ? (100 * feitos) / n * 0.8 : 0}%`;
    } else if (PROG.etapa === 2) {
      $("#prog-t").textContent = "Etapa 2 de 2 · Redação da minuta";
      $("#prog-tempo").textContent = `${fmtTempo(dec)} decorridos`;
      $("#prog-bar").style.width = "90%";
    } else {
      $("#prog-t").textContent = PROG.etapa === 3 ? "Minuta pronta" : "Geração interrompida";
      $("#prog-tempo").textContent = `${fmtTempo(dec)} no total`;
      $("#prog-bar").style.width = PROG.etapa === 3 ? "100%" : $("#prog-bar").style.width;
    }
    clear($("#prog-blocos"), n > 1 ? PROG.blocos.map((st, i) => h("span", { class: st, title: `Bloco ${i + 1}: ${{ "": "na fila", run: "lendo", done: "lido", fail: "falhou" }[st]}`, text: String(i + 1) })) : []);
    $("#prog-agora").textContent = PROG.agora;
    $("#prog-dica").hidden = PROG.etapa > 2;
  }
  $("#b-gerar").addEventListener("click", gerar);
  $("#b-parar").addEventListener("click", () => S.ctl && S.ctl.abort());
  const espera = (ms, signal) => new Promise((ok, no) => { const t = setTimeout(ok, ms); signal.addEventListener("abort", () => { clearTimeout(t); no({ code: "cancelled" }); }, { once: true }); });

  async function lerBloco(bloco, i, n, signal, nivel, onText) {
    for (let tentativa = 0; ; tentativa++) {
      try { return [await ask(P.stage1(bloco, i, n), { json: true, signal, onText })]; }
      catch (e) {
        if (e && e.code === "invalid_json" && nivel < 2 && bloco.length > 40000) {
          const [a, b] = AJ.chunkText(bloco, Math.ceil(bloco.length / 2) + 2000);
          return [...await lerBloco(a, i, n, signal, nivel + 1, onText), ...(b ? await lerBloco(b, i, n, signal, nivel + 1, onText) : [])];
        }
        const transitorio = e && ["rate_limited", "upstream_error", "invalid_json"].includes(e.code);
        if (!transitorio || tentativa >= 2) throw e;
        PROG.agora = `Bloco ${i}: ${e.code === "rate_limited" ? "limite de uso momentâneo" : "falha temporária"} — tentando de novo em ${20 * (tentativa + 1)}s…`; renderProg();
        await espera(20000 * (tentativa + 1), signal);
      }
    }
  }

  // O dossiê de autos enormes pode passar do limite de uma chamada: encurta transcrições e sínteses até caber.
  function compactar(d, limite) {
    let x = JSON.parse(JSON.stringify(d));
    const cabe = () => AJ.bytes(JSON.stringify(x)) <= limite;
    const passos = [
      () => x.cronologia.forEach((e) => { e.transcricoes = L(e.transcricoes).slice(0, 1).map((t) => String(t).slice(0, 200)); }),
      () => x.cronologia.forEach((e) => { e.resumo = String(e.resumo || "").slice(0, 300); }),
      () => x.provas.forEach((p) => { p.descricao = String(p.descricao || "").slice(0, 200); }),
      () => x.cronologia.forEach((e) => { e.transcricoes = []; e.resumo = String(e.resumo || "").slice(0, 160); }),
      () => { x.cronologia = x.cronologia.filter((e) => !["certidao", "outro", "peticao_intercorrente"].includes(e.tipo)); },
    ];
    for (const p of passos) { if (cabe()) break; p(); }
    if (!cabe()) x.alertas = [...L(x.alertas), "Dossiê resumido para caber no limite de uma chamada."];
    return x;
  }

  async function gerar() {
    const c = S.caso;
    showErr($("#gerar-err"), null);
    S.ctl = new AbortController(); const signal = S.ctl.signal;
    $("#b-parar").hidden = false; $("#prog").hidden = false; renderBotoes();
    const blocos = AJ.chunkText(c.autos, STAGE1_CHARS);
    if (!c.lidos || c.lidos.length !== blocos.length) c.lidos = new Array(blocos.length).fill(null);
    Object.assign(PROG, { ini: Date.now(), etapa: 1, duracoes: [], agora: "", blocos: c.lidos.map((x) => (x ? "done" : "")) });
    clearInterval(PROG.timer); PROG.timer = setInterval(renderProg, 1000); renderProg();
    try {
      // ETAPA 1 — blocos em paralelo; os já lidos são reaproveitados.
      const fila = c.lidos.map((x, i) => (x ? null : i)).filter((i) => i != null);
      const falhas = [];
      const trabalhador = async () => {
        while (fila.length && !signal.aborted) {
          const i = fila.shift(), t0 = Date.now();
          PROG.blocos[i] = "run"; PROG.agora = `Lendo o bloco ${i + 1} de ${blocos.length}…`; renderProg();
          try {
            c.lidos[i] = await lerBloco(blocos[i], i + 1, blocos.length, signal, 0, ({ text }) => { PROG.agora = `Bloco ${i + 1}: recebendo a leitura do Claude (${text.length.toLocaleString("pt-BR")} caracteres)…`; });
            PROG.blocos[i] = "done"; PROG.duracoes.push(Date.now() - t0);
          } catch (e) {
            PROG.blocos[i] = "fail";
            if (e && e.code === "cancelled") throw e;
            falhas.push({ i, e });
            if (e && ["not_granted", "sampling_disabled", "session_expired", "capability_disabled"].includes(e.code)) throw e;
          }
          renderProg();
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALELO, fila.length || 1) }, trabalhador));
      if (signal.aborted) throw { code: "cancelled" };
      if (falhas.length) {
        const primeira = falhas[0].e;
        throw { code: "blocos_pendentes", causa: primeira && primeira.code, message: `${falhas.length} bloco(s) não foram lidos (${falhas.map((f) => f.i + 1).join(", ")}): ${errMsg(primeira)} Clique em Gerar minuta de novo para continuar só com esses blocos.` };
      }
      c.dossie = AJ.mergeDossies(c.lidos.flat()); c.resumo = AJ.resumoExecutivo(c.dossie); c.numero = c.dossie.numeroProcesso;

      // ETAPA 2 — redação, com o texto aparecendo enquanto é escrito.
      PROG.etapa = 2; PROG.agora = `Dossiê pronto: ${c.dossie.pedidos.length} pedido(s), ${c.dossie.cronologia.length} evento(s). O Claude está pensando na minuta…`; renderProg();
      const sugerido = { despacho: "despacho", decisao_interlocutoria: "decisao", saneamento: "decisao", sentenca: "sentenca", embargos_declaracao: "embargos" };
      c.tipoAto = S.tipoAto !== "auto" ? S.tipoAto : (sugerido[c.dossie.atoSugerido] || "sentenca");
      const promptArea = S.prompts.find((x) => x.id === S.promptId) || null;
      const montar = (d) => P.stage2({ dossie: d, paradigma: null, teses: [], precedentes: [], instrucao: $("#t-instrucao").value.trim(), tipoAto: c.tipoAto, promptArea });
      let prompt = montar(c.dossie);
      if (AJ.bytes(prompt) > MAX_BYTES - 5000) prompt = montar(compactar(c.dossie, MAX_BYTES - 5000 - (AJ.bytes(prompt) - AJ.bytes(JSON.stringify(c.dossie)))));
      painel("p-minuta"); S.minAba = "texto"; renderMinuta();
      const r = await ask(prompt, { tier: "complex", signal, onText: ({ text }) => {
        PROG.agora = `Redigindo: ${text.split(/\n\s*\n/).filter((x) => x.trim()).length} parágrafo(s) até agora…`;
        clear($("#min-view"), h("div", { class: "folha claude-out" }, md(text)));
      } });
      c.minuta = r.text.trim();
      PROG.etapa = 3; PROG.agora = r.truncated ? "A resposta foi cortada pelo limite de tamanho: confira o final da minuta." : "Confira a aba Conferência antes de usar a minuta.";
      c.lidos = null; // leitura concluída: libera a memória
      salvarHistorico(); render();
    } catch (e) {
      PROG.etapa = 4;
      const lidos = (c.lidos || []).filter(Boolean).length;
      PROG.agora = e && e.code === "cancelled" ? `Interrompido. ${lidos} bloco(s) já lidos ficam guardados: clique em Gerar minuta para continuar.` : `${lidos} bloco(s) lidos e guardados.`;
      if (!(e && e.code === "cancelled")) showErr($("#gerar-err"), e);
      if (e && e.text && PROG.blocos.every((x) => x === "done")) { c.minuta = e.text; render(); }
    } finally { clearInterval(PROG.timer); S.ctl = null; $("#b-parar").hidden = true; renderProg(); renderBotoes(); }
  }
  async function aprofundar() {
    const c = S.caso; S.ctl = new AbortController(); renderBotoes();
    try {
      const r = await ask(P.aprofundar(c.minuta, c.resumo), { tier: "complex", signal: S.ctl.signal, onText: ({ text }) => clear($("#min-view"), h("div", { class: "folha claude-out" }, md(text))) });
      S.anterior = c.minuta; c.minuta = r.text.trim(); salvarHistorico();
    } catch (e) { showErr($("#gerar-err"), e); }
    finally { S.ctl = null; S.minAba = "texto"; render(); }
  }

  // ───────── Minuta ─────────
  $("#min-tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (!b) return; S.minAba = b.dataset.v; renderMinuta(); });
  $("#editor").addEventListener("change", () => { if ($("#editor").value !== S.caso.minuta) { S.anterior = S.caso.minuta; S.caso.minuta = $("#editor").value; salvarHistorico(); renderAcoes(); renderBotoes(); } });
  function conferencia() {
    const c = S.caso, fund = AJ.secao(c.minuta, "FUNDAMENTA", "DISPOSITIVO");
    return { densos: AJ.paragrafosDensos(fund || c.minuta), nao: c.dossie ? AJ.pedidosNaoApreciados(c.dossie, c.minuta) : [], sem: c.autos ? AJ.verificarFidelidade(c.minuta, c.autos) : [] };
  }
  function renderMinuta() {
    const c = S.caso, view = $("#min-view"), ed = $("#editor");
    $("#min-tabs").querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.v === S.minAba)));
    $("#minuta-h").textContent = c.numero && c.numero !== "n/i" ? `Minuta · ${c.numero}` : "Minuta";
    ed.hidden = S.minAba !== "editar"; view.hidden = S.minAba === "editar";
    if (S.minAba === "editar") { ed.value = c.minuta; return; }
    if (!c.minuta) return clear(view, h("div", { class: "placeholder" }, h("p", { text: c.autos ? "Autos prontos. Escolha o prompt e o tipo de ato e clique em Gerar minuta." : "Anexe os autos em PDF (ou use os autos de exemplo) para começar." }), h("p", { class: "small", text: "Etapa 1: o Claude extrai cronologia, pedidos de cada parte e provas com Mov./Arq./Pág. Etapa 2: redige relatório, fundamentação e dispositivo. Clique numa referência de página para abrir os autos nela." })));
    if (S.minAba === "texto") return clear(view, h("div", { class: "folha claude-out" }, md(c.minuta)));
    const { densos, nao, sem } = conferencia(), piso = !c.tipoAto || c.tipoAto === "sentenca" ? 14 : 0;
    const linha = (rot, n, bom) => h("div", { class: "check" }, h("span", { text: rot }), h("span", { class: "pill " + (bom ? "ok" : "bad"), text: String(n) }));
    clear(view, h("div", { class: "checks" },
      linha(piso ? "Parágrafos densos na fundamentação (mínimo 14)" : "Parágrafos densos na fundamentação", densos, densos >= piso),
      c.dossie ? linha("Pedidos não apreciados", nao.length, !nao.length) : null,
      c.autos ? linha("Dados sem lastro nos autos", sem.length, !sem.length) : null),
      h("div", { class: "notes" }, nao.map((p) => h("div", { class: "bad", text: `${p.id} — ${p.litisconsorte}: ${p.descricao}` })), sem.map((d) => h("div", { class: "bad", text: `${d.tipo}: ${d.valor} não aparece nos autos` })),
        c.dossie && c.dossie.alertas.length ? h("div", { class: "warn", text: "Alertas da Etapa 1: " + c.dossie.alertas.join(" · ") }) : null),
      piso && densos < piso && c.resumo ? h("div", { class: "row" }, h("button", { class: "btn quiet sm", type: "button", disabled: !!S.ctl || !S.cap.sample, onclick: aprofundar, text: "Aprofundar fundamentação" })) : null,
      !c.autos ? h("p", { class: "muted small", text: "Anexe os autos para conferir valores, datas e números." }) : null);
  }
  function renderAcoes() {
    const c = S.caso;
    clear($("#minuta-acts"), c.minuta ? [
      S.anterior != null ? h("button", { class: "btn quiet sm", type: "button", onclick: () => { const x = c.minuta; c.minuta = S.anterior; S.anterior = x; salvarHistorico(); render(); toast("Versão anterior restaurada."); }, text: "Desfazer" }) : null,
      h("button", { class: "btn quiet sm", type: "button", onclick: copiar, text: "Copiar" }),
      S.cap.downloads ? h("button", { class: "btn quiet sm", type: "button", onclick: baixarWord, text: "Word" }) : null] : []);
  }
  const semMarcadores = (t) => t.replace(/\s?\[P\d+\]/g, "");
  async function copiar() {
    try { await navigator.clipboard.writeText(semMarcadores(S.caso.minuta)); toast("Minuta copiada."); }
    catch (e) { S.minAba = "editar"; renderMinuta(); $("#editor").select(); toast("Selecione e copie no editor."); }
  }
  async function baixarWord() {
    const div = h("div"); div.append(md(semMarcadores(S.caso.minuta)));
    div.querySelectorAll(".ref,.pid").forEach((r) => r.replaceWith(document.createTextNode(r.textContent)));
    const nome = `minuta-${(S.caso.numero && S.caso.numero !== "n/i" ? S.caso.numero : "processo").replace(/[^\w.-]+/g, "_")}.doc`;
    const html = `<html lang="pt-BR"><head><meta charset="utf-8"><title>Minuta</title><style>body{font:12pt/1.5 "Times New Roman",serif}h1,h2{text-align:center;text-transform:uppercase;font-size:12pt}h3{font-size:12pt}p{text-align:justify;text-indent:2cm}p.cit{text-indent:0;margin-left:4cm;font-size:11pt}</style></head><body>${div.innerHTML}</body></html>`;
    try { await S.cap.downloads.save({ filename: nome, data: html }); } catch (e) { if (e && e.code !== "declined") toast("Não foi possível salvar o arquivo."); }
  }

  // ───────── Chat com a minuta (lê os autos por ferramentas) ─────────
  const tMsg = $("#t-msg");
  tMsg.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviarChat(); });
  $("#b-enviar").addEventListener("click", enviarChat);
  $("#b-chat-parar").addEventListener("click", () => S.ctl && S.ctl.abort());
  $("#b-chat-nova").addEventListener("click", () => { S.chat = []; renderChat(); salvarHistorico(); });
  $("#chips").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-p]"); if (!b) return;
    tMsg.value = b.dataset.p; tMsg.focus();
    if (!b.dataset.edit) enviarChat();
  });
  function separar(t) {
    const i = t.indexOf(INI); if (i < 0) return { conversa: t, minuta: "" };
    const resto = t.slice(i + INI.length), f = resto.indexOf(FIM);
    return { conversa: t.slice(0, i).trim(), minuta: (f >= 0 ? resto.slice(0, f) : resto).trim(), completa: f >= 0 };
  }
  function renderChat(bolha) {
    const box = $("#msgs");
    if (!S.chat.length && !bolha) return clear(box, h("p", { class: "muted small", text: "Converse sobre a minuta e os autos: peça resumo, reanálise de um documento, melhoria ou ajuste. Quando o Claude propuser uma minuta alterada, você decide se aplica." }));
    clear(box, S.chat.map((m) => {
      if (m.role === "user") return h("div", { class: "msg user", text: m.content });
      const { conversa, minuta, completa } = separar(m.content);
      return h("div", { class: "msg bot" }, h("span", { class: "claude-chip", text: "Claude" }),
        h("div", { class: "folha" }, md(conversa || "Minuta atualizada abaixo.")),
        L(m.fontes).length ? h("p", { class: "tool-note", text: "Consultou nos autos: " + m.fontes.join("; ") }) : null,
        minuta ? h("details", null, h("summary", { text: completa === false ? "Minuta proposta (cortada — confira antes de aplicar)" : "Ver a minuta proposta" }), h("div", { class: "folha" }, md(minuta))) : null,
        minuta ? h("div", { class: "row", style: "margin-top:8px" }, m.aplicada ? h("span", { class: "pill ok", text: "Aplicada" })
          : h("button", { class: "btn sm", type: "button", onclick: () => { m.aplicada = true; S.anterior = S.caso.minuta; S.caso.minuta = minuta; salvarHistorico(); S.minAba = "texto"; render(); toast("Minuta atualizada. Use Desfazer para voltar."); }, text: "Aplicar na minuta" })) : null);
    }), bolha || null);
    const sc = box.parentElement; sc.scrollTop = sc.scrollHeight;
  }
  function paginasDoTexto(autos) {
    const pags = new Map(); let atual = 1;
    for (const p of autos.split(/(⟦Pág\. \d+⟧)/)) { const m = /⟦Pág\. (\d+)⟧/.exec(p); if (m) atual = Number(m[1]); else pags.set(atual, (pags.get(atual) || "") + p); }
    return pags;
  }
  function ferramentas(fontes, nota) {
    const c = S.caso, pags = paginasDoTexto(c.autos);
    return [
      { name: "buscar_nos_autos", description: "Procura um termo nos autos (peça, pessoa, valor, 'Mov. 18', 'laudo'). Retorna até 12 ocorrências com página e trecho. Use antes de ler páginas.",
        inputSchema: { type: "object", properties: { termo: { type: "string" } }, required: ["termo"] },
        execute: ({ termo }) => {
          const q = String(termo || "").trim(); if (q.length < 3) throw new Error("Informe ao menos 3 letras.");
          nota(`buscando “${q}”…`);
          const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), out = [];
          for (const [n, t] of pags) { let m; re.lastIndex = 0; while ((m = re.exec(t)) && out.length < 12) out.push({ pagina: n, trecho: t.slice(Math.max(0, m.index - 160), m.index + q.length + 200).replace(/\s+/g, " ").trim() }); if (out.length >= 12) break; }
          fontes.push(`busca “${q}”`);
          return out.length ? out : "Nada encontrado. Tente outro termo.";
        } },
      { name: "ler_paginas", description: "Lê o texto integral de páginas dos autos (até 6 por vez). Retorna {pagina, texto}. Use para reanalisar um documento.",
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
  const autosParaIA = (extra) => {
    const c = S.caso, n = AJ.bytes(extra || "");
    if (c.autos && AJ.bytes(c.autos) + n < 200000) return c.autos;
    return c.resumo ? "" : c.autos.slice(0, Math.max(20000, 180000 - n));
  };
  async function enviarChat() {
    const msg = tMsg.value.trim(), c = S.caso;
    if (!msg || $("#b-enviar").disabled) return;
    showErr($("#chat-err"), null);
    S.chat.push({ role: "user", content: msg }); tMsg.value = "";
    const bolha = h("div", { class: "msg bot" }, h("span", { class: "claude-chip", text: "Claude" }), h("p", { class: "muted small", text: "Pensando…" }));
    renderChat(bolha);
    S.ctl = new AbortController(); renderBotoes(); $("#b-chat-parar").hidden = false;
    const fontes = [], nota = (t) => { const n = bolha.querySelector(".tool-note") || bolha.appendChild(h("p", { class: "tool-note" })); n.textContent = "Consultando os autos: " + t; };
    const usarFerr = !!(c.autos && S.cap.tools);
    const contexto = P.chat({ resumo: (c.resumo || "").slice(0, 60000), minuta: c.minuta, paginas: c.paginas, nomeAutos: c.nome, ferramentas: usarFerr, autosTexto: usarFerr ? "" : autosParaIA(c.minuta + c.resumo) });
    let hist = S.chat.slice(-8).map((m) => ({ role: m.role, content: m.role === "assistant" ? (separar(m.content).conversa || "Propus uma minuta atualizada.").slice(0, 3000) : m.content }));
    while (hist.length && hist[0].role !== "user") hist.shift();
    hist[0] = { role: "user", content: contexto + "\n\n---\nMENSAGEM:\n" + hist[0].content };
    const onText = ({ text }) => { const { conversa, minuta } = separar(text); clear(bolha, h("span", { class: "claude-chip", text: "Claude" }), h("div", { class: "folha" }, md(conversa)), minuta ? h("p", { class: "muted small", text: "Redigindo a minuta atualizada…" }) : null); };
    try {
      const r = usarFerr ? await S.cap.sample(hist, { modelTier: "default", signal: S.ctl.signal, onText, tools: ferramentas(fontes, nota) })
        : await ask(hist, { cache: false, signal: S.ctl.signal, onText });
      S.chat.push({ role: "assistant", content: r.text, fontes });
    } catch (e) {
      if (e && e.code === "cancelled") S.chat.push({ role: "assistant", content: (e.text || "") + "\n\n*(interrompido)*", fontes });
      else { S.chat.pop(); tMsg.value = msg; showErr($("#chat-err"), e); }
    } finally { S.ctl = null; $("#b-chat-parar").hidden = true; renderChat(); renderBotoes(); salvarHistorico(); }
  }

  // ───────── Prompts ─────────
  const AREAS = ["Juizado Especial Cível", "Cível", "Fazenda Pública", "Juizado da Fazenda Pública", "Família e Sucessões", "Previdenciário", "Criminal", "Infância e Juventude", "Execução Fiscal", "Outros"];
  const CATEGORIA_ANTIGA = { civel: "Cível", fazenda: "Fazenda Pública", criminal: "Criminal", familia: "Família e Sucessões", infancia: "Infância e Juventude", outros: "Outros", todos: "Outros" };
  clear($("#pr-area"), AREAS.map((a) => h("option", { value: a, text: a })));
  let prEdit = null;
  $("#pr-q").addEventListener("input", renderPrompts);
  function renderPrompts() {
    const q = $("#pr-q").value.trim().toLowerCase();
    const lista = S.prompts.filter((x) => !q || `${x.titulo} ${x.area} ${x.texto}`.toLowerCase().includes(q));
    $("#pr-h").textContent = `Prompts · ${S.prompts.length}`;
    clear($("#pr-list"), lista.length ? lista.map((x) => h("div", { class: "item" },
      h("div", { class: "row" }, h("span", null, h("strong", { text: x.titulo }), " ", h("span", { class: "tag", text: x.area })),
        h("div", { class: "row" },
          h("button", { class: "btn sm " + (S.promptId === x.id ? "" : "ghost"), type: "button", onclick: () => { S.promptId = x.id; lembrar("tj.prompt", x.id); renderSelect(); renderPrompts(); toast("Prompt ativo no Processo."); }, text: S.promptId === x.id ? "Em uso" : "Usar" }),
          h("button", { class: "btn sm quiet", type: "button", onclick: () => editarPrompt(x), text: "Editar" }),
          h("button", { class: "btn sm quiet", type: "button", onclick: () => confirmar($("#pr-list"), `Remover “${x.titulo}”?`, () => apagar("prompts", x.id, () => { S.prompts = S.prompts.filter((y) => y.id !== x.id); renderPrompts(); renderSelect(); })), text: "Remover" }))),
      h("p", { class: "muted small", text: x.texto.slice(0, 240) + (x.texto.length > 240 ? "…" : "") })))
      : [h("p", { class: "muted small", text: S.prompts.length ? "Nenhum prompt com esse filtro." : "Nenhum prompt ainda. Cadastre as instruções de cada matéria ou importe o JSON exportado do sistema antigo." })]);
  }
  function renderSelect() {
    const sel = $("#s-prompt");
    if (S.promptId && !S.prompts.some((x) => x.id === S.promptId)) S.promptId = "";
    clear(sel, h("option", { value: "", text: "Padrão do sistema" }), S.prompts.map((x) => h("option", { value: x.id, text: `${x.titulo} · ${x.area}` })));
    sel.value = S.promptId;
  }
  function editarPrompt(x) {
    prEdit = x ? x.id : null; $("#pr-form-h").textContent = x ? "Editar prompt" : "Novo prompt";
    $("#pr-titulo").value = x ? x.titulo : ""; $("#pr-area").value = x ? x.area : AREAS[0]; $("#pr-texto").value = x ? x.texto : "";
    if (x) $("#pr-titulo").focus();
  }
  $("#pr-limpar").addEventListener("click", () => editarPrompt(null));
  $("#pr-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = { titulo: $("#pr-titulo").value.trim(), area: $("#pr-area").value, texto: $("#pr-texto").value.trim() };
    if (d.titulo.length < 3 || d.texto.length < 10) return toast("Informe o título e as instruções.");
    const id = prEdit || novoId();
    if (await gravar("prompts", id, d, () => { S.prompts = [...S.prompts.filter((y) => y.id !== id), { ...d, id }]; renderPrompts(); renderSelect(); })) { editarPrompt(null); toast("Prompt salvo."); }
  });
  $("#pr-exp").addEventListener("click", async () => {
    if (!S.cap.downloads) return toast("Download indisponível nesta visualização.");
    const dados = JSON.stringify({ tipo: "assessor-tjgo/prompts", versao: 1, prompts: S.prompts.map(({ titulo, area, texto }) => ({ titulo, area, texto })) }, null, 2);
    try { await S.cap.downloads.save({ filename: "prompts.json", data: dados }); } catch (e) { if (e && e.code !== "declined") toast("Não foi possível salvar."); }
  });
  $("#pr-imp").addEventListener("change", async () => {
    const f = $("#pr-imp").files[0]; $("#pr-imp").value = ""; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      // Aceita o formato desta página, o do sistema novo e o do sistema antigo (title/promptText).
      const lista = (Array.isArray(j) ? j : j.prompts || []).filter((x) => x && !x.isDefault)
        .map((x) => ({ titulo: x.titulo || x.title, area: x.area || CATEGORIA_ANTIGA[x.category] || "Outros", texto: x.texto || x.promptText || x.description }))
        .filter((x) => typeof x.titulo === "string" && typeof x.texto === "string" && x.texto.trim());
      if (!lista.length) return toast("Nenhum prompt válido no arquivo.");
      let n = 0;
      for (const x of lista) { // só acrescenta: nunca sobrescreve os existentes
        if (S.prompts.some((y) => y.titulo === x.titulo && y.texto === x.texto)) continue;
        const d = { titulo: x.titulo.slice(0, 160), area: AREAS.includes(x.area) ? x.area : "Outros", texto: x.texto.slice(0, 20000) }, id = novoId();
        if (await gravar("prompts", id, d, () => S.prompts.push({ ...d, id }))) n++;
      }
      renderPrompts(); renderSelect(); toast(`${n} prompt(s) importado(s).`);
    } catch (e) { toast("Arquivo JSON inválido."); }
  });

  // ───────── Histórico (privado por pessoa) ─────────
  let histT;
  function salvarHistorico() {
    const c = S.caso;
    if (!S.cap.db || !S.cap.uid || !c.minuta || c.exemplo) return;
    clearTimeout(histT);
    histT = setTimeout(async () => {
      try {
        await S.cap.db.collection("data/users/" + S.cap.uid).doc("m-" + c.id).set({
          numero: c.numero || "n/i", arquivo: c.nome, paginas: c.paginas, tipoAto: c.tipoAto || "", criadoEm: c.criadoEm || (c.criadoEm = Date.now()), atualizadoEm: Date.now(),
          minuta: c.minuta.slice(0, 90000), resumo: (c.resumo || "").slice(0, 60000),
          pedidos: c.dossie ? c.dossie.pedidos.map((p) => ({ id: p.id, litisconsorte: p.litisconsorte, descricao: p.descricao })) : [],
          chat: S.chat.slice(-20).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
        });
      } catch (e) { /* o histórico é conveniência: falha não interrompe o trabalho */ }
    }, 800);
  }
  $("#hist-q").addEventListener("input", renderHistorico);
  function renderHistorico() {
    const box = $("#hist-list");
    if (!S.cap.db || !S.cap.uid) return clear(box, h("p", { class: "muted small", text: "O histórico fica disponível quando a página é aberta no claude.ai com sua conta." }));
    const q = $("#hist-q").value.trim().toLowerCase();
    const lista = S.historico.filter((m) => !q || `${m.numero} ${m.arquivo}`.toLowerCase().includes(q));
    clear(box, lista.length ? lista.map((m) => h("div", { class: "item" },
      h("div", { class: "row" }, h("span", null, h("strong", { text: m.numero }), " ", h("span", { class: "muted small", text: new Date(m.atualizadoEm || m.criadoEm).toLocaleString("pt-BR") })),
        h("div", { class: "row" }, h("button", { class: "btn sm", type: "button", onclick: () => reabrir(m), text: "Abrir" }),
          h("button", { class: "btn sm quiet", type: "button", onclick: () => confirmar(box, `Excluir a minuta ${m.numero} do histórico?`, async () => { try { await S.cap.db.collection("data/users/" + S.cap.uid).doc(m._id).delete(); } catch (e) { toast("Não foi possível excluir."); } }), text: "Excluir" }))),
      h("p", { class: "muted small", text: [m.arquivo, L(m.chat).length ? `${L(m.chat).length} mensagem(ns) no chat` : ""].filter(Boolean).join(" · ") })))
      : [h("p", { class: "muted small", text: S.historico.length ? "Nada encontrado." : "Nenhuma minuta ainda. Cada minuta gerada de autos reais fica guardada aqui, com a conversa do chat." })]);
  }
  function reabrir(m) {
    novoCaso({ id: m._id.replace(/^m-/, ""), nome: "", minuta: m.minuta, resumo: m.resumo, numero: m.numero, tipoAto: m.tipoAto, criadoEm: m.criadoEm, reaberto: true,
      dossie: L(m.pedidos).length ? AJ.normalizarDossie({ numeroProcesso: m.numero, pedidos: m.pedidos }) : null });
    S.chat = L(m.chat).map((x) => ({ ...x }));
    $("#drop-t").textContent = `${m.arquivo || "Minuta salva"} — anexe o PDF para ver os autos`;
    abrir("processo"); painel("p-minuta"); render();
  }

  // ───────── Banco da página ─────────
  async function gravar(col, id, dados, local) {
    try { if (S.cap.db) await S.cap.db.collection(col).doc(id).set({ ...dados, atualizadoEm: Date.now() }); else local(); return true; }
    catch (e) { toast(e && e.code === "invalid_argument" ? "Sem permissão para alterar isto." : "Não foi possível salvar."); return false; }
  }
  async function apagar(col, id, local) {
    try { if (S.cap.db) await S.cap.db.collection(col).doc(id).delete(); else local(); } catch (e) { toast("Não foi possível remover."); }
  }
  function confirmar(box, texto, acao) {
    const aviso = h("div", { class: "warnbox row" }, texto,
      h("button", { class: "btn danger sm", type: "button", onclick: async () => { await acao(); aviso.remove(); }, text: "Confirmar" }),
      h("button", { class: "btn quiet sm", type: "button", onclick: () => aviso.remove(), text: "Cancelar" }));
    box.prepend(aviso);
  }

  // ───────── Renderização geral ─────────
  function renderBotoes() {
    const c = S.caso, ok = !!S.cap.sample, ocupado = !!S.ctl;
    $("#b-gerar").disabled = !ok || !c.autos || ocupado;
    const lidos = (c.lidos || []).filter(Boolean).length;
    $("#b-gerar").textContent = lidos && !ocupado ? `Continuar (${lidos} de ${c.lidos.length} blocos lidos)` : "Gerar minuta";
    $("#b-enviar").disabled = !ok || !(c.minuta || c.autos) || ocupado;
  }
  function render() {
    const c = S.caso;
    if (c.autos) {
      $("#drop-t").textContent = c.nome;
      $("#drop-s").textContent = `${c.paginas} página(s) · ${c.autos.length.toLocaleString("pt-BR")} caracteres após a limpeza${c.exemplo ? " · fictícios" : ""}`;
    } else if (!c.minuta) { $("#drop-t").textContent = "Anexar os autos em PDF"; $("#drop-s").textContent = "PROJUDI, PJe ou eproc · lidos aqui no navegador"; }
    renderMinuta(); renderAcoes(); renderChat(); renderPagina(); renderBusca(); renderBotoes();
  }
  function pill(id, txt, tom) { const el = $(id); el.textContent = txt; el.className = "pill " + (tom || ""); }

  async function iniciar() {
    renderSelect(); renderPrompts(); renderHistorico(); render();
    if (!window.claude || !window.claude.use) { pill("#st-claude", "Claude: abra no claude.ai", "bad"); pill("#st-db", "Dados: só nesta sessão", "warn"); return; }
    const [sample, db, user, downloads] = await Promise.all(["sample", "db", "user", "downloads"].map((n) => window.claude.use(n).catch(() => null)));
    Object.assign(S.cap, { sample, db, user, downloads });
    if (sample && sample.limits) { try { S.cap.tools = !!(await sample.limits()).tools; } catch (e) { S.cap.tools = false; } }
    pill("#st-claude", sample ? "Claude: disponível" : "Claude: indisponível", sample ? "ok" : "bad");
    if (user) { try { S.cap.uid = await user.id(); } catch (e) { S.cap.uid = null; } }
    if (db) {
      pill("#st-db", "Dados: sincronizados", "ok");
      const falha = () => pill("#st-db", "Dados: conexão perdida — recarregue", "bad");
      db.collection("prompts").onSnapshot((s) => { S.prompts = s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => String(a.titulo).localeCompare(String(b.titulo))); renderPrompts(); renderSelect(); }, falha);
      if (S.cap.uid) db.collection("data/users/" + S.cap.uid).orderBy("atualizadoEm", "desc").limit(100).onSnapshot((s) => { S.historico = s.docs.map((d) => ({ ...d.data(), _id: d.id })).filter((m) => m.minuta); renderHistorico(); }, () => {});
    } else pill("#st-db", "Dados: só nesta sessão", "warn");
    renderHistorico(); render();
  }
  window.addEventListener("resize", () => { clearTimeout(window.__rz); window.__rz = setTimeout(renderPagina, 250); });

  // ───────── Autos de exemplo (FICTÍCIOS) ─────────
  const EXEMPLO = [
    "PROJUDI - Processo: 5001234-56.2025.8.09.0000 - Mov. 1 - Arq. 1 - Petição Inicial\nEXCELENTÍSSIMO SENHOR JUIZ DE DIREITO DO JUIZADO ESPECIAL CÍVEL\nMARIA DA SILVA EXEMPLO e JOÃO PEREIRA EXEMPLO, qualificados, vêm propor AÇÃO DECLARATÓRIA DE INEXISTÊNCIA DE DÉBITO C/C REPETIÇÃO DE INDÉBITO E INDENIZAÇÃO POR DANOS MORAIS em face de BANCO FICTÍCIO S.A.\nDOS FATOS\nA primeira autora é aposentada e, a partir de 05/02/2025, passou a sofrer descontos mensais de R$ 312,40 em seu benefício previdenciário, referentes a um empréstimo consignado que jamais contratou. O segundo autor, seu filho e curador, teve o nome inscrito em cadastro de inadimplentes em 10/03/2025 por dívida de R$ 1.874,00 vinculada ao mesmo contrato.",
    "DOS PEDIDOS\na) a declaração de inexistência do contrato nº 998877;\nb) a condenação do réu à restituição em dobro dos valores descontados da primeira autora, no total de R$ 1.874,40;\nc) a condenação do réu ao pagamento de R$ 10.000,00 a título de danos morais à primeira autora;\nd) a condenação do réu ao pagamento de R$ 5.000,00 a título de danos morais ao segundo autor, pela negativação indevida;\ne) a exclusão do nome do segundo autor dos cadastros de inadimplentes, em tutela de urgência.\nDá-se à causa o valor de R$ 16.874,40.",
    "PROJUDI - Mov. 18 - Arq. 1 - Contestação\nO BANCO FICTÍCIO S.A. sustenta, preliminarmente, a ilegitimidade ativa do segundo autor, que não seria parte no contrato. No mérito, afirma que o contrato foi celebrado eletronicamente, com biometria facial, e junta comprovante de transferência de R$ 5.000,00 para conta de titularidade da primeira autora em 03/01/2025. Pede a improcedência e, subsidiariamente, a compensação do valor transferido.",
    "PROJUDI - Mov. 24 - Arq. 1 - Réplica\nA primeira autora impugna a autenticidade da biometria e afirma que a conta indicada foi aberta por terceiro, sem sua participação. Requer a inversão do ônus da prova.\nPROJUDI - Mov. 30 - Termo de Audiência de Instrução\nRealizada em 14/08/2025. Ausente proposta de acordo. A testemunha Ana Souza afirmou que acompanhou a autora à agência e que ela desconhecia a conta. As partes dispensaram outras provas. Autos conclusos para sentença.",
  ];

  iniciar();
})();

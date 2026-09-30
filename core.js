/* Assessor Judicial IA — núcleo determinístico (sem IA). Exposto em window.AJ. */
(function (root) {
  "use strict";

  // ───────── Limpeza de PDFs forenses ─────────
  const NOISE = [
    /^documento\s+assinado\s+(digitalmente|eletronicamente)\b.*$/i,
    /^assinado\s+(digitalmente|eletronicamente)\s+por\b.*$/i,
    /^assinatura\s+eletr[oô]nica\b.*$/i,
    /\bICP[-\s]?Brasil\b/i,
    /^(este\s+documento\s+)?(pode\s+ser\s+)?(validado|verificado|conferido)\s+(em|no\s+(site|endere[cç]o))\b.*$/i,
    /^c[oó]digo\s+(de\s+)?(valida[cç][aã]o|verificador|de\s+autenticidade)\s*[:：]?.*$/i,
    /^(chave|identificador)\s+(de\s+acesso|do\s+documento)\s*[:：].*$/i,
    /^(hash|sha-?(1|256|512)|md5)\s*[:：]?\s*[0-9a-f]{16,}\s*$/i,
    /^[0-9a-f]{32,}$/i,
    /^https?:\/\/\S*(validar|autenticidade|verificador|consultadocumento|conferir|documento\.jsf|processo\/documento)\S*$/i,
    /^(p[aá]g(ina)?\.?|fl(s|ha)?\.?|folha)\s*\d+(\s*(de|\/)\s*\d+)?\s*$/i,
    /^-?\s*\d+\s*-?$/,
    /^\d+\s*(de|\/)\s*\d+$/i,
    /^evento\s+\d+\s*,?\s*[A-Z_]+\d*\s*,?\s*p[aá]gina\s+\d+\s*$/i,
    /^(num\.|n[uú]mero\s+do\s+documento)\s*[:：]?\s*\d{6,}\s*-?\s*p[aá]g\.?\s*\d+\s*$/i,
    /^(protocolo|recebido\s+em|juntado\s+em)\s*[:：]?\s*\d{1,2}\/\d{1,2}\/\d{2,4}.*\b\d{2}:\d{2}(:\d{2})?\s*$/i,
  ];
  const isNoiseLine = (l) => { const t = l.trim(); return !!t && NOISE.some((re) => re.test(t)); };
  const isStampFragment = (l) => { const t = l.trim(); return t.length > 0 && t.length <= 2 && !/^[IVX]+$/.test(t); };
  const signature = (l) => l.trim().toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ");

  function detectRepeatedEdges(pages, edge = 4, ratio = 0.4) {
    const counts = new Map();
    for (const lines of pages) {
      const ne = lines.filter((l) => l.trim());
      new Set([...ne.slice(0, edge), ...ne.slice(-edge)].map(signature)).forEach((s) => counts.set(s, (counts.get(s) || 0) + 1));
    }
    const min = Math.max(3, Math.ceil(pages.length * ratio));
    const out = new Set();
    counts.forEach((n, s) => { if (n >= min && s.length >= 4) out.add(s); });
    return out;
  }

  const SENTENCE_END = /[.!?:;…"”)\]]\s*$/;
  function joinAcrossPages(prev, next, marker) {
    const m = marker ? marker + " " : "";
    if (!prev) return m + next;
    if (!next) return prev + (marker ? " " + marker : "");
    const p = prev.replace(/\s+$/, ""), n = next.replace(/^\s+/, "");
    if (/[A-Za-zÀ-ú]-$/.test(p) && /^[a-zà-ú]/.test(n)) return marker ? p.slice(0, -1) + n.replace(/^(\S+)/, "$1 " + marker) : p.slice(0, -1) + n;
    if (!SENTENCE_END.test(p) && /^[a-zà-ú0-9,(]/.test(n)) return p + " " + m + n;
    return p + "\n\n" + m + n;
  }

  // ───────── Tríplice localização (Movimentação / Arquivo / Página do arquivo) ─────────
  // O PDF consolidado do PROJUDI traz em cada página o carimbo com a movimentação e o arquivo.
  // Lê o carimbo nas bordas da página ANTES da limpeza (que o remove como ruído).
  const RE_MOV = /\bMov(?:imenta[çc][ãa]o|imento|\.)?\s*(?:n[º°o.]?\s*)?[:\-]?\s*(\d{1,4})\b/i;
  const RE_ARQ = /\bArq(?:uivo|\.)?\s*(?:n[º°o.]?\s*)?[:\-]?\s*(\d{1,3})\b/i;
  const RE_PAG = /\bP[áa]g(?:ina|\.)?\s*[:\-]?\s*(\d{1,4})\s*(?:de|\/)\s*(\d{1,4})\b/i;
  function detectarLocais(rawPages) {
    const out = []; let ant = null;
    rawPages.forEach((txt, i) => {
      const linhas = String(txt).split("\n").map((l) => l.trim()).filter(Boolean);
      const bordas = [...linhas.slice(0, 8), ...linhas.slice(-8)];
      let mov = null, arq = null, pag = null, tot = null;
      for (const l of bordas) {
        const m = RE_MOV.exec(l), a = RE_ARQ.exec(l);
        if (m && a) { mov = m[1]; arq = a[1]; const pg = RE_PAG.exec(l); if (pg) { pag = pg[1]; tot = pg[2]; } break; }
      }
      // "Página X de Y" fora do carimbo só vale se não for a numeração do PDF inteiro.
      if (mov && !pag) for (const l of bordas) { const pg = RE_PAG.exec(l); if (pg && Number(pg[2]) !== rawPages.length) { pag = pg[1]; tot = pg[2]; break; } }
      let loc;
      if (mov) {
        // Sem "Página X de Y" no carimbo: conta as páginas do mesmo arquivo em sequência.
        const mesmo = ant && ant.mov === mov && ant.arq === arq;
        loc = { mov, arq, pag: pag || String(mesmo ? Number(ant.pag) + 1 : 1), tot, pdf: i + 1, lido: true };
      } else if (ant) loc = { mov: ant.mov, arq: ant.arq, pag: String(Number(ant.pag) + 1), tot: ant.tot, pdf: i + 1, lido: false };
      else loc = { pdf: i + 1, lido: false };
      out.push(loc); if (loc.mov) ant = loc;
    });
    const lidos = out.filter((l) => l.lido).length;
    return { locais: out, cobertura: rawPages.length ? lidos / rawPages.length : 0 };
  }
  const marcador = (loc) => (loc && loc.mov ? `⟦Mov. ${loc.mov} · Arq. ${loc.arq} · Pág. ${loc.pag} | PDF ${loc.pdf}⟧` : `⟦PDF ${loc ? loc.pdf : "?"}⟧`);

  /** Texto corrido, com marcadores discretos na virada de página: ⟦Mov. X · Arq. Y · Pág. Z | PDF N⟧ quando o carimbo existe. */
  function cleanPages(rawPages, keepMarkers = true, locais = null) {
    const pages = rawPages.map((p) => p.replace(/\r\n?/g, "\n").split("\n"));
    const repeated = detectRepeatedEdges(pages);
    const cleaned = pages.map((lines) => {
      const kept = []; let stamp = [];
      const flush = () => { if (stamp.length < 6) kept.push(...stamp); stamp = []; };
      for (const line of lines) {
        if (isStampFragment(line)) { stamp.push(line); continue; }
        flush();
        if (isNoiseLine(line) || repeated.has(signature(line))) continue;
        kept.push(line.replace(/[ \t]+/g, " ").trimEnd());
      }
      flush();
      return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    });
    let out = "";
    cleaned.forEach((t, i) => { out = joinAcrossPages(out, t, !keepMarkers ? "" : locais ? marcador(locais[i]) : `⟦Pág. ${i + 1}⟧`); });
    return out.trim();
  }

  // ───────── Fidelidade alfanumérica ─────────
  const PATTERNS = {
    "nº de processo": /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g,
    valor: /R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g,
    data: /\b\d{2}\/\d{2}\/\d{4}\b/g,
    telefone: /\(?\b\d{2}\)?\s?9?\d{4}-\d{4}\b/g,
  };
  const normData = (s) => s.replace(/\s+/g, "").replace(/[()]/g, "");
  function extrair(texto) {
    const out = {};
    for (const k in PATTERNS) out[k] = Array.from(new Set(texto.match(PATTERNS[k]) || []));
    return out;
  }
  /** Dados citados na minuta que NÃO aparecem literalmente nos autos. */
  function verificarFidelidade(minuta, autos) {
    const fonte = extrair(autos), naMinuta = extrair(minuta), out = [];
    for (const tipo in naMinuta) {
      const set = new Set(fonte[tipo].map(normData));
      for (const v of naMinuta[tipo]) if (!set.has(normData(v))) out.push({ tipo, valor: v });
    }
    return out;
  }
  const paragrafosDensos = (t, min = 250) => t.split(/\n\s*\n/).filter((p) => p.trim().length >= min && !/^#/.test(p.trim())).length;

  function secao(md, titulo, proximo) {
    const i = md.search(new RegExp("^#{1,3}\\s*" + titulo, "im"));
    if (i < 0) return "";
    const resto = md.slice(i);
    const j = proximo ? resto.slice(1).search(new RegExp("^#{1,3}\\s*" + proximo, "im")) : -1;
    return j < 0 ? resto : resto.slice(0, j + 1);
  }

  // ───────── Dossiê fático (Etapa 1) ─────────
  const arr = (v) => (Array.isArray(v) ? v : []);
  const str = (v, d = "n/i") => (typeof v === "string" && v.trim() ? v.trim() : d);
  function normalizarDossie(d) {
    d = d && typeof d === "object" ? d : {};
    const p = d.partes || {};
    return {
      numeroProcesso: str(d.numeroProcesso), classe: str(d.classe), unidade: str(d.unidade),
      partes: { polo_ativo: arr(p.polo_ativo).map(String), polo_passivo: arr(p.polo_passivo).map(String), terceiros: arr(p.terceiros).map(String) },
      cronologia: arr(d.cronologia).map((e) => ({ data: str(e.data), tipo: str(e.tipo, "outro"), resumo: str(e.resumo, ""), transcricoes: arr(e.transcricoes).map(String), mov: str(e.mov), arq: str(e.arq), pag: str(e.pag) })),
      pedidos: arr(d.pedidos).map((x, i) => ({ id: str(x.id, "P" + (i + 1)), litisconsorte: str(x.litisconsorte), descricao: str(x.descricao, ""), valor: typeof x.valor === "string" && x.valor.trim() ? x.valor.trim() : null, natureza: str(x.natureza, "principal"), mov: str(x.mov), arq: str(x.arq), pag: str(x.pag) })),
      preliminares: arr(d.preliminares).map((x) => ({ arguidaPor: str(x.arguidaPor), tese: str(x.tese, ""), pag: str(x.pag) })),
      provas: arr(d.provas).map((x) => ({ descricao: str(x.descricao, ""), produzidaPor: str(x.produzidaPor), mov: str(x.mov), pag: str(x.pag) })),
      pontosControvertidos: arr(d.pontosControvertidos).map(String),
      faseProcessual: str(d.faseProcessual), atoSugerido: str(d.atoSugerido, "sentenca"),
      alertas: arr(d.alertas).map(String),
    };
  }

  /** Funde dossiês de blocos sem juntar pedidos de litisconsortes distintos; renumera P1..Pn. */
  function mergeDossies(parts) {
    parts = parts.map(normalizarDossie);
    if (parts.length === 1) return parts[0];
    const first = (f) => parts.map(f).find((v) => v && v !== "n/i") || "n/i";
    const uniq = (a) => Array.from(new Set(a));
    const last = parts[parts.length - 1];
    const seen = new Set();
    return {
      numeroProcesso: first((d) => d.numeroProcesso), classe: first((d) => d.classe), unidade: first((d) => d.unidade),
      partes: { polo_ativo: uniq(parts.flatMap((p) => p.partes.polo_ativo)), polo_passivo: uniq(parts.flatMap((p) => p.partes.polo_passivo)), terceiros: uniq(parts.flatMap((p) => p.partes.terceiros)) },
      cronologia: parts.flatMap((p) => p.cronologia),
      pedidos: parts.flatMap((p) => p.pedidos).filter((x) => { const k = (x.litisconsorte + "|" + x.descricao + "|" + x.valor).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).map((x, i) => ({ ...x, id: "P" + (i + 1) })),
      preliminares: parts.flatMap((p) => p.preliminares), provas: parts.flatMap((p) => p.provas),
      pontosControvertidos: uniq(parts.flatMap((p) => p.pontosControvertidos)),
      faseProcessual: last.faseProcessual, atoSugerido: last.atoSugerido,
      alertas: uniq([...parts.flatMap((p) => p.alertas), `Autos lidos em ${parts.length} blocos — confira a continuidade da cronologia.`]),
    };
  }

  const loc = (x) => [x.mov !== "n/i" && x.mov ? "Mov. " + x.mov : "", x.arq !== "n/i" && x.arq ? "Arq. " + x.arq : "", x.pag !== "n/i" && x.pag ? "Pág. " + x.pag : ""].filter(Boolean).join(", ") || "localização n/i";

  /** Resumo Executivo montado do dossiê — sem nova chamada ao Claude. */
  function resumoExecutivo(d) {
    const L = [];
    L.push(`# Resumo Executivo — ${d.numeroProcesso}`, `${d.classe} · ${d.unidade}`, `Fase: ${d.faseProcessual} · Ato sugerido: ${d.atoSugerido}`);
    L.push(`\n## Partes\nPolo ativo: ${d.partes.polo_ativo.join("; ") || "n/i"}\nPolo passivo: ${d.partes.polo_passivo.join("; ") || "n/i"}` + (d.partes.terceiros.length ? `\nTerceiros: ${d.partes.terceiros.join("; ")}` : ""));
    L.push("\n## Pedidos");
    d.pedidos.forEach((p) => L.push(`- [${p.id}] ${p.litisconsorte}: ${p.descricao}${p.valor ? ` — ${p.valor}` : ""} (${p.natureza}; ${loc(p)})`));
    if (d.preliminares.length) { L.push("\n## Preliminares"); d.preliminares.forEach((p) => L.push(`- ${p.arguidaPor}: ${p.tese} (Pág. ${p.pag})`)); }
    L.push("\n## Cronologia");
    d.cronologia.forEach((e) => { L.push(`- ${e.data} · ${e.tipo} (${loc(e)}): ${e.resumo}`); e.transcricoes.forEach((t) => L.push(`  > "${t}"`)); });
    if (d.provas.length) { L.push("\n## Provas"); d.provas.forEach((p) => L.push(`- ${p.descricao} — ${p.produzidaPor} (${loc(p)})`)); }
    if (d.pontosControvertidos.length) { L.push("\n## Pontos controvertidos"); d.pontosControvertidos.forEach((p) => L.push(`- ${p}`)); }
    if (d.alertas.length) { L.push("\n## Alertas"); d.alertas.forEach((p) => L.push(`- ${p}`)); }
    return L.join("\n");
  }

  const pedidosNaoApreciados = (dossie, minuta) => {
    const ids = new Set((minuta.match(/\[P\d+\]/g) || []).map((s) => s.slice(1, -1)));
    return dossie.pedidos.filter((p) => !ids.has(p.id));
  };

  // ───────── Blocos ─────────
  function chunkText(text, maxChars, overlap = Math.floor(maxChars * 0.03)) {
    if (text.length <= maxChars) return [text];
    const out = []; let pos = 0;
    while (pos < text.length) {
      let end = Math.min(text.length, pos + maxChars);
      if (end < text.length) {
        const para = text.lastIndexOf("\n\n", end), sent = text.lastIndexOf(". ", end);
        end = para > pos + maxChars * 0.6 ? para : sent > pos + maxChars * 0.6 ? sent + 1 : end;
      }
      out.push(text.slice(pos, end));
      if (end >= text.length) break;
      pos = Math.max(end - overlap, pos + 1);
    }
    return out;
  }
  const bytes = (s) => new TextEncoder().encode(s).length;

  // ───────── Precedentes ─────────
  function hashId(s) { // FNV-1a 53 bits, estável entre navegadores
    let h1 = 0x811c9dc5 >>> 0, h2 = 0x01000193 >>> 0;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; }
    return "p" + h1.toString(36) + h2.toString(36);
  }
  const TRIBUNAIS = ["STF", "STJ", "TNU", "TJGO", "GABINETE"];
  function normalizarPrecedente(p, fonte) {
    const tribunal = TRIBUNAIS.includes(String(p.tribunal).toUpperCase()) ? String(p.tribunal).toUpperCase() : "GABINETE";
    const identificador = str(p.identificador, "sem identificador");
    const enunciado = str(p.enunciado, "");
    if (!enunciado) return null;
    return { id: hashId(`${tribunal}|${identificador.toLowerCase()}|${enunciado.slice(0, 200).toLowerCase()}`), tribunal, tipo: str(p.tipo, "informativo"), identificador, enunciado: enunciado.slice(0, 4000), palavrasChave: arr(p.palavrasChave).map(String).slice(0, 12), fonte: str(p.fonte, fonte || "") };
  }
  const STOP = new Set("a o as os de da do das dos e em no na nos nas por para com sem que se um uma ao aos à às pelo pela é art lei".split(" "));
  const tokens = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t));
  function rankPrecedentes(contexto, base, limite = 12) {
    const ctx = new Set(tokens(contexto));
    return base.map((p) => {
      const kw = (p.palavrasChave || []).flatMap(tokens), en = tokens(p.enunciado || "");
      return { p, score: kw.filter((t) => ctx.has(t)).length * 3 + new Set(en.filter((t) => ctx.has(t))).size };
    }).filter((x) => x.score >= 3).sort((a, b) => b.score - a.score).slice(0, limite).map((x) => x.p);
  }

  // ───────── Banco de teses do gabinete ─────────
  const semAcento = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  /** Chave de conferência: "s297" (súmula), "sv13" (súmula vinculante), "t1061" (tema); null para artigos, enunciados etc. */
  function chaveTese(tipo, numero) {
    const t = semAcento(tipo), n = /\d[\d.]*/.exec(String(numero || ""));
    if (!n) return null;
    const num = n[0].replace(/\./g, "").replace(/^0+(?=\d)/, "");
    if (/vinculante/.test(t)) return "sv" + num;
    if (/^sumula/.test(t)) return "s" + num;
    if (/tema|repetitivo|repercuss/.test(t)) return "t" + num;
    return null;
  }
  /** Súmulas e temas citados num texto: [{ chave, rotulo }], sem repetição. */
  function citacoesDeTeses(texto) {
    const out = new Map(), re = /\b(s[úu]mulas?\s+vinculantes?|s[úu]mulas?|temas?)\s*(?:n[º°o]?\.?\s*)?(\d{1,2}\.\d{3}|\d{1,4})(?![\d/])/gi;
    for (const m of String(texto || "").matchAll(re)) {
      const tipo = /vinculante/i.test(m[1]) ? "Súmula Vinculante" : /^s/i.test(m[1]) ? "Súmula" : "Tema";
      const chave = chaveTese(tipo, m[2]);
      if (chave && !out.has(chave)) out.set(chave, { chave, rotulo: `${tipo} ${m[2]}` });
    }
    return [...out.values()];
  }
  /** Teses que vão para o Claude: as da área (ou de todas as áreas); se não couberem em maxBytes,
   *  entram primeiro as marcadas "usar sempre" e as mais ligadas ao caso (assuntos, texto, número citado). */
  function selecionarTeses(teses, base, { area = "", maxBytes = 30000 } = {}) {
    const pool = (Array.isArray(teses) ? teses : []).filter((t) => t && t.texto && (!t.area || t.area === "Todas" || !area || t.area === area));
    const tam = (t) => bytes(JSON.stringify(t));
    if (pool.reduce((n, t) => n + tam(t), 0) <= maxBytes) return [...pool.filter((t) => t.sempre), ...pool.filter((t) => !t.sempre)];
    const ctx = new Set(tokens(base || "")), citadas = new Set(citacoesDeTeses(base).map((c) => c.chave));
    const nota = (t) => (t.sempre ? 1000 : 0) + (citadas.has(chaveTese(t.tipo, t.numero)) ? 50 : 0)
      + String(t.assuntos || "").split(/[,;\n]/).map(semAcento).map((x) => x.trim()).filter((x) => x && tokens(x).length && tokens(x).every((k) => ctx.has(k))).length * 5
      + new Set(tokens(t.texto).filter((k) => ctx.has(k))).size;
    const out = []; let usado = 0;
    for (const { t, n } of pool.map((t) => ({ t, n: nota(t) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)) {
      if (usado + tam(t) > maxBytes) continue;
      out.push(t); usado += tam(t);
    }
    return out;
  }

  // ───────── Consectários — Lei 14.905/2024 ─────────
  const round2 = (n) => Math.round(n * 100) / 100;
  function competencias(a, b) {
    let [y, m] = a.split("-").map(Number); const [by, bm] = b.split("-").map(Number); const out = [];
    while (y < by || (y === by && m <= bm)) { out.push(`${y}-${String(m).padStart(2, "0")}`); if (++m > 12) { m = 1; y++; } }
    return out;
  }
  /** Séries: linhas "AAAA-MM;ipca;selic" (percentual ao mês, vírgula ou ponto decimal). */
  function parseSeries(txt) {
    const ipca = new Map(), selic = new Map();
    for (const raw of txt.split(/\n/)) {
      const l = raw.trim(); if (!l || /^[a-z]/i.test(l)) continue;
      const [c, i, s] = l.split(/[;\t]/).map((x) => x.trim());
      if (!/^\d{4}-\d{2}$/.test(c)) throw new Error(`Linha inválida: "${l}". Use AAAA-MM;IPCA;Selic.`);
      ipca.set(c, Number(i.replace(",", "."))); selic.set(c, Number(s.replace(",", ".")));
    }
    return { ipca, selic };
  }
  function calcularConsectarios({ principal, inicioCorrecao, inicioJuros, fim, ipca, selic }) {
    const primeiro = inicioCorrecao < inicioJuros ? inicioCorrecao : inicioJuros;
    let fator = 1, jurosPct = 0; const memoria = [];
    for (const c of competencias(primeiro, fim)) {
      const i = ipca.get(c), s = selic.get(c);
      if (i === undefined || s === undefined || Number.isNaN(i) || Number.isNaN(s)) throw new Error(`Falta o índice da competência ${c}. Nenhum valor é estimado.`);
      if (c >= inicioCorrecao) fator *= 1 + i / 100;
      const tl = c >= inicioJuros ? Math.max(0, s - i) : 0;
      jurosPct += tl;
      memoria.push({ c, i, s, tl, fator });
    }
    const corrigido = round2(principal * fator), juros = round2(corrigido * (jurosPct / 100));
    return { corrigido, juros, total: round2(corrigido + juros), jurosPct, memoria };
  }

  // ───────── Prazos processuais (CPC, arts. 219, 220 e 224) — mesma regra de shared/prazos.ts ─────────
  const FERIADOS = { "01-01": "Confraternização Universal", "04-21": "Tiradentes", "05-01": "Dia do Trabalho", "09-07": "Independência do Brasil", "10-12": "Nossa Senhora Aparecida", "11-02": "Finados", "11-15": "Proclamação da República", "11-20": "Dia Nacional de Zumbi e da Consciência Negra", "12-25": "Natal" };
  const isoD = (d) => d.toISOString().slice(0, 10);
  const maisDias = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
  function parseData(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`Data inválida: "${s}". Use AAAA-MM-DD.`);
    const [y, m, d] = s.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d));
    if (isoD(dt) !== s) throw new Error(`Data inexistente: "${s}".`);
    return dt;
  }
  function motivoNaoUtil(d, extras) {
    const dow = d.getUTCDay();
    if (dow === 0) return "domingo";
    if (dow === 6) return "sábado";
    const mmdd = isoD(d).slice(5), m = d.getUTCMonth() + 1, dia = d.getUTCDate();
    if (FERIADOS[mmdd]) return `feriado nacional — ${FERIADOS[mmdd]}`;
    if ((m === 12 && dia >= 20) || (m === 1 && dia <= 20)) return "recesso forense (art. 220 do CPC)";
    if (extras.has(isoD(d))) return "sem expediente (informado)";
    return null;
  }
  /** Exclui o dia do começo, inclui o do vencimento; começo e vencimento em dia sem expediente vão para o próximo dia útil. */
  function calcularPrazo(intimacao, dias, extrasSemExpediente = [], uteis = true) {
    if (!Number.isInteger(dias) || dias < 1 || dias > 3650) throw new Error("Informe um prazo entre 1 e 3650 dias.");
    const extras = new Set(extrasSemExpediente.map((x) => isoD(parseData(x.trim()))));
    const ignorados = []; let d = maisDias(parseData(intimacao), 1), m;
    while ((m = motivoNaoUtil(d, extras))) { ignorados.push({ data: isoD(d), motivo: m }); d = maisDias(d, 1); }
    const inicioContagem = isoD(d);
    let contados = 1;
    while (contados < dias) {
      d = maisDias(d, 1);
      const mot = uteis ? motivoNaoUtil(d, extras) : null;
      if (mot) ignorados.push({ data: isoD(d), motivo: mot }); else contados++;
    }
    while ((m = motivoNaoUtil(d, extras))) { ignorados.push({ data: isoD(d), motivo: m }); d = maisDias(d, 1); }
    return { inicioContagem, vencimento: isoD(d), diasCorridos: Math.round((d - parseData(intimacao)) / 86400000), ignorados };
  }

  root.AJ = { cleanPages, isNoiseLine, verificarFidelidade, paragrafosDensos, secao, normalizarDossie, mergeDossies, resumoExecutivo, pedidosNaoApreciados, chunkText, bytes, hashId, normalizarPrecedente, rankPrecedentes, parseSeries, calcularConsectarios, loc, calcularPrazo, detectarLocais, chaveTese, citacoesDeTeses, selecionarTeses };
})(typeof window !== "undefined" ? window : globalThis);

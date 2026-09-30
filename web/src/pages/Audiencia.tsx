import { useState } from "react";
import type { PainelAudiencia } from "@shared/schemas";
import { MarkdownLite } from "../components/MarkdownLite";
import { Button, Card, ClaudeTag, ErrorBox, textareaCls } from "../components/ui";
import { api } from "../lib/api";
import { useCaso } from "../lib/caso";

const PILARES: [keyof PainelAudiencia, string][] = [
  ["fatosIncontroversos", "Fatos incontroversos"],
  ["controversias", "Controvérsias"],
  ["provasProduzidas", "Provas produzidas"],
  ["onusDaProva", "Ônus da prova"],
  ["pontosASanear", "Pontos a sanear"],
];

export default function Audiencia() {
  const { caso } = useCaso();
  const [participantes, setParticipantes] = useState("");
  const [painel, setPainel] = useState<PainelAudiencia | null>(null);
  const [anotacoes, setAnotacoes] = useState("");
  const [tipo, setTipo] = useState<"instrucao" | "conciliacao" | "acordo">("instrucao");
  const [termo, setTermo] = useState("");
  const [carregando, setCarregando] = useState<"painel" | "termo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function run<T>(qual: "painel" | "termo", fn: () => Promise<T>) {
    setErro(null);
    setCarregando(qual);
    try { await fn(); } catch (e) { setErro((e as Error).message); } finally { setCarregando(null); }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Resumo da lide — 5 pilares" actions={<Button loading={carregando === "painel"} disabled={!caso.autos && !caso.resumoExecutivo} onClick={() => run("painel", async () => setPainel(await api.post<PainelAudiencia>("/audiencia/painel", { autos: caso.resumoExecutivo || caso.autos, participantes: participantes.split(";").map((s) => s.trim()).filter(Boolean) })))}>Preparar audiência</Button>}>
        <input value={participantes} onChange={(e) => setParticipantes(e.target.value)} placeholder="Participantes (separe por ;) — ex.: Testemunha do autor João; Preposto do réu" className={`${textareaCls} mb-3`} />
        {painel ? (
          <div className="space-y-3 text-sm">
            {PILARES.map(([k, rotulo]) => (
              <div key={k}>
                <h3 className="font-semibold">{rotulo}</h3>
                <ul className="list-disc pl-5">{(painel[k] as string[]).map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            ))}
            <div>
              <h3 className="font-semibold">Perguntas sugeridas</h3>
              <ol className="list-decimal space-y-1 pl-5">{painel.perguntas.map((p, i) => <li key={i}><strong>{p.destinatario}:</strong> {p.pergunta} <span className="text-xs text-stone-500">({p.finalidade})</span></li>)}</ol>
            </div>
          </div>
        ) : (
          <p className="text-sm text-stone-500">Usa o Resumo Executivo do caso atual (ou os autos, se ainda não houver resumo).</p>
        )}
      </Card>

      <Card title="Redator rápido de termo">
        <div className="space-y-3">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={textareaCls}>
            <option value="instrucao">Termo de audiência de instrução</option>
            <option value="conciliacao">Termo de audiência de conciliação</option>
            <option value="acordo">Homologação de acordo</option>
          </select>
          <textarea rows={8} value={anotacoes} onChange={(e) => setAnotacoes(e.target.value)} className={textareaCls} placeholder="Anotações livres: presentes, ocorrências, proposta aceita (valor, parcelas, vencimentos, multa)…" />
          <Button loading={carregando === "termo"} disabled={anotacoes.length < 20} onClick={() => run("termo", async () => setTermo((await api.post<{ termo: string }>("/audiencia/termo", { anotacoes, tipo, cabecalho: caso.numeroProcesso })).termo))}>Redigir termo</Button>
          <ErrorBox erro={erro} />
          {termo && <div className="claude-output space-y-2"><ClaudeTag>Termo redigido pelo Claude</ClaudeTag><MarkdownLite text={termo} /></div>}
        </div>
      </Card>
    </div>
  );
}

import { Send } from "lucide-react";
import { useState } from "react";
import { MarkdownLite } from "../components/MarkdownLite";
import { Button, Card, ErrorBox, textareaCls } from "../components/ui";
import { api } from "../lib/api";
import { useCaso } from "../lib/caso";

interface Msg { role: "user" | "assistant"; content: string }

const SEPARADOR = /\n#{1,3}\s*Altera[çc][õo]es realizadas[\s\S]*$/i;

export default function Chat() {
  const { caso, atualizar } = useCaso();
  const [historico, setHistorico] = useState<Msg[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tokens, setTokens] = useState<{ entrada: number; saida: number } | null>(null);

  async function enviar() {
    if (!mensagem.trim()) return;
    setErro(null);
    setCarregando(true);
    try {
      const r = await api.post<{ resposta: string; tokens: { entrada: number; saida: number } }>("/chat", { resumoExecutivo: caso.resumoExecutivo, minutaAtual: caso.minuta, historico, mensagem });
      setHistorico((h) => [...h, { role: "user", content: mensagem }, { role: "assistant", content: r.resposta }]);
      setTokens(r.tokens);
      setMensagem("");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  const pronto = caso.resumoExecutivo && caso.minuta;
  return (
    <Card title="Chat de refino jurídico" actions={tokens && <span className="text-xs text-slate-500">última troca: {tokens.entrada.toLocaleString("pt-BR")} tokens de entrada (Resumo Executivo, não os autos integrais)</span>}>
      {!pronto && <p className="mb-3 text-sm text-slate-500">Gere uma minuta na Esteira primeiro — o chat trabalha sobre o Resumo Executivo e a minuta atual.</p>}
      <div className="mb-4 max-h-[60vh] space-y-4 overflow-auto">
        {historico.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-auto max-w-2xl rounded-lg bg-indigo-50 p-3 text-sm dark:bg-indigo-950" : "rounded-lg border border-slate-200 p-3 dark:border-slate-800"}>
            {m.role === "assistant" ? (
              <>
                <MarkdownLite text={m.content} />
                <Button variant="ghost" className="mt-2" onClick={() => atualizar({ minuta: m.content.replace(SEPARADOR, "").trim() })}>Aplicar como minuta atual</Button>
              </>
            ) : m.content}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <textarea rows={2} value={mensagem} onChange={(e) => setMensagem(e.target.value)} disabled={!pronto} className={textareaCls} placeholder='Ex.: "converta para improcedência", "aprecie a tutela de urgência"' onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void enviar(); }} />
        <Button onClick={enviar} loading={carregando} disabled={!pronto}><Send className="h-4 w-4" /></Button>
      </div>
      <ErrorBox erro={erro} />
    </Card>
  );
}

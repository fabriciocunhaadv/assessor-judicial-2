/**
 * Divide textos longos em blocos respeitando limites de parágrafo, com sobreposição
 * para não cortar uma oração ou um julgado ao meio.
 */
export function chunkText(text: string, maxChars: number, overlap = Math.floor(maxChars * 0.03)): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let pos = 0;
  while (pos < text.length) {
    let end = Math.min(text.length, pos + maxChars);
    if (end < text.length) {
      const para = text.lastIndexOf("\n\n", end);
      const sentence = text.lastIndexOf(". ", end);
      const cut = para > pos + maxChars * 0.6 ? para : sentence > pos + maxChars * 0.6 ? sentence + 1 : end;
      end = cut;
    }
    chunks.push(text.slice(pos, end));
    if (end >= text.length) break;
    pos = Math.max(end - overlap, pos + 1);
  }
  return chunks;
}

/** Executa tarefas com concorrência limitada, preservando a ordem dos resultados. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

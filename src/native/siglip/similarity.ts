export interface SimilarCandidate {
  id: string;
  embedding: number[];
}

export interface SimilarHit {
  id: string;
  score: number;
}

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  // Embeddings are L2-normalized at write time; still guard malformed legacy rows.
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

export function topKSimilar(
  query: ArrayLike<number>,
  candidates: SimilarCandidate[],
  options?: { k?: number; minScore?: number; excludeId?: string },
): SimilarHit[] {
  const k = options?.k ?? 6;
  const minScore = options?.minScore ?? 0.35;
  const excludeId = options?.excludeId;

  const scored: SimilarHit[] = [];
  for (const candidate of candidates) {
    if (excludeId && candidate.id === excludeId) continue;
    if (!candidate.embedding?.length) continue;
    const score = cosineSimilarity(query, candidate.embedding);
    if (score >= minScore) scored.push({ id: candidate.id, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

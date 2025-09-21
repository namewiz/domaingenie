import {
  AffixStrategy,
  PermutationStrategy,
  TldHackStrategy,
} from './strategies';
import { DomainCandidate, GenerationStrategy, ProcessedQuery } from './types';

export async function generateCandidates(
  processed: ProcessedQuery,
): Promise<Partial<DomainCandidate & { strategy: string }>[]> {
  const strategies: { name: string; strategy: GenerationStrategy }[] = [
    { name: 'permutation', strategy: new PermutationStrategy() },
    { name: 'affix', strategy: new AffixStrategy() },
    { name: 'tldHack', strategy: new TldHackStrategy() },
  ];

  const results = await Promise.all(strategies.map(s => s.strategy.generate(processed)));
  const combined: Partial<DomainCandidate & { strategy: string }>[] = [];
  results.forEach((arr, idx) => {
    const name = strategies[idx].name;
    arr.forEach(c => combined.push({ ...c, strategy: name }));
  });

  // Dedupe generations.
  const seen = new Set<string>();
  const deduped: Partial<DomainCandidate & { strategy: string }>[] = [];
  for (const cand of combined) {
    const domain = cand.domain?.toLowerCase();
    if (domain) {
      if (seen.has(domain)) continue;
      seen.add(domain);
    }
    deduped.push(cand);
  }

  return deduped;
}

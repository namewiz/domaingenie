import {
  AffixStrategy,
  AlphabeticalStrategy,
  PermutationStrategy,
  TldHackStrategy,
} from './strategies';
import { DomainCandidate, DomainSearchOptions, GenerationStrategy } from './types';

export async function generateCandidates(
  options: DomainSearchOptions,
): Promise<Partial<DomainCandidate & { strategy: string }>[]> {
  const strategies: { name: string; strategy: GenerationStrategy }[] = [
    { name: 'permutation', strategy: new PermutationStrategy() },
    { name: 'alphabetical', strategy: new AlphabeticalStrategy() },
    { name: 'affix', strategy: new AffixStrategy() },
    { name: 'tldHack', strategy: new TldHackStrategy() },
  ];

  const results = await Promise.all(strategies.map(s => s.strategy.generate(options)));
  const combined: Partial<DomainCandidate & { strategy: string }>[] = [];
  results.forEach((arr, idx) => {
    const name = strategies[idx].name;
    arr.forEach(c => combined.push({ ...c, strategy: name }));
  });
  return combined;
}

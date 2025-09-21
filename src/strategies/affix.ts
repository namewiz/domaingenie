/**
 * Generates domain variants by applying prefixes and suffixes to token combinations.
*/
import { DomainCandidate, GenerationStrategy, ProcessedQuery } from '../types';
import { combine } from '../utils';

export class AffixStrategy implements GenerationStrategy {
  async generate(query: ProcessedQuery): Promise<Partial<DomainCandidate>[]> {
    const prefixes = query.prefixes ?? [];
    const suffixes = query.suffixes ?? [];
    const tlds = query.orderedTlds;
    if ((!prefixes.length && !suffixes.length) || !tlds.length) return [];

    const synLists = query.tokens.map(token => {
      const synonyms = query.synonyms[token] ?? [];
      return [token, ...synonyms];
    });
    const bases = synLists.length ? combine(synLists, '') : [];
    const baseSet = new Set(bases.length ? bases : query.tokens);

    const results: Partial<DomainCandidate>[] = [];
    for (const base of baseSet) {
      if (!base) continue;
      if (prefixes.length) {
        for (const pre of prefixes) {
          const label = pre + base;
          for (const tld of tlds) {
            results.push({ domain: `${label}.${tld}`, suffix: tld });
          }
        }
      }
      if (suffixes.length) {
        for (const suf of suffixes) {
          const label = base + suf;
          for (const tld of tlds) {
            results.push({ domain: `${label}.${tld}`, suffix: tld });
          }
        }
      }
    }

    return results;
  }
}

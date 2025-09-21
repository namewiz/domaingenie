/**
 * Generates domain permutations and optional hyphenated combinations from tokens and synonyms.
*/
import { DomainCandidate, GenerationStrategy, ProcessedQuery } from '../types';
import { combine, permute } from '../utils';

export class PermutationStrategy implements GenerationStrategy {

  async generate(query: ProcessedQuery): Promise<Partial<DomainCandidate>[]> {
    if (!query.tokens.length) return [];
    const synLists = query.tokens.map(token => {
      const synonyms = query.synonyms[token] ?? [];
      return [token, ...synonyms];
    });
    const perms = permute(synLists);

    const labels = new Set<string>();
    const includeHyphenated = query.includeHyphenated ?? false;
    perms.forEach(lists => {
      for (const l of combine(lists, '')) labels.add(l);
      if (includeHyphenated && lists.length > 1) {
        for (const l of combine(lists, '-')) labels.add(l);
      }
    });

    const tlds = query.orderedTlds;
    if (!tlds.length) return [];

    const map = new Map<string, Partial<DomainCandidate>>();
    labels.forEach(label => {
      for (const tld of tlds) {
        const domain = `${label}.${tld}`;
        if (!map.has(domain)) {
          map.set(domain, { domain, suffix: tld });
        }
      }
    });

    return Array.from(map.values());
  }
}

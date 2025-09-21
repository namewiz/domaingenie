/**
 * Generates domain hacks by inserting dots before matching TLD endings.
*/
import { DomainCandidate, GenerationStrategy, ProcessedQuery } from '../types';
import { combine } from '../utils';

export class TldHackStrategy implements GenerationStrategy {
  async generate(query: ProcessedQuery): Promise<Partial<DomainCandidate>[]> {
    const tlds = query.orderedTlds.map(t => t.toLowerCase());
    if (!tlds.length) return [];
    const synLists = query.tokens.map(token => {
      const synonyms = query.synonyms[token] ?? [];
      return [token, ...synonyms];
    });
    const bases = synLists.length ? combine(synLists, '') : [];
    const labels = new Set(bases.length ? bases : query.tokens);
    const results: Partial<DomainCandidate>[] = [];
    for (const label of labels) {
      if (!label) continue;
      if (label.includes('.')) continue;
      for (const tld of tlds) {
        if (label.toLowerCase().endsWith(tld)) {
          const domain = label.slice(0, -tld.length) + '.' + tld;
          results.push({ domain, suffix: tld });
        }
      }
    }
    const seen = new Set<string>();
    return results.filter(r => {
      if (!r.domain) return false;
      if (seen.has(r.domain)) return false;
      seen.add(r.domain);
      return true;
    });
  }
}

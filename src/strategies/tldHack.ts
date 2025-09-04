/**
 * Generates domain hacks by inserting dots before matching TLD endings.
*/
import { expandSynonyms } from '../synonyms';
import { combine, normalizeTokens } from '../utils';
import { DomainSearchOptions, DomainCandidate, GenerationStrategy } from '../types';

export class TldHackStrategy implements GenerationStrategy {
  async generate(opts: DomainSearchOptions): Promise<Partial<DomainCandidate>[]> {
    const tlds = Array.from(new Set([
      opts.defaultTld,
      ...(opts.preferredTlds || []),
      ...(opts.supportedTlds || []),
    ])).map(t => t.toLowerCase());
    if (!tlds.length) return [];
    const tokens = normalizeTokens(opts.query);
    const keywords = (opts.keywords || []).map(k => k.toLowerCase());
    const maxSynonyms = opts.maxSynonyms ?? 5;
    const synLists = tokens.map(t => expandSynonyms(t, maxSynonyms));
    if (keywords.length) synLists.push(keywords);
    const bases = combine(synLists, '');
    const results: Partial<DomainCandidate>[] = [];
    for (const label of bases) {
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

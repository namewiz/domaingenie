/**
 * Generates domain permutations and optional hyphenated combinations from tokens and keywords.
*/
import { DomainCandidate, DomainSearchOptions, GenerationStrategy } from '../types';
import { combine, normalizeTokens, permute } from '../utils';

export class PermutationStrategy implements GenerationStrategy {

  async generate(opts: DomainSearchOptions): Promise<Partial<DomainCandidate>[]> {
    const tokens = normalizeTokens(opts.query);
    const keywords = (opts.keywords || []).map(k => k.toLowerCase());
    // Use precomputed synonyms provided by index.ts for speed; fallback to token itself
    const synLists = tokens.map(t => (opts.synonyms && opts.synonyms[t]) ? opts.synonyms[t] : [t]);
    if (keywords.length) synLists.push(keywords);
    const perms = permute(synLists);

    const labels = new Set<string>();
    const includeHyphenated = opts.includeHyphenated ?? true;
    perms.forEach(lists => {
      for (const l of combine(lists, '')) labels.add(l);
      if (includeHyphenated && lists.length > 1) {
        for (const l of combine(lists, '-')) labels.add(l);
      }
    });

    const tlds = Array.from(new Set([...(opts.supportedTlds || []), ...(opts.defaultTlds || [])]));
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

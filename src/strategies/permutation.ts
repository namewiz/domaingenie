/**
 * Generates domain permutations and optional hyphenated combinations from tokens and keywords.
*/
import { expandSynonyms } from '../synonyms';
import { normalizeTokens, combine, permute } from '../utils';
import { DomainSearchOptions, DomainCandidate, GenerationStrategy } from '../types';

export interface PermutationStrategyOptions {
  includeHyphenated?: boolean;
}

export class PermutationStrategy implements GenerationStrategy {
  private opts: Required<PermutationStrategyOptions>;

  constructor(opts: PermutationStrategyOptions = {}) {
    this.opts = { includeHyphenated: true, ...opts };
  }

  async generate(opts: DomainSearchOptions): Promise<Partial<DomainCandidate>[]> {
    const tokens = normalizeTokens(opts.query);
    const keywords = (opts.keywords || []).map(k => k.toLowerCase());
    const maxSynonyms = opts.maxSynonyms ?? 5;
    const synLists = tokens.map(t => expandSynonyms(t, maxSynonyms));
    if (keywords.length) synLists.push(keywords);
    const perms = permute(synLists);

    const labels = new Set<string>();
    perms.forEach(lists => {
      for (const l of combine(lists, '')) labels.add(l);
      if (this.opts.includeHyphenated && lists.length > 1) {
        for (const l of combine(lists, '-')) labels.add(l);
      }
    });

    const tlds = Array.from(new Set([
      opts.defaultTld,
      ...(opts.preferredTlds || []),
      ...(opts.supportedTlds || []),
    ]));
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

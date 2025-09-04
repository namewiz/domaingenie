/**
 * Generates domain variants by applying prefixes and suffixes to token combinations.
*/
import { expandSynonyms } from '../synonyms';
import { combine, normalizeTokens } from '../utils';
import { DomainSearchOptions, DomainCandidate, GenerationStrategy } from '../types';

export class AffixStrategy implements GenerationStrategy {
  async generate(opts: DomainSearchOptions): Promise<Partial<DomainCandidate>[]> {
    const prefixes = opts.prefixes ?? [];
    const suffixes = opts.suffixes ?? [];
    const tlds = Array.from(new Set([
      opts.defaultTld,
      ...(opts.preferredTlds || []),
      ...(opts.supportedTlds || []),
    ]));
    if ((!prefixes.length && !suffixes.length) || !tlds.length) return [];

    const tokens = normalizeTokens(opts.query);
    const keywords = (opts.keywords || []).map(k => k.toLowerCase());
    const maxSynonyms = opts.maxSynonyms ?? 5;
    const synLists = tokens.map(t => expandSynonyms(t, maxSynonyms));
    if (keywords.length) synLists.push(keywords);
    const bases = combine(synLists, '');

    const results: Partial<DomainCandidate>[] = [];
    for (const base of bases) {
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

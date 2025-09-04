/**
 * Generates alphabetical domain combinations from tokens using synonyms.
*/
import { expandSynonyms } from '../synonyms';
import { unique, normalizeTokens, combine } from '../utils';
import { DomainSearchOptions, DomainCandidate, GenerationStrategy } from '../types';

export class AlphabeticalStrategy implements GenerationStrategy {
  async generate(opts: DomainSearchOptions): Promise<Partial<DomainCandidate>[]> {
    const tokens = normalizeTokens(opts.query);
    if (tokens.length < 2) return [];
    const maxSynonyms = opts.maxSynonyms ?? 5;
    const alphaTokens = [...tokens].sort();
    const alphaLists = alphaTokens.map(t => expandSynonyms(t, maxSynonyms));
    const labels = unique(combine(alphaLists, ''));
    const tlds = Array.from(new Set([
      opts.defaultTld,
      ...(opts.preferredTlds || []),
      ...(opts.supportedTlds || []),
    ]));
    if (!tlds.length) return [];
    const results: Partial<DomainCandidate>[] = [];
    for (const label of labels) {
      for (const tld of tlds) {
        results.push({ domain: `${label}.${tld}`, suffix: tld });
      }
    }
    return results;
  }
}

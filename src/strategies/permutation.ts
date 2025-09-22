/**
 * Generates domain permutations and optional hyphenated combinations from tokens and synonyms.
*/
import { DomainCandidate, GenerationStrategy, ProcessedQuery } from '../types';
import { combine } from '../utils';

export class PermutationStrategy implements GenerationStrategy {

  async generate(query: ProcessedQuery): Promise<Partial<DomainCandidate>[]> {
    const tlds = query.orderedTlds;
    if (!query.tokens.length || !tlds.length) return [];

    // Limit: only combine at most 2 tokens at a time.
    // If exactly 1 token, allow single-token labels (no hyphenation needed).
    if (query.tokens.length === 1) {
      const soleList = [query.tokens[0], ...(query.synonyms[query.tokens[0]] ?? [])];
      const map = new Map<string, Partial<DomainCandidate>>();
      for (const label of soleList) {
        for (const tld of tlds) {
          const domain = `${label}.${tld}`;
          if (!map.has(domain)) {
            map.set(domain, { domain, suffix: tld });
            if (map.size >= query.limit) return Array.from(map.values());
          }
        }
      }
      return Array.from(map.values());
    }

    // Build synonym lists for each token
    const synLists = query.tokens.map(token => {
      const synonyms = query.synonyms[token] ?? [];
      return [token, ...synonyms];
    });

    const includeHyphenated = query.includeHyphenated ?? false;
    const labelSet = new Set<string>();
    const map = new Map<string, Partial<DomainCandidate>>();

    const addLabel = (label: string): boolean => {
      if (!label || labelSet.has(label)) return false;
      labelSet.add(label);
      for (const tld of tlds) {
        const domain = `${label}.${tld}`;
        if (!map.has(domain)) {
          map.set(domain, { domain, suffix: tld });
          if (map.size >= query.limit) return true; // Early exit when limit reached
        }
      }
      return map.size >= query.limit;
    };

    // Phase 1: generate single-token candidates (including synonyms)
    for (let i = 0; i < synLists.length; i++) {
      for (const label of synLists[i]) {
        if (addLabel(label)) return Array.from(map.values());
      }
    }

    // Phase 2: generate pairs if still below limit
    // Create all unique pairs of token indices and shuffle them for randomness
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < synLists.length; i++) {
      for (let j = i + 1; j < synLists.length; j++) {
        pairs.push([i, j]);
      }
    }
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; // Fisher-Yates shuffle
    }

    const generateForPair = (i: number, j: number): boolean => {
      const lists = [synLists[i], synLists[j]];
      // Non-hyphenated
      for (const l of combine(lists, '')) {
        if (addLabel(l)) return true;
      }
      // Hyphenated variants if requested
      if (includeHyphenated) {
        for (const l of combine(lists, '-')) {
          if (addLabel(l)) return true;
        }
      }
      return false;
    };

    for (const [i, j] of pairs) {
      if (generateForPair(i, j)) break; // forward order
      if (generateForPair(j, i)) break; // reverse order
    }

    return Array.from(map.values());
  }
}

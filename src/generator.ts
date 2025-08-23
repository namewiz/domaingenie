import { expandSynonyms } from './synonyms';
import { unique } from './utils';

const PREFIXES = ['my', 'the'];
const SUFFIXES = ['ly', 'ify'];

export function generateLabels(tokens: string[], keywords: string[] = []): string[] {
  const synonymLists = tokens.map(t => expandSynonyms(t));
  if (keywords.length) {
    synonymLists.push(keywords.map(k => k.toLowerCase()));
  }
  // Limit synonyms per token to first 3 to control explosion
  const trimmed = synonymLists.map(list => list.slice(0, 3));

  const results: string[] = [];

  function combine(prefix: string, index: number) {
    if (index === trimmed.length) {
      results.push(prefix);
      return;
    }
    for (const token of trimmed[index]) {
      combine(prefix + token, index + 1);
    }
  }

  if (trimmed.length) {
    combine('', 0);
    if (trimmed.length > 1) {
      const reversed = [...trimmed].reverse();
      function combineRev(prefix: string, index: number) {
        if (index === reversed.length) {
          results.push(prefix);
          return;
        }
        for (const token of reversed[index]) {
          combineRev(prefix + token, index + 1);
        }
      }
      combineRev('', 0);
    }
  }

  // Prefixes and suffixes
  const withAffixes = new Set<string>();
  for (const label of results) {
    withAffixes.add(label);
    for (const pre of PREFIXES) {
      withAffixes.add(pre + label);
    }
    for (const suf of SUFFIXES) {
      withAffixes.add(label + suf);
    }
  }

  return unique(Array.from(withAffixes));
}

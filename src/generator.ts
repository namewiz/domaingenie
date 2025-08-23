import { expandSynonyms } from './synonyms';
import { unique } from './utils';

type GenConfig = {
  prefixes?: string[];
  suffixes?: string[];
  maxSynonyms?: number;
};

function combine(lists: string[][], joiner = ''): string[] {
  const results: string[] = [];
  function helper(prefix: string, idx: number) {
    if (idx === lists.length) {
      results.push(prefix);
      return;
    }
    for (const token of lists[idx]) {
      const next = prefix ? prefix + joiner + token : token;
      helper(next, idx + 1);
    }
  }
  if (lists.length) helper('', 0);
  return results;
}

export function generateLabels(tokens: string[], keywords: string[] = [], config: GenConfig = {}): string[] {
  const maxSyn = config.maxSynonyms ?? 5;
  const synLists = tokens.map(t => expandSynonyms(t, maxSyn));
  if (keywords.length) synLists.push(keywords.map(k => k.toLowerCase()));

  // base combinations
  let labels: string[] = [];
  labels.push(...combine(synLists));
  if (synLists.length > 1) {
    labels.push(...combine([...synLists].reverse()));
    const alphaTokens = [...tokens].sort();
    const alphaLists = alphaTokens.map(t => expandSynonyms(t, maxSyn));
    labels.push(...combine(alphaLists));
  }

  // hyphenated versions
  if (synLists.length > 1) {
    const hyphenLabels = combine(synLists, '-');
    labels.push(...hyphenLabels);
  }

  // prefixes and suffixes
  const withAffixes = new Set<string>();
  const prefixes = config.prefixes || [];
  const suffixes = config.suffixes || [];
  for (const label of labels) {
    withAffixes.add(label);
    for (const pre of prefixes) withAffixes.add(pre + label);
    for (const suf of suffixes) withAffixes.add(label + suf);
  }

  return unique(Array.from(withAffixes));
}

import { expandSynonyms } from './synonyms';
import { unique } from './utils';

type GenConfig = {
  prefixes?: string[];
  suffixes?: string[];
  maxSynonyms?: number;
};

export interface GeneratedLabel {
  label: string;
  types: string[];
}

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

function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  arr.forEach((item, idx) => {
    const rest = [...arr.slice(0, idx), ...arr.slice(idx + 1)];
    for (const p of permute(rest)) {
      result.push([item, ...p]);
    }
  });
  return result;
}

export function generateLabels(
  tokens: string[],
  keywords: string[] = [],
  tlds: string[] = [],
  config: GenConfig = {}
): GeneratedLabel[] {
  const maxSyn = config.maxSynonyms ?? 5;
  const synLists = tokens.map(t => expandSynonyms(t, maxSyn));
  if (keywords.length) synLists.push(keywords.map(k => k.toLowerCase()));

  const labelMap = new Map<string, Set<string>>();
  function addLabels(lists: string[][], joiner: string, types: string[]) {
    for (const l of combine(lists, joiner)) {
      if (!labelMap.has(l)) labelMap.set(l, new Set());
      const set = labelMap.get(l)!;
      types.forEach(t => set.add(t));
    }
  }

  const perms = permute(synLists);
  perms.forEach((lists, idx) => {
    const baseTypes = idx === 0 ? ['base'] : ['permutation'];
    addLabels(lists, '', baseTypes);
    if (lists.length > 1) addLabels(lists, '-', [...baseTypes, 'hyphenated']);
  });

  if (synLists.length > 1) {
    const alphaTokens = [...tokens].sort();
    const alphaLists = alphaTokens.map(t => expandSynonyms(t, maxSyn));
    addLabels(alphaLists, '', ['alphabetical']);
  }

  // prefixes and suffixes
  const prefixes = config.prefixes || [];
  const suffixes = config.suffixes || [];
  const withAffixes = new Map<string, Set<string>>();

  labelMap.forEach((types, label) => {
    const baseSet = withAffixes.get(label) || new Set<string>(types);
    withAffixes.set(label, baseSet);
    for (const pre of prefixes) {
      const l = pre + label;
      const set = withAffixes.get(l) || new Set<string>(types);
      set.add('prefix');
      withAffixes.set(l, set);
    }
    for (const suf of suffixes) {
      const l = label + suf;
      const set = withAffixes.get(l) || new Set<string>(types);
      set.add('suffix');
      withAffixes.set(l, set);
    }
  });

  // TLD hacks
  const finalMap = new Map<string, Set<string>>();
  withAffixes.forEach((types, label) => {
    finalMap.set(label, new Set(types));
    if (!label.includes('.')) {
      for (const tld of tlds) {
        if (label.toLowerCase().endsWith(tld.toLowerCase())) {
          const hacked = label.slice(0, -tld.length) + '.' + tld;
          const set = finalMap.get(hacked) || new Set<string>(types);
          set.add('tldHack');
          finalMap.set(hacked, set);
        }
      }
    }
  });

  return Array.from(finalMap.entries()).map(([label, types]) => ({
    label,
    types: unique(Array.from(types)),
  }));
}

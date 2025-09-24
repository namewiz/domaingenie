import wordList from 'word-list-json';
import type { DomainCandidate, DomainScore, ProcessedQuery } from './types';
import { vowelRatio } from './utils';

const DEFAULT_TLD_WEIGHTS: Record<string, number> = {
  com: 20,
  net: 10,
  org: 10,
};

export class ScoringConfig {
  tldWeights: Record<string, number> = DEFAULT_TLD_WEIGHTS;
  hyphenPenalty = 5;
  numberPenalty = 5;
  baseScore = 100;
  lengthPenaltyPerChar = 1;
  lengthSeverity = 2;
  vowelRatioWeight = 10;
  lowVowelRatioThreshold = 0.3;
  lowVowelPenalty = 5;
  consonantClusterPenalty = 5;
  repeatedLettersPenalty = 5;
  locationTldBonus = 20;
  dictionaryWord = 15;
  dictionarySubstr = 5;

  constructor (init?: Partial<ScoringConfig>) {
    if (init) Object.assign(this, init);
  }
}

// Preload dictionary for O(1) membership checks
const ENGLISH_DICTIONARY: ReadonlySet<string> = (() => {
  const dict = new Set<string>();
  for (const entry of wordList) {
    if (typeof entry !== 'string') continue;
    const word = entry.toLowerCase();
    if (/^[a-z]+$/.test(word)) dict.add(word);
  }
  return dict;
})();

// Simple dictionary membership cache for speed
const DICT_CACHE = new Map<string, boolean>();

function isDictionaryWord(word: string): boolean {
  const w = word.toLowerCase();
  if (!w || /[^a-z]/.test(w)) return false;
  const cached = DICT_CACHE.get(w);
  if (cached !== undefined) return cached;
  const result = ENGLISH_DICTIONARY.has(w);
  DICT_CACHE.set(w, result);
  return result;
}

function isComposedOfDictionaryWords(label: string): boolean {
  const s = label.toLowerCase();
  // Hyphenated labels: every part should be a dictionary word
  const parts = s.split('-').filter(Boolean);
  if (parts.length > 1) {
    if (parts.every(isDictionaryWord)) return true;
  }
  // Non-hyphenated: try a few quick 2-way splits
  if (!s.includes('-') && /^[a-z]+$/.test(s)) {
    const n = s.length;
    const early = Math.min(6, n - 2);
    for (let i = 2; i <= early; i++) {
      if (isDictionaryWord(s.slice(0, i)) && isDictionaryWord(s.slice(i))) return true;
    }
    const lateStart = Math.max(2, n - 6);
    for (let i = lateStart; i <= n - 2; i++) {
      if (isDictionaryWord(s.slice(0, i)) && isDictionaryWord(s.slice(i))) return true;
    }
  }
  return false;
}

export function scoreCandidates(
  candidates: Partial<DomainCandidate & { strategy?: string }>[],
  processed: ProcessedQuery,
  locationTld?: string,
  tldWeights: Record<string, number> = {},
): DomainCandidate[] {
  const supported = new Set(processed.orderedTlds.map(t => t.toLowerCase()));
  const results: DomainCandidate[] = [];
  for (const cand of candidates) {
    if (!cand.domain || !cand.suffix) continue;
    const suffix = cand.suffix.toLowerCase();
    if (supported.size && !supported.has(suffix)) continue;
    const label = cand.domain.slice(0, -(cand.suffix.length + 1));
    const score = scoreDomain(label, suffix, locationTld, { tldWeights });
    results.push({
      domain: cand.domain,
      suffix,
      strategy: cand.strategy,
      score,
    });
  }
  // Sort by score (highest first) before returning
  results.sort((a, b) => b.score.total - a.score.total);
  return results;
}

export function scoreDomain(
  label: string,
  tld: string,
  location?: string,
  config?: Partial<ScoringConfig> | ScoringConfig,
): DomainScore {
  const cfg: ScoringConfig = config instanceof ScoringConfig ? config : new ScoringConfig(config);
  const components: Record<string, number> = {};
  let total = 0;

  const add = (key: string, value: number) => {
    if (value !== 0) components[key] = value;
    total += value;
  };

  add('base', cfg.baseScore);

  const len = label.length + (tld ? tld.length : 0);
  add('lengthPenalty', -(cfg.lengthSeverity * len * cfg.lengthPenaltyPerChar));
  const hyphenCount = (label.match(/-/g) || []).length;
  const numCount = (label.match(/[0-9]/g) || []).length;
  add('hyphenPenalty', -hyphenCount * cfg.hyphenPenalty);
  add('numberPenalty', -numCount * cfg.numberPenalty);

  const ratio = vowelRatio(label);
  add('vowelRatio', ratio * cfg.vowelRatioWeight);
  if (ratio < cfg.lowVowelRatioThreshold) add('lowVowelPenalty', -cfg.lowVowelPenalty); // hard to pronounce
  if (/([bcdfghjklmnpqrstvwxyz]{4,})/i.test(label)) add('consonantClusterPenalty', -cfg.consonantClusterPenalty); // many consonants together
  if (/([a-z])\1{2,}/i.test(label)) add('repeatedLettersPenalty', -cfg.repeatedLettersPenalty); // repeated letters reduce brandability

  const suffix = tld.toLowerCase();
  const weights = cfg.tldWeights;
  add('tldWeight', weights[suffix] || 0);
  if (location && suffix === location.toLowerCase()) {
    add('locationBonus', cfg.locationTldBonus);
  }

  // Boost dictionary words and sensible compounds
  if (isDictionaryWord(label)) {
    add('dictWord', cfg.dictionaryWord);
  } else if (isComposedOfDictionaryWords(label)) {
    add('dictSubstr', cfg.dictionarySubstr);
  }

  return { total, components };
}

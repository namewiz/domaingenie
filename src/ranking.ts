import synonymsLib from 'synonyms';
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

// Simple dictionary membership cache for speed
const DICT_CACHE = new Map<string, boolean>();

function isDictionaryWord(word: string): boolean {
  const w = word.toLowerCase();
  if (!w || /[^a-z]/.test(w)) return false;
  const cached = DICT_CACHE.get(w);
  if (cached !== undefined) return cached;
  let result = false;
  try {
    const syn = (synonymsLib as any)(w);
    result = !!syn && Object.keys(syn).length > 0;
  } catch {
    result = false;
  }
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

/**
 * Ranker: interleaves candidates across TLDs and strategies while
 * penalizing repeated labels. Optimized with single global sort and
 * shallow lookahead during selection.
 */
export function rankDomains(candidates: DomainCandidate[], limit?: number): DomainCandidate[] {
  if (!candidates.length) return [];

  // Global sort by score descending
  const sorted = candidates.slice().sort((a, b) => b.score.total - a.score.total);

  // Extract label (domain left of last ".suffix") quickly
  const getLabel = (c: DomainCandidate): string => {
    const s = c.suffix || '';
    if (s && c.domain.endsWith('.' + s)) return c.domain.slice(0, -(s.length + 1));
    const i = c.domain.lastIndexOf('.');
    return i > 0 ? c.domain.slice(0, i) : c.domain;
  };

  // Group by suffix for TLD diversity
  const bySuffix = new Map<string, DomainCandidate[]>();
  for (const c of sorted) {
    const arr = bySuffix.get(c.suffix);
    if (arr) arr.push(c); else bySuffix.set(c.suffix, [c]);
  }

  // Order groups by their top score
  const groups = Array.from(bySuffix.entries()).sort((a, b) => (b[1][0]?.score.total || 0) - (a[1][0]?.score.total || 0));

  const out: DomainCandidate[] = [];
  const usedLabels = new Set<string>();
  let lastStrategy: string | undefined;
  let strategyRun = 0;
  const maxStrategyRun = 1; // avoid long runs of same strategy
  const lookahead = 6; // shallow scan window per group

  while (out.length < sorted.length && groups.length) {
    let picked = 0;
    for (let gi = 0; gi < groups.length; gi++) {
      const queue = groups[gi][1];
      if (!queue.length) continue;

      let pickIdx = -1;
      let fallbackIdx = -1;
      const n = Math.min(lookahead, queue.length);
      for (let i = 0; i < n; i++) {
        const cand = queue[i];
        const lbl = getLabel(cand);
        if (usedLabels.has(lbl)) continue;
        const strat = cand.strategy || 'other';
        const breaksRun = !(lastStrategy === strat && strategyRun >= maxStrategyRun);
        if (breaksRun) { pickIdx = i; break; }
        if (fallbackIdx === -1) fallbackIdx = i;
      }

      if (pickIdx === -1) {
        // allow same-strategy if label is new
        if (fallbackIdx !== -1) pickIdx = fallbackIdx;
        else if (n > 0) pickIdx = 0; // last resort: accept duplicate label
      }

      if (pickIdx === -1) continue;

      const [item] = queue.splice(pickIdx, 1);
      const lbl = getLabel(item);
      const strat = item.strategy || 'other';
      if (!usedLabels.has(lbl)) usedLabels.add(lbl);
      if (lastStrategy === strat) strategyRun++; else { lastStrategy = strat; strategyRun = 1; }
      out.push(item);
      picked++;
      if (typeof limit === 'number' && out.length >= limit) return out;
    }

    // Remove empty groups
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i][1].length === 0) groups.splice(i, 1);
    }
    if (picked === 0) break; // nothing left to pick
  }

  return out;
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
      isAvailable: false,
    });
  }
  return results;
}

export function scoreDomain(label: string, tld: string, location?: string, config?: Partial<ScoringConfig> | ScoringConfig): DomainScore {
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

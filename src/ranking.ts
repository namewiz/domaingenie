import { containsNumber, vowelRatio } from './utils';

const DEFAULT_TLD_WEIGHTS: Record<string, number> = {
  com: 20,
  net: 10,
  org: 10,
};

type RankingConfig = {
  tldWeights?: Record<string, number>;
  hyphenPenalty?: number;
  numberPenalty?: number;
};

export function scoreDomain(label: string, tld: string, location?: string, config: RankingConfig = {}): number {
  let score = 100;
  const len = label.length;
  score -= len; // shorter is better
  const hyphenCount = (label.match(/-/g) || []).length;
  const numCount = (label.match(/[0-9]/g) || []).length;
  const hyphenPenalty = config.hyphenPenalty ?? 5;
  const numberPenalty = config.numberPenalty ?? 5;
  score -= hyphenCount * hyphenPenalty;
  score -= numCount * numberPenalty;
  if (containsNumber(label)) score -= numberPenalty;

  const ratio = vowelRatio(label);
  score += ratio * 10;
  if (ratio < 0.3) score -= 10; // hard to pronounce
  if (/([bcdfghjklmnpqrstvwxyz]{4,})/i.test(label)) score -= 5; // many consonants together
  if (/([a-z])\1{2,}/i.test(label)) score -= 5; // repeated letters reduce brandability

  const suffix = tld.toLowerCase();
  const weights = config.tldWeights || DEFAULT_TLD_WEIGHTS;
  score += weights[suffix] || 0;
  if (location && suffix === location.toLowerCase()) {
    score += 20;
  }
  return score;
}

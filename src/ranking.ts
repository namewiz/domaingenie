import { containsNumber, vowelRatio } from './utils';

const TLD_WEIGHTS: Record<string, number> = {
  com: 20,
  net: 10,
  org: 10,
};

export function scoreDomain(label: string, tld: string, location?: string): number {
  let score = 100;
  const len = label.length;
  score -= len; // shorter is better
  const hyphenCount = (label.match(/-/g) || []).length;
  score -= hyphenCount * 5;
  const numCount = (label.match(/[0-9]/g) || []).length;
  score -= numCount * 5;
  if (containsNumber(label)) score -= 5;
  score += vowelRatio(label) * 10;

  const suffix = tld.toLowerCase();
  score += TLD_WEIGHTS[suffix] || 0;
  if (location && suffix === location.toLowerCase()) {
    score += 15;
  }
  return score;
}

import type { DomainCandidate } from './types';

export { ScoringConfig, scoreCandidates, scoreDomain } from './scoring';

const LABEL_DEMAND_BONUS = 7;

function getDomainLabel(candidate: DomainCandidate): string {
  const suffix = candidate.suffix || '';
  if (suffix && candidate.domain.endsWith('.' + suffix)) {
    return candidate.domain.slice(0, -(suffix.length + 1));
  }
  const idx = candidate.domain.lastIndexOf('.');
  return idx > 0 ? candidate.domain.slice(0, idx) : candidate.domain;
}

export function rankDomains(candidates: DomainCandidate[], limit?: number): DomainCandidate[] {
  if (!candidates.length) return [];

  // Global sort by score descending
  const sorted = candidates.slice().sort((a, b) => b.score.total - a.score.total);

  // Extract label (domain left of last ".suffix") quickly
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
        const lbl = getDomainLabel(cand);
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
      const lbl = getDomainLabel(item);
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

export function rerankWithUnavailable(
  candidates: DomainCandidate[],
  unavailable: DomainCandidate[],
): DomainCandidate[] {
  if (!candidates.length) return [];

  const demandByLabel = new Map<string, number>();
  for (const cand of unavailable) {
    const label = getDomainLabel(cand);
    demandByLabel.set(label, (demandByLabel.get(label) || 0) + 1);
  }

  let hasDemand = false;
  for (const value of demandByLabel.values()) {
    if (value > 0) {
      hasDemand = true;
      break;
    }
  }

  if (!hasDemand) {
    return rankDomains(candidates, candidates.length);
  }

  const adjusted = candidates.map(candidate => {
    const label = getDomainLabel(candidate);
    const demand = demandByLabel.get(label) || 0;
    if (!demand) return candidate;

    const bonus = demand * LABEL_DEMAND_BONUS;
    const components = { ...candidate.score.components };
    components.availabilityDemand = (components.availabilityDemand || 0) + bonus;
    return {
      ...candidate,
      score: {
        total: candidate.score.total + bonus,
        components,
      },
    };
  });

  return rankDomains(adjusted, adjusted.length);
}

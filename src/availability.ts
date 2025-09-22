import { checkBatch } from 'domainstat';
import type { DomainAvailability, DomainCandidate } from './types';

const DOH_ONLY = ['dns.doh', 'rdap'];
const DEFAULT_TIMEOUT_MS = 1500;

const VALID_AVAILABILITIES: DomainAvailability[] = [
  'unregistered',
  'registered',
  'unsupported',
  'invalid',
  'unknown',
];

const INVALID_AVAILABILITY = new Set<DomainAvailability>(['registered', 'invalid']);

export type CandidateAvailability = DomainAvailability;

function mapAvailability(value: string | undefined): CandidateAvailability {
  if (value && (VALID_AVAILABILITIES as string[]).includes(value)) {
    return value as DomainAvailability;
  }
  return 'unknown';
}

async function resolveStatuses(
  domains: string[],
  timeoutMs: number,
): Promise<Map<string, CandidateAvailability>> {
  const normalized = domains.map(d => d.toLowerCase());
  const results = new Map<string, CandidateAvailability>();
  if (!normalized.length) return results;

  try {
    const statuses = await checkBatch(normalized, {
      only: DOH_ONLY,
      timeoutConfig: { 'dns.doh': timeoutMs },
    } as any);
    for (const status of statuses) {
      const availability = mapAvailability((status as any)?.availability);
      if (status?.domain) {
        results.set(status.domain.toLowerCase(), availability);
      }
    }
  } catch (error) {
    // Swallow errors and mark as unknown below.
  }

  for (const domain of normalized) {
    if (!results.has(domain)) {
      results.set(domain, 'unknown');
    }
  }

  return results;
}

export interface AvailabilityResult {
  available: DomainCandidate[];
  unavailable: DomainCandidate[];
}

export async function annotateAvailability(
  candidates: DomainCandidate[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<AvailabilityResult> {
  if (!candidates.length) return { available: [], unavailable: [] };
  const statusMap = await resolveStatuses(candidates.map(c => c.domain), timeoutMs);

  const available: DomainCandidate[] = [];
  const unavailable: DomainCandidate[] = [];

  for (const cand of candidates) {
    const status = statusMap.get(cand.domain.toLowerCase()) || 'unknown';
    const score = {
      total: cand.score.total,
      components: { ...cand.score.components },
    };
    const annotated: DomainCandidate = {
      ...cand,
      score,
      availability: status,
    };
    if (status === 'unregistered') {
      annotated.isAvailable = true;
    } else if (INVALID_AVAILABILITY.has(status)) {
      annotated.isAvailable = false;
    } else {
      delete annotated.isAvailable;
    }

    if (INVALID_AVAILABILITY.has(status)) {
      unavailable.push(annotated);
    } else {
      available.push(annotated);
    }
  }

  return { available, unavailable };
}

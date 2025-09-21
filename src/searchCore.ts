import { stemmer } from 'stemmer';
import { generateCandidates } from './generator';
import { getPerformance } from './perf';
import { rankDomains, scoreCandidates } from './ranking';
import { expandSynonyms } from './synonyms';
import { ClientInitOptions, DomainCandidate, DomainSearchOptions, LatencyMetrics, ProcessedQuery, SearchResponse } from './types';
import { getCcTld, isValidTld, normalizeTld, normalizeTokens, unique } from './utils';

export function createLatencyMetrics(): LatencyMetrics {
  return {
    total: 0,
    requestProcessing: 0,
    domainGeneration: 0,
    scoring: 0,
    ranking: 0,
    strategies: {},
  };
}

type PreparedRequest = {
  processed: ProcessedQuery;
  offset: number;
  locationTld?: string;
  tldWeights: Record<string, number>;
  filterApplied: boolean;
};

function error(message: string, latency: LatencyMetrics = createLatencyMetrics()): SearchResponse {
  return {
    results: [],
    success: false,
    includesAiGenerations: false,
    message,
    metadata: {
      searchTime: Math.round(latency.total),
      totalGenerated: 0,
      filterApplied: false,
      latency,
    },
  };
}

export async function executeSearch(
  init: Required<ClientInitOptions>,
  options: DomainSearchOptions
): Promise<SearchResponse> {
  const performance = await getPerformance();
  const totalTimer = performance.start('total-search');
  const latency = createLatencyMetrics();
  console.log("search request: ", options);

  try {
    // 1) Process search request
    const requestTimer = performance.start('request-processing');
    let prepared: PreparedRequest;
    try {
      prepared = processRequest(init, options);
    } catch (e: any) {
      const requestDuration = requestTimer.stop();
      latency.requestProcessing = requestDuration;
      latency.total = totalTimer.stop();
      return error(e?.message || 'invalid request', latency);
    }
    const requestDuration = requestTimer.stop();
    latency.requestProcessing = requestDuration;

    // 2) Generate candidates
    const generationTimer = performance.start('domain-generation');
    let rawCandidates: Partial<DomainCandidate & { strategy?: string }>[] = [];
    try {
      rawCandidates = await generateCandidates(prepared.processed);
    } finally {
      const generationDuration = generationTimer.stop();
      latency.domainGeneration = generationDuration;
    }

    // 3) Score candidates
    const scoringTimer = performance.start('scoring');
    let scored: DomainCandidate[] = [];
    try {
      scored = scoreCandidates(rawCandidates, prepared.processed, prepared.locationTld, prepared.tldWeights);
    } finally {
      const scoringDuration = scoringTimer.stop();
      latency.scoring = scoringDuration;
    }

    // 4) Rank candidates (account for offset by expanding limit then slicing)
    const rankingTimer = performance.start('ranking');
    let ranked: DomainCandidate[] = [];
    try {
      const rankLimit = prepared.processed.limit + (prepared.offset || 0);
      const rankedAll = rankDomains(scored, rankLimit);
      ranked = (prepared.offset || 0) > 0 ? rankedAll.slice(prepared.offset) : rankedAll;
    } finally {
      const rankingDuration = rankingTimer.stop();
      latency.ranking = rankingDuration;
    }

    // 5) Return results
    const totalDuration = totalTimer.stop();
    latency.total = totalDuration;
    const totalGenerated = rawCandidates.length;
    const response = buildResponse(ranked, options, latency, totalGenerated, prepared.filterApplied, prepared.processed);
    console.log("search latency: ", JSON.stringify(response.metadata.latency, null, 2));
    return response;
  } finally {
    totalTimer.stop();
  }
}

function processRequest(
  init: Required<ClientInitOptions>,
  options: DomainSearchOptions
): PreparedRequest {
  if (!options.query || !options.query.trim()) throw new Error('query is required');

  const cfg = { ...init, ...options } as DomainSearchOptions;
  const limit = cfg.limit ?? init.limit;
  if (!Number.isFinite(limit) || (limit as number) <= 0) throw new Error('limit must be positive');
  const offset = cfg.offset ?? init.offset ?? 0;
  if (!Number.isFinite(offset) || (offset as number) < 0) throw new Error('offset must be >= 0');

  if (options.supportedTlds && !Array.isArray(options.supportedTlds)) throw new Error('supportedTlds must be an array');
  if (options.defaultTlds && !Array.isArray(options.defaultTlds)) throw new Error('defaultTlds must be an array');

  const prefixes = Array.isArray(cfg.prefixes) ? cfg.prefixes : [];
  const suffixes = Array.isArray(cfg.suffixes) ? cfg.suffixes : [];

  const rawTokens = normalizeTokens(cfg.query);
  const tokens = unique(rawTokens);

  const synonymLimit = Math.max(0, Math.min(cfg.maxSynonyms ?? 10, 10));
  const synonyms: Record<string, string[]> = {};
  for (const token of tokens) {
    let list = expandSynonyms(token, synonymLimit);
    if (list.length === 0) {
      list = expandSynonyms(stemmer(token), synonymLimit)
    }
    synonyms[token] = list;
  }

  const hasSupportedOverride = Array.isArray(options.supportedTlds) && options.supportedTlds.length > 0;
  const defaultSource = (options.defaultTlds ?? (hasSupportedOverride ? [] : init.defaultTlds) ?? []).map(normalizeTld);
  const supportedSource = (options.supportedTlds ?? init.supportedTlds ?? []).map(normalizeTld);

  for (const t of [...defaultSource, ...supportedSource]) {
    if (!isValidTld(t)) throw new Error(`invalid tld: ${t}`);
  }

  const locationTldRaw = getCcTld(options.location);
  const locationTld = locationTldRaw ? normalizeTld(locationTldRaw) : undefined;
  if (locationTld && !isValidTld(locationTld)) throw new Error(`invalid tld: ${locationTld}`);

  const tokenSet = new Set(tokens);
  const synonymSet = new Set(Object.values(synonyms).flat());
  const supportedTlds = hasSupportedOverride
    ? supportedSource
    : supportedSource.filter(t => tokenSet.has(t) || synonymSet.has(t));

  const orderedTlds: string[] = [];
  const pushTld = (t?: string) => {
    if (!t) return;
    if (!orderedTlds.includes(t)) orderedTlds.push(t);
  };

  defaultSource.forEach(pushTld);
  pushTld(locationTld);
  supportedTlds.forEach(pushTld);

  const processed: ProcessedQuery = {
    query: cfg.query,
    tokens,
    synonyms,
    orderedTlds,
    includeHyphenated: !!cfg.includeHyphenated,
    limit: limit as number,
    prefixes,
    suffixes,
  };

  return {
    processed,
    offset: offset as number,
    locationTld,
    tldWeights: cfg.tldWeights || {},
    filterApplied: hasSupportedOverride,
  };
}

function buildResponse(
  ranked: DomainCandidate[],
  options: DomainSearchOptions,
  latency: LatencyMetrics,
  totalGenerated: number,
  filterApplied: boolean,
  processed: ProcessedQuery
): SearchResponse {
  let finalResults: DomainCandidate[] = ranked;
  if (!options.debug) {
    finalResults = ranked.map(r => ({
      domain: r.domain,
      suffix: r.suffix,
      score: r.score,
      strategy: r.strategy,
    }));
  }

  return {
    results: finalResults,
    success: true,
    includesAiGenerations: !!options.useAi,
    metadata: {
      searchTime: Math.round(latency.total),
      totalGenerated,
      filterApplied,
      latency,
    },
    processed,
  };
}

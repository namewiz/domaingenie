import { generateCandidates } from './generator';
import { getPerformance } from './perf';
import { rankDomains, scoreCandidates } from './ranking';
import { expandSynonyms } from './synonyms';
import { ClientInitOptions, DomainCandidate, DomainSearchOptions, LatencyMetrics, ProcessedQueryInfo, RequestContext, SearchResponse } from './types';
import { getCcTld, isValidTld, normalizeTld, normalizeTokens } from './utils';

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

  try {
    // 1) Process search request
    const requestTimer = performance.start('request-processing');
    let request: RequestContext;
    try {
      request = processRequest(init, options);
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
      rawCandidates = await generateCandidates(request.cfg);
    } finally {
      const generationDuration = generationTimer.stop();
      latency.domainGeneration = generationDuration;
    }

    // 3) Score candidates
    const scoringTimer = performance.start('scoring');
    let scored: DomainCandidate[] = [];
    try {
      scored = scoreCandidates(rawCandidates, request);
    } finally {
      const scoringDuration = scoringTimer.stop();
      latency.scoring = scoringDuration;
    }

    // 4) Rank candidates (account for offset by expanding limit then slicing)
    const rankingTimer = performance.start('ranking');
    let ranked: DomainCandidate[] = [];
    try {
      const rankLimit = request.limit + (request.offset || 0);
      const rankedAll = rankDomains(scored, rankLimit);
      ranked = (request.offset || 0) > 0 ? rankedAll.slice(request.offset) : rankedAll;
    } finally {
      const rankingDuration = rankingTimer.stop();
      latency.ranking = rankingDuration;
    }

    // 5) Return results
    const totalDuration = totalTimer.stop();
    latency.total = totalDuration;
    const totalGenerated = rawCandidates.length;
    return buildResponse(ranked, options, latency, totalGenerated, !!options.supportedTlds, request);
  } finally {
    totalTimer.stop();
  }
}

function processRequest(
  init: Required<ClientInitOptions>,
  options: DomainSearchOptions
): RequestContext {
  if (!options.query || !options.query.trim()) throw new Error('query is required');

  const cfg = { ...init, ...options } as DomainSearchOptions;
  const limit = cfg.limit ?? init.limit;
  if (!Number.isFinite(limit) || (limit as number) <= 0) throw new Error('limit must be positive');
  const offset = cfg.offset ?? init.offset ?? 0;
  if (!Number.isFinite(offset) || (offset as number) < 0) throw new Error('offset must be >= 0');

  if (options.keywords && !Array.isArray(options.keywords)) throw new Error('keywords must be an array');
  if (options.supportedTlds && !Array.isArray(options.supportedTlds)) throw new Error('supportedTlds must be an array');
  if (options.defaultTlds && !Array.isArray(options.defaultTlds)) throw new Error('defaultTlds must be an array');

  const supportedTlds = (cfg.supportedTlds || []).map(normalizeTld);
  const defaultTlds = (cfg.defaultTlds || []).map(normalizeTld);
  for (const t of [...supportedTlds, ...defaultTlds]) {
    if (!isValidTld(t)) throw new Error(`invalid tld: ${t}`);
  }

  const cc = getCcTld(options.location);
  if (cc && !supportedTlds.includes(cc)) supportedTlds.push(cc);
  if (cc && !defaultTlds.includes(cc)) defaultTlds.push(cc);

  cfg.supportedTlds = supportedTlds;
  cfg.defaultTlds = defaultTlds;

  // Precompute synonyms for tokens to avoid recomputation in strategies
  const tokens = normalizeTokens(cfg.query);
  const maxSynonyms = cfg.maxSynonyms ?? 5;
  const synMap: Record<string, string[]> = {};
  for (const t of tokens) {
    synMap[t] = expandSynonyms(t, maxSynonyms);
  }
  cfg.synonyms = synMap;

  return { cfg, cc, limit: limit as number, offset: offset as number, tokens };
}

function buildResponse(
  ranked: DomainCandidate[],
  options: DomainSearchOptions,
  latency: LatencyMetrics,
  totalGenerated: number,
  filterApplied: boolean,
  request: RequestContext
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

  const processedInfo: ProcessedQueryInfo = {
    tokens: request.tokens,
    finalQuery: request.tokens.join(''),
    cc: request.cc ?? getCcTld(options.location),
    supportedTlds: request.cfg.supportedTlds,
    defaultTlds: request.cfg.defaultTlds,
    limit: request.limit,
    offset: request.offset,
    location: options.location,
    includeHyphenated: options.includeHyphenated,
  };

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
    processed: processedInfo,
  };
}

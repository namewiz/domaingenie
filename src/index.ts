import { generateCandidates } from './generator';
import { getPerformance } from './perf';
import { rankDomains, scoreDomain } from './ranking';
import { expandSynonyms } from './synonyms';
import tlds from "./tlds.json" assert { type: "json" };
import { ClientInitOptions, DomainCandidate, DomainSearchOptions, LatencyMetrics, ProcessedQueryInfo, SearchResponse } from './types';
import { getCcTld, isValidTld, normalizeTld, normalizeTokens } from './utils';

const TLD_MAP: Record<string, string | boolean> = {
  ...(tlds as any).popular,
  ...(tlds as any).gTLDs,
};

const DEFAULT_INIT_OPTIONS: Required<ClientInitOptions> = {
  defaultTlds: ['com', 'ng', 'com.ng', 'site', 'org', 'net', 'edu.ng', 'name.ng', 'sch.ng', 'io'],
  supportedTlds: Object.keys(TLD_MAP),
  limit: 20,
  offset: 0,
  // more here - https://gist.github.com/marcanuy/06cb00bc36033cd12875
  prefixes: [
    'try', 'the', 'get', 'go',
  ],
  suffixes: [
    'ly', 'hq', 'hub', 'app', 'labs',
  ],
  maxSynonyms: 5,
  tldWeights: {
    com: 20,
    net: 10,
    org: 10,
    io: 10,
    dev: 10,
    me: 5,
    ng: 10
  },
};

function createLatencyMetrics(): LatencyMetrics {
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

export class DomainSearchClient {
  private init: Required<ClientInitOptions>;

  constructor (initOptions: ClientInitOptions = {}) {
    this.init = { ...DEFAULT_INIT_OPTIONS, ...initOptions };
  }

  setInitOptions(options: ClientInitOptions): void {
    this.init = { ...this.init, ...options };
  }

  getInitOptions(): Required<ClientInitOptions> {
    return this.init;
  }

  async search(options: DomainSearchOptions): Promise<SearchResponse> {
    console.log("starting search", options)
    const performance = await getPerformance();
    const totalTimer = performance.start('total-search');
    const latency = createLatencyMetrics();

    try {
      // 1) Process search request
      const requestTimer = performance.start('request-processing');
      let request: RequestContext;
      try {
        request = this.processRequest(options);
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
        scored = this.scoreCandidates(rawCandidates, request);
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
      const response = this.buildResponse(ranked, options, latency, totalGenerated, !!options.supportedTlds);
      console.log("response: ", response);
      return response;
    } finally {
      totalTimer.stop();
    }
  }

  // Step 1: Process search request (validate, normalize, enrich)
  private processRequest(options: DomainSearchOptions): RequestContext {
    if (!options.query || !options.query.trim()) throw new Error('query is required');

    const cfg = { ...this.init, ...options } as DomainSearchOptions;
    const limit = cfg.limit ?? this.init.limit;
    if (!Number.isFinite(limit) || (limit as number) <= 0) throw new Error('limit must be positive');
    const offset = cfg.offset ?? this.init.offset ?? 0;
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

  private scoreCandidates(
    candidates: Partial<DomainCandidate & { strategy?: string }>[],
    request: RequestContext,
  ): DomainCandidate[] {
    const { cfg, cc } = request;
    const supported = cfg.supportedTlds || [];
    const results: DomainCandidate[] = [];
    for (const cand of candidates) {
      if (!cand.domain || !cand.suffix) continue;
      if (!supported.includes(cand.suffix)) continue;
      const label = cand.domain.slice(0, -(cand.suffix.length + 1));
      const score = scoreDomain(label, cand.suffix, cc, { tldWeights: cfg.tldWeights });
      results.push({
        domain: cand.domain,
        suffix: cand.suffix,
        strategy: cand.strategy,
        score,
        isAvailable: false,
      });
    }
    return results;
  }

  private buildResponse(
    ranked: DomainCandidate[],
    options: DomainSearchOptions,
    latency: LatencyMetrics,
    totalGenerated: number,
    filterApplied: boolean,
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
      tokens: requestCache?.tokens || normalizeTokens(options.query),
      finalQuery: (requestCache?.tokens || normalizeTokens(options.query)).join(''),
      cc: requestCache?.cc ?? getCcTld(options.location),
      supportedTlds: requestCache?.supportedTlds || (options.supportedTlds || this.init.supportedTlds).map(normalizeTld),
      defaultTlds: requestCache?.defaultTlds || (options.defaultTlds || this.init.defaultTlds).map(normalizeTld),
      limit: requestCache?.limit ?? (options.limit ?? this.init.limit),
      offset: requestCache?.offset ?? (options.offset ?? this.init.offset),
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
}

// Internal types for clarity of orchestration
type RequestContext = {
  cfg: DomainSearchOptions & { supportedTlds: string[]; defaultTlds: string[]; synonyms: Record<string, string[]> };
  cc?: string;
  limit: number;
  offset: number;
  tokens: string[];
};

// Simple cache to make request details available to buildResponse without changing its signature
let requestCache: {
  tokens: string[];
  cc?: string;
  supportedTlds: string[];
  defaultTlds: string[];
  limit: number;
  offset: number;
} | null = null;

export { generateCandidates } from './generator';
export { scoreDomain } from './ranking';
export {
  AffixStrategy, PermutationStrategy, TldHackStrategy
} from './strategies';
export type {
  ClientInitOptions,
  DomainCandidate, DomainSearchOptions, GenerationStrategy, LatencyMetrics, ProcessedQueryInfo, DomainScore as ScoreBreakdown, SearchMetadata, SearchResponse
} from './types';


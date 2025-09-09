import synonymsLib from 'synonyms';
import { generateCandidates } from './generator';
import { scoreDomain } from './ranking';
import tlds from "./tlds.json" assert { type: "json" };
import { ClientInitOptions, DomainCandidate, DomainSearchOptions, SearchResponse } from './types';
import { getCcTld, isValidTld, normalizeTld, normalizeTokens } from './utils';

const TLD_MAP: Record<string, string | boolean> = {
  ...(tlds as any).popular,
  ...(tlds as any).gTLDs,
  ...(tlds as any).ccTLDs,
  ...(tlds as any).SLDs,
};

const DEFAULT_INIT_OPTIONS: Required<ClientInitOptions> = {
  defaultTlds: ['com', 'ng'],
  supportedTlds: Object.keys(TLD_MAP),
  limit: 20,
  // more here - https://gist.github.com/marcanuy/06cb00bc36033cd12875
  prefixes: [
    'my', 'the', 'get', 'try', 'go', 'global', 'one', 'pro', 'best',
    'hey', 'on', 'up', 'we', 'our', 'new', 'now', 'top', 'ez',
    'you', 'max', 'neo', 're', 'be', 'do', 'co', 'hub', 'i', 'u',
    'easy', 'fast', 'free', 'just', 'true', 'next', 'real', 'pure', 'good'
  ],
  suffixes: [
    'ly', 'ify', 'hq', 'hub', 'app', 'web', 'spot', 'inc', 'site',
    'io', 'ai', 'up', 'it', 'go', 'co', 'fy', 'me', 'now', 'lab',
    'dev', 'tech', 'net', 'one', 'pay', 'kit', 'bot', 'base', 'box'
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

// Local synonym expansion with memoization
const SYN_CACHE = new Map<string, string[]>();
function expandSynonyms(token: string, max = 5, extra: string[] = []): string[] {
  const base = token.toLowerCase();
  if (SYN_CACHE.has(base)) return SYN_CACHE.get(base)!;
  let list: string[] = [base];
  try {
    const syn = synonymsLib(base);
    if (syn) {
      for (const key of Object.keys(syn as any)) {
        const arr = (syn as any)[key] as string[];
        if (Array.isArray(arr)) list.push(...arr);
      }
    }
  } catch {
    // ignore library errors
  }
  if (extra && extra.length) list.push(...extra.map(e => e.toLowerCase()));
  const uniqueList = Array.from(new Set(list.filter(w => w && w.length <= 15))).slice(0, max);
  SYN_CACHE.set(base, uniqueList);
  return uniqueList;
}

function error(message: string): SearchResponse {
  return {
    results: [],
    success: false,
    includesAiGenerations: false,
    message,
    metadata: { searchTime: 0, totalGenerated: 0, filterApplied: false },
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
    const start = Date.now();

    // 1) Process search request
    let prepared: PreparedRequest;
    try {
      prepared = this.processRequest(options);
    } catch (e: any) {
      return error(e?.message || 'invalid request');
    }

    // 2) Generate candidates
    const rawCandidates = await generateCandidates(prepared.cfg);

    // 3) Score candidates
    const scored = this.scoreCandidates(rawCandidates, prepared);

    // 4) Rank candidates
    const ranked = this.rankCandidates(scored, prepared.limit);

    // 5) Return results
    const end = Date.now();
    const response = this.buildResponse(ranked, options, end - start, scored.length, !!options.supportedTlds);
    return response;
  }

  // Step 1: Process search request (validate, normalize, enrich)
  private processRequest(options: DomainSearchOptions): PreparedRequest {
    if (!options.query || !options.query.trim()) throw new Error('query is required');

    const cfg = { ...this.init, ...options } as DomainSearchOptions;
    const limit = cfg.limit ?? this.init.limit;
    if (!Number.isFinite(limit) || (limit as number) <= 0) throw new Error('limit must be positive');

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

    return { cfg, cc, limit: limit as number };
  }

  // Step 3: Score candidates (filter and score)
  private scoreCandidates(
    candidates: Partial<DomainCandidate & { strategy?: string }>[],
    prepared: PreparedRequest,
  ): DomainCandidate[] {
    const { cfg, cc } = prepared;
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

  // Step 4: Rank candidates (dedupe by domain, sort by score desc, limit)
  private rankCandidates(results: DomainCandidate[], limit: number): DomainCandidate[] {
    const resultMap = new Map<string, DomainCandidate>();
    for (const r of results) {
      const existing = resultMap.get(r.domain);
      if (existing) {
        if (r.score.total > existing.score.total) existing.score = r.score;
      } else {
        resultMap.set(r.domain, { ...r });
      }
    }
    const uniqueResults = Array.from(resultMap.values());
    uniqueResults.sort((a, b) => b.score.total - a.score.total);
    return uniqueResults.slice(0, limit);
  }

  // Step 5: Build response respecting debug flag
  private buildResponse(
    ranked: DomainCandidate[],
    options: DomainSearchOptions,
    searchTime: number,
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
    return {
      results: finalResults,
      success: true,
      includesAiGenerations: !!options.useAi,
      metadata: {
        searchTime,
        totalGenerated,
        filterApplied,
      },
    };
  }
}

// Internal types for clarity of orchestration
type PreparedRequest = {
  cfg: DomainSearchOptions & { supportedTlds: string[]; defaultTlds: string[]; synonyms: Record<string, string[]> };
  cc?: string;
  limit: number;
};

export { generateCandidates } from './generator';
export {
  AffixStrategy, AlphabeticalStrategy, PermutationStrategy, TldHackStrategy
} from './strategies';
export type {
  ClientInitOptions,
  DomainCandidate, DomainSearchOptions, GenerationStrategy, DomainScore as ScoreBreakdown, SearchMetadata, SearchResponse
} from './types';


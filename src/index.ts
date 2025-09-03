import { DomainSearchOptions, DomainCandidate, SearchResponse, ClientInitOptions } from './types';
import { normalizeTokens, unique, isValidTld, getCcTld, normalizeTld } from './utils';
import { generateLabels } from './generator';
import { scoreDomain } from './ranking';
import tlds from "./tlds.json" assert { type: "json" };

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

  constructor(initOptions: ClientInitOptions = {}) {
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
    if (!options.query || !options.query.trim()) return error('query is required');

    const cfg = { ...this.init, ...options };
    const limit = cfg.limit ?? this.init.limit;
    if (!Number.isFinite(limit) || limit <= 0) return error('limit must be positive');

    if (options.keywords && !Array.isArray(options.keywords)) return error('keywords must be an array');
    if (options.supportedTlds && !Array.isArray(options.supportedTlds)) return error('supportedTlds must be an array');
    if (options.defaultTlds && !Array.isArray(options.defaultTlds)) return error('defaultTlds must be an array');

    const supportedTlds = (cfg.supportedTlds || []).map(normalizeTld);
    const defaultTlds = (cfg.defaultTlds || []).map(normalizeTld);
    for (const t of [...supportedTlds, ...defaultTlds]) {
      if (!isValidTld(t)) return error(`invalid tld: ${t}`);
    }

    const tokens = normalizeTokens(options.query);
    const keywords = options.keywords?.map(k => k.toLowerCase()) || [];
    const tldsForGen = unique([...supportedTlds, ...defaultTlds]);
    const labels = generateLabels(tokens, keywords, tldsForGen, {
      prefixes: cfg.prefixes,
      suffixes: cfg.suffixes,
      maxSynonyms: cfg.maxSynonyms,
    });

    let tlds = tldsForGen.slice();
    const cc = getCcTld(options.location);
    if (cc && !tlds.includes(cc)) tlds.push(cc);
    if (cc && !supportedTlds.includes(cc)) supportedTlds.push(cc);

    const results: DomainCandidate[] = [];
    for (const { label, types } of labels) {
      if (label.length === 0) continue;
      if (label.includes('.')) {
        const parts = label.split('.');
        const suffix = parts.pop() || '';
        if (supportedTlds.includes(suffix)) {
          const domain = label;
          const score = scoreDomain(parts.join('.'), suffix, cc, {
            tldWeights: cfg.tldWeights,
          });
          results.push({ domain, suffix, score, isAvailable: false, variantTypes: types });
        }
        continue;
      }
      for (const tld of tlds) {
        if (supportedTlds && !supportedTlds.includes(tld)) continue;
        const domain = `${label}.${tld}`;
        const score = scoreDomain(label, tld, cc, { tldWeights: cfg.tldWeights });
        results.push({ domain, suffix: tld, score, isAvailable: false, variantTypes: types });
      }
    }

    const resultMap = new Map<string, DomainCandidate>();
    for (const r of results) {
      const existing = resultMap.get(r.domain);
      if (existing) {
        if (r.score > existing.score) existing.score = r.score;
        if (r.variantTypes) {
          existing.variantTypes = unique([...(existing.variantTypes || []), ...r.variantTypes]);
        }
      } else {
        resultMap.set(r.domain, { ...r });
      }
    }
    const uniqueResults = Array.from(resultMap.values());
    uniqueResults.sort((a, b) => b.score - a.score);

    let finalResults = uniqueResults.slice(0, limit);
    if (!options.debug) {
      finalResults = finalResults.map(r => ({ domain: r.domain, suffix: r.suffix, score: r.score }));
    }

    const end = Date.now();
    return {
      results: finalResults,
      success: true,
      includesAiGenerations: !!options.useAi,
      metadata: {
        searchTime: end - start,
        totalGenerated: uniqueResults.length,
        filterApplied: !!options.supportedTlds,
      },
    };
  }
}

export type { DomainSearchOptions, ClientInitOptions, DomainCandidate, SearchResponse } from './types';
export { generateLabels } from './generator';

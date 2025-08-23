import { DomainSearchParams, DomainResult, SearchResponse, DomainSearchConfig } from './types';
import { normalizeTokens, unique, isValidTld, getCcTld, normalizeTld } from './utils';
import { generateLabels } from './generator';
import { scoreDomain } from './ranking';

const DEFAULT_CONFIG: DomainSearchConfig = {
  defaultTlds: ['com'],
  supportedTlds: ['com', 'net', 'org'],
  limit: 20,
  prefixes: ['my', 'the'],
  suffixes: ['ly', 'ify'],
  maxSynonyms: 5,
  tldWeights: { com: 20, net: 10, org: 10 },
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
  private config: DomainSearchConfig;

  constructor(config: Partial<DomainSearchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setConfig(config: Partial<DomainSearchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): DomainSearchConfig {
    return this.config;
  }

  async search(params: DomainSearchParams): Promise<SearchResponse> {
    const start = Date.now();
    if (!params.query || !params.query.trim()) return error('query is required');

    const limit = params.limit ?? this.config.limit;
    if (!Number.isFinite(limit) || limit <= 0) return error('limit must be positive');

    if (params.keywords && !Array.isArray(params.keywords)) return error('keywords must be an array');
    if (params.supportedTlds && !Array.isArray(params.supportedTlds)) return error('supportedTlds must be an array');
    if (params.defaultTlds && !Array.isArray(params.defaultTlds)) return error('defaultTlds must be an array');

    const supportedTlds = (params.supportedTlds ?? this.config.supportedTlds).map(normalizeTld);
    const defaultTlds = (params.defaultTlds ?? this.config.defaultTlds).map(normalizeTld);
    for (const t of [...supportedTlds, ...defaultTlds]) {
      if (!isValidTld(t)) return error(`invalid tld: ${t}`);
    }

    const tokens = normalizeTokens(params.query);
    const keywords = params.keywords?.map(k => k.toLowerCase()) || [];
    const labels = generateLabels(tokens, keywords, {
      prefixes: this.config.prefixes,
      suffixes: this.config.suffixes,
      maxSynonyms: this.config.maxSynonyms,
    });

    let tlds = unique([...defaultTlds, ...supportedTlds]);
    const cc = getCcTld(params.location);
    if (cc && !tlds.includes(cc)) tlds.push(cc);
    if (cc && !supportedTlds.includes(cc)) supportedTlds.push(cc);

    const results: DomainResult[] = [];
    for (const label of labels) {
      if (label.length === 0) continue;
      if (label.includes('.')) {
        const parts = label.split('.');
        const suffix = parts.pop() || '';
        if (supportedTlds.includes(suffix)) {
          const domain = label;
          const score = scoreDomain(parts.join('.'), suffix, cc, {
            tldWeights: this.config.tldWeights,
          });
          results.push({ domain, suffix: '.' + suffix, score, isAvailable: false });
        }
        continue;
      }
      for (const tld of tlds) {
        if (supportedTlds && !supportedTlds.includes(tld)) continue;
        const domain = `${label}.${tld}`;
        const score = scoreDomain(label, tld, cc, { tldWeights: this.config.tldWeights });
        results.push({ domain, suffix: '.' + tld, score, isAvailable: false });
      }
    }

    const uniqueResults = unique(results.map(r => r.domain)).map(d => results.find(r => r.domain === d) as DomainResult);
    uniqueResults.sort((a, b) => b.score - a.score);

    let finalResults = uniqueResults.slice(0, limit);
    if (!params.debug) {
      finalResults = finalResults.map(r => ({ domain: r.domain, suffix: r.suffix, score: r.score }));
    }

    const end = Date.now();
    return {
      results: finalResults,
      success: true,
      includesAiGenerations: !!params.useAi,
      metadata: {
        searchTime: end - start,
        totalGenerated: uniqueResults.length,
        filterApplied: !!params.supportedTlds,
      },
    };
  }
}

export type { DomainSearchParams, DomainResult, SearchResponse } from './types';

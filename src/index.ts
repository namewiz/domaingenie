import { DomainSearchParams, DomainResult, SearchResponse, DomainSearchConfig } from './types';
import { normalizeTokens, unique, isValidTld, getCcTld } from './utils';
import { generateLabels } from './generator';
import { scoreDomain } from './ranking';

const DEFAULT_CONFIG: DomainSearchConfig = {
  defaultTlds: ['com'],
  supportedTlds: ['com', 'net', 'org'],
  limit: 20,
};

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
    const limit = params.limit ?? this.config.limit;
    const supportedTlds = params.supportedTlds?.map(t => t.toLowerCase()) ?? this.config.supportedTlds;
    const defaultTlds = params.defaultTlds?.map(t => t.toLowerCase()) ?? this.config.defaultTlds;

    if (!params.query || !params.query.trim()) {
      return {
        results: [],
        success: false,
        includesAiGenerations: false,
        message: 'query is required',
        metadata: { searchTime: 0, totalGenerated: 0, filterApplied: false },
      };
    }

    if (limit <= 0) {
      return {
        results: [],
        success: false,
        includesAiGenerations: false,
        message: 'limit must be positive',
        metadata: { searchTime: 0, totalGenerated: 0, filterApplied: false },
      };
    }

    for (const t of supportedTlds) {
      if (!isValidTld(t)) {
        return {
          results: [],
          success: false,
          includesAiGenerations: false,
          message: `invalid tld: ${t}`,
          metadata: { searchTime: 0, totalGenerated: 0, filterApplied: false },
        };
      }
    }

    const tokens = normalizeTokens(params.query);
    const keywords = params.keywords?.map(k => k.toLowerCase()) || [];
    const labels = generateLabels(tokens, keywords);

    let tlds = unique([...defaultTlds, ...supportedTlds]);
    const cc = getCcTld(params.location);
    if (cc && !tlds.includes(cc)) tlds.push(cc);

    const results: DomainResult[] = [];
    for (const label of labels) {
      if (label.length === 0) continue;
      if (label.includes('.')) {
        const parts = label.split('.');
        const suffix = parts.pop() || '';
        if (supportedTlds.includes(suffix)) {
          const domain = label;
          const score = scoreDomain(parts.join('.'), suffix, cc);
          results.push({ domain, suffix: '.' + suffix, score });
        }
        continue;
      }
      for (const tld of tlds) {
        if (supportedTlds && !supportedTlds.includes(tld)) continue;
        const domain = `${label}.${tld}`;
        const score = scoreDomain(label, tld, cc);
        results.push({ domain, suffix: '.' + tld, score });
      }
    }

    const uniqueResults = unique(results.map(r => r.domain)).map(d => results.find(r => r.domain === d) as DomainResult);
    uniqueResults.sort((a, b) => b.score - a.score);

    const end = Date.now();
    return {
      results: uniqueResults.slice(0, limit),
      success: true,
      includesAiGenerations: false,
      metadata: {
        searchTime: end - start,
        totalGenerated: uniqueResults.length,
        filterApplied: !!params.supportedTlds,
      },
    };
  }
}

export type { DomainSearchParams, DomainResult, SearchResponse } from './types';

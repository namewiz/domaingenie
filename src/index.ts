import { DomainSearchParams, DomainResult, SearchResponse, DomainSearchConfig, AIFilters } from './types';
import { normalizeTokens, unique, isValidTld, getCcTld, normalizeTld } from './utils';
import { generateLabels } from './generator';
import { scoreDomain } from './ranking';
import { SmartAIService } from './ai/smart-ai-service';
import tlds from "./tlds.json" assert { type: "json" };

const TLD_MAP: Record<string, string | boolean> = {
  ...(tlds as any).popular,
  ...(tlds as any).gTLDs,
  ...(tlds as any).ccTLDs,
  ...(tlds as any).SLDs,
};


const DEFAULT_CONFIG: DomainSearchConfig = {
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
    enableAI: false
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
  private aiService?: SmartAIService;

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

    // Simple AI vs Traditional switch
    if (params.useAi) {
      return this.performAISearch(params, start);
    } else {
      return this.performTraditionalSearch(params, start);
    }
  }

  private async performAISearch(params: DomainSearchParams, start: number): Promise<SearchResponse> {
    console.log('🤖 [ai-domain-generator] Starting AI search with params:', {
      query: params.query,
      limit: params.limit,
      aiFilters: params.aiFilters
    });

    try {
      // Initialize AI service lazily (only when needed)
      if (!this.aiService) {
        console.log('🔄 [ai-domain-generator] Initializing AI service...');
        this.aiService = new SmartAIService();
      }

      const limit = params.limit ?? this.config.limit;
      console.log(`🎯 [ai-domain-generator] Generating ${limit} domains for query: "${params.query}"`);
      
      // Generate domains using AI with filters
      const aiResults = await this.aiService.generateDomains(params.query, {
        limit,
        filters: params.aiFilters
      });
      
      console.log('🎉 [ai-domain-generator] AI generation completed:', {
        resultsCount: aiResults.length,
        results: aiResults
      });
      
      // Convert to library format
      const domainResults: DomainResult[] = aiResults.map(aiResult => ({
        domain: aiResult.domain,
        suffix: this.extractSuffix(aiResult.domain),
        score: 95,
        isAvailable: false,
        aiGenerated: true
      }));
      
      console.log('✅ [ai-domain-generator] AI search successful, returning results');
      return {
        results: domainResults,
        success: true,
        includesAiGenerations: true,
        metadata: {
          searchTime: Date.now() - start,
          totalGenerated: aiResults.length,
          filterApplied: !!params.aiFilters
        }
      };
      
    } catch (error) {
      console.error('❌ [ai-domain-generator] AI search failed:', {
        error: error.message,
        stack: error.stack,
        params
      });
      console.warn('[ai-domain-generator] AI failed, falling back to traditional search');
      return this.performTraditionalSearch(params, start);
    }
  }

  private performTraditionalSearch(params: DomainSearchParams, start: number): SearchResponse {
    console.log('🔍 [ai-domain-generator] Starting traditional search with params:', {
      query: params.query,
      limit: params.limit,
      keywords: params.keywords
    });

    const limit = params.limit ?? this.config.limit;
    
    const supportedTlds = (params.supportedTlds ?? this.config.supportedTlds).map(normalizeTld);
    const defaultTlds = (params.defaultTlds ?? this.config.defaultTlds).map(normalizeTld);
    for (const t of [...supportedTlds, ...defaultTlds]) {
      if (!isValidTld(t)) return error(`invalid tld: ${t}`);
    }

    const tokens = normalizeTokens(params.query);
    const keywords = params.keywords?.map(k => k.toLowerCase()) || [];
    const tldsForGen = unique([...supportedTlds, ...defaultTlds]);
    const labels = generateLabels(tokens, keywords, tldsForGen, {
      prefixes: this.config.prefixes,
      suffixes: this.config.suffixes,
      maxSynonyms: this.config.maxSynonyms,
    });

    let tlds = tldsForGen.slice();
    const cc = getCcTld(params.location);
    if (cc && !tlds.includes(cc)) tlds.push(cc);
    if (cc && !supportedTlds.includes(cc)) supportedTlds.push(cc);

    const results: DomainResult[] = [];
    for (const { label, types } of labels) {
      if (label.length === 0) continue;
      if (label.includes('.')) {
        const parts = label.split('.');
        const suffix = parts.pop() || '';
        if (supportedTlds.includes(suffix)) {
          const domain = label;
          const score = scoreDomain(parts.join('.'), suffix, cc, {
            tldWeights: this.config.tldWeights,
          });
          results.push({ domain, suffix: '.' + suffix, score, isAvailable: false, variantTypes: types });
        }
        continue;
      }
      for (const tld of tlds) {
        if (supportedTlds && !supportedTlds.includes(tld)) continue;
        const domain = `${label}.${tld}`;
        const score = scoreDomain(label, tld, cc, { tldWeights: this.config.tldWeights });
        results.push({ domain, suffix: '.' + tld, score, isAvailable: false, variantTypes: types });
      }
    }

    const resultMap = new Map<string, DomainResult>();
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
    if (!params.debug) {
      finalResults = finalResults.map(r => ({ domain: r.domain, suffix: r.suffix, score: r.score }));
    }

    return {
      results: finalResults,
      success: true,
      includesAiGenerations: false,
      metadata: {
        searchTime: Date.now() - start,
        totalGenerated: uniqueResults.length,
        filterApplied: !!params.supportedTlds,
      },
    };
  }

  private extractSuffix(domain: string): string {
    const parts = domain.split('.');
    if (parts.length >= 2) {
      return '.' + parts.slice(1).join('.');
    }
    return '';
  }
}

export type { DomainSearchParams, DomainResult, SearchResponse } from './types';
export { generateLabels } from './generator';
export { SmartAIService, smartAIService } from './ai/smart-ai-service';

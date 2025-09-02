export interface AIFilters {
  tlds?: string[];
  domainLength?: { min: number; max: number };
  wordCount?: string;
  keywords?: { include: string; exclude: string };
}

export interface DomainSearchParams {
  query: string;
  keywords?: string[];
  location?: string;
  supportedTlds?: string[];
  defaultTlds?: string[];
  limit?: number;
  debug?: boolean;
  useAi?: boolean;
  aiFilters?: AIFilters;
}

export interface DomainResult {
  domain: string;
  suffix: string;
  score: number;
  isAvailable?: boolean;
  aiGenerated?: boolean;
  variantTypes?: string[];
}

export interface SearchResponse {
  results: DomainResult[];
  success: boolean;
  message?: string;
  includesAiGenerations: boolean;
  metadata: {
    searchTime: number;
    totalGenerated: number;
    filterApplied: boolean;
  };
}

export interface DomainSearchConfig {
  defaultTlds: string[];
  supportedTlds: string[];
  limit: number;
  prefixes?: string[];
  suffixes?: string[];
  maxSynonyms?: number;
  tldWeights?: Record<string, number>;
  enableAI?: boolean;
}

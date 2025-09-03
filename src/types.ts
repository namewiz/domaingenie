export interface ClientInitOptions {
  defaultTlds?: string[];
  supportedTlds?: string[];
  limit?: number;
  prefixes?: string[];
  suffixes?: string[];
  maxSynonyms?: number;
  tldWeights?: Record<string, number>;
}

export interface DomainSearchOptions extends ClientInitOptions {
  query: string;
  keywords?: string[];
  location?: string;
  debug?: boolean;
  useAi?: boolean;
}

export interface DomainCandidate {
  domain: string;
  suffix: string;
  score: number;
  isAvailable?: boolean;
  aiGenerated?: boolean;
  variantTypes?: string[];
}

export interface SearchResponse {
  results: DomainCandidate[];
  success: boolean;
  message?: string;
  includesAiGenerations: boolean;
  metadata: {
    searchTime: number;
    totalGenerated: number;
    filterApplied: boolean;
  };
}


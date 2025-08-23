export interface DomainSearchParams {
  query: string;
  keywords?: string[];
  location?: string;
  supportedTlds?: string[];
  defaultTlds?: string[];
  limit?: number;
}

export interface DomainResult {
  domain: string;
  suffix: string;
  score: number;
  isAvailable?: boolean;
  aiGenerated?: boolean;
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
}

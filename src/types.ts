// Options --------------------------------------------------------------------

/** Configuration provided when initializing the client. */
export interface ClientInitOptions {
  defaultTlds?: string[];
  supportedTlds?: string[];
  limit?: number;
  // Number of results to skip (for pagination)
  offset?: number;
  prefixes?: string[];
  suffixes?: string[];
  maxSynonyms?: number;
  tldWeights?: Record<string, number>;
}

/** Per-search options extending the client defaults. */
export interface DomainSearchOptions extends ClientInitOptions {
  query: string;
  location?: string;
  debug?: boolean;
  useAi?: boolean;
  // Whether to generate hyphenated label variants (e.g., foo-bar)
  includeHyphenated?: boolean;
}

// Results --------------------------------------------------------------------

/** Detailed breakdown of how a domain was scored. */
export interface DomainScore {
  total: number;
  components: Record<string, number>;
}

/** Represents a generated domain name candidate. */
export interface DomainCandidate {
  domain: string;
  suffix: string;
  score: DomainScore;
  isAvailable?: boolean;
  aiGenerated?: boolean;
  variantTypes?: string[];
  strategy?: string;
}

/** Describes the latency measurements captured for a search. */
export interface LatencyMetrics {
  total: number;
  requestProcessing: number;
  domainGeneration: number;
  scoring: number;
  ranking: number;
  strategies: Record<string, number>;
}

/** Metadata describing a search operation. */
export interface SearchMetadata {
  searchTime: number;
  totalGenerated: number;
  filterApplied: boolean;
  latency: LatencyMetrics;
}

/** Simplified processed query shared across generation strategies. */
export interface ProcessedQuery {
  query: string;
  tokens: string[];
  synonyms: Record<string, string[]>;
  orderedTlds: string[];
  includeHyphenated: boolean;
  limit: number;
  prefixes: string[];
  suffixes: string[];
}

/** Response returned from a domain search. */
export interface SearchResponse {
  results: DomainCandidate[];
  success: boolean;
  message?: string;
  includesAiGenerations: boolean;
  metadata: SearchMetadata;
  // Final processed query details
  processed?: ProcessedQuery;
}

// Strategies -----------------------------------------------------------------

/** Contract implemented by all generation strategies. */
export interface GenerationStrategy {
  generate(query: ProcessedQuery): Promise<Partial<DomainCandidate>[]>;
}

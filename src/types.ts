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
  keywords?: string[];
  location?: string;
  debug?: boolean;
  useAi?: boolean;
  // Whether to generate hyphenated label variants (e.g., foo-bar)
  includeHyphenated?: boolean;
  // Precomputed synonyms per normalized token (filled by search())
  synonyms?: Record<string, string[]>;
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

/** Metadata describing a search operation. */
export interface SearchMetadata {
  searchTime: number;
  totalGenerated: number;
  filterApplied: boolean;
}

/** Details about the processed query and resolved config. */
export interface ProcessedQueryInfo {
  // Normalized tokens extracted from the input query
  tokens: string[];
  // Convenience: tokens joined without separators (e.g., "fasttech")
  finalQuery: string;
  // Country-code TLD derived from location, if any
  cc?: string;
  // Effective supported and default TLDs after normalization and location merge
  supportedTlds: string[];
  defaultTlds: string[];
  // Effective limit and offset
  limit: number;
  offset: number;
  // Original request context that can affect generation/scoring
  location?: string;
  includeHyphenated?: boolean;
}

/** Response returned from a domain search. */
export interface SearchResponse {
  results: DomainCandidate[];
  success: boolean;
  message?: string;
  includesAiGenerations: boolean;
  metadata: SearchMetadata;
  // Final processed query details
  processed?: ProcessedQueryInfo;
}

// Strategies -----------------------------------------------------------------

/** Contract implemented by all generation strategies. */
export interface GenerationStrategy {
  generate(opts: DomainSearchOptions): Promise<Partial<DomainCandidate>[]>;
}

// Options --------------------------------------------------------------------

/** Configuration provided when initializing the client. */
export interface ClientInitOptions {
  /** Primary TLD used when none is specified in a query. */
  defaultTld?: string;
  /** Additional TLDs to prioritise when generating candidates. */
  preferredTlds?: string[];
  supportedTlds?: string[];
  limit?: number;
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
}

// Results --------------------------------------------------------------------

/** Represents a generated domain name candidate. */
export interface DomainCandidate {
  domain: string;
  suffix: string;
  score: number;
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

/** Response returned from a domain search. */
export interface SearchResponse {
  results: DomainCandidate[];
  success: boolean;
  message?: string;
  includesAiGenerations: boolean;
  metadata: SearchMetadata;
}

// Strategies -----------------------------------------------------------------

/** Contract implemented by all generation strategies. */
export interface GenerationStrategy {
  generate(opts: DomainSearchOptions): Promise<Partial<DomainCandidate>[]>;
}


# Fast Domain Search Library - Design Document

## 1. Overview

### 1.1 Purpose
The Fast Domain Search Library is a pure JavaScript/TypeScript library that performs intelligent domain name searches and suggestions. Given a search query and optional parameters, it returns a ranked list of available or suggested domain names with various TLD combinations.

### 1.2 Objectives
- Provide fast, relevant domain name suggestions based on user queries
- Support multiple TLD options with customizable preferences
- Implement intelligent ranking algorithms for result relevance
- Maintain zero external runtime dependencies for maximum portability
- Support both browser and Node.js environments

### 1.3 Key Features
- Query-based domain generation and suggestion
- Keyword-based result seeding for improved relevance
- Location-aware TLD suggestions
- Customizable TLD filtering and defaults
- AI-powered domain generation capabilities (optional)
- Result ranking based on relevance and popularity

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Client Application                 │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              DomainSearchClient                      │
│  ┌────────────────────────────────────────────────┐ │
│  │            Configuration Manager               │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │              Query Processor                   │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │           Domain Generator Engine              │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │             Ranking Engine                     │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │              TLD Manager                       │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 2.2 Core Components

#### 2.2.1 DomainSearchClient
Main entry point for the library, orchestrates all operations.

#### 2.2.2 Configuration Manager
Handles default configurations and parameter validation.

#### 2.2.3 Query Processor
Parses and normalizes search queries, extracts meaningful tokens.

#### 2.2.4 Domain Generator Engine
Creates domain name variations based on processed queries.

The generator is composed of independent strategies located in `src/strategies`. Each strategy implements a common interface and executes in parallel, returning domain candidates tagged with the strategy that produced them.

#### 2.2.5 Ranking Engine
Scores and sorts generated domains based on relevance factors.

#### 2.2.6 TLD Manager
Manages supported TLDs and location-based TLD recommendations.

## 3. API Specification

### 3.1 Main Interface

```typescript
interface ClientInitOptions {
  defaultTld?: string;               // Primary TLD appended by default
  preferredTlds?: string[];          // TLDs to prioritise
  supportedTlds?: string[];          // Allowed TLDs
  limit?: number;                    // Max results (default: 20)
  prefixes?: string[];               // Prefixes for generation
  suffixes?: string[];               // Suffixes for generation
  maxSynonyms?: number;              // Synonym expansion limit
  tldWeights?: Record<string, number>; // TLD ranking weights
}

interface DomainSearchOptions extends ClientInitOptions {
  query: string;                     // Required: search term(s)
  keywords?: string[];               // Optional: seeding keywords
  location?: string;                 // Optional: 2-char country code
  debug?: boolean;                   // Include debug info
  useAi?: boolean;                   // Include AI suggestions
}

interface DomainCandidate {
  domain: string;                   // Full domain name
  suffix: string;                   // TLD suffix
  score?: number;                   // Relevance score (internal)
  isAvailable?: boolean;            // Availability status (if checked)
  aiGenerated?: boolean;            // Whether AI-generated
}

interface SearchResponse {
  results: DomainCandidate[];
  success: boolean;
  message?: string;
  includes_ai_generations: boolean;
  metadata?: {
    searchTime: number;             // Search duration in ms
    totalGenerated: number;          // Total domains generated
    filterApplied: boolean;          // Whether filtering was applied
  };
}
```

### 3.2 Primary Methods

```typescript
class DomainSearchClient {
  constructor(initOptions?: ClientInitOptions);

  search(options: DomainSearchOptions): Promise<SearchResponse>;

  setInitOptions(options: ClientInitOptions): void;
  getInitOptions(): ClientInitOptions;
}
```

### 3.3 Configuration Interface

```typescript
interface ClientInitOptions {
  defaultLimit?: number;             // Default: 20
  defaultTld?: string;               // Default: 'com'
  preferredTlds?: string[];          // Default: []
  enableAiGeneration?: boolean;      // Default: false
  maxQueryLength?: number;           // Default: 100
  minDomainLength?: number;          // Default: 2
  maxDomainLength?: number;          // Default: 63
  rankingWeights?: RankingWeights;   // Scoring configuration
  tldData?: TldDatabase;             // TLD information database
}

interface RankingWeights {
  exactMatch: number;               // Weight for exact query match
  tldPopularity: number;            // Weight for TLD popularity
  domainLength: number;             // Weight for shorter domains
  keywordMatch: number;             // Weight for keyword matches
  pronounceability: number;         // Weight for pronounceable domains
}
```

## 4. Implementation Details

### 4.1 Query Processing

```typescript
class QueryProcessor {
  process(query: string): ProcessedQuery {
    // 1. Normalize query (lowercase, trim, remove special chars)
    // 2. Extract tokens (split by spaces, hyphens, etc.)
    // 3. Identify compound words
    // 4. Generate variations (singular/plural, synonyms)
    // 5. Remove stop words (optional)
    // 6. Extract numbers and convert to words (optional)
    
    return {
      original: string;
      normalized: string;
      tokens: string[];
      compounds: string[];
      variations: string[];
    };
  }
}
```

### 4.2 Domain Generation Strategies

```typescript
class DomainGenerator {
  generate(processedQuery: ProcessedQuery, params: DomainSearchOptions): string[] {
    const strategies = [
      this.exactMatchStrategy,        // foo.bar for "foo bar"
      this.concatenationStrategy,     // foobar.com for "foo bar"
      this.hyphenationStrategy,       // foo-bar.com
      this.abbreviationStrategy,      // fb.com for "foo bar"
      this.reverseStrategy,           // bar-foo.com
      this.prefixSuffixStrategy,      // getfoobar.com, foobarapp.com
      this.creativeStrategy,           // foob.ar, foo.ba
      this.aiGenerationStrategy,      // AI-powered suggestions
    ];
    
    const domains = new Set<string>();
    
    for (const strategy of strategies) {
      const generated = strategy(processedQuery, params);
      generated.forEach(d => domains.add(d));
    }
    
    return Array.from(domains);
  }
}
```

### 4.3 Ranking Algorithm

```typescript
class RankingEngine {
  rank(domains: DomainCandidate[], params: DomainSearchOptions): DomainCandidate[] {
    return domains
      .map(domain => ({
        ...domain,
        score: this.calculateScore(domain, params)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, params.limit || 20);
  }
  
  private calculateScore(domain: DomainCandidate, params: DomainSearchOptions): number {
    let score = 0;
    const weights = this.config.rankingWeights;
    
    // Exact match bonus
    if (domain.domain === params.query) {
      score += weights.exactMatch;
    }
    
    // TLD popularity score
    score += this.getTldPopularityScore(domain.suffix) * weights.tldPopularity;
    
    // Domain length penalty (shorter is better)
    const lengthScore = Math.max(0, 20 - domain.domain.length) / 20;
    score += lengthScore * weights.domainLength;
    
    // Keyword matching
    if (params.keywords) {
      const keywordScore = this.calculateKeywordScore(domain, params.keywords);
      score += keywordScore * weights.keywordMatch;
    }
    
    // Pronounceability score
    score += this.calculatePronounceability(domain) * weights.pronounceability;
    
    // Location relevance for ccTLDs
    if (params.location) {
      score += this.calculateLocationRelevance(domain, params.location);
    }
    
    return score;
  }
}
```

### 4.4 TLD Management

```typescript
class TldManager {
  private tldDatabase: Map<string, TldInfo>;
  
  interface TldInfo {
    tld: string;
    type: 'generic' | 'country' | 'sponsored' | 'infrastructure';
    popularity: number;           // 0-100 scale
    countryCode?: string;         // For ccTLDs
    categories?: string[];        // e.g., ['tech', 'business']
    restrictions?: string[];      // Registration restrictions
  }
  
  getSupportedTlds(params?: DomainSearchOptions): string[] {
    // Return filtered TLDs based on parameters
  }
  
  getLocationBasedTlds(countryCode: string): string[] {
    // Return relevant TLDs for the country
  }
  
  getTldInfo(tld: string): TldInfo | undefined {
    // Return TLD information
  }
}
```

## 5. Generation Algorithms

### 5.1 Exact Match Strategy
Combines query tokens directly with TLDs.
- "foo bar" → foo.bar (if .bar TLD exists)

### 5.2 Concatenation Strategy
Joins tokens without separators.
- "foo bar" → foobar.com

### 5.3 Hyphenation Strategy
Joins tokens with hyphens.
- "foo bar baz" → foo-bar-baz.com

### 5.4 Abbreviation Strategy
Creates abbreviations from token initials.
- "foo bar company" → fbc.com

### 5.5 Creative Strategy
Splits domains creatively across name and TLD.
- "foobar" → foob.ar (if .ar TLD exists)
- "foobar" → foo.ba (if .ba TLD exists)

### 5.6 AI Generation Strategy (Optional)
Uses pattern recognition and linguistic models to generate creative variations.

## 6. Performance Optimization

### 6.1 Caching Strategy
```typescript
class CacheManager {
  private cache: LRUCache<string, SearchResponse>;
  private ttl: number = 3600000; // 1 hour
  
  get(key: string): SearchResponse | null;
  set(key: string, value: SearchResponse): void;
  invalidate(pattern?: string): void;
}
```

### 6.2 Optimization Techniques
- **Lazy Loading**: Load TLD database on-demand
- **Memoization**: Cache expensive computations (pronounceability scores)
- **Early Termination**: Stop generation when limit is reached
- **Parallel Processing**: Use Web Workers in browser for heavy computations
- **Trie Data Structure**: For efficient prefix matching

### 6.3 Performance Targets
- Search latency: < 100ms for typical queries
- Memory usage: < 10MB for core library
- Bundle size: < 50KB minified + gzipped

## 7. Error Handling

### 7.1 Error Types
```typescript
enum ErrorType {
  INVALID_QUERY = 'INVALID_QUERY',
  INVALID_PARAMS = 'INVALID_PARAMS',
  TLD_NOT_SUPPORTED = 'TLD_NOT_SUPPORTED',
  GENERATION_FAILED = 'GENERATION_FAILED',
  TIMEOUT = 'TIMEOUT'
}

class DomainSearchError extends Error {
  constructor(
    public type: ErrorType,
    public message: string,
    public details?: any
  ) {
    super(message);
  }
}
```

### 7.2 Error Handling Strategy
- Validate all inputs before processing
- Provide meaningful error messages
- Graceful degradation (return partial results if possible)
- Log errors for debugging (configurable)

## 8. Testing Strategy

### 8.1 Unit Tests
```typescript
// Example test structure
describe('DomainSearchClient', () => {
  describe('search()', () => {
    it('should return results for valid query');
    it('should handle special characters in query');
    it('should respect limit parameter');
    it('should filter by supported_tlds');
    it('should handle empty query gracefully');
  });
});

describe('RankingEngine', () => {
  it('should rank exact matches highest');
  it('should consider TLD popularity');
  it('should penalize very long domains');
});
```

### 8.2 Integration Tests
- Test complete search flow
- Test with various parameter combinations
- Test performance with large result sets
- Test browser vs Node.js compatibility

### 8.3 Performance Tests
- Benchmark search speed with various query complexities
- Memory usage profiling
- Stress testing with concurrent searches

## 9. Security Considerations

### 9.1 Input Validation
- Sanitize all user inputs
- Prevent regex DoS attacks
- Limit query length and complexity
- Validate TLD inputs against whitelist

### 9.2 Output Sanitization
- Ensure domain names follow RFC standards
- Prevent XSS in domain suggestions
- Validate character sets (ASCII, Unicode handling)

## 10. Browser and Node.js Compatibility

### 10.1 Environment Detection
```typescript
const isNode = typeof process !== 'undefined' && 
               process.versions && 
               process.versions.node;

const isBrowser = typeof window !== 'undefined';
```

### 10.2 Platform-Specific Features
- Use Web Workers in browser for parallel processing
- Use worker_threads in Node.js
- Conditional imports for platform-specific optimizations

## 11. Package Structure

```
fast-domain-search/
├── src/
│   ├── index.ts                 // Main export
│   ├── client.ts                // DomainSearchClient
│   ├── config/
│   │   ├── default.ts
│   │   └── validator.ts
│   ├── processors/
│   │   └── query.ts
│   ├── generators/
│   │   ├── index.ts
│   │   └── strategies/
│   │       ├── exact.ts
│   │       ├── concatenation.ts
│   │       └── ...
│   ├── ranking/
│   │   └── engine.ts
│   ├── tld/
│   │   ├── manager.ts
│   │   └── database.ts
│   ├── cache/
│   │   └── lru.ts
│   ├── utils/
│   │   ├── validation.ts
│   │   └── helpers.ts
│   └── types/
│       └── index.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── performance/
├── dist/                        // Built files
│   ├── index.js                // CommonJS
│   ├── index.esm.js            // ES Modules
│   └── index.d.ts              // TypeScript definitions
├── package.json
├── tsconfig.json
├── rollup.config.js            // Build configuration
└── README.md
```

## 12. Build and Distribution

### 12.1 Build Targets
- CommonJS for Node.js compatibility
- ES Modules for modern bundlers
- UMD for browser script tags
- TypeScript definitions

### 12.2 Package.json Configuration
```json
{
  "name": "fast-domain-search",
  "version": "1.0.0",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "require": "./dist/index.js",
      "import": "./dist/index.esm.js",
      "types": "./dist/index.d.ts"
    }
  },
  "sideEffects": false,
  "engines": {
    "node": ">=14.0.0"
  }
}
```

## 13. Usage Examples

### 13.1 Basic Usage
```typescript
import { DomainSearchClient } from 'fast-domain-search';

const client = new DomainSearchClient();

const results = await client.search({
  query: 'foo bar',
  limit: 10
});

console.log(results.results);
```

### 13.2 Advanced Usage
```typescript
const client = new DomainSearchClient({
  defaultTld: 'com',
  preferredTlds: ['io', 'dev'],
  enableAiGeneration: true,
  rankingWeights: {
    exactMatch: 100,
    tldPopularity: 50,
    domainLength: 30,
    keywordMatch: 40,
    pronounceability: 20
  }
});

const results = await client.search({
  query: 'tech startup',
  keywords: ['innovation', 'technology', 'saas'],
  location: 'us',
  supported_tlds: ['com', 'io', 'tech', 'app'],
  limit: 25
});
```

## 14. Future Enhancements

### 14.1 Version 2.0 Features
- Real-time domain availability checking
- Bulk search capabilities
- Domain history and trends analysis
- Multi-language support
- Premium domain identification
- Similar domain detection
- Trademark conflict detection

### 14.2 Performance Improvements
- WebAssembly modules for compute-intensive operations
- Service Worker caching for browser environments
- Streaming results for large searches
- Incremental search with progressive enhancement

## 15. Dependencies

### 15.1 Runtime Dependencies
- None (pure JavaScript/TypeScript implementation)

### 15.2 Development Dependencies
- TypeScript: Type checking and compilation
- Rollup/Webpack: Bundling
- Jest/Mocha: Testing framework
- ESLint: Code quality
- Prettier: Code formatting

## 16. License and Contributing

The library should be distributed under MIT license for maximum adoption. Contributing guidelines should be established for community contributions.
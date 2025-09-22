import { runSearchInWorker } from './searchRunner';
import tlds from "./tlds.json" assert { type: "json" };
import { ClientInitOptions, DomainSearchOptions, SearchResponse } from './types';

const TLD_MAP: Record<string, string | boolean> = {
  ...(tlds as any).popular,
  ...(tlds as any).gTLDs,
};

const DEFAULT_INIT_OPTIONS: Required<ClientInitOptions> = {
  defaultTlds: ['com', 'ng', 'com.ng', 'site', 'org', 'net', 'edu.ng', 'name.ng', 'sch.ng', 'app', 'xyz'],
  supportedTlds: Object.keys(TLD_MAP),
  limit: 20,
  offset: 0,
  checkAvailability: false,
  // more here - https://gist.github.com/marcanuy/06cb00bc36033cd12875
  prefixes: [
    'try', 'the', 'get', 'go',
  ],
  suffixes: [
    'ly', 'hq', 'hub', 'app', 'labs',
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
};

export class DomainSearchClient {
  private init: Required<ClientInitOptions>;

  constructor (initOptions: ClientInitOptions = {}) {
    this.init = { ...DEFAULT_INIT_OPTIONS, ...initOptions };
  }

  setInitOptions(options: ClientInitOptions): void {
    this.init = { ...this.init, ...options };
  }

  getInitOptions(): Required<ClientInitOptions> {
    return this.init;
  }

  async search(options: DomainSearchOptions): Promise<SearchResponse> {
    return runSearchInWorker(this.init, options);
  }
}

export { generateCandidates } from './generator';
export { scoreCandidates, scoreDomain } from './ranking';
export {
  AffixStrategy, PermutationStrategy, TldHackStrategy
} from './strategies';
export type {
  ClientInitOptions,
  DomainAvailability,
  DomainCandidate,
  DomainSearchOptions,
  GenerationStrategy,
  LatencyMetrics,
  ProcessedQuery,
  DomainScore as ScoreBreakdown,
  SearchMetadata,
  SearchResponse
} from './types';


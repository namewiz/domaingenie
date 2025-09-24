import type { ClientInitOptions, DomainSearchOptions, SearchResponse } from './index';

export interface WorkerRequest {
  id: number;
  init: Required<ClientInitOptions>;
  options: DomainSearchOptions;
}

export interface WorkerResponse {
  id: number;
  result?: SearchResponse;
  error?: string;
}

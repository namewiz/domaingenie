import { executeSearch } from './searchCore';
import { ClientInitOptions, DomainSearchOptions, SearchResponse } from './types';
import type { WorkerRequest, WorkerResponse } from './types/worker';

function handleRequest(message: WorkerRequest, postMessage: (response: WorkerResponse) => void): void {
  executeSearch(message.init, message.options)
    .then((result) => {
      postMessage({ id: message.id, result });
    })
    .catch((error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      postMessage({ id: message.id, error: errorMessage });
    });
}

const hasSelf = typeof self !== 'undefined' && typeof (self as any).postMessage === 'function';

if (hasSelf) {
  (self as any).onmessage = (event: any) => {
    const message = event?.data as WorkerRequest | undefined;
    if (!message) return;
    handleRequest(message, (response) => (self as any).postMessage(response));
  };
} else if (typeof process !== 'undefined' && !!process.versions?.node) {
  import('worker_threads').then(({ parentPort }) => {
    if (!parentPort) return;
    parentPort.on('message', (message: WorkerRequest) => {
      if (!message) return;
      handleRequest(message, (response) => parentPort.postMessage(response));
    });
  });
}

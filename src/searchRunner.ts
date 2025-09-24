import { executeSearch } from './searchCore';
import { ClientInitOptions, DomainSearchOptions, SearchResponse } from './types';
import type { WorkerRequest, WorkerResponse } from './types/worker';

const WORKER_PATH = new URL('./searchWorkerThread.js', import.meta.url);

let nextMessageId = 0;

const isNode = typeof process !== 'undefined' && !!process.versions?.node;
const isBrowser = typeof window !== 'undefined' && typeof (window as any).Worker === 'function';

export async function runSearchInWorker(
  init: Required<ClientInitOptions>,
  options: DomainSearchOptions
): Promise<SearchResponse> {
  if (isNode) {
    try {
      return await runInNodeWorker(init, options);
    } catch (err) {
      return executeSearch(init, options);
    }
  }

  if (isBrowser) {
    try {
      return await runInBrowserWorker(init, options);
    } catch (err) {
      return executeSearch(init, options);
    }
  }

  return executeSearch(init, options);
}

async function runInNodeWorker(
  init: Required<ClientInitOptions>,
  options: DomainSearchOptions
): Promise<SearchResponse> {
  const { Worker } = await import('worker_threads');
  return new Promise<SearchResponse>((resolve, reject) => {
    let worker: InstanceType<typeof Worker>;
    try {
      worker = new Worker(WORKER_PATH, { type: 'module' });
    } catch (error) {
      reject(error as Error);
      return;
    }
    const id = ++nextMessageId;

    const cleanup = () => {
      void worker.terminate();
    };

    worker.once('message', (message: WorkerResponse) => {
      cleanup();
      if (message.error) {
        reject(new Error(message.error));
      } else {
        resolve(message.result as SearchResponse);
      }
    });

    worker.once('error', (error) => {
      cleanup();
      reject(error);
    });

    worker.once('exit', (code) => {
      if (code !== 0) {
        cleanup();
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });

    const payload: WorkerRequest = { id, init, options };
    try {
      worker.postMessage(payload);
    } catch (error) {
      cleanup();
      reject(error as Error);
    }
  });
}

function runInBrowserWorker(
  init: Required<ClientInitOptions>,
  options: DomainSearchOptions
): Promise<SearchResponse> {
  const WorkerCtor = (globalThis as any).Worker;
  if (typeof WorkerCtor !== 'function') {
    return executeSearch(init, options);
  }

  return new Promise<SearchResponse>((resolve, reject) => {
    let worker: any;
    try {
      worker = new WorkerCtor(WORKER_PATH, { type: 'module' });
    } catch (error) {
      reject(error as Error);
      return;
    }
    const id = ++nextMessageId;

    const cleanup = () => {
      worker.terminate();
    };

    worker.onmessage = (event: any) => {
      const message = event?.data as WorkerResponse | undefined;
      if (!message || message.id !== id) return;
      cleanup();
      if (message.error) {
        reject(new Error(message.error));
      } else {
        resolve(message.result as SearchResponse);
      }
    };

    worker.onerror = (event: any) => {
      cleanup();
      const error = event?.error instanceof Error
        ? event.error
        : new Error(event?.message || 'Worker error');
      reject(error);
    };

    const payload: WorkerRequest = { id, init, options };
    try {
      worker.postMessage(payload);
    } catch (error) {
      cleanup();
      reject(error as Error);
    }
  });
}

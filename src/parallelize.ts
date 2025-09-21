/**
 * Interface for the task message sent to a worker.
 * @template I The type of the input data item.
 */
interface Task<I> {
  index: number;
  data: I;
  fnString: string;
}

/**
 * Interface for the result message received from a worker.
 * @template O The type of the output result item.
 */
interface Result<O> {
  index: number;
  result?: O;
  error?: string;
}

// A type alias for the worker instance, which differs between environments.
type GenericWorker = Worker | import('worker_threads').Worker;

/**
 * Executes a pure function in parallel for each item in an array using workers.
 * This implementation is isomorphic, meaning it works in both Node.js and browser environments.
 *
 * @template I The type of the items in the input data array.
 * @template O The type of the items in the returned result array.
 * @param {ArrayLike<I>} data An array-like object of data to be processed.
 * @param {(item: I) => O} fn A **pure, self-contained function** to execute on each data item.
 * This function must not rely on any external scope or closures,
 * as it will be serialized and executed in a separate context.
 * @returns {Promise<O[]>} A promise that resolves to an array of results
 * in the same order as the input data.
 */
export async function parallelize<I, O>(
  data: ArrayLike<I>,
  fn: (item: I) => O
): Promise<O[]> {
  // --- 1. Argument Validation ---
  if (!data || typeof data.length !== 'number') {
    return Promise.reject(new TypeError('The "data" argument must be an ArrayLike object.'));
  }
  if (typeof fn !== 'function') {
    return Promise.reject(new TypeError('The "fn" argument must be a pure function.'));
  }

  const dataArray: I[] = Array.from(data);
  if (dataArray.length === 0) {
    return Promise.resolve([]);
  }

  // --- 2. Environment Detection ---
  const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
  const isBrowser = typeof window !== 'undefined' && typeof window.Worker !== 'undefined';

  /**
   * The core worker pool logic, shared by both environments.
   */
  const run = (taskData: I[], numCores: number, workerSource: string, fnString: string): Promise<O[]> => {
    return new Promise(async (resolve, reject) => {
      const workers: GenericWorker[] = [];
      const results: O[] = new Array(taskData.length);
      let tasksAssigned = 0;
      let tasksCompleted = 0;
      const numWorkers = Math.min(numCores, taskData.length);

      // Dynamically load Node.js Worker class only if in Node environment
      let NodeWorker: typeof import('worker_threads').Worker | undefined;
      if (isNode) {
        NodeWorker = (await import('worker_threads')).Worker;
      }

      const cleanup = () => {
        workers.forEach(w => w.terminate());
        if (isBrowser && workerSource.startsWith('blob:')) {
          URL.revokeObjectURL(workerSource);
        }
      };

      const handleMessage = (message: Result<O>, worker: GenericWorker) => {
        if (message.error) {
          cleanup();
          reject(new Error(`Error processing item ${message.index}: ${message.error}`));
          return;
        }

        // The non-null assertion (!) is safe here because we've checked for an error.
        results[message.index] = message.result!;
        tasksCompleted++;

        if (tasksCompleted === taskData.length) {
          cleanup();
          resolve(results);
        } else if (tasksAssigned < taskData.length) {
          assignTask(worker, tasksAssigned++);
        }
      };

      const assignTask = (worker: GenericWorker, index: number) => {
        const task: Task<I> = { index, data: taskData[index], fnString };
        worker.postMessage(task);
      };

      for (let i = 0; i < numWorkers; i++) {
        const worker: GenericWorker = isNode && NodeWorker
          ? new NodeWorker(workerSource, { eval: true })
          : new Worker(workerSource);

        worker.onmessage = (event: MessageEvent<Result<O>> | Result<O>) => {
          handleMessage(isNode ? (event as Result<O>) : (event as MessageEvent<Result<O>>).data, worker);
        };
        worker.onerror = (err: any) => {
          cleanup();
          reject(isNode ? err : new Error(`Worker error: ${err.message}`));
        };

        if (isNode) {
          (worker as import('worker_threads').Worker).on('exit', (code) => {
            if (code !== 0 && tasksCompleted < taskData.length) {
              cleanup();
              reject(new Error(`Worker stopped with exit code ${code}`));
            }
          });
        }

        workers.push(worker);
      }

      // Initial task distribution
      for (let i = 0; i < numWorkers; i++) {
        if (tasksAssigned < taskData.length) {
          assignTask(workers[i], tasksAssigned++);
        }
      }
    });
  };

  const fnString = fn.toString();

  // --- 3. Environment-Specific Execution ---
  if (isNode) {
    const os = await import('os');
    const workerScript = `
      const { parentPort } = require('worker_threads');
      parentPort.on('message', (task) => {
        try {
          const workFn = new Function('return (' + task.fnString + ')')();
          const result = workFn(task.data);
          parentPort.postMessage({ index: task.index, result });
        } catch (e) {
          parentPort.postMessage({ index: task.index, error: e.message });
        }
      });
    `;
    return run(dataArray, os.cpus().length, workerScript, fnString);
  }

  if (isBrowser) {
    const workerScript = `
      self.onmessage = (event) => {
        const task = event.data;
        try {
          const workFn = new Function('return (' + task.fnString + ')')();
          const result = workFn(task.data);
          self.postMessage({ index: task.index, result });
        } catch (e) {
          self.postMessage({ index: task.index, error: e.message });
        }
      };
    `;
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const blobURL = URL.createObjectURL(blob);
    return run(dataArray, window.navigator.hardwareConcurrency || 2, blobURL, fnString);
  }

  // --- 4. Fallback for Unsupported Environments ---
  console.warn("Workers not supported. Running tasks sequentially.");
  try {
    const results = dataArray.map(fn);
    return Promise.resolve(results);
  } catch (e: any) {
    return Promise.reject(e);
  }
}

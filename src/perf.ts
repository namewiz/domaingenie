export interface PerformanceEntryLike {
  duration: number;
}

export interface PerformanceLike {
  now(): number;
  mark(name: string): void;
  measure(name: string, startMark?: string, endMark?: string): void;
  clearMarks(name?: string): void;
  clearMeasures(name?: string): void;
  getEntriesByName(name: string, type?: string): PerformanceEntryLike[];
}

export interface PerformanceTimer {
  stop(): number;
}

export interface TimedPerformance extends PerformanceLike {
  start(label: string): PerformanceTimer;
}

let cached: Promise<TimedPerformance> | undefined;

/**
 * Resolves a high-resolution performance timer across environments.
 * Prefers the browser Performance API and falls back to Node's perf_hooks.
 */
export async function getPerformance(): Promise<TimedPerformance> {
  if (cached) return cached;

  cached = (async () => {
    const impl = await resolvePerformanceImplementation();
    return new WrappedPerformance(impl);
  })();

  return cached;
}

async function resolvePerformanceImplementation(): Promise<PerformanceLike> {
  if (typeof globalThis !== 'undefined') {
    const perf = (globalThis as any).performance;
    if (
      perf &&
      typeof perf.now === 'function' &&
      typeof perf.mark === 'function' &&
      typeof perf.measure === 'function' &&
      typeof perf.clearMarks === 'function' &&
      typeof perf.clearMeasures === 'function' &&
      typeof perf.getEntriesByName === 'function'
    ) {
      return perf as PerformanceLike;
    }
  }

  if (typeof globalThis !== 'undefined' && 'process' in globalThis) {
    const processRef = (globalThis as any).process;
    if (processRef && processRef.versions && processRef.versions.node) {
      try {
        const mod = await import('node:perf_hooks');
        if (
          mod?.performance &&
          typeof mod.performance.now === 'function' &&
          typeof mod.performance.mark === 'function' &&
          typeof mod.performance.measure === 'function' &&
          typeof mod.performance.clearMarks === 'function' &&
          typeof mod.performance.clearMeasures === 'function' &&
          typeof mod.performance.getEntriesByName === 'function'
        ) {
          return mod.performance as PerformanceLike;
        }
      } catch {
        // ignore and fall back to Date.now
      }
    }
  }

  return createFallbackPerformance();
}

class WrappedPerformance implements TimedPerformance {
  private counter = 0;

  constructor(private readonly impl: PerformanceLike) {}

  now(): number {
    return this.impl.now();
  }

  mark(name: string): void {
    this.impl.mark(name);
  }

  measure(name: string, startMark?: string, endMark?: string): void {
    this.impl.measure(name, startMark, endMark);
  }

  clearMarks(name?: string): void {
    this.impl.clearMarks(name);
  }

  clearMeasures(name?: string): void {
    this.impl.clearMeasures(name);
  }

  getEntriesByName(name: string, type?: string): PerformanceEntryLike[] {
    return this.impl.getEntriesByName(name, type);
  }

  start(label: string): PerformanceTimer {
    const id = `${label}-${++this.counter}`;
    const startMark = `${id}-start`;
    this.impl.mark(startMark);
    let measured: number | undefined;

    return {
      stop: (): number => {
        if (typeof measured === 'number') return measured;

        const endMark = `${id}-end`;
        const measureName = `${id}-measure`;
        let duration = 0;

        try {
          this.impl.mark(endMark);
          this.impl.measure(measureName, startMark, endMark);
          const entries = this.impl.getEntriesByName(measureName);
          const entry = entries[entries.length - 1];
          duration = entry ? entry.duration : 0;
        } finally {
          this.impl.clearMarks(startMark);
          this.impl.clearMarks(endMark);
          this.impl.clearMeasures(measureName);
        }

        measured = this.round(duration);
        return measured;
      },
    };
  }

  private round(duration: number): number {
    return Number(duration.toFixed(3));
  }
}

function createFallbackPerformance(): PerformanceLike {
  const marks = new Map<string, number>();
  const measures = new Map<string, number>();

  function now(): number {
    return Date.now();
  }

  function mark(name: string): void {
    marks.set(name, now());
  }

  function measure(name: string, startMark?: string, endMark?: string): void {
    const start = startMark ? marks.get(startMark) ?? now() : now();
    const end = endMark ? marks.get(endMark) ?? now() : now();
    measures.set(name, end - start);
  }

  function clearMarks(name?: string): void {
    if (typeof name === 'string') {
      marks.delete(name);
    } else {
      marks.clear();
    }
  }

  function clearMeasures(name?: string): void {
    if (typeof name === 'string') {
      measures.delete(name);
    } else {
      measures.clear();
    }
  }

  function getEntriesByName(name: string): PerformanceEntryLike[] {
    const duration = measures.get(name);
    return typeof duration === 'number' ? [{ duration }] : [];
  }

  return { now, mark, measure, clearMarks, clearMeasures, getEntriesByName };
}

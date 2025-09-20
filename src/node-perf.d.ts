declare module 'node:perf_hooks' {
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

  export const performance: PerformanceLike;
}

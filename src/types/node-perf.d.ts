declare module 'node:perf_hooks' {
  export type PerformanceEntryLike = import('./perf').PerformanceEntryLike;
  export type PerformanceLike = import('./perf').PerformanceLike;

  export const performance: PerformanceLike;
}

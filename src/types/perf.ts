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

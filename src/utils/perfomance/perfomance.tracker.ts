export class PerfTracker {
  private start = performance.now();
  private last = this.start;

  step(label: string) {
    const now = performance.now();
    const diff = (now - this.last).toFixed(2);
    const total = (now - this.start).toFixed(2);
    this.last = now;
    return `[PERF] ${label}: +${diff}ms (total ${total}ms)`;
  }
}

// Simple per-key token bucket rate limiter.
interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets: Map<string, Bucket> = new Map();
  constructor(private max: number, private refillPerSec: number) {}

  tryConsume(key: string, cost = 1): boolean {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: this.max, lastRefill: now };
      this.buckets.set(key, b);
    }
    const elapsedSec = (now - b.lastRefill) / 1000;
    b.tokens = Math.min(this.max, b.tokens + elapsedSec * this.refillPerSec);
    b.lastRefill = now;
    if (b.tokens < cost) return false;
    b.tokens -= cost;
    return true;
  }

  drop(key: string) {
    this.buckets.delete(key);
  }
}

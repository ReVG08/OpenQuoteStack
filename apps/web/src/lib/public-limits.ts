/** Process-local abuse guard. Shared deployments should also limit requests at the proxy. */
export class WindowLimiter {
  private buckets = new Map<string, { count: number; expires: number }>();
  constructor(
    private readonly clock = () => Date.now(),
    private readonly capacity = 10000,
  ) {}
  consume(key: string, limit: number, windowMs = 60000): boolean {
    const now = this.clock(),
      old = this.buckets.get(key),
      bucket =
        old && old.expires > now ? old : { count: 0, expires: now + windowMs };
    if (!this.buckets.has(key) && this.buckets.size >= this.capacity)
      this.buckets.delete(this.buckets.keys().next().value!);
    bucket.count++;
    this.buckets.set(key, bucket);
    return bucket.count <= limit;
  }
}
const limiter = new WindowLimiter();
export function publicAttempt(operation: string, key: string, limit: number) {
  if (
    !limiter.consume("all", 1200) ||
    !limiter.consume(`${operation}:${key}`, limit)
  )
    throw new Error("Request limit reached");
}

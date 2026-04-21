export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * After failing to acquire a populate lock, wait for another worker to fill the cache.
 */
export async function waitForAffiliateCacheHit<T>(
  get: () => Promise<T | null>,
  maxAttempts = 24,
): Promise<T | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const v = await get();
    if (v !== null) return v;
    await delay(18 + i * 12);
  }
  return null;
}

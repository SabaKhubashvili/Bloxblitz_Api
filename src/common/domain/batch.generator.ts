/**
 * Splits an array into batches of given size.
 *
 * @param items - The original array
 * @param batchSize - Size of each batch
 * @returns 2D array where each sub-array is a batch
 */
export function createBatches<T>(items: T[], batchSize: number): T[][] {
  if (batchSize <= 0) throw new Error('');

  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

import { createHmac } from 'crypto';
import type { TowersRowConfig } from './towers.config';

/**
 * Provably fair Towers — same HMAC + 52-bit rejection sampling pattern as Mines.
 * Message binds clientSeed, nonce, and row/cursor so outcomes are reproducible
 * server-side. Raw serverSeed / nonce are never returned on HTTP APIs (shared seed).
 */
function towersGetRandomIndex(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  rowIndex: number,
  cursor: number,
  max: number,
): number {
  let round = 0;
  while (true) {
    const message = `${clientSeed}:${nonce}:towers:row:${rowIndex}:c:${cursor}:${round}`;
    const hash = createHmac('sha256', serverSeed).update(message).digest('hex');
    const value = parseInt(hash.slice(0, 13), 16);
    const maxRange = Math.pow(2, 52);
    const limit = maxRange - (maxRange % max);
    if (value < limit) {
      return value % max;
    }
    round++;
  }
}

export function towersDeriveGemTileIndices(params: {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  rowIndex: number;
  row: TowersRowConfig;
}): number[] {
  const { tiles, gems } = params.row;
  if (tiles < 1 || gems < 1 || gems > tiles) {
    return [];
  }
  const idx = Array.from({ length: tiles }, (_, i) => i);
  let cursor = 0;
  for (let i = tiles - 1; i > 0; i--) {
    const j = towersGetRandomIndex(
      params.serverSeed,
      params.clientSeed,
      params.nonce,
      params.rowIndex,
      cursor,
      i + 1,
    );
    cursor++;
    const tmp = idx[i];
    idx[i] = idx[j]!;
    idx[j] = tmp;
  }
  return idx.slice(0, gems).sort((a, b) => a - b);
}

export function towersIsGemPick(
  gemIndices: number[],
  tileIndex: number,
): boolean {
  return gemIndices.includes(tileIndex);
}

export function towersDeriveAllGemIndicesByRow(params: {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  rows: TowersRowConfig[];
}): number[][] {
  return params.rows.map((row, rowIndex) =>
    towersDeriveGemTileIndices({
      serverSeed: params.serverSeed,
      clientSeed: params.clientSeed,
      nonce: params.nonce,
      rowIndex,
      row,
    }),
  );
}

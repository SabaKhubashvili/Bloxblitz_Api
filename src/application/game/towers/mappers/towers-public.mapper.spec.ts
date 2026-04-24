import { TowersGameStatus } from '@prisma/client';
import type { TowersGameEntity } from '../../../../infrastructure/persistance/repositories/game/towers-game.types';
import { TowersDifficulty } from '../../../../domain/game/towers/towers.enums';
import {
  toTowersBoardRevealDto,
  toTowersGamePublicDto,
} from './towers-public.mapper';

const FORBIDDEN_PUBLIC_KEYS = [
  'serverSeed',
  'serverSeedHash',
  'clientSeed',
  'nonce',
] as const;

const FORBIDDEN_REVEAL_KEYS = [
  'serverSeed',
  'serverSeedHash',
  'clientSeed',
  'nonce',
] as const;

function minimalEntity(
  overrides: Partial<TowersGameEntity> = {},
): TowersGameEntity {
  const rowConfigs = [{ tiles: 3, gems: 2 }];
  return {
    id: 'row-1',
    gameHistoryId: 'gh-1',
    userUsername: 'u',
    profilePicture: '',
    betAmount: 1,
    difficulty: TowersDifficulty.EASY,
    levels: 1,
    rowConfigs,
    status: TowersGameStatus.ACTIVE,
    currentRowIndex: 0,
    currentMultiplier: 1,
    picks: [null],
    multiplierLadder: [1.1],
    serverSeed: 'secret-server-seed-do-not-leak',
    serverSeedHash: 'hash-commitment',
    clientSeed: 'client',
    nonce: 99,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('towers-public.mapper', () => {
  it('toTowersGamePublicDto never exposes seeds, nonce, or hashes', () => {
    const dto = toTowersGamePublicDto(minimalEntity());
    const json = JSON.stringify(dto);
    for (const k of FORBIDDEN_PUBLIC_KEYS) {
      expect(json).not.toContain(`"${k}"`);
      expect(dto).not.toHaveProperty(k);
    }
    expect(dto.gameId).toBe('gh-1');
    expect(dto.multiplierLadder).toEqual([1.1]);
  });

  it('toTowersBoardRevealDto exposes only gemIndicesByRow', () => {
    const reveal = toTowersBoardRevealDto(minimalEntity());
    const json = JSON.stringify(reveal);
    for (const k of FORBIDDEN_REVEAL_KEYS) {
      expect(json).not.toContain(`"${k}"`);
      expect(reveal).not.toHaveProperty(k);
    }
    expect(reveal).toEqual({ gemIndicesByRow: expect.any(Array) });
    expect(reveal.gemIndicesByRow).toHaveLength(1);
  });
});

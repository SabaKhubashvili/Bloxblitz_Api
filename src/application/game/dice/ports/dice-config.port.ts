import type { DiceConfig } from '../../../../domain/game/dice/dice-config';

export interface IDiceConfigPort {
  /** One resolved snapshot per call; reads Redis when available (authoritative). */
  getConfig(): Promise<DiceConfig>;
}

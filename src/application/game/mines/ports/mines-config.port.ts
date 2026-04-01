import type { MinesConfigPayload } from '../../../../domain/game/mines/mines-config';

export interface IMinesConfigPort {
  /** Resolved config (Redis + validation + same fallbacks as admin service). */
  getConfig(): Promise<MinesConfigPayload>;
}

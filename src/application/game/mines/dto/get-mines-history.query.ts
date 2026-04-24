import type { MinesHistorySortOrder } from '../../../../domain/game/mines/ports/mines-history.repository.port';

export interface GetMinesHistoryQuery {
  username: string;
  page: number;
  limit: number;
  /** Sort direction for `createdAt`. Defaults to `'desc'` (newest first). */
  order: MinesHistorySortOrder;
}

export interface GetDiceHistoryQuery {
  username: string;
  page: number;
  limit: number;
  order: 'desc' | 'asc';
}

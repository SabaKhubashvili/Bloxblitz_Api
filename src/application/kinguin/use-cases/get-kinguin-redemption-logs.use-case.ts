import { Injectable } from '@nestjs/common';
import { Ok } from '../../../domain/shared/types/result.type';

export interface GetKinguinRedemptionLogsQuery {
  page?: number;
  limit?: number;
}

@Injectable()
export class GetKinguinRedemptionLogsUseCase {
  async execute(_query: GetKinguinRedemptionLogsQuery) {
    return Ok({ items: [], total: 0 });
  }
}

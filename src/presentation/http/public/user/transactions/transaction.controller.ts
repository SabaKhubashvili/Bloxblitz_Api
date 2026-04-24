import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseFilters,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../../shared/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../shared/decorators/current-user.decorator';
import { DomainExceptionFilter } from '../../../../../shared/filters/domain-exception.filter';
import { GetUserTransactionHistoryUseCase } from '../../../../../application/user/transactions/use-cases/get-user-transaction-history.use-case';
import { GetTransactionByIdUseCase } from '../../../../../application/user/transactions/use-cases/get-transaction-by-id.use-case';
import { TransactionHistoryQueryDto } from './dto/transaction-history-query.dto';

/**
 * Handles all authenticated transaction-history routes under /user/transactions.
 *
 * Controller responsibilities (and nothing else):
 *  1. Authenticate the caller via JwtAuthGuard
 *  2. Validate and coerce query parameters via TransactionHistoryQueryDto
 *  3. Extract the authenticated username from the JWT payload
 *  4. Build the use-case input and delegate — no business logic here
 *  5. Unwrap the Result<T, E>: throw the domain error on failure so
 *     DomainExceptionFilter maps it to the correct HTTP status code
 *  6. Return the output DTO as the HTTP response body
 */
@Controller('user/transactions')
@UseGuards(JwtAuthGuard)
@UseFilters(DomainExceptionFilter)
export class TransactionController {
  constructor(
    private readonly getHistoryUseCase: GetUserTransactionHistoryUseCase,
    private readonly getByIdUseCase: GetTransactionByIdUseCase,
  ) {}

  /**
   * GET /user/transactions
   *
   * Returns a paginated list of the authenticated user's transaction history.
   *
   * Supported query params (all optional):
   *   page       — 1-based page number          (default: 1)
   *   limit      — records per page, max 100     (default: 10)
   *   order      — "asc" | "desc"                (default: "desc")
   *   category   — CRYPTO | KINGUIN_REDEEM | PET | REFUND
   *   direction  — IN | OUT
   *   status     — PENDING | COMPLETED | FAILED | CANCELED
   *   assetType  — CRYPTO | GIFT_CARD | ITEM
   *   from       — ISO-8601 lower bound for createdAt
   *   to         — ISO-8601 upper bound for createdAt
   *
   * Example:
   *   GET /user/transactions?page=1&limit=20&direction=IN&category=CRYPTO
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: TransactionHistoryQueryDto,
  ) {
    const result = await this.getHistoryUseCase.execute({
      username: user.username,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      order: (query.order ?? 'desc') as 'desc' | 'asc',
      category: query.category,
      direction: query.direction,
      status: query.status,
      assetType: query.assetType,
      from: query.from,
      to: query.to,
    });

    if (!result.ok) throw result.error;
    return result.value;
  }

  /**
   * GET /user/transactions/:id
   *
   * Returns a single transaction by its UUID.
   * Ownership is enforced at the repository level — the transaction must belong
   * to the authenticated user or a 404 is returned.
   *
   * Example:
   *   GET /user/transactions/550e8400-e29b-41d4-a716-446655440000
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const result = await this.getByIdUseCase.execute({
      id,
      username: user.username,
    });

    if (!result.ok) throw result.error;
    return result.value;
  }
}

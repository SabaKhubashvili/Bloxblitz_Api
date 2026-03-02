import {
  Controller,
  Get,
  UseGuards,
  UseFilters,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../../../../shared/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator.js';
import { DomainExceptionFilter } from '../../../../shared/filters/domain-exception.filter.js';
import { GetBalanceUseCase } from '../../../../application/user/use-cases/get-balance/get-balance.use-case.js';

/**
 * Exposes a single authenticated endpoint: GET /user/balance
 *
 * Controller responsibilities (and nothing else):
 *  1. Authenticate the request via JwtAuthGuard
 *  2. Extract the caller's username from the JWT payload
 *  3. Delegate to GetBalanceUseCase
 *  4. Unwrap the Result — throw the domain error on failure so
 *     DomainExceptionFilter maps it to the correct HTTP status
 *  5. Return the output DTO as the HTTP response body
 */
@Controller('user/balance')
@UseGuards(JwtAuthGuard)
@UseFilters(DomainExceptionFilter)
export class BalanceController {
  constructor(private readonly getBalanceUseCase: GetBalanceUseCase) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getBalance(@CurrentUser() user: JwtPayload) {
    const result = await this.getBalanceUseCase.execute({
      username: user.username,
    });

    if (!result.ok) throw result.error;
    return result.value;
  }
}

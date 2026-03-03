import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '../../domain/shared/errors/domain.error.js';

// ── Mines errors ─────────────────────────────────────────────────────────────
import {
  InvalidMineCountError,
  GameNotActiveError,
  InvalidTileIndexError,
  TileAlreadyRevealedError,
  NoTilesRevealedError,
  ActiveGameExistsError,
  GameNotFoundError,
  UserSeedNotFoundError,
  InsufficientBalanceError,
  MinesHistoryFetchError,
  MinesRoundNotFoundError,
} from '../../domain/game/mines/errors/mines.errors.js';

// ── User errors ───────────────────────────────────────────────────────────────
import {
  UserNotFoundError,
  BalanceFetchError,
} from '../../domain/user/errors/user.errors.js';

// ── Leveling errors ───────────────────────────────────────────────────────────
import {
  LevelingUserNotFoundError,
  InvalidXpAmountError,
  InvalidLevelError,
  LevelingPersistenceError,
} from '../../domain/leveling/errors/leveling.errors.js';

// ── Rakeback errors ──────────────────────────────────────────────────────────
import {
  RakebackNotFoundError,
  RakebackNotUnlockedError,
  RakebackWindowClosedError,
  RakebackAlreadyClaimedError,
  ZeroRakebackBalanceError,
  RakebackClaimInProgressError,
  RakebackAccumulationError,
} from '../../domain/rakeback/errors/rakeback.errors.js';

/**
 * Global domain-exception filter.
 *
 * Catches any class that extends DomainError and maps it to a structured
 * HTTP response.  Adding a new domain error requires only one new line in
 * resolveHttpStatus() — no other file needs to change.
 *
 * Response shape:
 *   { statusCode: number, error: string (domain code), message: string }
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = this.resolveHttpStatus(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[DomainFilter] Unhandled domain error [${exception.code}]: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.warn(
        `[DomainFilter] Domain error [${exception.code}]: ${exception.message}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      error: exception.code,
      message: exception.message,
    });
  }

  private resolveHttpStatus(error: DomainError): HttpStatus {
    // ── User errors ───────────────────────────────────────────────────────────
    if (error instanceof UserNotFoundError)  return HttpStatus.NOT_FOUND;
    if (error instanceof BalanceFetchError)  return HttpStatus.INTERNAL_SERVER_ERROR;

    // ── Mines errors ──────────────────────────────────────────────────────────
    if (error instanceof InsufficientBalanceError) return HttpStatus.PAYMENT_REQUIRED;
    if (error instanceof ActiveGameExistsError)    return HttpStatus.CONFLICT;
    if (error instanceof GameNotFoundError)        return HttpStatus.NOT_FOUND;
    if (error instanceof UserSeedNotFoundError)    return HttpStatus.NOT_FOUND;
    if (error instanceof GameNotActiveError)       return HttpStatus.CONFLICT;
    if (error instanceof MinesRoundNotFoundError)  return HttpStatus.NOT_FOUND;
    if (error instanceof MinesHistoryFetchError)   return HttpStatus.INTERNAL_SERVER_ERROR;
    if (
      error instanceof InvalidMineCountError   ||
      error instanceof InvalidTileIndexError   ||
      error instanceof TileAlreadyRevealedError ||
      error instanceof NoTilesRevealedError
    ) {
      return HttpStatus.BAD_REQUEST;
    }

    // ── Leveling errors ───────────────────────────────────────────────────────
    if (error instanceof LevelingUserNotFoundError) return HttpStatus.NOT_FOUND;
    if (error instanceof InvalidXpAmountError)      return HttpStatus.BAD_REQUEST;
    if (error instanceof InvalidLevelError)         return HttpStatus.BAD_REQUEST;
    if (error instanceof LevelingPersistenceError)  return HttpStatus.INTERNAL_SERVER_ERROR;

    // ── Rakeback errors ─────────────────────────────────────────────────────
    if (error instanceof RakebackNotFoundError)        return HttpStatus.NOT_FOUND;
    if (error instanceof ZeroRakebackBalanceError)     return HttpStatus.BAD_REQUEST;
    if (error instanceof RakebackNotUnlockedError)     return HttpStatus.FORBIDDEN;
    if (error instanceof RakebackWindowClosedError)    return HttpStatus.FORBIDDEN;
    if (error instanceof RakebackAlreadyClaimedError)  return HttpStatus.CONFLICT;
    if (error instanceof RakebackClaimInProgressError) return HttpStatus.CONFLICT;
    if (error instanceof RakebackAccumulationError)    return HttpStatus.INTERNAL_SERVER_ERROR;

    // ── Fallback ──────────────────────────────────────────────────────────────
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

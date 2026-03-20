import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '../../domain/shared/errors/domain.error';

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
} from '../../domain/game/mines/errors/mines.errors';

// ── Dice errors ─────────────────────────────────────────────────────────────
import {
  InsufficientBalanceError as DiceInsufficientBalanceError,
  UserSeedNotFoundError as DiceUserSeedNotFoundError,
  InvalidChanceError as DiceInvalidChanceError,
  InvalidBetAmountError as DiceInvalidBetAmountError,
  DiceHistoryFetchError,
} from '../../domain/game/dice/errors/dice.errors';

// ── User errors ───────────────────────────────────────────────────────────────
import {
  UserNotFoundError,
  BalanceFetchError,
} from '../../domain/user/errors/user.errors';

// ── Leveling errors ───────────────────────────────────────────────────────────
import {
  LevelingUserNotFoundError,
  InvalidXpAmountError,
  InvalidLevelError,
  LevelingPersistenceError,
} from '../../domain/leveling/errors/leveling.errors';

// ── Rakeback errors ──────────────────────────────────────────────────────────
import {
  RakebackNotFoundError,
  RakebackNotUnlockedError,
  RakebackWindowClosedError,
  RakebackAlreadyClaimedError,
  ZeroRakebackBalanceError,
  RakebackClaimInProgressError,
  RakebackAccumulationError,
} from '../../domain/rakeback/errors/rakeback.errors';

// ── Kinguin errors ───────────────────────────────────────────────────────
import {
  KinguinCodeNotFoundError,
  KinguinCodeAlreadyRedeemedError,
  KinguinCodeExpiredError,
  KinguinCodeDisabledError,
  KinguinCodeRedemptionInProgressError,
} from '../../domain/kinguin/errors/kinguin.errors';

import {
  UniwireProfileNotFoundError,
  UniwirePayoutNotFoundError,
  UniwireTransactionNotFoundError,
  UniwireAddressNotFoundError,
  UniwirePayoutFailedError,
  UniwireTransactionNotConfirmedError,
  UniwireExchangeRateUnavailableError,
  UniwireApiError,
} from '../../domain/uniwire/errors/uniwire.errors';

import {
  ProvablyFairNotFoundError,
  RotateClientSeedFailedError,
} from '../../domain/user/errors/provably-fair.errors';

import {
  CaseNotFoundError,
  CaseInactiveError,
  CaseEmptyPoolError,
  CaseInsufficientBalanceError,
  CaseUserSeedNotFoundError,
  CaseInvalidQuantityError,
  CasePersistenceError,
  CaseSlugTakenError,
  CaseUnknownPetsError,
  CaseInvalidItemsError,
} from '../../domain/game/case/errors/case.errors';

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

    // ── Dice errors ─────────────────────────────────────────────────────────────
    if (error instanceof DiceInsufficientBalanceError) return HttpStatus.PAYMENT_REQUIRED;
    if (error instanceof DiceUserSeedNotFoundError)    return HttpStatus.NOT_FOUND;
    if (error instanceof DiceHistoryFetchError)       return HttpStatus.INTERNAL_SERVER_ERROR;
    if (
      error instanceof DiceInvalidChanceError ||
      error instanceof DiceInvalidBetAmountError
    ) {
      return HttpStatus.BAD_REQUEST;
    }
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

    // ── Kinguin errors ─────────────────────────────────────────────────────
    if (error instanceof KinguinCodeNotFoundError)           return HttpStatus.NOT_FOUND;
    if (error instanceof KinguinCodeAlreadyRedeemedError)   return HttpStatus.BAD_REQUEST;
    if (error instanceof KinguinCodeExpiredError)           return HttpStatus.BAD_REQUEST;
    if (error instanceof KinguinCodeDisabledError)          return HttpStatus.BAD_REQUEST;
    if (error instanceof KinguinCodeRedemptionInProgressError) return HttpStatus.CONFLICT;

    // ── Uniwire errors ─────────────────────────────────────────────────────
    if (error instanceof UniwireProfileNotFoundError)     return HttpStatus.NOT_FOUND;
    if (error instanceof UniwirePayoutNotFoundError)       return HttpStatus.NOT_FOUND;
    if (error instanceof UniwireTransactionNotFoundError)  return HttpStatus.NOT_FOUND;
    if (error instanceof UniwireAddressNotFoundError)      return HttpStatus.NOT_FOUND;
    if (error instanceof UniwirePayoutFailedError)        return HttpStatus.BAD_REQUEST;
    if (error instanceof UniwireTransactionNotConfirmedError) return HttpStatus.BAD_REQUEST;
    if (error instanceof UniwireExchangeRateUnavailableError) return HttpStatus.SERVICE_UNAVAILABLE;
    if (error instanceof UniwireApiError)                  return HttpStatus.BAD_GATEWAY;

    // ── Provably Fair errors ───────────────────────────────────────────────────
    if (error instanceof ProvablyFairNotFoundError)         return HttpStatus.NOT_FOUND;
    if (error instanceof RotateClientSeedFailedError)       return HttpStatus.BAD_REQUEST;

    // ── Cases ─────────────────────────────────────────────────────────────────
    if (error instanceof CaseNotFoundError)            return HttpStatus.NOT_FOUND;
    if (error instanceof CaseInactiveError)            return HttpStatus.FORBIDDEN;
    if (error instanceof CaseEmptyPoolError)           return HttpStatus.CONFLICT;
    if (error instanceof CaseInsufficientBalanceError) return HttpStatus.PAYMENT_REQUIRED;
    if (error instanceof CaseUserSeedNotFoundError)   return HttpStatus.NOT_FOUND;
    if (error instanceof CaseInvalidQuantityError)     return HttpStatus.BAD_REQUEST;
    if (error instanceof CasePersistenceError)       return HttpStatus.INTERNAL_SERVER_ERROR;
    if (error instanceof CaseSlugTakenError)          return HttpStatus.CONFLICT;
    if (error instanceof CaseUnknownPetsError)        return HttpStatus.BAD_REQUEST;
    if (error instanceof CaseInvalidItemsError)       return HttpStatus.BAD_REQUEST;

    // ── Fallback ──────────────────────────────────────────────────────────────
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

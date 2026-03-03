import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RakebackType } from '../../domain/rakeback/enums/rakeback-type.enum.js';
import { OpenClaimWindowUseCase } from '../../application/user/rakeback/use-cases/open-claim-window.use-case.js';
import { CloseClaimWindowUseCase } from '../../application/user/rakeback/use-cases/close-claim-window.use-case.js';

/**
 * Cron-driven scheduler for weekly and monthly rakeback windows.
 * All cron expressions are in UTC.  Contains zero business logic —
 * all decisions are delegated to the use-cases.
 */
@Injectable()
export class RakebackSchedulerWorker {
  private readonly logger = new Logger(RakebackSchedulerWorker.name);

  constructor(
    private readonly openWindowUseCase: OpenClaimWindowUseCase,
    private readonly closeWindowUseCase: CloseClaimWindowUseCase,
  ) {}

  // ── Weekly ─────────────────────────────────────────────────────────────────

  /** Saturday 07:00 UTC — open weekly claim window. */
  @Cron('0 7 * * 6', { timeZone: 'UTC' })
  async openWeeklyWindow(): Promise<void> {
    this.logger.log('⏰  Weekly window OPEN cron fired');
    await this.openWindowUseCase.execute({ type: RakebackType.WEEKLY });
  }

  /** Sunday 07:00 UTC — close weekly window and reset missed streaks. */
  @Cron('0 7 * * 0', { timeZone: 'UTC' })
  async closeWeeklyWindow(): Promise<void> {
    this.logger.log('⏰  Weekly window CLOSE cron fired');
    await this.closeWindowUseCase.execute({ type: RakebackType.WEEKLY });
  }

  // ── Monthly ────────────────────────────────────────────────────────────────

  /** 1st of month 07:00 UTC — open monthly claim window. */
  @Cron('0 7 1 * *', { timeZone: 'UTC' })
  async openMonthlyWindow(): Promise<void> {
    this.logger.log('⏰  Monthly window OPEN cron fired');
    await this.openWindowUseCase.execute({ type: RakebackType.MONTHLY });
  }

  /** 2nd of month 07:00 UTC — close monthly window and reset missed streaks. */
  @Cron('0 7 2 * *', { timeZone: 'UTC' })
  async closeMonthlyWindow(): Promise<void> {
    this.logger.log('⏰  Monthly window CLOSE cron fired');
    await this.closeWindowUseCase.execute({ type: RakebackType.MONTHLY });
  }
}

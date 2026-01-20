import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { BalanceProvider } from './providers/balance.provider';
import { BALANCE_PROVIDER } from './providers/balance.tokens';
import { hashCode } from 'src/admin/kinguin/domain/kinguin-code.generator';
import { RedeemResult } from './contracts/redeem-result.contract';

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    @Inject(BALANCE_PROVIDER)
    private readonly provider: BalanceProvider
  ) {}

  async redeemKinguinCode(
    username: string,
    code: string,
  ): Promise<RedeemResult> {
    this.logger.log(`Attempting to redeem Kinguin code for user ${username}`);

    try {
      const hashedCode = hashCode(code);

      // Redeem the code
      const [newBalance, codeAmount] = await this.provider.redeemKinguinCode(
        username,
        hashedCode,
      );

      this.logger.log(`Kinguin code redeemed successfully. Username: ${username}, Amount: ${codeAmount}, NewBalance: ${newBalance}`);

      return {
        success: true,
        message: `Successfully redeemed Kinguin code for ${codeAmount} balance.`,
        newBalance,
      };
    } catch (err) {
      if (
        err instanceof UnauthorizedException ||
        err instanceof BadRequestException
      ) throw err;

      this.logger.error(
        `Unexpected error while redeeming Kinguin code for user ${username}`,
        err.stack,
      );
      throw new InternalServerErrorException(
        'Something went wrong while redeeming the Kinguin code. Please try again later.',
      );
    }
  }
}

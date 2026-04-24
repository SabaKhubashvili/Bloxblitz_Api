import { Injectable } from '@nestjs/common';
import type { IKinguinRedemptionLogRepository } from '../../../../domain/kinguin/ports/kinguin-redemption-log.repository.port';

@Injectable()
export class PrismaKinguinRedemptionLogRepository implements IKinguinRedemptionLogRepository {
  // Redemption log creation is handled inside PrismaKinguinCodeRepository.redeemCode
}

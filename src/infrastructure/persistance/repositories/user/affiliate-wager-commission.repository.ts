import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ApplyAffiliateWagerCommissionInput,
  ApplyAffiliateWagerCommissionResult,
  IAffiliateWagerCommissionRepository,
} from '../../../../domain/referral/ports/affiliate-wager-commission.repository.port';

@Injectable()
export class PrismaAffiliateWagerCommissionRepository
  implements IAffiliateWagerCommissionRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async applyCommissionIfNew(
    input: ApplyAffiliateWagerCommissionInput,
  ): Promise<ApplyAffiliateWagerCommissionResult> {
    const wager = new Prisma.Decimal(input.wagerAmount);
    const commission = new Prisma.Decimal(input.commissionAmount);

    return this.prisma.$transaction(async (tx) => {
      const inserted = await tx.referralLog.createMany({
        data: [
          { 
            referredUsername: input.bettorUsername,
            game: input.game,
            amount: wager,
            referrerShare: commission,
            referrerCode: input.referralCode,
          },
        ],
        skipDuplicates: true,
      });

      if (inserted.count === 0) {
        return 'duplicate';
      }

      await tx.referral.updateMany({
        where: {
          userUsername: input.referrerUsername,
          referralCode: input.referralCode,
        },
        data: {
          claimableAmount: { increment: commission },
          totalGenerated: { increment: commission },
          lastActivity: new Date(),
        },
      });

    
      return 'applied';
    });
  }
}

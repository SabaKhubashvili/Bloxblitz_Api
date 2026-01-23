import { Injectable, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { IncrementReferralEarnedDto } from './dto/increment-referral-earned.dto';

@Injectable()
export class InternalReferralService {
  private readonly logger = new Logger(InternalReferralService.name);

  constructor(private readonly prisma: PrismaClient) {}

  async incrementReferralEarned(
    data: IncrementReferralEarnedDto,
  ): Promise<void> {
    try {
      const { referredUsername, amount, source } = data;

      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { username: referredUsername },
          select: {
            username: true,
            referedBy: true,
          },
        });

        if (!user?.referedBy || amount <= 0) {
          return;
        }

        // 2️⃣ Get referral info
        const referral = await tx.referral.findUnique({
          where: { referralCode: user.referedBy },
          select: {
            referralCode: true,
            commissionRate: true,
            totalGenerated: true,
          },
        });

        if (!referral || referral.totalGenerated.toNumber() >= 100) {
          return;
        }

        // 3️⃣ Calculate commission (respect cap)
        const commission = amount * referral.commissionRate.toNumber();
        const availableCap = 100 - referral.totalGenerated.toNumber();
        const finalCommission = Math.min(commission, availableCap);

        if (finalCommission <= 0) {
          return;
        }

        // 4️⃣ Update referral totals
        await tx.referral.update({
          where: { referralCode: referral.referralCode },
          data: {
            totalGenerated: {
              increment: finalCommission,
            },
            claimableAmount: {
              increment: finalCommission,
            },
          },
        });

        // 5️⃣ Log referral earning
        await tx.referralLog.create({
          data: {
            referrerCode: referral.referralCode,
            referredUsername: user.username,
            game: source,
            amount: new Prisma.Decimal(finalCommission),
          },
        });
      });
    } catch (error) {
      this.logger.error(
        `Failed to increment referral earned for ${data.referredUsername}`,
        error.stack,
      );
    }
  }
}

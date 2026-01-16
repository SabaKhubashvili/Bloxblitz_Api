import { PrismaService } from 'src/prisma/prisma.service';
import { BalanceProvider } from './balance.provider';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { KinguinCodeStatus } from '@prisma/client';
import { UserRepository } from 'src/user/user.repository';

@Injectable()
export class RemoteBalanceProvider implements BalanceProvider {
  private readonly logger = new Logger(RemoteBalanceProvider.name);

  constructor(private readonly prisma: PrismaService, private readonly userRepository: UserRepository) {}

  /**
   * Checks if a Kinguin code is available for redemption
   */
  async checkKinguinCodeAvailability(username: string, code: string): Promise<boolean> {
    try {
      this.logger.log(`Checking Kinguin code for user ${username}: ${code}`);

      // Single query with all checks
      const codeRecord = await this.prisma.kinguinPromoCode.findFirst({
        where: {
          code,
          redeemedBy: null,
          isRedeemed: false,
          status: KinguinCodeStatus.UNUSED,
        },
      });

      if (!codeRecord) {
        this.logger.warn(`Invalid or already redeemed code: ${code}`);
        throw new BadRequestException(
          'This Kinguin code is invalid or has already been redeemed.'
        );
      }

      this.logger.log(`Kinguin code is valid: ${code}`);
      return true;
    } catch (error) {
      this.logger.error(`Error checking Kinguin code for user ${username}`, error.stack);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Failed to check Kinguin code. Try again later.');
    }
  }

  /**
   * Redeem the code and increment user balance in a single transaction
   */
async redeemKinguinCode(username: string, code: string): Promise<[number, number]> {
  try {
    this.logger.log(`Redeeming Kinguin code for user ${username}: ${code}`);

    const result = await this.prisma.$transaction(async (prisma) => {
      // Use raw SQL to select and lock the code row for update
      const codeRecord = await prisma.$queryRaw<
        { id: number; value: number }[]
      >`
        SELECT id, value
        FROM "KinguinPromoCode"
        WHERE code = ${code} 
          AND "isRedeemed" = false
          AND "redeemedBy" IS NULL
          AND status = ${KinguinCodeStatus.UNUSED}
        FOR UPDATE
      `;

      if (codeRecord.length === 0) {
        this.logger.warn(`Code not valid or already redeemed: ${code}`);
        throw new BadRequestException('Invalid or already redeemed code!');
      }

      const { id: codeId, value: codeValue } = codeRecord[0];

      // Increment user balance using raw query
      const updatedUser = await this.userRepository.processDeposit(username, codeValue);
      

      if (!updatedUser) {
        throw new BadRequestException('User not found while redeeming code.');
      }

      // Mark code as redeemed
      await prisma.$executeRaw`
        UPDATE "KinguinPromoCode"
        SET "isRedeemed" = true,
            "redeemedBy" = ${username},
            "redeemedAt" = NOW(),
            status = ${KinguinCodeStatus.REDEEMED}
        WHERE id = ${codeId}
      `;

      await prisma.kinguinRedemptionLog.create({
        data: {
          codeId:codeId.toString(),
          userUsername: username,
          creditAmount: codeValue,
          creditsAfter: updatedUser,
          creditsBefore: updatedUser - codeValue,
          userAgent: 'N/A',
          ipAddress: 'N/A',
          redeemedAt: new Date(),
        },
      });

      return [updatedUser as number, codeValue] as [number, number];
    });

    this.logger.log(`Code redeemed successfully for user ${username}: ${code}`);
    return result;
  } catch (error) {
    this.logger.error(`Error redeeming Kinguin code for user ${username}`, error.stack);
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('Failed to redeem Kinguin code. Try again later.');
  }
}

}

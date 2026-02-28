import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisKeys } from 'src/provider/redis/redis.keys';
import { RedisService } from 'src/provider/redis/redis.service';
import { getRakebackRate } from 'src/public/modules/leveling/utils/levelToRakeback';

@Injectable()
export class PrivateRakebackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async processRakebackForUser(username: string, wagerAmount: number) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        throw new InternalServerErrorException('User not found');
      }

      const totalRakeback = wagerAmount * getRakebackRate(user.currentLevel);

      const dailyShare = totalRakeback * 0.5;
      const weeklyShare = totalRakeback * 0.3;
      const monthlyShare = totalRakeback * 0.2;

      await this.prisma.userRakeback.update({
        where: { userUsername: user.username },
        data: {
          dailyAccrued: { increment: dailyShare },
          weeklyAccrued: { increment: weeklyShare },
          monthlyAccrued: { increment: monthlyShare },
        },
      });

      // Optionally, you can also update the cache if you're caching user data
      const cacheKey = RedisKeys.user.rakeback.user(user.username);
      await this.redis.del(cacheKey);
    } catch (error) {
      console.error('Error processing rakeback:', error);
      throw new InternalServerErrorException('Failed to process rakeback');
    }
  }
}

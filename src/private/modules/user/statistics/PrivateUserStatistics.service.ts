import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetCoinflipWagerDto } from './dto/get-coinflip-wager.dto';

@Injectable()
export class PrivateUserStatisticsService {
  constructor(private readonly prismaService: PrismaService) { }

  getUserWager(username: string) {
    return this.prismaService.userStatistics.findUnique({
      where: { userUsername: username },
      select: { totalWagered: true },
    });
  }
  async incrementTotalWager(username: string, amount: number) {
    await this.prismaService.userStatistics.update({
      where: { userUsername: username },
      data: {
        totalWagered: {
          increment: amount,
        },
      },
    });
  }
  async getUserLevel(username: string) {
    const userLevel = await this.prismaService.user.findUnique({
      where: { username },
      select: { currentLevel: true },
    });
    if (!userLevel) {
      throw new NotFoundException('User statistics not found');
    }
    return { userLevel: userLevel.currentLevel };
  } 
}

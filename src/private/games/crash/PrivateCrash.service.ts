import { Injectable } from '@nestjs/common';
import { GameType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SaveCrashRoundDto } from './dto/save-round.dto';
import { UpdateChainDto } from './dto/update-chain.dto';
import { UpdateCrashRoundDto } from './dto/update-round.dto';

@Injectable()
export class PrivateCrashService {
  constructor(private readonly prisma: PrismaService) {}

  async getLastActiveCrashChain() {
    return this.prisma.hashChain.findFirst({
      where: {
        gameType: GameType.CRASH,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
  async getPrecalculatedRound(chainId: string, roundNumber: number) {
    return this.prisma.crashRound.findFirst({
      where: {
        chainId,
        roundNumber,
      },
    });
  }
  async getChainById(chainId: string) {
    return this.prisma.hashChain.findUnique({
      where: {
        chainId: chainId,
        gameType: GameType.CRASH,
      },
    });
  }
  async saveRound(data: SaveCrashRoundDto) {
    return this.prisma.crashRound.create({
      data: {
        chainId: data.chainId,
        roundNumber: data.roundNumber,
        gameHash: data.gameHash,
        crashPoint: data.crashPoint,
        clientSeed: data.clientSeed,
      },
      select: {
        roundNumber: true,
        crashPoint: true,
        gameHash: true,
      },
    });
  }
  async updateChain(data: UpdateChainDto) {
    return this.prisma.hashChain.update({
      where: {
        chainId: data.chainId,
      },
      data: {
        currentRound: data.roundNumber,
      },
    });
  }
  async updateRound(data: UpdateCrashRoundDto) {
    return this.prisma.crashRound.updateMany({
      where: {
        chainId: data.chainId,
        roundNumber: data.roundNumber,
      },
      data: {
        totalBets: data.totalBets,
        totalPayout: data.totalPayout,
        totalWagered: data.totalWagered,
      },
    });
  }
  async GetCrashHistoryByHash(gameHash: string, chainId: string) {
    return this.prisma.crashRound.findFirst({
      where: {
        gameHash: gameHash,
        chainId,
      },
      include: {
        chain: true,
      },
    });
  }
}

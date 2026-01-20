import { Injectable } from '@nestjs/common';
import { GameType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisKeys } from 'src/provider/redis/redis.keys';
import { RedisService } from 'src/provider/redis/redis.service';

@Injectable()
export class SharedUserGamesService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async getActiveGames(username: string):Promise<{gameType:GameType,gameId:string}[]> {
    const key = RedisKeys.user.games.active(username);
    const games = await this.redis.mainClient.get(key);
    if (!games) {
      const games = await this.prisma.gameHistory.findMany({
        where: { userUsername: username, outcome: 'PLAYING' },
        select: { gameType: true, gameId: true },
      });
      await this.redis.mainClient.set(key, JSON.stringify(games), { EX: 300 });
      return games;
    }
    return JSON.parse(games);
  }
  async deleteActiveGamesCache(username: string) {
    const key = RedisKeys.user.games.active(username);
    await this.redis.mainClient.del(key);
  }
  async removeActiveGame(username: string, gameId: string) {
    const activeGames = await this.getActiveGames(username);
    const updatedGames = activeGames.filter(
      (game: any) => game.gameId !== gameId,
    );
    const key = RedisKeys.user.games.active(username);
    await this.redis.mainClient.set(key, JSON.stringify(updatedGames));
  }
  async addActiveGame(username: string, game: {gameId:string,gameType:GameType}) {
    const activeGames = await this.getActiveGames(username);
    activeGames.push(game);
    const key = RedisKeys.user.games.active(username);
    await this.redis.mainClient.set(key, JSON.stringify(activeGames));
  }
}

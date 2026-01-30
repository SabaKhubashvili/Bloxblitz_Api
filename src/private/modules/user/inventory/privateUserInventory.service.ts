import { PrismaService } from 'src/prisma/prisma.service';
import { GetInventoryDto } from './dto/get-inventory.dto';
import { Injectable } from '@nestjs/common';


@Injectable()
export class PrivateUserInventoryService {
  constructor(private readonly prismaService: PrismaService) { }

  getUserInventory(data:GetInventoryDto) {
    return this.prismaService.userInventoryAmp.findMany({
      where: {
        userUsername: data.username,
        id: { in: data.itemIds },
        state: data.state || 'IDLE',
        Bot: {
          active: true,
          banned: false,
        },
        value:{
          gte: data.valueGte || 0,
        }
      },
      select: {
        id: true,
        petVariant: true,
        value: true,
        pet: {
          select: {
            name: true,
            rarity: true,
            image: true,
          },
        },
      },
    });
  }
  async getUserAllItems(username: string) {
    return this.prismaService.userInventoryAmp.findMany({
      where: {
        userUsername: username,
        Bot: {
          active: true,
          banned: false,
        },
      },
      select: {
        id: true,
        petVariant: true,
        value: true,
        state: true,
        pet: {
          select: {
            name: true,
            rarity: true,
            image: true,
          },
        },
      },
    });
  } 
  async updateItemState(
    itemId: number[],
    newState: 'IDLE' | 'BATTLING',
    username?: string,
  ) {
    await this.prismaService.userInventoryAmp.updateMany({
      where: {
        userUsername: username,
        id: {
          in: itemId,
        },
      },
      data: { state: newState, updatedAt: new Date(), },
    });
  }
  async giveItemsToUser(username: string, itemIds: number[]) {
    await this.prismaService.userInventoryAmp.updateMany({
      where: {
        id: {
          in: itemIds,
        },
      },
      data: {
        userUsername: username,
        state: 'IDLE',
        updatedAt: new Date(),
      },
    });
  }

  async cancelWithdraw(username: string): Promise<{
    success: boolean;
    count: number;
  }> {
    const updatedInventory =
      await this.prismaService.userInventoryAmp.updateManyAndReturn({
        where: {
          userUsername: username,
          state: 'WITHDRAWING',
        },
        data: {
          state: 'IDLE',
        },
        select: {
          id: true,
        },
      });

    return {
      success: true,
      count: updatedInventory.length,
    };
  }

   /**
   * Resolves item ownership after a battle/coinflip
   */
  async resolveCoinflipItems(params: {
    winner: { username: string };
    loser: { username: string };
    winnerItemIds: number[];
    loserToWinnerIds: number[];
    houseItems: number[];
  }) {
    const {
      winner,
      loser,
      winnerItemIds,
      loserToWinnerIds,
      houseItems,
    } = params;

    await this.prismaService.$executeRaw`
      UPDATE "UserInventory"
      SET 
        "userUsername" = CASE 
          WHEN id = ANY(${winnerItemIds}::int[]) THEN ${winner.username}
          WHEN id = ANY(${loserToWinnerIds}::int[]) THEN ${winner.username}
          WHEN id = ANY(${houseItems}::int[]) THEN 'damaluliwignaki'
          ELSE "userUsername"
        END,
        "state" = 'IDLE'::"UserInventoryItemState"
      WHERE 
        (id = ANY(${winnerItemIds}::int[]) AND "userUsername" = ${winner.username})
        OR (id = ANY(${loserToWinnerIds}::int[]) AND "userUsername" = ${loser.username})
        OR (id = ANY(${houseItems}::int[]) AND "userUsername" = ${loser.username});
    `;
  }


}

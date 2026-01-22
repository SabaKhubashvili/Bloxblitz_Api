import { Body, Post } from '@nestjs/common';
import { InternalController } from 'src/private/decorator/InternalController.decorator';
import { PrivateUserInventoryService } from './privateUserInventory.service';
import { GetInventoryDto } from './dto/get-inventory.dto';
import { SeedManagementService } from 'src/public/games/seed-managment/seed-managment.service';
import { UpdateItemStateDto } from './dto/update-item-state';
import { GiveItemsDto } from './dto/give-items.dto';
import { ResolveCoinflipItemsDto } from './dto/resolve-coinflip-items.dto';

@InternalController('user/inventory')
export class PrivateUserInventoryController {
  constructor(
    private readonly privateUserInventoryService: PrivateUserInventoryService,
    private readonly seedService: SeedManagementService,
  ) { }

  @Post('/get')
  async getInventory(@Body() dto: GetInventoryDto) {
    const inventory = await this.privateUserInventoryService.getUserInventory(
      dto.username,
      dto.itemIds,
    );
    return {
      inventory: inventory,
    };
  }
  @Post('/get-all')
  async getAllItems(@Body() dto: { username: string }) {
    const items = await this.privateUserInventoryService.getUserAllItems(
      dto.username,
    );
    return {
      items: items,
    };
  }

  @Post('/seed-and-items')
  async getSeedAndItems(@Body() dto: GetInventoryDto) {
    try {
      const seed = await this.seedService.getUserSeed(dto.username);
      const inventory = await this.privateUserInventoryService.getUserInventory(
        dto.username,
        dto.itemIds,
      );
      return {
        client_seed: seed.activeClientSeed,
        inventory: inventory,
      };
    } catch (error) {
      throw error;
    }
  }
  @Post('/update-item-state')
  async updateItemState(@Body() dto: UpdateItemStateDto) {
    return this.privateUserInventoryService.updateItemState(
      dto.username,
      dto.itemId,
      dto.newState,
    );
  }
  @Post('/give-items')
  async giveItems(@Body() dto: GiveItemsDto) {
    return this.privateUserInventoryService.giveItemsToUser(
      dto.username,
      dto.itemIds,
    );
  }
  @Post('/cancel-withdraw')
  async cancelWithdraw(@Body() dto: { username: string }) {
    return this.privateUserInventoryService.cancelWithdraw(dto.username);
  }
  @Post('/resolve-coinflip-items')
  async resolveCoinflipItems(@Body() dto: ResolveCoinflipItemsDto) {
    return this.privateUserInventoryService.resolveCoinflipItems(dto);
  }
}

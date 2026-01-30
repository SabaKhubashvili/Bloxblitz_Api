
import { PrivateCoinflipHistoryService } from "./PrivateCoinflipHistory.service";
import { Body, Post } from "@nestjs/common";
import { SaveCoinflipGameDto } from "./dto/save-coinflip-game.dto";
import { InternalController } from "../../decorator/InternalController.decorator";


@InternalController('coinflip/history')
export class PrivateCoinflipHistoryController {
  constructor(private readonly historyService: PrivateCoinflipHistoryService) {}

  @Post('save')
  async saveGameInHistory(@Body() body: SaveCoinflipGameDto): Promise<void> {
    return this.historyService.saveGameInHistory(body);
  } 
}
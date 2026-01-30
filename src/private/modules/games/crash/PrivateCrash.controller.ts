import { Body, Get, Post, Query } from '@nestjs/common';
import { PrivateCrashService } from './PrivateCrash.service';
import { GetPrecalculatedRoundDto } from './dto/get-precalculated-round.dto';
import { GetChainByIdDto } from './dto/get-chain-by-id.dto';
import { UpdateChainDto } from './dto/update-chain.dto';
import { SaveCrashRoundDto } from './dto/save-round.dto';
import { UpdateCrashRoundDto } from './dto/update-round.dto';
import { GetCrashHistoryByHashDto } from './dto/get-history-by-hash.dto';
import { InternalController } from '../decorator/InternalController.decorator';

@InternalController('crash')
export class PrivateCrashController {
  constructor(private readonly privateCrashService: PrivateCrashService) {}

  @Get('last-active-chain')
  async getLastActiveChain() {
    return this.privateCrashService.getLastActiveCrashChain();
  }

  @Get('precalculated-round')
  async getPrecalculatedRound(
    @Query() { chainId, roundNumber }: GetPrecalculatedRoundDto,
  ) {
    return this.privateCrashService.getPrecalculatedRound(chainId, roundNumber);
  }
  @Get('chain-by-id')
  async getChainById(@Query() data: GetChainByIdDto) {
    return this.privateCrashService.getChainById(data.chainId);
  }
  @Get('by-hash')
    async getByHash(@Query() data: GetCrashHistoryByHashDto) { 
    return this.privateCrashService.GetCrashHistoryByHash(data.gameHash, data.chainId);
    }
  @Post('save-round')
  async saveRound(@Body() data: SaveCrashRoundDto) {
    return this.privateCrashService.saveRound(data);
  }
  @Post('update-round')
    async updateRound(@Body() data: UpdateCrashRoundDto) {
    return this.privateCrashService.updateRound(data);
    }
  @Post('update-chain')
  async updateChain(@Body() data: UpdateChainDto) {
    return this.privateCrashService.updateChain(data);
  }
}

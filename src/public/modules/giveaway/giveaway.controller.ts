import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { GiveawayService } from './giveaway.service';
import { AddNewGiveawayDto } from './dto/add-new-giveaway.dto';
import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from 'src/middleware/jwt.middleware';
import { JwtOptionalGuard, type OptionalAuthenticatedRequest } from 'src/middleware/JWTOptionalGuard.middleawre';

@Controller('giveaway')
export class GiveawayController {
  constructor(private readonly giveawayService: GiveawayService) {}

  @Get('get')
  @UseGuards(JwtOptionalGuard)
  async getStatus(@Request() req: OptionalAuthenticatedRequest) {
    return this.giveawayService.getActiveGiveaways(req.user);
  }
  @Post('add')
  @UseGuards(JwtAuthGuard)
  async addGiveaway(
    @Body() data: AddNewGiveawayDto,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!req.user || req.user.role !== 'OWNER') {
      throw new BadRequestException('Unauthorized');
    }

    return this.giveawayService.addGiveaway(data);
  }
  @Post('join')
  @UseGuards(JwtAuthGuard)
  async joinGiveaway(
    @Body('giveawayId') giveawayId: number,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.giveawayService.joinGiveaway(req.user.username, giveawayId);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SeedManagementService } from './seed-managment.service';
import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from 'src/middleware/jwt.middleware';
import { RotateClientSeedDto } from './dto/rotate-client-seed.dto';

@Controller('fairness/seeds')
export class SeedManagementController {
  private readonly logger = new Logger(SeedManagementController.name);
  constructor(private readonly seedManagementService: SeedManagementService) {}

  @Get('info')
  @UseGuards(JwtAuthGuard)
  async getSeedManagementInfo(@Request() req: AuthenticatedRequest) {
    try {
      const data = await this.seedManagementService.getPublicSeedInfo(
        req.user.username,
      );
      return {
        serverSeedHash: data.serverSeedHash,
        nextServerSeedHash: data.nextServerSeedHash,
        clientSeed: data.clientSeed,
        totalGamesPlayed: data.totalGamesPlayed,
        activeGames: data.activeGames,
      };
    } catch (err) {
      this.logger.error('Error fetching seed management info', err);
      return {
        serverSeedHash: null,
        nextServerSeedHash: null,
        clientSeed: null,
        totalGamesPlayed: 0,
      };
    }
  }
  @Post('rotate')
  @UseGuards(JwtAuthGuard)
  async rotateClientSeed(
    @Request() req: AuthenticatedRequest,
    @Body() body: RotateClientSeedDto,
  ) {
    try {
      const result = await this.seedManagementService.rotateSeed(
        req.user.username,
        body.newClientSeed,
        'MANUAL',
      );
      return {
        success: true,
        clientSeed: result.newClientSeed,
        serverSeedHash: result.newServerSeedHash,
        nextServerSeedHash: result.nextServerSeedHash,
        totalGamesPlayed: result.gamesPlayed,
        message: 'Client seed rotated successfully',
      };
    } catch (err) {
      this.logger.error('Error rotating client seed', err);
      throw new BadRequestException('Failed to rotate client seed');
    }
  }
}

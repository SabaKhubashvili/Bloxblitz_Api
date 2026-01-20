
// ===================================
// giveaway/giveaway.controller.ts - Admin endpoints
// ===================================
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GiveawayService } from './giveaway.service';
import { GiveawayCronService } from './giveaway-cron/giveaway-cron.service';
// import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('giveaway')
export class GiveawayController {
  constructor(
    private readonly giveawayService: GiveawayService,
    private readonly cronService: GiveawayCronService,
  ) {}


  // Manual trigger for winner selection (admin only)
  @Post('admin/trigger-winner-selection')
  // @UseGuards(AdminGuard)
  async triggerWinnerSelection() {
    return this.cronService.triggerWinnerSelection();
  }

  // Get cron job status (admin only)
  @Get('admin/cron-status')
  // @UseGuards(AdminGuard)
  getCronStatus() {
    return this.cronService.getCronJobStatus();
  }

  // Stop cron job (admin only)
  @Post('admin/stop-cron')
  // @UseGuards(AdminGuard)
  stopCron() {
    this.cronService.stopCronJob();
    return { message: 'Cron job stopped' };
  }

  // Start cron job (admin only)
  @Post('admin/start-cron')
  // @UseGuards(AdminGuard)
  startCron() {
    this.cronService.startCronJob();
    return { message: 'Cron job started' };
  }
}
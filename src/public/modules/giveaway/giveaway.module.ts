import { Module } from '@nestjs/common';
import { GiveawayCronService } from './giveaway-cron/giveaway-cron.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { GiveawayController } from './giveaway.controller';
import { GiveawayService } from './giveaway.service';

@Module({
  providers: [GiveawayCronService,PrismaService,GiveawayService],
  controllers:[GiveawayController]
})
export class GiveawayModule {}

import { Module } from '@nestjs/common';
import { GiveawayCronService } from './giveaway-cron/giveaway-cron.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  providers: [GiveawayCronService,PrismaService],
})
export class GiveawayModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../persistance/prisma/prisma.module';
import { RedisModule } from '../cache/redis.module';
import { RouletteRestrictionBootstrapService } from './roulette-restriction-bootstrap.service';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [RouletteRestrictionBootstrapService],
})
export class RouletteRestrictionSyncModule {}

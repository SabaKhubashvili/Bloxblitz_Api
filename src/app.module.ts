import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';

import { AppController } from './app.controller';

import { RedisModule } from './infrastructure/cache/redis.module';
import { PrismaModule } from './infrastructure/persistance/prisma/prisma.module';
import { UserStatisticsBumpModule } from './infrastructure/persistance/user-statistics/user-statistics-bump.module';
import { WorkersModule } from './infrastructure/workers/workers.module';
import { GameSaveModule } from './infrastructure/queue/game-save/game-save.module';
import { MinesModule } from './modules/game/mines.module';
import { TowersModule } from './modules/game/towers.module';
import { DiceModule } from './modules/game/dice.module';
import { CaseModule } from './modules/game/case.module';
import { GameFairnessVerifyModule } from './modules/game/game-fairness-verify.module';
import { UserModule } from './modules/user/user.module';
import { LevelingModule } from './modules/user/statistics/leveling.module';
import { RakebackModule } from './modules/user/rakeback.module';
import { ProfileModule } from './modules/user/profile.module';
import { DailySpinModule } from './modules/rewards/daily-spin.module';
import { RewardCasesModule } from './modules/rewards/reward-cases.module';
import { BetHistoryModule } from './modules/game/bet-history.module';
import { TransactionModule } from './modules/user/transaction.module';
import { KinguinModule } from './modules/kinguin.module';
import { UniwireModule } from './modules/uniwire.module';
import { ProvablyFairModule } from './modules/user/provably-fair.module';
import { RaceModule } from './modules/race.module';
import { UserTrackingModule } from './infrastructure/user-tracking/user-tracking.module';
import { RouletteRestrictionSyncModule } from './infrastructure/roulette-restriction/roulette-restriction-sync.module';
import { AffiliateModule } from './modules/user/affiliate.module';
import { AffiliateWagerCommissionModule } from './infrastructure/queue/affiliate-wager/affiliate-wager-commission.module';
import { InternalMicroserviceModule } from './modules/internal-microservice.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL,
      },
    }),
    PrismaModule,
    UserStatisticsBumpModule,
    RedisModule,
    RouletteRestrictionSyncModule,
    GameSaveModule,
    AffiliateWagerCommissionModule,
    InternalMicroserviceModule,
    UserTrackingModule,
    WorkersModule,
    MinesModule,
    TowersModule,
    DiceModule,
    CaseModule,
    GameFairnessVerifyModule,
    UserModule,
    TransactionModule,
    LevelingModule,
    RakebackModule,
    ProfileModule,
    DailySpinModule,
    RewardCasesModule,
    BetHistoryModule,
    KinguinModule,
    UniwireModule,

    ProvablyFairModule,
    RaceModule,
    AffiliateModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

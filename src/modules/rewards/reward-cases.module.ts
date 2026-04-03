import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RewardCaseKeysService } from '../../application/rewards/reward-cases/reward-case-keys.service';
import { RewardCasesController } from '../../presentation/http/public/user/rewards/reward-cases/reward-cases.controller';
import { DiceBalanceLedgerAdapter } from '../../infrastructure/cache/adapters/dice-balance-ledger.adapter';
import { AuthModule } from '../auth.module';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';

@Module({
  imports: [AuthModule, JwtModule],
  controllers: [RewardCasesController],
  providers: [
    RewardCaseKeysService,
    DiceBalanceLedgerAdapter,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [RewardCaseKeysService],
})
export class RewardCasesModule {}

import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../persistance/prisma/prisma.module';
import { RedisModule } from '../cache/redis.module';
import { UserActivityService } from './user-activity.service';
import { UserActivityInterceptor } from './user-activity.interceptor';

@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [
    UserActivityService,
    {
      provide: APP_INTERCEPTOR,
      useClass: UserActivityInterceptor,
    },
  ],
  exports: [UserActivityService],
})
export class UserTrackingModule {}

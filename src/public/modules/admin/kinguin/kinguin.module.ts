import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { KinguinApiProvider } from './providers/kinguin-api.provider';
import { KINGUIN_PROVIDER } from './kinguin.tokens';
import { KinguinController } from './kinguin.controller';
import { KinguinService } from './kinguin.service';
import { ConfigService } from '@nestjs/config';

@Module({
  controllers: [KinguinController],
  providers: [
    KinguinService,
    PrismaService,
    KinguinApiProvider,
    ConfigService,
    {
      provide: KINGUIN_PROVIDER,
      useClass: KinguinApiProvider,
    },
  ],
  imports: [],
  exports: [],
})
export class KinguinModule {}

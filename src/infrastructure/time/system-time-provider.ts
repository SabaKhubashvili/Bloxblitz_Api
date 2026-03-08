import { Injectable } from '@nestjs/common';
import type { ITimeProvider } from '../../domain/rakeback/interfaces/time-provider.interface';

@Injectable()
export class SystemTimeProvider implements ITimeProvider {
  now(): Date {
    return new Date();
  }
}

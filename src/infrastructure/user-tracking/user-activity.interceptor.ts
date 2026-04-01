import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { UserActivityService } from './user-activity.service';
import { clientIpFromRequest } from './client-ip.util';
import type { JwtPayload } from '../../shared/guards/jwt-auth.guard';

@Injectable()
export class UserActivityInterceptor implements NestInterceptor {
  constructor(private readonly activity: UserActivityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req['user'] as JwtPayload | undefined;
    if (user?.username) {
      const ip = clientIpFromRequest(req);
      void this.activity.recordActivity(user.username, ip);
    }
    return next.handle();
  }
}

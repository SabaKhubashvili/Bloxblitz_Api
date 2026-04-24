import * as crypto from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class UniwireCallbackGuard implements CanActivate {
  private readonly UNIWIRE_CALLBACK_TOKEN = process.env.UNIWIRE_CALLBACK_TOKEN!;

  private encodeHmac(key: string, msg: string) {
    return crypto.createHmac('sha256', key).update(msg).digest('hex');
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const payload = req.body;

    if (!payload || typeof payload !== 'object') {
      throw new NotFoundException();
    }

    const signature = payload['signature'];
    const callbackId = payload['callback_id'];

    if (
      typeof signature !== 'string' ||
      typeof callbackId !== 'string' ||
      !signature ||
      !callbackId
    ) {
      throw new NotFoundException();
    }

    const isValid =
      signature === this.encodeHmac(this.UNIWIRE_CALLBACK_TOKEN, callbackId);

    if (!isValid) {
      throw new NotFoundException();
    }

    return true;
  }
}

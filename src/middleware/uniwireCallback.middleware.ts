import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import * as crypto from 'crypto';

@Injectable()
export class UniwireCallbackGuard implements CanActivate {
  private readonly UNIWIRE_CALLBACK_TOKEN =
    process.env.UNIWIRE_CALLBACK_TOKEN!;

  encode_hmac(key: string, msg: string) {
    return crypto.createHmac('sha256', key).update(msg).digest('hex');
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const req = context.switchToHttp().getRequest();
    console.log(req.body);
    
    const payload = req.body;
    
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid request body');
    }
      
    const signature = payload['signature'];
    const callback_id = payload['callback_id'];
    
    if (!signature || !callback_id) {
      throw new Error('Missing signature or callback_id in request');
    }
    
    const is_valid =
      signature === this.encode_hmac(this.UNIWIRE_CALLBACK_TOKEN, callback_id);
      
    if (!is_valid) {
      throw new Error('Failed to verify Uniwire callback signature.');
    }
    
    return true;
  }
}
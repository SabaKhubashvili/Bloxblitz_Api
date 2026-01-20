import { Get } from '@nestjs/common';
import { InternalController } from '../decorator/InternalController.decorator';

@InternalController('user')
export class PrivateUserController {
  constructor() {}

  @Get('')
  getUserInfo() {
    return { message: 'Private User Info' };
  }
}

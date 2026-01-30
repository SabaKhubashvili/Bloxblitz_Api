import { Body, Controller, Post } from '@nestjs/common';
import { InternalController } from '../games/decorator/InternalController.decorator';
import { InternalReferralService } from './InternalReferral.service';
import { IncrementReferralEarnedDto } from './dto/increment-referral-earned.dto';

@InternalController('referrals')
export class InternalReferralsController {
  constructor(
    private readonly referralService: InternalReferralService,
  ) {}

  @Post('earned/increment')
  async incrementReferralCount(@Body() body: IncrementReferralEarnedDto) {
    return this.referralService.incrementReferralEarned(body);
  }
}

import { Module } from "@nestjs/common";
import { InternalReferralService } from "./InternalReferral.service";
import { InternalReferralsController } from "./InernalReferral.controller";

@Module({
    imports: [InternalReferralService],
    controllers: [InternalReferralsController],
    exports: [InternalReferralService],
    
})
export class ReferralModule {}
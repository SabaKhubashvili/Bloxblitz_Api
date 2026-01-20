import { Module } from "@nestjs/common";
import { ProvablyFairController } from "./private-provably-fair.controller";
import { SharedUserProvablyFairService } from "src/shared/user/provably-fair/shared-user-provably-fair.service";

@Module({
    imports:[],
    providers:[SharedUserProvablyFairService],
    controllers:[ProvablyFairController]
})
export class PrivateProvablyFairModule {}
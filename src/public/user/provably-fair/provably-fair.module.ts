import { Module } from "@nestjs/common";
import { ProvablyFairController } from "./provably-fair.controller";

@Module({
    imports: [],
    controllers:[ProvablyFairController],
})
export class ProvablyFairModule {}
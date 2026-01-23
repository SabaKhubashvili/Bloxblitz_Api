import { Module } from "@nestjs/common";
import { PrivateCrashService } from "./PrivateCrash.service";
import { PrivateCrashController } from "./PrivateCrash.controller";


@Module({
    imports: [],
    controllers:[PrivateCrashController],
    providers:[PrivateCrashService],
    exports:[PrivateCrashService],
})
export class PrivateCrashModule {}
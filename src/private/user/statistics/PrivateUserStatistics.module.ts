import { Module } from "@nestjs/common";
import { PrivateUserStatisticsController } from "./PrivateUserStatistics.controller";
import { PrivateUserStatisticsService } from "./PrivateUserStatistics.service";


@Module({
    controllers:[PrivateUserStatisticsController],
    providers:[PrivateUserStatisticsService],
})
export class PrivateUserStatisticsModule {}
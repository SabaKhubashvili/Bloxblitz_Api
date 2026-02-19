import { Module } from "@nestjs/common";
import { PrivateBetsController } from "./PrivateBets.controller";


@Module({
    controllers:[PrivateBetsController],
    providers:[],
})
export class PrivateBetsModule{}
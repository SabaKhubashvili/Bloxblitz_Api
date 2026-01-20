import { Module } from "@nestjs/common";
import { PrivateUserModule } from "./user/privateUser.module";

@Module({
    imports:[PrivateUserModule]
})
export class PrivateModule {}
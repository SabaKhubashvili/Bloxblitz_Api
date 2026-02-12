import { Module } from "@nestjs/common";
import { KinguinModule } from "./kinguin/kinguin.module";

@Module({
    imports: [KinguinModule],
})
export class AdminModule {}
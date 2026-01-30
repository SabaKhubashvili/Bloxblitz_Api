import { Module } from "@nestjs/common";
import { KinguinModule } from "./kinguin/kinguin.module";
import { UniwireModule } from "./uniwire/uniwire.module";

@Module({
    imports:[KinguinModule, UniwireModule]
})
export class IntegrationsModule {}
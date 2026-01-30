import { IsNotEmpty, IsString } from "class-validator";

export class getClientSeedDto {
    @IsNotEmpty()
    @IsString()
    username:string
}
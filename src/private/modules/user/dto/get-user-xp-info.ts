import { IsString, MaxLength } from "class-validator";

export class getUserXpInfoDto {
    @IsString()
    @MaxLength(32)
    username:string;
}
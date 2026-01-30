import { IsString, MaxLength } from "class-validator";

export class getUserWagerDto {
    @IsString()
    @MaxLength(32)
    username: string;
}
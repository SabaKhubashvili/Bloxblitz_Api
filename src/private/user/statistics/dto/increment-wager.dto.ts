import { IsNumber, IsString, MaxLength, Min } from "class-validator";

export class incrementUserWagerDto {
    @IsString()
    @MaxLength(32)
    username: string;

    @IsNumber()
    @Min(0)
    amount: number;
}
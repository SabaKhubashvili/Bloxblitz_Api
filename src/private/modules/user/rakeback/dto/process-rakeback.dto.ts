import { IsNumber, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class ProcessRakebackDto {
    @IsString()
    @MaxLength(32)
    @MinLength(3)
    username: string;

    @IsNumber()
    @Min(0.1)
    @Max(1000000)
    wagerAmount: number;
}
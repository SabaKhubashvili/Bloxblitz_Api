import { IsEnum, IsInt, IsNumber, Max, Min } from "class-validator";

import { AvailableGridSizes } from "../../../../../../domain/game/mines/entities/mines-game.entity";
import { Transform } from "class-transformer";

export class CreateMinesHttpDto {
    @IsNumber()
    @Min(0.01)
    betAmount: number;
  
    @IsInt()
    @Min(1)
    @Max(24)
    mineCount: number;

    @IsEnum(AvailableGridSizes)
    @Transform(({ value }) => {
        switch (value) {
            case "4x4":
            case "4X4":
                return 4;
            case "5x5":
            case "5X5":
                return 5;
            case "6x6":
            case "6X6":
                return 6;
            case "8x8":
            case "8X8":
                return 8;
            case "10x10":
            case "10X10":
                return 10;
            default:
                return Number(value);
        }
    })
    gridSize: AvailableGridSizes;
  }
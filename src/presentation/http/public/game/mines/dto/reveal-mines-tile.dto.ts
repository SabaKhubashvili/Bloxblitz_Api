import { IsInt, Max, Min } from "class-validator";

export class RevealTileHttpDto {
    @IsInt()
    @Min(0)
    @Max(99) // largest valid index for a 10×10 grid (100 total cells, 0-indexed)
    tileIndex: number;
  }
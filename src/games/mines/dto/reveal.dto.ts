
import { IsInt, Min, Max } from 'class-validator';

export class RevealTileDto {
  @IsInt()
  @Min(0)
  @Max(24)
  tile: number;
}

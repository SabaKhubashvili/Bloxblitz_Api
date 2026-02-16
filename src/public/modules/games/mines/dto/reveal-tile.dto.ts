
import { IsInt, Min, Max } from 'class-validator';

export class RevealTileDto {
  @IsInt()
  @Min(0)
  @Max(100)
  tile: number;
}

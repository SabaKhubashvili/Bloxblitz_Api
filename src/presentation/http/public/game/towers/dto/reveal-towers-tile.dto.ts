import { IsInt, Min } from 'class-validator';

export class RevealTowersTileHttpDto {
  @IsInt()
  @Min(0)
  rowIndex!: number;

  @IsInt()
  @Min(0)
  tileIndex!: number;
}

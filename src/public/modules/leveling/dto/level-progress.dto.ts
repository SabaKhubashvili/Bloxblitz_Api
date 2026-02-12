
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class LevelProgressResponseDto {
  @ApiProperty()
  currentLevel: number;

  @ApiProperty()
  xpInCurrentLevel: number;

  @ApiProperty()
  xpNeededForNextLevel: number;

  @ApiProperty()
  progressPercentage: number;

  @ApiProperty()
  totalXp: number;
}

export class LeaderboardQueryDto {
  @ApiProperty({ required: false, default: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 100;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}
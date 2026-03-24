import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class RaceRewardTierHttpDto {
  @IsInt()
  @Min(1)
  @Max(10)
  position!: number;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'rewardAmount must be a decimal string (e.g. 10 or 10.50)',
  })
  rewardAmount!: string;
}

export class CreateRaceHttpDto {
  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RaceRewardTierHttpDto)
  rewards!: RaceRewardTierHttpDto[];
}

export class WagerOnActiveRaceHttpDto {
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a positive decimal string' })
  amount!: string;
}


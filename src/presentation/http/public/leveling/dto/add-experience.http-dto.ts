import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { XpSource } from '../../../../../domain/leveling/enums/xp-source.enum.js';

export class AddExperienceHttpDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsEnum(XpSource)
  source!: XpSource;

  @IsOptional()
  @IsString()
  referenceId?: string;
}

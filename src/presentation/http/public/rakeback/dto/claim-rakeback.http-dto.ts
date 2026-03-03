import { IsEnum } from 'class-validator';
import { RakebackType } from '../../../../../domain/rakeback/enums/rakeback-type.enum.js';

export class ClaimRakebackParamDto {
  @IsEnum(RakebackType)
  type: RakebackType;
}

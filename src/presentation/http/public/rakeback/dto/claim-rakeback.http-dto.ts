import { IsEnum } from 'class-validator';
import { RakebackType } from '../../../../../domain/rakeback/enums/rakeback-type.enum';

export class ClaimRakebackParamDto {
  @IsEnum(RakebackType)
  type: RakebackType;
}

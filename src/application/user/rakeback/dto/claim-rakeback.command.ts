import type { RakebackType } from '../../../../domain/rakeback/enums/rakeback-type.enum';

export interface ClaimRakebackCommand {
  username: string;
  type: RakebackType;
}

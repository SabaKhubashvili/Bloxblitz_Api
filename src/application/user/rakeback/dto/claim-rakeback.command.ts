import type { RakebackType } from '../../../../domain/rakeback/enums/rakeback-type.enum.js';

export interface ClaimRakebackCommand {
  username: string;
  type: RakebackType;
}

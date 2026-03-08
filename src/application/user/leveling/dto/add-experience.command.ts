import type { XpSource } from '../../../../domain/leveling/enums/xp-source.enum';

export interface AddExperienceCommand {
  readonly username:     string;
  readonly amount:       number;
  readonly source:       XpSource;
  readonly referenceId?: string;
}

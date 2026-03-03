import type { XpSource } from '../../../../domain/leveling/enums/xp-source.enum.js';

export interface AddExperienceCommand {
  readonly username:     string;
  readonly amount:       number;
  readonly source:       XpSource;
  readonly referenceId?: string;
}

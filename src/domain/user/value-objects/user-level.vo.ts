/**
 * Lightweight value-object for a user's level as seen by the User bounded
 * context.  Full tier/XP logic lives in the Leveling bounded context.
 */
export class UserLevelVO {
  private constructor(private readonly _value: number) {}

  static of(raw: number): UserLevelVO {
    if (!Number.isInteger(raw) || raw < 0 || raw > 100) {
      throw new RangeError(`User level must be an integer between 0 and 100, got ${raw}`);
    }
    return new UserLevelVO(raw);
  }

  get value(): number {
    return this._value;
  }

  equals(other: UserLevelVO): boolean {
    return this._value === other._value;
  }
}

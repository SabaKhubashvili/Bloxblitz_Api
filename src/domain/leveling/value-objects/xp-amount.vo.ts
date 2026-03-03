/**
 * Immutable value-object representing a non-negative integer XP amount.
 * Fractional values are floored on construction.
 */
export class XpAmount {
  private constructor(private readonly _value: number) {}

  static of(raw: number): XpAmount {
    if (!Number.isFinite(raw) || raw < 0) {
      throw new RangeError(
        `XP amount must be a non-negative finite number, got ${raw}`,
      );
    }
    return new XpAmount(Math.floor(raw));
  }

  static zero(): XpAmount {
    return new XpAmount(0);
  }

  get value(): number {
    return this._value;
  }

  add(other: XpAmount): XpAmount {
    return new XpAmount(this._value + other._value);
  }

  equals(other: XpAmount): boolean {
    return this._value === other._value;
  }
}

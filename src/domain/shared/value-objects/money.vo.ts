/**
 * Immutable value object for monetary amounts.
 * Enforces non-negative values and 2-decimal precision.
 */
export class Money {
  readonly amount: number;

  constructor(amount: number) {
    if (isNaN(amount) || !isFinite(amount)) {
      throw new Error(`Invalid money amount: ${amount}`);
    }
    if (amount < 0) {
      throw new Error(`Money amount cannot be negative: ${amount}`);
    }
    this.amount = Math.round(amount * 100) / 100;
  }

  add(other: Money): Money {
    return new Money(this.amount + other.amount);
  }

  subtract(other: Money): Money {
    return new Money(this.amount - other.amount);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor);
  }

  isGreaterThan(other: Money): boolean {
    return this.amount > other.amount;
  }

  isGreaterThanOrEqual(other: Money): boolean {
    return this.amount >= other.amount;
  }

  equals(other: Money): boolean {
    return this.amount === other.amount;
  }

  toString(): string {
    return this.amount.toFixed(2);
  }
}

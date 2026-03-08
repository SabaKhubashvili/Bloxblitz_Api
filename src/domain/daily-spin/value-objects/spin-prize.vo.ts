export interface SpinPrizeProps {
  readonly label: string;
  readonly amount: number;
  readonly weight: number;
}

/**
 * Immutable value object representing a single prize slot on the wheel.
 * Equality is determined by structural value, not identity.
 */
export class SpinPrize {
  readonly label: string;
  readonly amount: number;
  readonly weight: number;

  private constructor(props: SpinPrizeProps) {
    this.label  = props.label;
    this.amount = props.amount;
    this.weight = props.weight;
  }

  static create(props: SpinPrizeProps): SpinPrize {
    if (props.amount <= 0)  throw new Error('Prize amount must be positive');
    if (props.weight <= 0)  throw new Error('Prize weight must be positive');
    if (!props.label.trim()) throw new Error('Prize label must not be empty');
    return new SpinPrize(props);
  }
}

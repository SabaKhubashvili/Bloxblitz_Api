import { randomUUID } from 'crypto';

export class EntityId {
  readonly value: string;

  constructor(value?: string) {
    this.value = value ?? randomUUID();
  }

  equals(other: EntityId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Immutable value object representing the set of mine positions on the grid.
 * The positions are stored as a set of tile indices (0-based).
 */
export class MineMask {
  private readonly positions: ReadonlySet<number>;

  constructor(positions: Set<number>) {
    this.positions = new Set(positions);
  }

  hasMineAt(tileIndex: number): boolean {
    return this.positions.has(tileIndex);
  }

  getPositions(): ReadonlySet<number> {
    return this.positions;
  }

  toArray(): number[] {
    return Array.from(this.positions).sort((a, b) => a - b);
  }

  get size(): number {
    return this.positions.size;
  }
}

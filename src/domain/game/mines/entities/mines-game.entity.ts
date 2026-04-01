import { EntityId } from '../../../shared/value-objects/entity-id.vo';
import { Money } from '../../../shared/value-objects/money.vo';
import { Result, Ok, Err } from '../../../shared/types/result.type';
import { MineMask } from '../value-objects/mine-mask.vo';
import { GameStatus } from '../value-objects/game-status.vo';
import {
  InvalidMineCountError,
  GameNotActiveError,
  InvalidTileIndexError,
  TileAlreadyRevealedError,
  NoTilesRevealedError,
  MinesError,
} from '../errors/mines.errors';

export interface CreateMinesGameParams {
  id?: string;
  username: string;
  profilePicture: string;
  betAmount: Money;
  mineCount: number;
  mineMask: MineMask;
  nonce: number;
  gridSize: number;
  /** House edge as a percentage (0–100), same as admin `mines:config`. */
  houseEdge: number;
  revealedTiles?: Set<number>;
  status?: GameStatus;
}

export interface RevealResult {
  isMine: boolean;
  multiplier: number;
}

export interface CashoutResult {
  profit: Money;
  multiplier: number;
}

export enum AvailableGridSizes {
  "4X4" = 4,
  "5X5" = 5,
  "6X6" = 6,
  "8X8" = 8,
  "10X10" = 10,
}
export class MinesGame {
  readonly id: EntityId;
  readonly username: string;
  readonly profilePicture: string;
  readonly betAmount: Money;
  readonly mineCount: number;
  private readonly mineMask: MineMask;
  private _status: GameStatus;
  private _revealedTiles: Set<number>;
  readonly nonce: number;
  readonly gridSize: number;
  private readonly houseEdge: number;

  private constructor(
    id: EntityId,
    username: string,
    betAmount: Money,
    profilePicture: string,
    mineCount: number,
    mineMask: MineMask,
    status: GameStatus,
    revealedTiles: Set<number>,
    nonce: number,
    gridSize: number,
    houseEdge: number,
  ) {
    this.id = id;
    this.username = username;
    this.profilePicture = profilePicture;
    this.betAmount = betAmount;
    this.mineCount = mineCount;
    this.mineMask = mineMask;
    this._status = status;
    this._revealedTiles = new Set(revealedTiles);
    this.nonce = nonce;
    this.gridSize = gridSize;
    this.houseEdge = houseEdge;
  }

  static create(params: CreateMinesGameParams): Result<MinesGame, MinesError> {
    if (params.mineCount < 1 || params.mineCount >= params.gridSize) {
      return Err(new InvalidMineCountError());
    }

    return Ok(
      new MinesGame(
        new EntityId(params.id),
        params.username,
        params.betAmount,
        params.profilePicture,
        params.mineCount,
        params.mineMask,
        params.status ?? GameStatus.ACTIVE,
        params.revealedTiles ?? new Set<number>(),
        params.nonce,
        params.gridSize,
        params.houseEdge,
      ),
    );
  }

  get status(): GameStatus {
    return this._status;
  }

  /** Admin-config style house edge percentage (0–100). */
  get houseEdgePercent(): number {
    return this.houseEdge;
  }

  get revealedTiles(): ReadonlySet<number> {
    return this._revealedTiles;
  }

  revealTile(tileIndex: number): Result<RevealResult, MinesError> {
    if (this._status !== GameStatus.ACTIVE) return Err(new GameNotActiveError());
    if (tileIndex < 0 || tileIndex >= this.gridSize) return Err(new InvalidTileIndexError());
    if (this._revealedTiles.has(tileIndex)) return Err(new TileAlreadyRevealedError());

    this._revealedTiles = new Set([...this._revealedTiles, tileIndex]);
    const isMine = this.mineMask.hasMineAt(tileIndex);

    if (isMine) {
      this._status = GameStatus.LOST;
    }

    return Ok({ isMine, multiplier: this.calculateMultiplier() });
  }

  cashout(): Result<CashoutResult, MinesError> {
    if (this._status !== GameStatus.ACTIVE) return Err(new GameNotActiveError());
    if (this._revealedTiles.size === 0) return Err(new NoTilesRevealedError());

    const multiplier = this.calculateMultiplier();
    const profit = this.betAmount.multiply(multiplier);
    this._status = GameStatus.WON;

    return Ok({ profit, multiplier });
  }

  /**
   * Computes the current payout multiplier.
   *
   * Formula: M = ∏(i=0 to r-1) [(n-i) / (n-m-i)] × (1 - houseEdge/100)
   * where n = gridSize, m = mineCount, r = safe tiles revealed so far.
   *
   * houseEdge is stored as an admin-config percentage (same as Redis `mines:config`).
   */
  calculateMultiplier(): number {
    const n = this.gridSize;
    const m = this.mineCount;
    const r = this._revealedTiles.size;

    if (r === 0) return 1;

    let multiplier = 1;
    for (let i = 0; i < r; i++) {
      multiplier *= (n - i) / (n - m - i);
    }

    const edgeFactor = 1 - this.houseEdge / 100;
    return Math.round(multiplier * edgeFactor * 10_000) / 10_000;
  }

  getMinePositions(): number[] {
    return this.mineMask.toArray();
  }

  isActive(): boolean {
    return this._status === GameStatus.ACTIVE;
  }
}

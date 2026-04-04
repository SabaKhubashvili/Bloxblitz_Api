import type { RewardCaseOpenRewardDto } from '../reward-case-keys.service';

// ── Command ───────────────────────────────────────────────────────────────────

/**
 * Input for executing a case-open database transaction.
 *
 * The reward item is resolved by the use-case (weighted roll) BEFORE
 * the transaction runs, keeping the repository free of business logic.
 */
export interface ExecuteOpenCommand {
  /** Username of the player opening the case. */
  readonly userUsername: string;

  /**
   * Slug of the case being opened.
   * Used inside the transaction to look up the case `id` (lightweight
   * unique-index scan) so the repository avoids a second round-trip.
   */
  readonly caseSlug: string;

  /** Pre-resolved reward item to persist. */
  readonly reward: RewardCaseOpenRewardDto;

  /**
   * Global cooldown window in milliseconds.
   * The transaction checks the DB as a fallback source of truth when the
   * Redis cooldown key is absent or stale.
   */
  readonly cooldownMs: number;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface ExecuteOpenResult {
  readonly caseSlug: string;
  readonly caseTitle: string;
}

// ── Port ──────────────────────────────────────────────────────────────────────

/**
 * Repository port for the case-open transaction.
 *
 * A single method wraps the entire multi-step DB write so it is
 * completely atomic — no partial state is ever committed.
 *
 * Implementations live in the infrastructure layer (Prisma adapter).
 */
export interface IRewardCaseOpenRepository {
  /**
   * Persists the open (DB transaction) and credits `reward.value` to the
   * user's live balance via `IncrementUserBalanceUseCase` in the Prisma
   * adapter (after the transaction commits).
   *
   * Throws `Error` with message codes on validation failure:
   *   - `'CASE_GLOBAL_COOLDOWN'`
   *   - `'REWARD_CASE_INSUFFICIENT_KEYS'`
   *   - `'REWARD_CASE_NOT_FOUND'`
   */
  executeOpen(cmd: ExecuteOpenCommand): Promise<ExecuteOpenResult>;
}

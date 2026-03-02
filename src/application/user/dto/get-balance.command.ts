/**
 * Input to the GetBalanceUseCase.
 * Constructed by the controller from the authenticated JWT payload.
 */
export interface GetBalanceCommand {
  /** The authenticated user's username (the domain identifier). */
  readonly username: string;
}

import { DomainError } from '../../shared/errors/domain.error';

export class ProvablyFairNotFoundError extends DomainError {
  readonly code = 'PROVABLY_FAIR_NOT_FOUND';

  constructor(username: string) {
    super(`Provably fair data not found for user: ${username}`);
  }
}

export class RotateClientSeedFailedError extends DomainError {
  readonly code = 'ROTATE_CLIENT_SEED_FAILED';

  constructor(message: string = 'Failed to rotate client seed') {
    super(message);
  }
}

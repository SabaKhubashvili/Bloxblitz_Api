import { Injectable, Inject } from '@nestjs/common';
import { Ok, Err } from '../../../domain/shared/types/result.type';
import { KinguinCodeNotFoundError } from '../../../domain/kinguin/errors/kinguin.errors';
import { KINGUIN_CODE_REPOSITORY } from '../tokens/kinguin.tokens';
import type { IKinguinCodeRepository } from '../../../domain/kinguin/ports/kinguin-code.repository.port';
import { hashCode } from '../../../shared/utils/kinguin-hash.util';

export interface DisableKinguinCodeCommand {
  code: string;
}

/**
 * Disables a Kinguin promo code by its raw value.
 * The code is hashed before lookup to match the stored hash.
 */
@Injectable()
export class DisableKinguinCodeUseCase {
  constructor(
    @Inject(KINGUIN_CODE_REPOSITORY)
    private readonly codeRepo: IKinguinCodeRepository,
  ) {}

  async execute(
    cmd: DisableKinguinCodeCommand,
  ): Promise<
    | { ok: true; value: undefined }
    | { ok: false; error: KinguinCodeNotFoundError }
  > {
    const codeHash = hashCode(cmd.code.trim());
    const found = await this.codeRepo.disableCode(codeHash);
    if (!found) {
      return Err(new KinguinCodeNotFoundError());
    }
    return Ok(undefined);
  }
}

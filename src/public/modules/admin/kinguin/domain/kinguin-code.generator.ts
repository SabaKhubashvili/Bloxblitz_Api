import { createHash, randomBytes } from 'crypto';
import {
  KINGUIN_CODE_PREFIX,
  KINGUIN_RANDOM_BYTES,
  KINGUIN_CODE_SEPARATOR,
} from './kinguin-code.rule';

export function generateKinguinCode(amount:number): {raw:string,hashed:string} {
  const random = randomBytes(KINGUIN_RANDOM_BYTES)
    .toString('hex')
    .toUpperCase();
  const code = `${KINGUIN_CODE_PREFIX}${KINGUIN_CODE_SEPARATOR}${random}${KINGUIN_CODE_SEPARATOR}${amount}`;
  return {raw:code,hashed:hashCode(code)} ;
}


export function hashCode(code: string, salt?: string): string {
  return createHash('sha256')
    .update(salt ? code + salt : code)
    .digest('hex')
}
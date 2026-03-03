import type { ProfileOutputDto } from '../dto/profile.output-dto.js';

export interface IProfileCachePort {
  get(username: string): Promise<ProfileOutputDto | null>;
  set(username: string, data: ProfileOutputDto, ttlSeconds?: number): Promise<void>;
  invalidate(username: string): Promise<void>;
}

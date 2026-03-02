import { UserSeed } from '../entities/user-seed.entity.js';

export interface IUserSeedRepository {
  findByusername(username: string): Promise<UserSeed | null>;
}

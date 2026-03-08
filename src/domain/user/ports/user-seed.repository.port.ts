import { UserSeed } from '../entities/user-seed.entity';

export interface IUserSeedRepository {
  findByusername(username: string): Promise<UserSeed | null>;
}

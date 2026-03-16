import { PrivateProfileOutputDto, ProfileOutputDto, PublicProfileOutputDto } from "../dto/profile.output-dto";


export interface IProfileCachePort {
  get(username: string): Promise<ProfileOutputDto | null>;
  set(username: string, data: ProfileOutputDto, ttlSeconds?: number): Promise<void>;
  invalidate(username: string): Promise<void>;

  getPublic(username: string): Promise<Omit<PublicProfileOutputDto,'isOnline'> | PrivateProfileOutputDto | null>;
  setPublic(username: string, data: Omit<PublicProfileOutputDto,'isOnline'> | PrivateProfileOutputDto, ttlSeconds?: number): Promise<void>;
  invalidatePublic(username: string): Promise<void>;

  getOnlineStatus(username: string): Promise<boolean | null>;
}

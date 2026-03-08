import { MinesGame } from '../entities/mines-game.entity';

export interface IMinesGameRepository {
  findActiveByusername(username: string): Promise<MinesGame | null>;
  findById(id: string): Promise<MinesGame | null>;
  save(game: MinesGame): Promise<void>;
  update(game: MinesGame): Promise<void>;
  deleteActiveGame(username: string): Promise<void>;
  deleteGame(id: string): Promise<void>;
}

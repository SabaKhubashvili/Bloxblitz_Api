import { Inject, Injectable } from '@nestjs/common';
import type {
  IRaceRepository,
  RaceLeaderboardEntry,
  RaceRecord,
  RaceRewardRecord,
} from '../../../domain/race/ports/race.repository.port';
import { RACE_REPOSITORY } from '../tokens/race.tokens';

export interface PreviousRaceView {
  race: RaceRecord;
  rewardDistribution: RaceRewardRecord[];
  top10: RaceLeaderboardEntry[];
  winner: RaceLeaderboardEntry | null;
}

@Injectable()
export class GetPreviousRacesUseCase {
  constructor(
    @Inject(RACE_REPOSITORY) private readonly raceRepository: IRaceRepository,
  ) {}

  async execute(offset: number, limit: number): Promise<PreviousRaceView[]> {
    const races = await this.raceRepository.listFinishedRaces(offset, limit);
    if (races.length === 0) {
      return [];
    }

    const ids = races.map((r) => r.id);
    const [topByRace, rewardsByRace] = await Promise.all([
      this.raceRepository.findLeaderboardTopForRaces(ids, 10),
      this.raceRepository.findRewardsByRaceIds(ids),
    ]);

    return races.map((race) => {
      const top10 = topByRace.get(race.id) ?? [];
      return {
        race,
        rewardDistribution: rewardsByRace.get(race.id) ?? [],
        top10,
        winner: top10[0] ?? null,
      };
    });
  }
}

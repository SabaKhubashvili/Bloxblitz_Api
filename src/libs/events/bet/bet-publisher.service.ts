import { Injectable } from "@nestjs/common";
import { RedisService } from "src/provider/redis/redis.service";
import { BetPlacedEvent } from "./bet-placed.dto";

@Injectable()
export class BetsPublisher {
  constructor(private readonly redis:RedisService) {}

  async publishBet(event: BetPlacedEvent) {
    await this.redis.mainClient.publish(
      'bet.placed',
      JSON.stringify(event),
    );
  }
}

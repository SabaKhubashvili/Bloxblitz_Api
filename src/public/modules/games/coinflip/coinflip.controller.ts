import { Body, Controller, Post } from "@nestjs/common";
import { VerifyCoinflipGameDto } from "./dto/verify-coinflip-game.dto";
import { CoinflipService } from "./coinflip.service";

@Controller('games/coinflip')
export class CoinflipController {
    constructor(private readonly coinflipService: CoinflipService) {}
    @Post('verify')
    async verifyCoinflipGame(@Body() dto: VerifyCoinflipGameDto) {
       return this.coinflipService.verify(dto);
    }
}
import { IsInt, Min, Max, IsIn, Validate } from 'class-validator';
import { TwoDecimalPlacesRegex } from 'src/class-validator/TwoDecimalPlacesRegex.validator';


export class CreateGameDto {
  @Min(0.01, { message: 'Bet amount must be at least 0.01' })
  @Max(3000, { message: 'Bet amount must not exceed 3000' })
  @Validate(TwoDecimalPlacesRegex)
  betAmount: number;

  @IsInt()
  @IsIn([16, 25, 36, 64, 100], { message: 'Grid must be 16, 25, 36, 64, or 100' })
  gridSize: 16 | 25 | 36 | 64 | 100;

  @IsInt()
  @Min(1)
  @Max(24)
  mineCount: number;
}

import { IsNotEmpty, IsString } from "class-validator";

export class GetUserClientSeedDto {
  @IsString()
  @IsNotEmpty()
  username: string;
}
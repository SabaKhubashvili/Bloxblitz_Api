import { IsEnum } from "class-validator";

export enum RakebackType {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
}

export class ClaimRakebackDto {
  @IsEnum(RakebackType, {
    message: "type must be one of: daily, weekly, monthly",
  })
  type!: RakebackType;
}